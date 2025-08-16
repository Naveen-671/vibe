// parser.ts
export type FileMap = Record<string, string>;

/* ----------------- type guards ----------------- */

/** runtime check for plain object (non-null) */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** runtime check for file entry { path: string, content: string } */
function isFileEntry(value: unknown): value is { path: string; content: string } {
  return isRecord(value) && typeof (value as Record<string, unknown>).path === "string" && typeof (value as Record<string, unknown>).content === "string";
}

/* ----------------- utilities ----------------- */

function safeUnescapeContent(s: string): string {
  if (typeof s !== "string") return "";
  let out = s.trim();

  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'")) ||
    (out.startsWith("`") && out.endsWith("`"))
  ) {
    out = out.slice(1, -1);
  }

  out = out.replace(/\\\\/g, "\\");
  out = out.replace(/\\n/g, "\n");
  out = out.replace(/\\r/g, "\r");
  out = out.replace(/\\t/g, "\t");
  out = out.replace(/\\"/g, '"');
  out = out.replace(/\\'/g, "'");

  return out;
}

function findMatchingIndex(text: string, startIdx: number, openCh: string, closeCh: string): number {
  let depth = 0;
  let inString: string | null = null;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }

    if (inString) {
      if (ch === inString) inString = null;
      continue;
    } else {
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }
    }

    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalizeToJsonLike(input: string): string {
  let s = input.trim();

  s = s.replace(/`([\s\S]*?)`/g, (_m, inner) => {
    const esc = inner.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    return `"${esc}"`;
  });

  s = s.replace(/'([^']*?)'/g, (_m, inner) => {
    const esc = inner.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    return `"${esc}"`;
  });

  s = s.replace(/([{,]\s*)([A-Za-z0-9_\-./$]+)\s*:/g, (_m, pre, key) => `${pre}"${key}":`);
  return s;
}

/* ----------------- createOrUpdateFiles block parser ----------------- */

