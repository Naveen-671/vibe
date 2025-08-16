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


// // /**
// //  * Parses an AI model response and extracts code blocks in a structured way.
// //  * @param response - The raw response object from the model.
// //  * @returns Array of parsed code blocks with type and content.
// //  */
// // export function parseGeneratedCode(response: unknown): ParsedBlock[] {
// //   const blocks: ParsedBlock[] = [];

// //   if (!isModelResponse(response) || !Array.isArray(response.content)) {
// //     return blocks;
// //   }

// //   for (const block of response.content) {
// //     if (block.type === "text" && typeof block.text === "string") {
// //       const parsed = extractCodeBlocks(block.text);
// //       blocks.push(...parsed);
// //     }
// //   }

// //   return blocks;
// // }

// // /**
// //  * Type guard to validate a response as a ModelResponse.
// //  */
// // function isModelResponse(obj: unknown): obj is ModelResponse {
// //   return (
// //     typeof obj === "object" &&
// //     obj !== null &&
// //     "content" in obj
// //   );
// // }

// // /**
// //  * Extracts code blocks from markdown-formatted text.
// //  * Supports triple backtick syntax with optional language specifier.
// //  */
// // function extractCodeBlocks(text: string): ParsedBlock[] {
// //   // Compatible with ES2018 — avoids unsupported regex flags
// //   const regex = /```(\w+)?\n([\s\S]*?)```/g;
// //   const blocks: ParsedBlock[] = [];

// //   let match: RegExpExecArray | null;
// //   while ((match = regex.exec(text)) !== null) {
// //     blocks.push({
// //       type: match[1] || "plaintext",
// //       content: match[2].trim(),
// //     });
// //   }

// //   return blocks;
// // }


// // parser.ts
// /* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// type FileMap = Record<string, string>;

// /**
//  * Safely unescape JSON-style sequences produced by LLMs, while preserving
//  * meaningful backslashes (don't strip all backslashes).
//  */
// function safeUnescapeContent(s: string): string {
//   if (typeof s !== "string") return "";
//   let out = s;

//   // Remove surrounding whitespace
//   out = out.trim();

//   // Remove one layer of outer quotes/backticks when present
//   if ((out.startsWith("`") && out.endsWith("`")) || (out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
//     out = out.slice(1, -1);
//   }

//   // Unescape common sequences - keep backslashes relevant to code intact
//   // Order matters: replace double-escaped backslash first
//   out = out.replace(/\\\\/g, "\\");
//   out = out.replace(/\\n/g, "\n");
//   out = out.replace(/\\r/g, "\r");
//   out = out.replace(/\\t/g, "\t");
//   out = out.replace(/\\"/g, '"');
//   out = out.replace(/\\'/g, "'");

//   return out;
// }

// /**
//  * Find the index of the matching closing brace '}' for the opening brace at `startIdx`.
//  * Handles nested braces. Returns -1 if not found.
//  */
// function findMatchingClosingBrace(text: string, startIdx: number): number {
//   let depth = 0;
//   for (let i = startIdx; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === "{") depth++;
//     else if (ch === "}") {
//       depth--;
//       if (depth === 0) return i;
//     }
//   }
//   return -1;
// }

// /**
//  * Given a summary string that contains a createOrUpdateFiles: { ... } block,
//  * extract files by scanning top-level keys (filename-like) and capture the
//  * substring between each key and the next key (or the closing brace).
//  *
//  * This approach is robust against non-JSON quoting and embedded JSX/template literals.
//  */
// function parseCreateOrUpdateBlock(block: string): FileMap {
//   const files: FileMap = {};
//   // Regex to find keys that look like filenames (quoted or unquoted)
//   // Group 1/2 handle quoted keys; group 3 handles unquoted filename-like keys.
//   // Note: avoid using /s flag to keep compatibility with older targets.
//   const keyRegex = /(?:(['"`])([^'"`]+?)\1|([A-Za-z0-9_\/\-.]+?\.(?:ts|tsx|js|jsx|json|css|html)))\s*:/g;

//   const matches: Array<{ key: string; index: number; length: number; groups: RegExpExecArray }> = [];

//   let m: RegExpExecArray | null;
//   while ((m = keyRegex.exec(block)) !== null) {
//     const key = m[2] ?? m[3] ?? "";
//     matches.push({ key, index: m.index, length: m[0].length, groups: m });
//   }

