import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceDir = process.argv[2];
if (!sourceDir) {
  throw new Error("Usage: node scripts/generate-dashboard-data.mjs <career-data-directory>");
}

const load = async (name) =>
  JSON.parse(await readFile(path.join(sourceDir, name), "utf8"));

const [opportunitiesDoc, trackingDoc, tasksDoc, contactsDoc, activityDoc, resumesDoc, profileDoc, metaDoc] =
  await Promise.all([
    load("opportunities.json"),
    load("tracking.json"),
    load("tasks.json"),
    load("contacts.json"),
    load("activity.json"),
    load("resumes.json"),
    load("profile.json"),
    load("meta.json"),
  ]);

const trackingByOpportunity = new Map(
  trackingDoc.tracking.map((item) => [item.opportunity_id, item]),
);

const opportunities = opportunitiesDoc.opportunities.map((opportunity) => ({
  ...opportunity,
  tracking: trackingByOpportunity.get(opportunity.id) ?? {
    application_stage: "Researching",
    pipeline_phase: "Not started",
    status_detail: "No workflow state recorded",
    contact_ids: [],
    referral_ids: [],
  },
}));

const output = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  profile: profileDoc,
  opportunities,
  tasks: tasksDoc.tasks,
  contacts: contactsDoc.contacts,
  activities: activityDoc.activities,
  resumes: resumesDoc.resumes,
  meta: metaDoc,
};

const outputDir = path.resolve("public/generated");
await mkdir(outputDir, { recursive: true });
await writeFile(
  path.join(outputDir, "dashboard.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(`Generated dashboard data with ${opportunities.length} opportunities.`);
