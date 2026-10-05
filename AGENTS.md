# Vamsi Career Command Center — frontend rules

This repository is public and contains application code only. The private repository `rallabhandiAi/vamsi-career-command-center-data` is the canonical source for opportunities, contacts, applications, tasks and candidate details.

## Non-negotiable rules

1. Never commit real opportunity records, recruiter notes, application history, immigration details, contact details or generated private dashboard data to this repository.
2. Keep `public/generated/dashboard.json` as a safe empty placeholder in public source. A private snapshot may overwrite it only in a local or deployment workspace.
3. Read the private data repository's `AGENTS.md` before changing schemas, field meanings or generator behavior.
4. Preserve the private dashboard's decision-first hierarchy: current interview focus, action queue, ranked opportunities, pipeline, contacts and activity history.
5. Preserve the visible search policy: Senior Manager and above, credible total compensation of at least $190K, and H-1B compatibility.
6. Do not add write actions for applications, recruiter messages or contact updates without explicit user approval and a private backend.
7. Run `pnpm build` after frontend changes. Run the private data validator before generating a deployment snapshot.

## Data generation

```bash
node scripts/generate-dashboard-data.mjs /path/to/vamsi-career-command-center-data/data
```

The generated snapshot is deployment input, not public repository content.