//   if (matches.length === 0) return files;

//   for (let i = 0; i < matches.length; i++) {
//     const cur = matches[i];
//     const next = matches[i + 1];
//     const valueStart = cur.index + cur.length;
//     const valueEnd = next ? next.index : block.length;
//     let rawValue = block.slice(valueStart, valueEnd).trim();

//     // Remove trailing commas and optional closing commas
//     rawValue = rawValue.replace(/^[\s,]*/, "").replace(/,[\s]*$/, "").trim();

//     // If the value begins with `createOrUpdateFiles` nested object, try to normalize.
//     // Otherwise take as-is and unescape conservatively.
//     const content = safeUnescapeContent(rawValue);

//     files[cur.key] = content;
//   }

//   return files;
// }

// /**
//  * Top-level parser which tries several strategies:
//  * 1) If there's a JSON-style "files": [...] block, parse it with JSON.parse (best-effort).
//  * 2) If there's a createOrUpdateFiles: { ... } object, extract using parseCreateOrUpdateBlock.
//  * 3) Scan for quoted key:value pairs anywhere ("app/page.tsx": "...") and extract.
//  * 4) Extract fenced code blocks and try to infer filenames from surrounding hints.
//  */
// export function parseFilesFromSummary(summary: string): FileMap {
//   const out: FileMap = {};
//   if (!summary) return out;

//   // 1) Try JSON "files": [ ... ] first (strict)
//   try {
//     const filesArrayRegex = /"files"\s*:\s*(\[[\s\S]*?\])/i;
//     const faMatch = summary.match(filesArrayRegex);
//     if (faMatch?.[1]) {
//       const parsed = (() => {
//         try {
//           return JSON.parse(faMatch[1]) as unknown;
//         } catch {
//           return null;
//         }
//       })();
//       if (Array.isArray(parsed)) {
//         for (const item of parsed) {
//           if (item && typeof item === "object" && "path" in (item as Record<string, unknown>) && "content" in (item as Record<string, unknown>)) {
//             const rec = item as Record<string, unknown>;
//             if (typeof rec.path === "string" && typeof rec.content === "string") {
//               out[rec.path] = safeUnescapeContent(rec.content);
//             }
//           }
//         }
//         if (Object.keys(out).length) return out;
//       }
//     }
//   } catch {
//     // ignore and continue
//   }

//   // 2) Look for createOrUpdateFiles: { ... } block and parse it with brace matching
//   try {
//     const createIdx = summary.indexOf("createOrUpdateFiles");
//     if (createIdx !== -1) {
//       // find the first '{' after the token
//       const firstBrace = summary.indexOf("{", createIdx);
//       if (firstBrace !== -1) {
//         const closing = findMatchingClosingBrace(summary, firstBrace);
//         if (closing !== -1 && closing > firstBrace) {
//           const block = summary.slice(firstBrace + 1, closing); // content inside braces
//           const parsed = parseCreateOrUpdateBlock(block);
//           if (Object.keys(parsed).length) return parsed;
//         }
//       }
//     }
//   } catch {
//     // continue to fallback methods
//   }

//   // 3) Quoted key:value pairs anywhere: "app/page.tsx": "content"
//   try {
//     const quotedKeyValueRegex = /['"`]([^'"`]+?\.(?:ts|tsx|js|jsx|json|css|html))['"`]\s*:\s*(['"`])([\s\S]*?)\2/gim;
//     let mm: RegExpExecArray | null;
//     while ((mm = quotedKeyValueRegex.exec(summary)) !== null) {
//       const p = mm[1];
//       const val = mm[3];
//       out[p] = safeUnescapeContent(val);
//     }
//     if (Object.keys(out).length) return out;
//   } catch {
//     // ignore
//   }

