"""Score the auditor against hand-marked contracts.

Each case is a JSON label file in evals/cases/ next to its contract (.pdf or .txt).
A label says which risks a careful human expects the audit to flag.

    python -m evals.score                 # live: calls OpenAI for every case
    python -m evals.score --saved out/    # offline: score saved audit JSON, no API key
"""
import argparse
import json
import re
import time
from pathlib import Path

CASES_DIR = Path(__file__).parent / "cases"


def _normalize(s: str | None) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def match_findings(expected: list[dict], clauses: list[dict]) -> dict[str, int | None]:
    """Map each expected risk id -> index of the finding that covers it (or None).

    A finding covers a risk if any of the risk's `match` phrases appears in the
    finding's title, quote or issue. One finding can cover only one risk, so a
    single vague finding can't score several points.
    """
    used: set[int] = set()
    result: dict[str, int | None] = {}
    for risk in expected:
        phrases = [_normalize(p) for p in risk["match"]]
        result[risk["id"]] = None
        for i, c in enumerate(clauses):
            if i in used:
                continue
            haystack = _normalize(" ".join([c.get("title", ""), c.get("quote") or "", c.get("issue", "")]))
            if any(p in haystack for p in phrases):
                result[risk["id"]] = i
                used.add(i)
                break
    return result


def score_case(label: dict, audit: dict) -> dict:
    expected = label["expected"]
    clauses = audit["clauses"]
    matches = match_findings(expected, clauses)

    high = [r["id"] for r in expected if r["severity"] == "High"]
    risky = [c for c in clauses if c["type"] == "risky"]
    return {
        "case": label["name"],
        "found": sum(1 for v in matches.values() if v is not None),
        "expected": len(expected),
        "high_found": sum(1 for r in high if matches[r] is not None),
        "high_expected": len(high),
        "missed": [r for r, v in matches.items() if v is None],
        # findings that match no label: not always wrong (labels can be incomplete), review by hand
        "extra": len(clauses) - sum(1 for v in matches.values() if v is not None),
        "unverified_quotes": sum(1 for c in risky if c.get("verified") is False),
        "risky_findings": len(risky),
    }


def load_cases() -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted(CASES_DIR.glob("*.json"))]


def contract_text(label: dict) -> str:
    path = CASES_DIR / label["contract"]
    if path.suffix == ".txt":
        return f"[Page 1]\n{path.read_text()}"  # same page tag format as extract_text_from_pdf
    from app.services.auditor import extract_text_from_pdf
    return extract_text_from_pdf(path.read_bytes())


def run_live(label: dict) -> tuple[dict, float]:
    # imported here: auditor needs OPENAI_API_KEY at import time, offline mode must not
    from app.services.auditor import audit_contract_text
    start = time.perf_counter()
    result = audit_contract_text(contract_text(label), label.get("context", ""), label["role"])
    return result.model_dump(), time.perf_counter() - start


def pct(a: int, b: int) -> str:
    return f"{100 * a / b:.0f}%" if b else "n/a"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saved", type=Path, help="folder with <case name>.json audit outputs")
    parser.add_argument("--save-to", type=Path, help="write live audit outputs here for later re-scoring")
    args = parser.parse_args()

    rows, latencies = [], []
    for label in load_cases():
        if args.saved:
            audit = json.loads((args.saved / f"{label['name']}.json").read_text())
        else:
            audit, seconds = run_live(label)
            latencies.append(seconds)
            if args.save_to:
                args.save_to.mkdir(parents=True, exist_ok=True)
                (args.save_to / f"{label['name']}.json").write_text(json.dumps(audit, indent=2))
        row = score_case(label, audit)
        rows.append(row)
        print(f"{row['case']:<24} {row['found']}/{row['expected']} found, "
              f"high {row['high_found']}/{row['high_expected']}, extra {row['extra']}, "
              f"unverified quotes {row['unverified_quotes']}, missed {row['missed']}")

    total = lambda k: sum(r[k] for r in rows)
    print(f"\nRecall, all risks:  {pct(total('found'), total('expected'))}")
    print(f"Recall, High risks: {pct(total('high_found'), total('high_expected'))}")
    print(f"Unverified quotes:  {pct(total('unverified_quotes'), total('risky_findings'))}")
    if latencies:
        print(f"Latency per contract: avg {sum(latencies) / len(latencies):.1f}s, max {max(latencies):.1f}s")


if __name__ == "__main__":
    main()
