# Supabase

Schema, Row Level Security and the storage bucket live in `migrations/`.

## Apply

**Option A — SQL editor (no CLI):** open your project → SQL Editor → paste
each file in `migrations/` in name order → Run. Run each only once:
`20261117000000_documents_audits.sql`, then `20261120000000_audits_realtime.sql`.

**Option B — CLI:**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## What it creates

| Object | Purpose |
| --- | --- |
| `documents` | One row per uploaded PDF (`storage_path` points into the bucket) |
| `audits` | One AI run on a document: `queued → processing → done / failed` |
| bucket `contracts` | Private, PDF only, 10 MB max, files under `<user_id>/...` |

Users can read and create only their own rows and files. Only the backend,
using the `service_role` key, can change an audit's status or result.
**Never ship the `service_role` key to the browser.**