//   // 4) Fenced code blocks: try to infer filename hints and return them
//   try {
//     const fenceRegex = /```(?:([\w-+.]+))?\n([\s\S]*?)\n```/g;
//     let fm: RegExpExecArray | null;
//     let idx = 0;
//     while ((fm = fenceRegex.exec(summary)) !== null) {
//       const lang = fm[1] ?? "";
//       const code = fm[2] ?? "";
//       // Look backwards 200 chars for hints like "app/page.tsx" or "file: app/page.tsx"
//       const before = summary.slice(Math.max(0, fm.index - 200), fm.index);
//       const hintMatch = before.match(/(?:file|path|->|:)\s*([^\s\n\r]+?\.(?:ts|tsx|js|jsx|json|css|html))/i);
//       const filename = hintMatch ? hintMatch[1] : lang.includes("ts") ? `app/component-${idx}.tsx` : `app/component-${idx}.txt`;
//       out[filename] = safeUnescapeContent(code);
//       idx++;
//     }
//     if (Object.keys(out).length) return out;
//   } catch {
//     // ignore
//   }

//   // No matches found — return empty
//   return out;
// }

// parser.ts
// Robust parser for LLM-generated createOrUpdateFiles outputs.
// - Brace matching is quote-aware and escape-aware
// - Tokenizes keys and extracts full values (strings, objects, arrays, code blocks)
// - Conservative unescaping to preserve template literals / JSX
// - Returns Record<filename, content>

// export type FileMap = Record<string, string>;

// /** Unescape common LLM-escaped sequences but preserve meaningful backslashes. */
// function safeUnescapeContent(s: string): string {
//   if (typeof s !== "string") return "";
//   let out = s.trim();

//   // Strip one layer of surrounding quotes/backticks if present
//   if (
//     (out.startsWith('"') && out.endsWith('"')) ||
//     (out.startsWith("'") && out.endsWith("'")) ||
//     (out.startsWith("`") && out.endsWith("`"))
//   ) {
//     out = out.slice(1, -1);
//   }

//   // Replace common JSON-like escapes (do not remove single backslashes used in code)
//   out = out.replace(/\\\\/g, "\\"); // double backslash -> single
//   out = out.replace(/\\n/g, "\n");
//   out = out.replace(/\\r/g, "\r");
//   out = out.replace(/\\t/g, "\t");
//   out = out.replace(/\\"/g, '"');
//   out = out.replace(/\\'/g, "'");

//   return out;
// }

// /** Find matching closing brace/ bracket index, aware of quotes and escapes. */
// function findMatchingIndex(text: string, startIdx: number, openCh: string, closeCh: string): number {
//   let depth = 0;
//   let inString: string | null = null; // quote char if inside string
//   for (let i = startIdx; i < text.length; i++) {
//     const ch = text[i];

//     // handle escape char
//     if (ch === "\\" && i + 1 < text.length) {
//       i++; // skip escaped char
//       continue;
//     }

//     // toggle quote state (ignore quotes if already in string and matches)
//     if (inString) {
//       if (ch === inString) {
//         inString = null;
//       }
//       continue;
//     } else {
//       if (ch === '"' || ch === "'" || ch === "`") {
//         inString = ch;
//         continue;
//       }
//     }

//     if (ch === openCh) {
//       depth++;
//     } else if (ch === closeCh) {
//       depth--;
//       if (depth === 0) return i;
//     }
//   }
//   return -1;
// }

// /** Parse a createOrUpdateFiles {...} block (string contains inner content between braces). */
// function parseCreateOrUpdateBlock(inner: string): FileMap {
//   const out: FileMap = {};
//   let i = 0;
//   const N = inner.length;

//   while (i < N) {
//     // skip whitespace and commas
//     while (i < N && /\s|,/.test(inner[i])) i++;
//     if (i >= N) break;

//     // parse key: can be quoted or unquoted filename-like
//     let key = "";
//     if (inner[i] === '"' || inner[i] === "'" || inner[i] === "`") {
//       const quote = inner[i];
//     //   const start = i;
//       i++;
//       let buf = "";
//       while (i < N) {
//         if (inner[i] === "\\" && i + 1 < N) {
//           buf += inner[i] + inner[i + 1];
//           i += 2;
//           continue;
//         }
//         if (inner[i] === quote) {
//           i++;
//           break;
//         }
//         buf += inner[i++];
//       }
//       key = buf;
//       // skip to colon
//       while (i < N && /\s/.test(inner[i])) i++;
//       if (inner[i] === ":") i++;
//     } else {
//       // unquoted key (read until colon)
//       let buf = "";
//       while (i < N && inner[i] !== ":" && inner[i] !== "\n") {
//         buf += inner[i++];
//       }
//       key = buf.trim();
//       if (inner[i] === ":") i++;
//     }

