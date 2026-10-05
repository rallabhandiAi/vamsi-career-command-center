# Vamsi Career Command Center — frontend rules

This repository is public and contains application code only. The private repository `rallabhandiAi/vamsi-career-command-center-data` is the canonical source for opportunities, contacts, applications, tasks and candidate details.

## Non-negotiable rules

1. Never commit real opportunity records, recruiter notes, application history, immigration details, contact details or generated private dashboard data to this repository. This includes hard-coding employer names, requisition IDs, interview steps, home location or work-authorization status in UI source.
2. Keep `public/generated/dashboard.json` as a safe empty placeholder in public source. A private snapshot may overwrite it only in a local or deployment workspace.
3. Read the private data repository's `AGENTS.md` before changing schemas, field meanings or generator behavior.
4. Preserve the private dashboard's decision-first hierarchy: current interview focus, action queue, ranked opportunities, pipeline, contacts and activity history.
5. Preserve the visible search policy. The public default is Senior Manager and above with credible total compensation of at least $190K; the full policy, including work-authorization requirements, comes from the private `meta.json` field `search_policy` (array of strings), which replaces the default when present.
6. Do not add write actions for applications, recruiter messages or contact updates without explicit user approval and a private backend.
7. Run `pnpm build` after frontend changes. Run the private data validator before generating a deployment snapshot.

## How the dashboard derives its focus

The Today banner and Interview Center are derived from the private data, not from code:

- The **primary focus** is the highest-priority active opportunity in a live stage (Offer, Final Interview, Team Matching, Interview, Assessment, Recruiter Screen, Hiring Manager), then the opportunity linked to the most urgent open task.
- The banner headline is that opportunity's most urgent open task (`tasks[].title`), with `tasks[].details` or `tracking.status_detail` as supporting text.
- The evaluation path maps `tracking.application_stage` onto a generic six-step process. Employer-specific interview steps belong in tasks, not in code.

## Deployment

`.github/workflows/pages.yml` builds a static export and deploys it to GitHub Pages on every push to `main`. Pages must be enabled once with **Settings → Pages → Source: GitHub Actions**.

## Data generation

```bash
node scripts/generate-dashboard-data.mjs /path/to/vamsi-career-command-center-data/data
```

The generated snapshot is deployment input, not public repository content.
