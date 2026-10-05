// Format-preserving JSON edits.
//
// The private data repository keeps hand-tuned JSON layouts (inline score
// objects, one-line activity events) and its AGENTS.md asks writers to preserve
// them. Instead of re-serializing whole files, these helpers locate the exact
// text span of each value and replace or insert only what changes, so a
// dashboard save produces a minimal, reviewable diff.

type Path = (string | number)[];
type Scalar = string | number | boolean | null;

type ObjectEntry = { key: string; keyStart: number; value: JsonNode };
type JsonNode =
  | { kind: "object"; start: number; end: number; entries: ObjectEntry[] }
  | { kind: "array"; start: number; end: number; items: JsonNode[] }
  | { kind: "scalar"; start: number; end: number };

function parseSpans(text: string): JsonNode {
  let i = 0;
  const fail = (message: string): never => {
    throw new Error(`Unreadable JSON at character ${i}: ${message}`);
  };
  const skipWhitespace = () => {
    while (i < text.length && (text[i] === " " || text[i] === "\n" || text[i] === "\r" || text[i] === "\t")) i++;
  };
  const readString = (): string => {
    const start = i;
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (text[i] !== '"') fail("unterminated string");
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const readValue = (): JsonNode => {
    skipWhitespace();
    const start = i;
    if (text[i] === "{") {
      i++;
      const entries: ObjectEntry[] = [];
      skipWhitespace();
      if (text[i] === "}") {
        i++;
        return { kind: "object", start, end: i, entries };
      }
      for (;;) {
        skipWhitespace();
        if (text[i] !== '"') fail("expected a key");
        const keyStart = i;
        const key = readString();
        skipWhitespace();
        if (text[i] !== ":") fail("expected ':'");
        i++;
        entries.push({ key, keyStart, value: readValue() });
        skipWhitespace();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return { kind: "object", start, end: i, entries };
        }
        fail("expected ',' or '}'");
      }
    }
    if (text[i] === "[") {
      i++;
      const items: JsonNode[] = [];
      skipWhitespace();
      if (text[i] === "]") {
        i++;
        return { kind: "array", start, end: i, items };
      }
      for (;;) {
        items.push(readValue());
        skipWhitespace();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { kind: "array", start, end: i, items };
        }
        fail("expected ',' or ']'");
      }
    }
    if (text[i] === '"') {
      readString();
      return { kind: "scalar", start, end: i };
    }
    const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
    if (!literal) fail("unexpected token");
    i += literal![0].length;
    return { kind: "scalar", start, end: i };
  };
  const root = readValue();
  skipWhitespace();
  if (i !== text.length) fail("unexpected trailing content");
  return root;
}

const isContainer = (value: unknown): value is object => value !== null && typeof value === "object";

function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(", ")}]`;
  if (isContainer(value)) {
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${inlineJson(item)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

// Block layout used by the data files: containers holding only scalars stay on
// one line; containers holding other containers break across lines.
function blockJson(value: unknown, indent: string): string {
  if (!isContainer(value)) return JSON.stringify(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  if (!children.length || children.every((child) => !isContainer(child))) return inlineJson(value);
  const inner = `${indent}  `;
  const lines = Array.isArray(value)
    ? value.map((item) => `${inner}${blockJson(item, inner)}`)
    : Object.entries(value).map(([key, item]) => `${inner}${JSON.stringify(key)}: ${blockJson(item, inner)}`);
  return `${Array.isArray(value) ? "[" : "{"}\n${lines.join(",\n")}\n${indent}${Array.isArray(value) ? "]" : "}"}`;
}

export class JsonDocument {
  readonly data: unknown;
  private readonly text: string;
  private readonly root: JsonNode;
  private readonly edits = new Map<string, { start: number; end: number; text: string; order: number }>();
  private counter = 0;

  constructor(text: string) {
    this.text = text;
    this.root = parseSpans(text);
    this.data = JSON.parse(text);
  }

  private find(path: Path): JsonNode | undefined {
    let node: JsonNode | undefined = this.root;
    for (const step of path) {
      if (!node) return undefined;
      if (node.kind === "object" && typeof step === "string") node = node.entries.find((entry) => entry.key === step)?.value;
      else if (node.kind === "array" && typeof step === "number") node = node.items[step];
      else return undefined;
    }
    return node;
  }

  private indentAt(position: number): string | null {
    const lineStart = this.text.lastIndexOf("\n", position - 1) + 1;
    const lead = this.text.slice(lineStart, position);
    return /^[ \t]*$/.test(lead) ? lead : null;
  }

  private edit(id: string, start: number, end: number, text: string) {
    this.edits.set(id, { start, end, text, order: this.counter++ });
  }

  /** Replace a scalar value, or add the key to its object when it is missing. */
  set(path: Path, value: Scalar) {
    const node = this.find(path);
    if (node) {
      if (node.kind !== "scalar") throw new Error(`Refusing to overwrite a nested value at ${path.join(".")}`);
      this.edit(`set:${node.start}`, node.start, node.end, JSON.stringify(value));
      return;
    }
    const key = path[path.length - 1];
    const parent = this.find(path.slice(0, -1));
    if (typeof key !== "string" || !parent || parent.kind !== "object") {
      throw new Error(`Cannot set ${path.join(".")}`);
    }
    const id = `key:${parent.start}:${key}`;
    const last = parent.entries[parent.entries.length - 1];
    if (!last) {
      this.edit(id, parent.start + 1, parent.start + 1, `${JSON.stringify(key)}: ${JSON.stringify(value)}`);
      return;
    }
    const multiline = this.text.slice(parent.start, parent.end).includes("\n");
    const indent = multiline ? this.indentAt(last.keyStart) : null;
    const separator = indent !== null ? `,\n${indent}` : ", ";
    this.edit(id, last.value.end, last.value.end, `${separator}${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }

  /** Append an element to an array, matching the layout of its last element. */
  append(path: Path, element: Record<string, unknown>) {
    const node = this.find(path);
    if (!node || node.kind !== "array") throw new Error(`No array at ${path.join(".")}`);
    const id = `append:${node.start}:${this.counter}`;
    const last = node.items[node.items.length - 1];
    if (!last) {
      const lineStart = this.text.lastIndexOf("\n", node.start - 1) + 1;
      const base = /^[ \t]*/.exec(this.text.slice(lineStart))![0];
      const indent = `${base}  `;
      this.edit(id, node.start + 1, node.start + 1, `\n${indent}${blockJson(element, indent)}\n${base}`);
      return;
    }
    const indent = this.indentAt(last.start);
    const singleLine = !this.text.slice(last.start, last.end).includes("\n");
    const rendered = singleLine ? inlineJson(element) : blockJson(element, indent ?? "");
    this.edit(id, last.end, last.end, indent !== null ? `,\n${indent}${rendered}` : `, ${rendered}`);
  }

  toString(): string {
    const ordered = [...this.edits.values()].sort((a, b) => b.start - a.start || b.order - a.order);
    let output = this.text;
    for (const change of ordered) output = output.slice(0, change.start) + change.text + output.slice(change.end);
    JSON.parse(output);
    return output;
  }
}