//     // skip whitespace
//     while (i < N && /\s/.test(inner[i])) i++;
//     if (i >= N) break;

//     // parse value: could be string, object, array, or raw until next top-level comma/next key
//     let value = "";
//     const ch = inner[i];

//     if (ch === '"' || ch === "'" || ch === "`") {
//       // quoted string - capture respecting escapes
//       const quote = ch;
//     //   const start = i;
//       i++;
//       let buf = quote;
//       while (i < N) {
//         const cur = inner[i];
//         buf += cur;
//         if (cur === "\\" && i + 1 < N) {
//           buf += inner[i + 1];
//           i += 2;
//           continue;
//         }
//         if (cur === quote) {
//           i++;
//           break;
//         }
//         i++;
//       }
//       value = buf;
//     } else if (ch === "{") {
//       const matchIdx = findMatchingIndex(inner, i, "{", "}");
//       if (matchIdx !== -1) {
//         value = inner.slice(i, matchIdx + 1);
//         i = matchIdx + 1;
//       } else {
//         // Can't find match - take rest conservatively
//         value = inner.slice(i);
//         i = N;
//       }
//     } else if (ch === "[") {
//       const matchIdx = findMatchingIndex(inner, i, "[", "]");
//       if (matchIdx !== -1) {
//         value = inner.slice(i, matchIdx + 1);
//         i = matchIdx + 1;
//       } else {
//         value = inner.slice(i);
//         i = N;
//       }
//     } else {
//       // raw: read until a top-level comma that is followed by another filename-like key or end
//       let buf = "";
//       let depth = 0;
//       let inStr: string | null = null;
//       while (i < N) {
//         const cur = inner[i];

//         if (cur === "\\" && i + 1 < N) {
//           buf += cur + inner[i + 1];
//           i += 2;
//           continue;
//         }
//         if (inStr) {
//           buf += cur;
//           if (cur === inStr) inStr = null;
//           i++;
//           continue;
//         } else {
//           if (cur === '"' || cur === "'" || cur === "`") {
//             inStr = cur;
//             buf += cur;
//             i++;
//             continue;
//           }
//         }

//         if (cur === "{" || cur === "[") {
//           depth++;
//         } else if (cur === "}" || cur === "]") {
//           if (depth > 0) depth--;
//         } else if (cur === "," && depth === 0) {
//           // peek ahead to see if next token looks like a filename key (with .tsx etc) - naive but useful
//           const lookahead = inner.slice(i + 1, i + 200);
//           if (lookahead.match(/['"`]?\s*[A-Za-z0-9_\/\-.]+?\.(ts|tsx|js|jsx|json|css|html)\s*['"`]?\s*:/i)) {
//             i++; // consume comma
//             break;
//           }
//         }
//         buf += cur;
//         i++;
//       }
//       value = buf.trim();
//     }

//     // Clean up trailing commas on value (common in LLM output)
//     value = value.replace(/,\s*$/g, "");

//     // store key/value after safe unescape
//     if (key) {
//       out[key] = safeUnescapeContent(value);
//     }
//   }

//   return out;
// }

// /** Try strict "files": [ {path, content}, ... ] JSON first (best-case). */
// function tryParseFilesArray(summary: string): FileMap | null {
//   const res: FileMap = {};
//   try {
//     const filesArrayMatch = summary.match(/"files"\s*:\s*(\[[\s\S]*?\])/i);
//     if (filesArrayMatch?.[1]) {
//       const parsed = JSON.parse(filesArrayMatch[1]);
//       if (Array.isArray(parsed)) {
//         for (const it of parsed) {
//           if (it && typeof it === "object" && typeof it.path === "string" && typeof it.content === "string") {
//             res[it.path] = safeUnescapeContent(it.content);
//           }
//         }
//         if (Object.keys(res).length) return res;
//       }
//     }
//   } catch {
//     // ignore and fallback
//   }
//   return null;
// }

// /** Find createOrUpdateFiles block by scanning for the token and matching braces (quote-aware). */
// function extractCreateOrUpdateBlock(summary: string): string | null {
//   const tokenIdx = summary.indexOf("createOrUpdateFiles");
//   if (tokenIdx === -1) return null;
//   // find first '{' after token
//   const braceIdx = summary.indexOf("{", tokenIdx);
//   if (braceIdx === -1) return null;
//   // find matching closing brace with awareness of quotes/escapes
//   const closeIdx = findMatchingIndex(summary, braceIdx, "{", "}");
//   if (closeIdx === -1) return null;
//   // return inner content (without outer braces)
//   return summary.slice(braceIdx + 1, closeIdx);
// }

