// Browser-side access to the private data repository through the GitHub API,
// using the viewer's own fine-grained token. Reads use the Contents API; saves
// build one atomic commit with the Git Data API so a stage change, its posting
// update and its activity entry land together. Following the data repo's
// AGENTS.md, every save re-reads the latest commit and re-applies only the
// intended edits when someone else (for example a ChatGPT search run) committed
// first, and never force-pushes.

import { JsonDocument } from "@/lib/json-edit";

export type GitHubSettings = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
};

export class GitHubError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const TOKEN_SETTINGS_URL = "https://github.com/settings/personal-access-tokens";

const API = "https://api.github.com";

function decodeBase64Utf8(content: string) {
  const binary = atob(content.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function request(
  settings: GitHubSettings,
  path: string,
  options: { method?: string; body?: unknown; accept?: string } = {},
) {
  return fetch(
    `${API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}${path}`,
    {
      method: options.method ?? "GET",
      headers: {
        Accept: options.accept ?? "application/vnd.github+json",
        Authorization: `Bearer ${settings.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    },
  );
}

function readError(status: number, name: string) {
  if (status === 401) return new GitHubError("GitHub rejected the token. Confirm that it is active and copied completely.", status);
  if (status === 403) return new GitHubError("The token cannot read this repository. Grant it Contents access to the private data repository.", status);
  if (status === 404) return new GitHubError("The private data repository or branch could not be found with this token.", status);
  return new GitHubError(`GitHub returned ${status} while loading ${name}.`, status);
}

function writeError(status: number) {
  if (status === 401) return new GitHubError("GitHub rejected the token. Confirm that it is active, then reconnect.", status);
  if (status === 403 || status === 404) {
    return new GitHubError("This token can only read. On GitHub, edit the token and set Repository permissions → Contents to Read and write, then save again.", status);
  }
  return new GitHubError(`GitHub returned ${status} while saving. Nothing was changed; try again.`, status);
}

/** Read a file under data/ as text, at a branch or commit. */
export async function readDataText(settings: GitHubSettings, name: string, ref = settings.branch) {
  const path = `/contents/data/${encodeURIComponent(name)}?ref=${encodeURIComponent(ref)}`;
  const response = await request(settings, path);
  if (!response.ok) throw readError(response.status, name);
  const payload = (await response.json()) as { content?: string; encoding?: string };
  if (payload.encoding === "base64" && payload.content) return decodeBase64Utf8(payload.content);
  // Files larger than 1 MB arrive without inline content; fetch the raw bytes.
  const raw = await request(settings, path, { accept: "application/vnd.github.raw+json" });
  if (!raw.ok) throw readError(raw.status, name);
  return raw.text();
}

export async function readDataJson<T = unknown>(settings: GitHubSettings, name: string): Promise<T> {
  return JSON.parse(await readDataText(settings, name)) as T;
}

export type FileEdit = { name: string; apply: (doc: JsonDocument) => void };

/** Commit edits to several data files as one commit on the configured branch. */
export async function commitDataEdits(settings: GitHubSettings, message: string, edits: FileEdit[]) {
  const branch = encodeURIComponent(settings.branch);
  for (let attempt = 0; attempt < 4; attempt++) {
    const refResponse = await request(settings, `/git/ref/heads/${branch}`);
    if (!refResponse.ok) throw readError(refResponse.status, "the branch");
    const head = ((await refResponse.json()) as { object: { sha: string } }).object.sha;
    const headCommit = await request(settings, `/git/commits/${head}`);
    if (!headCommit.ok) throw readError(headCommit.status, "the latest commit");
    const baseTree = ((await headCommit.json()) as { tree: { sha: string } }).tree.sha;

    const tree: { path: string; mode: "100644"; type: "blob"; content: string }[] = [];
    const files: Record<string, unknown> = {};
    for (const edit of edits) {
      const before = await readDataText(settings, edit.name, head);
      const doc = new JsonDocument(before);
      edit.apply(doc);
      const after = doc.toString();
      files[edit.name] = JSON.parse(after);
      if (after !== before) tree.push({ path: `data/${edit.name}`, mode: "100644", type: "blob", content: after });
    }
    if (!tree.length) return { sha: head, files };

    const treeResponse = await request(settings, "/git/trees", { method: "POST", body: { base_tree: baseTree, tree } });
    if (!treeResponse.ok) throw writeError(treeResponse.status);
    const newTree = ((await treeResponse.json()) as { sha: string }).sha;
    const commitResponse = await request(settings, "/git/commits", {
      method: "POST",
      body: { message, tree: newTree, parents: [head] },
    });
    if (!commitResponse.ok) throw writeError(commitResponse.status);
    const commit = ((await commitResponse.json()) as { sha: string }).sha;

    const update = await request(settings, `/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: { sha: commit, force: false },
    });
    if (update.ok) return { sha: commit, files };
    // 422 means the branch moved since we read it: re-read and re-apply.
    if (update.status !== 422 && update.status !== 409) throw writeError(update.status);
  }
  throw new GitHubError("The data repository kept changing while saving. Wait a moment and try again.", 409);
}
