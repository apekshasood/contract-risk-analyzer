import json
import unittest
from pathlib import Path

from evals.score import CASES_DIR, match_findings, score_case

FIXTURES = Path(__file__).parent / "fixtures"


class ScoreTest(unittest.TestCase):
    def test_sample_case(self):
        label = json.loads((CASES_DIR / "sample-lease.json").read_text())
        audit = json.loads((FIXTURES / "sample-lease.json").read_text())
        row = score_case(label, audit)
        self.assertEqual((row["found"], row["expected"]), (3, 7))
        self.assertEqual((row["high_found"], row["high_expected"]), (3, 4))
        self.assertEqual(row["extra"], 1)
        self.assertEqual(row["unverified_quotes"], 1)
        self.assertIn("one-sided-termination", row["missed"])

    def test_one_finding_counts_once(self):
        expected = [
            {"id": "a", "severity": "High", "match": ["deposit"]},
            {"id": "b", "severity": "High", "match": ["deposit"]},
        ]
        clauses = [{"title": "Deposit risk", "type": "risky", "quote": None, "issue": ""}]
        self.assertEqual(match_findings(expected, clauses), {"a": 0, "b": None})

    def test_match_ignores_case_and_spacing(self):
        expected = [{"id": "a", "severity": "Low", "match": ["late   FEE"]}]
        clauses = [{"title": "", "type": "risky", "quote": "A Late\nfee applies", "issue": ""}]
        self.assertEqual(match_findings(expected, clauses), {"a": 0})


if __name__ == "__main__":
    unittest.main()