// /** Fenced code blocks fallback */
// function parseFencedCodeBlocks(summary: string): FileMap {
//   const out: FileMap = {};
//   const fenceRegex = /```(?:([\w-+.]+))?\n([\s\S]*?)\n```/g;
//   let m: RegExpExecArray | null;
//   let idx = 0;
//   while ((m = fenceRegex.exec(summary)) !== null) {
//     const lang = m[1] ?? "";
//     const code = m[2] ?? "";
//     const before = summary.slice(Math.max(0, m.index - 200), m.index);
//     const hint = before.match(/(?:file|path|->|:)\s*([^\s\n\r]+?\.(ts|tsx|js|jsx|json|css|html))/i)?.[1] ?? null;
//     const filename = hint ?? (lang.includes("ts") ? `app/component-${idx}.tsx` : `app/component-${idx}.txt`);
//     out[filename] = safeUnescapeContent(code);
//     idx++;
//   }
//   return out;
// }

// /** Quoted key:value pairs fallback */
// function parseQuotedKeyValues(summary: string): FileMap {
//   const out: FileMap = {};
//   const kvRegex = /['"`]([^'"`]+?\.(?:ts|tsx|js|jsx|json|css|html))['"`]\s*:\s*(['"`])([\s\S]*?)\2/gim;
//   let m: RegExpExecArray | null;
//   while ((m = kvRegex.exec(summary)) !== null) {
//     const p = m[1];
//     const raw = m[3];
//     out[p] = safeUnescapeContent(raw);
//   }
//   return out;
// }

