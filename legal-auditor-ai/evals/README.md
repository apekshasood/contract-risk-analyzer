# Evals

Measures how many real risks the auditor catches, on contracts a human has marked by hand.

## Add a case

1. Put the contract in `cases/` (`.pdf`, or `.txt` for a quick synthetic one).
2. Read it yourself and list every risk a careful lawyer would flag for the chosen `role`.
3. Write `cases/<name>.json`:

```json
{
  "name": "my-lease",
  "contract": "my-lease.pdf",
  "role": "tenant",
  "context": "",
  "expected": [
    { "id": "deposit-forfeit", "severity": "High", "match": ["deposit"] }
  ]
}
```

`match` holds short phrases. A finding counts as catching the risk if any phrase appears in its title, quote or issue (case and spacing ignored). One finding can only catch one risk.

Don't commit contracts that hold personal data. Use public templates or remove names first.

## Run

From `legal-auditor-ai/`:

```bash
python -m evals.score --save-to evals/out     # live, needs OPENAI_API_KEY, costs money
python -m evals.score --saved evals/out       # re-score saved outputs, free
python -m unittest evals.test_score           # tests for the scorer itself
```

## What the numbers mean

- **Recall, all / High**: share of hand-marked risks the audit found. High recall is the resume number.
- **extra**: findings that match no label. Read them: some are noise, some are risks you missed when labelling.
- **Unverified quotes**: risky findings whose quote was not found in the PDF (`verified: false`), a hallucination signal.
