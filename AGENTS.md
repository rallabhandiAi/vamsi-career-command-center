# Vamsi Career Command Center — frontend rules

This repository is public and contains application code only. The private repository `rallabhandiAi/vamsi-career-command-center-data` is the canonical source for opportunities, contacts, applications, tasks and candidate details.

## Non-negotiable rules

1. Never commit real opportunity records, recruiter notes, application history, immigration details, contact details or generated private dashboard data to this repository. This includes hard-coding employer names, requisition IDs, interview steps, home location or work-authorization status in UI source.
2. Keep `public/generated/dashboard.json` as a safe empty placeholder in public source. A private snapshot may overwrite it only in a local or deployment workspace.
3. Read the private data repository's `AGENTS.md` before changing schemas, field meanings or generator behavior.
4. Preserve the private dashboard's decision-first hierarchy: current interview focus, action queue, ranked opportunities, pipeline, contacts and activity history.
5. Preserve the visible search policy. The public default is Senior Manager and above with credible total compensation of at least $190K; the full policy, including work-authorization requirements, comes from the private `profile.json` field `search_policy` (array of strings), which replaces the default when present (`meta.json` `search_policy` is a fallback).
6. Writes go only to the private data repository, through the GitHub API with the viewer's own fine-grained token (Contents: Read and write), following that repository's `AGENTS.md`. Vamsi approved on 2026-10-05 editing of these human-controlled fields from the dashboard: application stage, posting status, priority, applied date, pipeline phase, next step (`status_detail`) and task completion. Every save is one atomic commit (`Tracker: …`) that includes an `activity.json` event. Do not add other write actions (recruiter messages, contact updates) without explicit user approval.
7. Run `pnpm build` after frontend changes. Run the private data validator before generating a deployment snapshot.

## How the dashboard derives its focus

The Today banner and Interview Center are derived from the private data, not from code:

- The **primary focus** is the highest-priority active opportunity in a live stage (Offer, Final Interview, Team Matching, Interview, Assessment, Recruiter Screen, Hiring Manager), then the opportunity linked to the most urgent open task.
- The banner headline is that opportunity's most urgent open task (`tasks[].title`), with `tasks[].details` or `tracking.status_detail` as supporting text.
- The evaluation path maps `tracking.application_stage` onto a generic six-step process. Employer-specific interview steps belong in tasks, not in code.

## Editing from the dashboard

- `lib/github-data.ts` reads with the Contents API and saves with the Git Data API: read the branch head, re-apply the intended edits to the latest files, create one commit, and fast-forward the branch. If the branch moved, it re-reads and re-applies; it never force-pushes.
- `lib/json-edit.ts` changes only the affected values so the data files keep their hand-tuned layout (two-space indentation, inline small objects, trailing newline).
- Saved rows use `updated_by: "vamsi-dashboard"`. Activity events use types `tracker_update`, `task_completed` and `task_reopened`.
- A role is "closed out" (hidden from active views, listed under Opportunities → Closed out) when its stage is Rejected or Withdrawn, or its posting is Closed while no application is in motion.

## Deployment

`.github/workflows/pages.yml` builds a static export and deploys it to GitHub Pages on every push to `main`. Pages must be enabled once with **Settings → Pages → Source: GitHub Actions**.

## Data generation

```bash
node scripts/generate-dashboard-data.mjs /path/to/vamsi-career-command-center-data/data
```

The generated snapshot is deployment input, not public repository content.