// /** Public parser exported for use in functions.ts */
// export function parseFilesFromSummary(summary: string, selectedModel?:
  // //  * Parses an AI model response and extracts code blocks in a structured way.
  // //  * @param response - The raw response object from the model.
  // //  * @returns Array of parsed code blocks with type and content.
  // //  */
  // // export function parseGeneratedCode(response: unknown): ParsedBlock[] {
  // //   const blocks: ParsedBlock[] = [];
  // //   if (!isModelResponse(response) || !Array.isArray(response.content)) {
  // //     return blocks;
  // //   }
  // //   for (const block of response.content) {
  // //     if (block.type === "text" && typeof block.text === "string") {
  // //       const parsed = extractCodeBlocks(block.text);
  // //       blocks.push(...parsed);
  // //     }
  // //   }
  // //   return blocks;
  // // }
  // // /**
  // //  * Type guard to validate a response as a ModelResponse.
  // //  */
  // // function isModelResponse(obj: unknown): obj is ModelResponse {
  // //   return (
  // //     typeof obj === "object" &&
  // //     obj !== null &&
  // //     "content" in obj
  // //   );
  // // }
  // // /**
  // //  * Extracts code blocks from markdown-formatted text.
  // //  * Supports triple backtick syntax with optional language specifier.
  // //  */
  // // function extractCodeBlocks(text: string): ParsedBlock[] {
  // //   // Compatible with ES2018 — avoids unsupported regex flags
  // //   const regex = /```(\w+)?\n([\s\S]*?)```/g;
  // //   const blocks: ParsedBlock[] = [];
  // //   let match: RegExpExecArray | null;
  // //   while ((match = regex.exec(text)) !== null) {
  // //     blocks.push({
  // //       type: match[1] || "plaintext",
  // //       content: match[2].trim(),
  // //     });
  // //   }
  // //   return blocks;
  // // }
  // // parser.ts
  // /* eslint-disable @typescript-eslint/explicit-module-boundary-types */
  // type FileMap = Record<string, string>;
  // /**
  //  * Safely unescape JSON-style sequences produced by LLMs, while preserving
  //  * meaningful backslashes (don't strip all backslashes).
  //  */
  // function safeUnescapeContent(s: string): string {
  //   if (typeof s !== "string") return "";
  //   let out = s;
  //   // Remove surrounding whitespace
  //   out = out.trim();
  //   // Remove one layer of outer quotes/backticks when present
  //   if ((out.startsWith("`") && out.endsWith("`")) || (out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
  //     out = out.slice(1, -1);
  //   }
  //   // Unescape common sequences - keep backslashes relevant to code intact
  //   // Order matters: replace double-escaped backslash first
  //   out = out.replace(/\\\\/g, "\\");
  //   out = out.replace(/\\n/g, "\n");
  //   out = out.replace(/\\r/g, "\r");
  //   out = out.replace(/\\t/g, "\t");
  //   out = out.replace(/\\"/g, '"');
  //   out = out.replace(/\\'/g, "'");
  //   return out;
  // }
  // /**
  //  * Find the index of the matching closing brace '}' for the opening brace at `startIdx`.
  //  * Handles nested braces. Returns -1 if not found.
  //  */
  // function findMatchingClosingBrace(text: string, startIdx: number): number {
  //   let depth = 0;
  //   for (let i = startIdx; i < text.length; i++) {
  //     const ch = text[i];
  //     if (ch === "{") depth++;
  //     else if (ch === "}") {
  //       depth--;
  //       if (depth === 0) return i;
  //     }
  //   }
  //   return -1;
  // }
  // /**
  //  * Given a summary string that contains a createOrUpdateFiles: { ... } block,
  //  * extract files by scanning top-level keys (filename-like) and capture the
  //  * substring between each key and the next key (or the closing brace).
  //  *
  //  * This approach is robust against non-JSON quoting and embedded JSX/template literals.
  //  */
  // function parseCreateOrUpdateBlock(block: string): FileMap {
  //   const files: FileMap = {};
  //   // Regex to find keys that look like filenames (quoted or unquoted)
  //   // Group 1/2 handle quoted keys; group 3 handles unquoted filename-like keys.
  //   // Note: avoid using /s flag to keep compatibility with older targets.
  //   const keyRegex = /(?:(['"`])([^'"`]+?)\1|([A-Za-z0-9_\/\-.]+?\.(?:ts|tsx|js|jsx|json|css|html)))\s*:/g;
  //   const matches: Array<{ key: string; index: number; length: number; groups: RegExpExecArray }> = [];
  //   let m: RegExpExecArray | null;
  //   while ((m = keyRegex.exec(block)) !== null) {
  //     const key = m[2] ?? m[3] ?? "";
  //     matches.push({ key, index: m.index, length: m[0].length, groups: m });
  //   }
  //   if (matches.length === 0) return files;
  //   for (let i = 0; i < matches.length; i++) {
  //     const cur = matches[i];
  //     const next = matches[i + 1];
  //     const valueStart = cur.index + cur.length;
  //     const valueEnd = next ? next.index : block.length;
  //     let rawValue = block.slice(valueStart, valueEnd).trim();
  //     // Remove trailing commas and optional closing commas
  //     rawValue = rawValue.replace(/^[\s,]*/, "").replace(/,[\s]*$/, "").trim();
  //     // If the value begins with `createOrUpdateFiles` nested object, try to normalize.
  //     // Otherwise take as-is and unescape conservatively.
  //     const content = safeUnescapeContent(rawValue);
  //     files[cur.key] = content;
  //   }
  //   return files;
  // }
  // /**
  //  * Top-level parser which tries several strategies:
  //  * 1) If there's a JSON-style "files": [...] block, parse it with JSON.parse (best-effort).
  //  * 2) If there's a createOrUpdateFiles: { ... } object, extract using parseCreateOrUpdateBlock.
  //  * 3) Scan for quoted key:value pairs anywhere ("app/page.tsx": "...") and extract.
  //  * 4) Extract fenced code blocks and try to infer filenames from surrounding hints.
  //  */
  // export function parseFilesFromSummary(summary: string): FileMap {
  //   const out: FileMap = {};
  //   if (!summary) return out;
  //   // 1) Try JSON "files": [ ... ] first (strict)
  //   try {
  //     const filesArrayRegex = /"files"\s*:\s*(\[[\s\S]*?\])/i;
  //     const faMatch = summary.match(filesArrayRegex);
  //     if (faMatch?.[1]) {
  //       const parsed = (() => {
  //         try {
  //           return JSON.parse(faMatch[1]) as unknown;
  //         } catch {
  //           return null;
  //         }
  //       })();
  //       if (Array.isArray(parsed)) {
  //         for (const item of parsed) {
  //           if (item && typeof item === "object" && "path" in (item as Record<string, unknown>) && "content" in (item as Record<string, unknown>)) {
  //             const rec = item as Record<string, unknown>;
  //             if (typeof rec.path === "string" && typeof rec.content === "string") {
  //               out[rec.path] = safeUnescapeContent(rec.content);
  //             }
  //           }
  //         }
  //         if (Object.keys(out).length) return out;
  //       }
  //     }
  //   } catch {
  //     // ignore and continue
  //   }
  //   // 2) Look for createOrUpdateFiles: { ... } block and parse it with brace matching
  //   try {
  //     const createIdx = summary.indexOf("createOrUpdateFiles");
  //     if (createIdx !== -1) {
  //       // find the first '{' after the token
  //       const firstBrace = summary.indexOf("{", createIdx);
  //       if (firstBrace !== -1) {
  //         const closing = findMatchingClosingBrace(summary, firstBrace);
  //         if (closing !== -1 && closing > firstBrace) {
  //           const block = summary.slice(firstBrace + 1, closing); // content inside braces
  //           const parsed = parseCreateOrUpdateBlock(block);
  //           if (Object.keys(parsed).length) return parsed;
  //         }
  //       }
  //     }
  //   } catch {
  //     // continue to fallback methods
  //   }
  //   // 3) Quoted key:value pairs anywhere: "app/page.tsx": "content"
  //   try {
  //     const quotedKeyValueRegex = /['"`]([^'"`]+?\.(?:ts|tsx|js|jsx|json|css|html))['"`]\s*:\s*(['"`])([\s\S]*?)\2/gim;
  //     let mm: RegExpExecArray | null;
  //     while ((mm = quotedKeyValueRegex.exec(summary)) !== null) {
  //       const p = mm[1];
  //       const val = mm[3];
  //       out[p] = safeUnescapeContent(val);
  //     }
  //     if (Object.keys(out).length) return out;
  //   } catch {
  //     // ignore
  //   }
  //   // 4) Fenced code blocks: try to infer filename hints and return them
  //   try {
  //     const fenceRegex = /```(?:([\w-+.]+))?\n([\s\S]*?)\n```/g;
  //     let fm: RegExpExecArray | null;
  //     let idx = 0;
  //     while ((fm = fenceRegex.exec(summary)) !== null) {
  //       const lang = fm[1] ?? "";
  //       const code = fm[2] ?? "";
  //       // Look backwards 200 chars for hints like "app/page.tsx" or "file: app/page.tsx"
  //       const before = summary.slice(Math.max(0, fm.index - 200), fm.index);
  //       const hintMatch = before.match(/(?:file|path|->|:)\s*([^\s\n\r]+?\.(?:ts|tsx|js|jsx|json|css|html))/i);
  //       const filename = hintMatch ? hintMatch[1] : lang.includes("ts") ? `app/component-${idx}.tsx` : `app/component-${idx}.txt`;
  //       out[filename] = safeUnescapeContent(code);
  //       idx++;
  //     }
  //     if (Object.keys(out).length) return out;
  //   } catch {
  //     // ignore
  //   }
  //   // No matches found — return empty
  //   return out;
  // }
  // parser.ts
  // Robust parser for LLM-generated createOrUpdateFiles outputs.
  // - Brace matching is quote-aware and escape-aware
  // - Tokenizes keys and extracts full values (strings, objects, arrays, code blocks)
  // - Conservative unescaping to preserve template literals / JSX
  // - Returns Record<filename, content>
//   string): FileMap {
//   if (!summary || typeof summary !== "string") return {};

//   // 1) Strict files array
//   const filesArray = tryParseFilesArray(summary);
//   if (filesArray) return filesArray;

//   // 2) createOrUpdateFiles block
//   const block = extractCreateOrUpdateBlock(summary);
//   if (block) {
//     const parsed = parseCreateOrUpdateBlock(block);
//     if (Object.keys(parsed).length) return parsed;
//   }

//   // 3) quoted key:value pairs
//   const kvs = parseQuotedKeyValues(summary);
//   if (Object.keys(kvs).length) return kvs;

//   // 4) fenced code blocks
//   const fences = parseFencedCodeBlocks(summary);
//   if (Object.keys(fences).length) return fences;

//   // nothing found
//   return {};
// }