function parseCreateOrUpdateBlock(inner: string): FileMap {
  const out: FileMap = {};
  let i = 0;
  const N = inner.length;

  while (i < N) {
    while (i < N && /\s|,/.test(inner[i])) i++;
    if (i >= N) break;

    let key = "";
    if (inner[i] === '"' || inner[i] === "'" || inner[i] === "`") {
      const quote = inner[i];
      i++;
      let buf = "";
      while (i < N) {
        if (inner[i] === "\\" && i + 1 < N) {
          buf += inner[i] + inner[i + 1];
          i += 2;
          continue;
        }
        if (inner[i] === quote) {
          i++;
          break;
        }
        buf += inner[i++];
      }
      key = buf;
      while (i < N && /\s/.test(inner[i])) i++;
      if (inner[i] === ":") i++;
    } else {
      let buf = "";
      while (i < N && inner[i] !== ":" && inner[i] !== "\n") {
        buf += inner[i++];
      }
      key = buf.trim();
      if (inner[i] === ":") i++;
    }

    while (i < N && /\s/.test(inner[i])) i++;
    if (i >= N) break;

    let value = "";
    const ch = inner[i];

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      let buf = "";
      while (i < N) {
        const cur = inner[i];
        if (cur === "\\" && i + 1 < N) {
          buf += cur + inner[i + 1];
          i += 2;
          continue;
        }
        if (cur === quote) {
          i++;
          break;
        }
        buf += cur;
        i++;
      }
      value = buf;
    } else if (ch === "{") {
      const matchIdx = findMatchingIndex(inner, i, "{", "}");
      if (matchIdx !== -1) {
        value = inner.slice(i, matchIdx + 1);
        i = matchIdx + 1;
      } else {
        value = inner.slice(i);
        i = N;
      }
    } else if (ch === "[") {
      const matchIdx = findMatchingIndex(inner, i, "[", "]");
      if (matchIdx !== -1) {
        value = inner.slice(i, matchIdx + 1);
        i = matchIdx + 1;
      } else {
        value = inner.slice(i);
        i = N;
      }
    } else {
      let buf = "";
      let depth = 0;
      let inStr: string | null = null;
      while (i < N) {
        const cur = inner[i];

        if (cur === "\\" && i + 1 < N) {
          buf += cur + inner[i + 1];
          i += 2;
          continue;
        }
        if (inStr) {
          buf += cur;
          if (cur === inStr) inStr = null;
          i++;
          continue;
        } else {
          if (cur === '"' || cur === "'" || cur === "`") {
            inStr = cur;
            buf += cur;
            i++;
            continue;
          }
        }

        if (cur === "{" || cur === "[") depth++;
        else if (cur === "}" || cur === "]") {
          if (depth > 0) depth--;
        } else if (cur === "," && depth === 0) {
          const lookahead = inner.slice(i + 1, i + 200);
          if (lookahead.match(/['"`]?\s*[A-Za-z0-9_\/\-.]+?\.(ts|tsx|js|jsx|json|css|html)\s*['"`]?\s*:/i)) {
            i++;
            break;
          }
        }
        buf += cur;
        i++;
      }
      value = buf.trim();
    }

    value = value.replace(/,\s*$/g, "");

    if (key) {
      out[key] = safeUnescapeContent(value);
    }
  }

  return out;
}

/* ----------------- other heuristics ----------------- */

function tryParseFilesArray(summary: string): FileMap | null {
  const res: FileMap = {};
  try {
    const filesArrayMatch = summary.match(/["']?files["']?\s*:\s*(\[[\s\S]*?\])/i);
    if (filesArrayMatch?.[1]) {
      const normalized = normalizeToJsonLike(filesArrayMatch[1]);
      const parsedRaw = JSON.parse(normalized) as unknown;
      if (Array.isArray(parsedRaw)) {
        for (const item of parsedRaw) {
          if (isFileEntry(item)) {
            res[item.path] = safeUnescapeContent(item.content);
          } else if (isRecord(item)) {
            const p = item["path"];
            const c = item["content"];
            if (typeof p === "string" && typeof c === "string") {
              res[p] = safeUnescapeContent(c);
            }
          }
        }
        if (Object.keys(res).length) return res;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

function extractCreateOrUpdateBlock(summary: string): string | null {
  const tokenIdx = summary.indexOf("createOrUpdateFiles");
  if (tokenIdx === -1) return null;
  const braceIdx = summary.indexOf("{", tokenIdx);
  if (braceIdx === -1) return null;
  const closeIdx = findMatchingIndex(summary, braceIdx, "{", "}");
  if (closeIdx === -1) return null;
  return summary.slice(braceIdx + 1, closeIdx);
}

function parseFencedCodeBlocks(summary: string): FileMap {
  const out: FileMap = {};
  const fenceRegex = /```(?:([\w-+.]+))?\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = fenceRegex.exec(summary)) !== null) {
    const lang = m[1] ?? "";
    const code = m[2] ?? "";
    const before = summary.slice(Math.max(0, m.index - 200), m.index);
    const hint = before.match(/(?:file|path|->|:)\s*([^\s\n\r]+?\.(ts|tsx|js|jsx|json|css|html))/i)?.[1] ?? null;
    const filename = hint ?? (lang.includes("ts") ? `app/component-${idx}.tsx` : `app/component-${idx}.txt`);
    out[filename] = safeUnescapeContent(code);
    idx++;
  }
  return out;
}

function parseQuotedKeyValues(summary: string): FileMap {
  const out: FileMap = {};
  const kvRegex = /['"`]([^'"`]+?\.(?:ts|tsx|js|jsx|json|css|html))['"`]\s*:\s*(['"`])([\s\S]*?)\2/gim;
  let m: RegExpExecArray | null;
  while ((m = kvRegex.exec(summary)) !== null) {
    const p = m[1];
    const raw = m[3];
    out[p] = safeUnescapeContent(raw);
  }
  return out;
}

function sweepJsonBlocksForFiles(summary: string): FileMap {
  const files: FileMap = {};
  try {
    const jsonBlockRegex = /(\{[\s\S]*?\})/g;
    let jb: RegExpExecArray | null;
    while ((jb = jsonBlockRegex.exec(summary)) !== null) {
      const candidate = jb[1];
      const normalized = normalizeToJsonLike(candidate);
      try {
        const parsed = JSON.parse(normalized) as unknown;
        if (!isRecord(parsed)) continue;

        const maybeFiles = parsed["files"];
        if (Array.isArray(maybeFiles)) {
          for (const it of maybeFiles) {
            if (isFileEntry(it)) {
              files[it.path] = safeUnescapeContent(it.content);
            } else if (isRecord(it)) {
              const p = it["path"];
              const c = it["content"];
              if (typeof p === "string" && typeof c === "string") {
                files[p] = safeUnescapeContent(c);
              }
            }
          }
        } else {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "string" && /\.(?:ts|tsx|js|jsx|json|css|html)$/i.test(k)) {
              files[k] = safeUnescapeContent(v);
            }
          }
        }

        if (Object.keys(files).length) return files;
      } catch {
        continue;
      }
    }
  } catch {
    // fallthrough
  }
  return files;
}

/* ----------------- exported parser ----------------- */

export function parseFilesFromSummary(summary: string, modelId?: string): FileMap {
  if (!summary || typeof summary !== "string") return {};

  if (modelId && /nvidia|mistral|openai\/gpt-oss/i.test(modelId)) {
    try {
      const strict = tryParseFilesArray(summary);
      if (strict && Object.keys(strict).length) return strict;
      const block = extractCreateOrUpdateBlock(summary);
      if (block) {
        const parsedBlock = parseCreateOrUpdateBlock(block);
        if (Object.keys(parsedBlock).length) return parsedBlock;
      }
    } catch {
      // continue to heuristics
    }
  }

  const filesArray = tryParseFilesArray(summary);
  if (filesArray && Object.keys(filesArray).length) return filesArray;

  const block = extractCreateOrUpdateBlock(summary);
  if (block) {
    const parsed = parseCreateOrUpdateBlock(block);
    if (Object.keys(parsed).length) return parsed;
  }

  const kvs = parseQuotedKeyValues(summary);
  if (Object.keys(kvs).length) return kvs;

  const fences = parseFencedCodeBlocks(summary);
  if (Object.keys(fences).length) return fences;

  const swept = sweepJsonBlocksForFiles(summary);
  if (Object.keys(swept).length) return swept;

  return {};
}

