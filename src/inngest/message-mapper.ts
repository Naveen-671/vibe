// // src/inngest/message-mapper.ts
// /**
//  * Normalize Prisma message rows to a simple ChatMessage[] shape expected by the
//  * agent network / provider calls. This avoids sending arrays/objects directly
//  * which caused provider validation errors like "Input should be a valid dictionary".
//  *
//  * The mapper:
//  *  - Flattens arrays of content items into readable text lines
//  *  - Extracts textual fields from common UI object shapes: { text }, { content }
//  *  - Extracts image URLs and emits a short sentinel "IMAGE_URL: <url>" text line
//  *  - Ensures role is exactly "user" | "assistant"
//  *
//  * No `any` is used — everything is typed and guarded.
//  */

// export type PrismaMessageRow = {
//   role: "ASSISTANT" | "USER" | string;
//   content: unknown; // content stored in DB; can be string | array | object
//   imageUrl?: string | null;
// };

// export type ChatMessage = {
//   role: "user" | "assistant" | "system";
//   content: string;
// };

// function isNonEmptyString(v: unknown): v is string {
//   return typeof v === "string" && v.trim().length > 0;
// }

// function isArrayOfUnknown(v: unknown): v is unknown[] {
//   return Array.isArray(v);
// }

// type ImageUrlShape = { url?: unknown };
// function isImageUrlShape(o: unknown): o is ImageUrlShape {
//   return typeof o === "object" && o !== null && "url" in (o as Record<string, unknown>);
// }

// /**
//  * Extract meaningful text from a single unknown content item (string, object).
//  * Returns null when nothing meaningful found.
//  */
// function extractTextFromItem(item: unknown): string | null {
//   if (isNonEmptyString(item)) return item.trim();

//   if (typeof item === "object" && item !== null) {
//     const rec = item as Record<string, unknown>;
//     // common toolkit shapes:
//     if (isNonEmptyString(rec.text)) return rec.text.trim();
//     if (isNonEmptyString(rec.content)) return rec.content.trim();
//     // sometimes rich shapes: { type:"input_text", text: "..." }
//     if (isNonEmptyString(rec.type) && isNonEmptyString(rec.text)) return rec.text.trim();
//     // some toolkits store { image_url: { url: "..." } } or { url: "..." }
//     if (isImageUrlShape(rec)) {
//       const maybe = (rec as ImageUrlShape).url;
//       if (isNonEmptyString(maybe)) return `IMAGE_URL: ${maybe.trim()}`;
//     }
//   }

//   return null;
// }

// /**
//  * Map Prisma message rows into ChatMessage[].
//  * - Keeps only messages that produce a non-empty string.
//  * - Preserves chronological order: input rows may be newest-first from DB; caller
//  *   should pass them in the order it wants delivered. This function does not reverse.
//  */
// export function mapPrismaMessagesToChatMessages(rows: PrismaMessageRow[]): ChatMessage[] {
//   const out: ChatMessage[] = [];

//   for (const row of rows) {
//     // normalize role:
//     const role = row.role === "ASSISTANT" ? "assistant" : row.role === "USER" ? "user" : "user";

//     // If there's an imageUrl attached to the row and no textual content,
//     // add an explicit IMAGE_URL line so providers that can't fetch can see something.
//     const hasImageUrl = typeof row.imageUrl === "string" && row.imageUrl.trim().length > 0;

//     // Handle string content
//     if (isNonEmptyString(row.content)) {
//       out.push({ role, content: row.content.trim() });
//       // If both string content and image exist, attach a short indicator after content
//       if (hasImageUrl) {
//         out.push({ role, content: `IMAGE_URL: ${row.imageUrl!.trim()}` });
//       }
//       continue;
//     }

//     // Handle array content: flatten into separate text messages
//     if (isArrayOfUnknown(row.content)) {
//       for (const item of row.content) {
//         const text = extractTextFromItem(item);
//         if (text) out.push({ role, content: text });
//       }
//       // If array had no textual items but there is an image URL, add that
//       if (hasImageUrl && out.length === 0) out.push({ role, content: `IMAGE_URL: ${row.imageUrl!.trim()}` });
//       continue;
//     }

//     // Handle object content (single object)
//     if (typeof row.content === "object" && row.content !== null) {
//       const text = extractTextFromItem(row.content);
//       if (text) {
//         out.push({ role, content: text });
//         if (hasImageUrl) out.push({ role, content: `IMAGE_URL: ${row.imageUrl!.trim()}` });
//         continue;
//       }
//     }

//     // Fallback: if no content but imageUrl exists, emit just the image line
//     if (!row.content && hasImageUrl) {
//       out.push({ role, content: `IMAGE_URL: ${row.imageUrl!.trim()}` });
//       continue;
//     }

//     // else ignore this row (no useful text)
//   }

//   // Only keep messages with non-empty trimmed content
//   return out.filter((m) => typeof m.content === "string" && m.content.trim().length > 0);
// }

// src/inngest/message-mapper.ts
/**
 * Normalize Prisma message rows to a typed TextMessage[] expected by the agent-network/provider.
 *
 * - No `any`.
 * - Strictly guards shapes.
 * - Flattens arrays/objects into text blocks.
 * - Emits short IMAGE_URL sentinel lines when image URLs are present.
 */

// import type { TextMessage } from "@inngest/agent-kit";

// type PrismaMessageRow = {
//   role: string;
//   content: unknown;
//   imageUrl?: string | null;
// };

// /** Simple runtime guards */
// function isNonEmptyString(v: unknown): v is string {
//   return typeof v === "string" && v.trim().length > 0;
// }
// function isArrayOfUnknown(v: unknown): v is unknown[] {
//   return Array.isArray(v);
// }
// function isRecord(v: unknown): v is Record<string, unknown> {
//   return typeof v === "object" && v !== null && !Array.isArray(v);
// }

// /** Flatten one Prisma row -> list of text blocks (strings) */
// function flattenRowContent(row: PrismaMessageRow): string[] {
//   const blocks: string[] = [];

//   const content = row.content;

//   // If content is a string -> single text block
//   if (isNonEmptyString(content)) {
//     blocks.push(content.trim());
//     // optionally also include image url sentinel if present
//     if (isNonEmptyString(row.imageUrl)) {
//       blocks.push(`IMAGE_URL: ${row.imageUrl!.trim()}`);
//     }
//     return blocks;
//   }

//   // If content is an array of things emitted from UI toolkits
//   if (isArrayOfUnknown(content)) {
//     for (const item of content) {
//       if (isNonEmptyString(item)) {
//         blocks.push(item.trim());
//         continue;
//       }
//       if (isRecord(item)) {
//         const it = item as Record<string, unknown>;
//         if (isNonEmptyString(it.text)) {
//           blocks.push(it.text.trim());
//           continue;
//         }
//         if (isNonEmptyString(it.content)) {
//           blocks.push(String(it.content).trim());
//           continue;
//         }
//         // potential image object
//         if (it.type === "image" && isNonEmptyString(it.url)) {
//           blocks.push(`IMAGE_URL: ${it.url.trim()}`);
//           continue;
//         }
//         // nested image_url shape: { image_url: { url: "..." } }
//         if (it.type === "image_url" && isRecord(it.image_url) && isNonEmptyString((it.image_url as Record<string, unknown>).url)) {
//           blocks.push(`IMAGE_URL: ${((it.image_url as Record<string, unknown>).url as string).trim()}`);
//           continue;
//         }
//       }
//     }
//     if (isNonEmptyString(row.imageUrl)) {
//       blocks.push(`IMAGE_URL: ${row.imageUrl!.trim()}`);
//     }
//     return blocks;
//   }

//   // If content is an object, try to pull common fields
//   if (isRecord(content)) {
//     const obj = content as Record<string, unknown>;
//     if (isNonEmptyString(obj.text)) {
//       blocks.push(obj.text.trim());
//     } else if (isNonEmptyString(obj.content)) {
//       blocks.push(String(obj.content).trim());
//     } else {
//       // Flatten top-level string properties
//       // eslint-disable-next-line @typescript-eslint/no-unused-vars
//       for (const [k, v] of Object.entries(obj)) {
//         if (isNonEmptyString(v)) {
//           blocks.push(String(v).trim());
//         }
//       }
//     }
//     if (isNonEmptyString(row.imageUrl)) {
//       blocks.push(`IMAGE_URL: ${row.imageUrl!.trim()}`);
//     }
//     return blocks;
//   }

//   // fallback: stringified content
//   try {
//     const s = content == null ? "" : JSON.stringify(content);
//     if (isNonEmptyString(s)) blocks.push(s);
//   } catch {
//     // ignore
//   }
//   if (isNonEmptyString(row.imageUrl)) blocks.push(`IMAGE_URL: ${row.imageUrl!.trim()}`);

//   return blocks;
// }

// /**
//  * Map Prisma rows (newest-first) to TextMessage[] expected by agents:
//  * - ensures role is exactly "user" | "assistant"
//  * - each TextMessage has { type: "text", role, content }
//  */
// export function mapPrismaRowsToTextMessages(rows: PrismaMessageRow[]): TextMessage[] {
//   const out: TextMessage[] = [];

//   for (const r of rows) {
//     const role = r.role === "ASSISTANT" ? "assistant" : "user";
//     const blocks = flattenRowContent(r);
//     for (const b of blocks) {
//       const trimmed = b.trim();
//       if (!trimmed) continue;
//       out.push({
//         type: "text",
//         role,
//         content: trimmed,
//       });
//     }
//   }

//   return out;
// }

// // src/inngest/message-mapper.ts
// import type { TextMessage } from "@inngest/agent-kit";

// /**
//  * Map DB rows from prisma.message -> TextMessage[]
//  *
//  * Ensures messages are sanitized and always returned in the shape the agent/network expects:
//  * {
//  *   type: "text",
//  *   role: "user" | "assistant" | "system",
//  *   content: string
//  * }
//  *
//  * We never use `any` and we guard for arrays/objects that come from UI toolkits.
//  */

// export type PrismaMessageRow = {
//   role: string;
//   content: unknown;
//   imageUrl?: string | null;
// };

// function isNonEmptyString(v: unknown): v is string {
//   return typeof v === "string" && v.trim().length > 0;
// }

// function isArrayOfUnknown(v: unknown): v is unknown[] {
//   return Array.isArray(v);
// }

// /**
//  * Convert a single DB row's content into a single normalized string.
//  * - Flatten arrays of blocks
//  * - Extract common shapes: { text }, { content }, {type: 'image', url}
//  * - If imageUrl exists, append a short sentinel line: "IMAGE_URL: <url>"
//  */
// function normalizeContentToString(row: PrismaMessageRow): string {
//   const parts: string[] = [];

//   const maybeAdd = (s?: string | null) => {
//     if (s && s.trim()) parts.push(s.trim());
//   };

//   const raw = row.content;

//   if (isNonEmptyString(raw)) {
//     maybeAdd(raw);
//   } else if (isArrayOfUnknown(raw)) {
//     for (const item of raw) {
//       if (isNonEmptyString(item)) {
//         maybeAdd(item);
//         continue;
//       }
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (isNonEmptyString(it.text)) {
//           maybeAdd(it.text);
//           continue;
//         }
//         if (isNonEmptyString(it.content)) {
//           maybeAdd(it.content);
//           continue;
//         }
//         // some UI toolkits wrap images as { type: 'image', url: '...' } or { image_url: { url: '...' } }
//         if (it.type === "image" && isNonEmptyString(it.url)) {
//           maybeAdd(`IMAGE_URL: ${it.url}`);
//           continue;
//         }
//         if (it.type === "image_url" && it.image_url && typeof it.image_url === "object") {
//           const iu = it.image_url as Record<string, unknown>;
//           if (isNonEmptyString(iu.url)) maybeAdd(`IMAGE_URL: ${iu.url}`);
//           continue;
//         }
//       }
//     }
//   } else if (raw && typeof raw === "object") {
//     // objects - attempt common keys
//     const obj = raw as Record<string, unknown>;
//     if (isNonEmptyString(obj.text)) maybeAdd(obj.text as string);
//     else if (isNonEmptyString(obj.content)) maybeAdd(obj.content as string);
//     else {
//       // fallback: try to stringify short objects (not large blobs)
//       try {
//         const s = JSON.stringify(obj);
//         if (s && s.length < 1000) maybeAdd(s);
//       } catch {
//         // ignore
//       }
//     }
//   }

//   // add explicit imageUrl column if present (UploadThing / DB)
//   if (isNonEmptyString(row.imageUrl)) {
//     maybeAdd(`IMAGE_URL: ${row.imageUrl!.trim()}`);
//   }

//   return parts.join("\n\n").trim();
// }

// /**
//  * Normalize DB role to agent role
//  */
// function normalizeRole(role: string | undefined): "user" | "assistant" | "system" {
//   if (role === "ASSISTANT" || role === "assistant") return "assistant";
//   if (role === "SYSTEM" || role === "system") return "system";
//   return "user";
// }

// /**
//  * Map prisma rows to typed TextMessage[] for the agent/network.
//  */
// export function mapPrismaRowsToTextMessages(rows: PrismaMessageRow[]): TextMessage[] {
//   const out: TextMessage[] = [];

//   for (const r of rows) {
//     // Defensive: skip clearly invalid rows
//     if (!r) continue;
//     const role = normalizeRole(r.role);
//     const content = normalizeContentToString(r);

//     // If nothing meaningful produced, skip
//     if (!content) continue;

//     // TextMessage shape expected by agent-kit:
//     // { type: "text", role: "user" | "assistant" | "system", content: string }
//     out.push({
//       type: "text",
//       role,
//       content,
//     });
//   }

//   return out;
// }

// // src/inngest/message-mapper.ts
// import type { TextMessage } from "@inngest/agent-kit";

// /**
//  * Mapper that converts Prisma message rows into the TextMessage[] shape
//  * expected by the agent runtime / provider calls.
//  *
//  * It:
//  *  - ensures every message has `type: "text"`
//  *  - coerces role to "user" | "assistant" | "system"
//  *  - flattens arrays/objects to readable text lines
//  *  - emits image sentinel lines when image URLs are present
//  *
//  * No `any` is used; everything is typed and guarded.
//  */

// export type PrismaMessageRow = {
//   role: string;
//   content: unknown;
//   imageUrl?: string | null;
//   createdAt?: Date | string;
//   // other DB fields may exist but we ignore them
// };

// function isNonEmptyString(v: unknown): v is string {
//   return typeof v === "string" && v.trim().length > 0;
// }

// function isArrayOfUnknown(v: unknown): v is unknown[] {
//   return Array.isArray(v);
// }

// function isRecord(v: unknown): v is Record<string, unknown> {
//   return v !== null && typeof v === "object" && !Array.isArray(v);
// }

// /**
//  * Convert a single PrismaMessageRow -> array of TextMessage blocks
//  * (we sometimes emit multiple TextMessage entries per row if content is an array).
//  */
// export function mapPrismaRowToTextMessages(row: PrismaMessageRow): TextMessage[] {
//   const out: TextMessage[] = [];

//   // normalize role
//   const rawRole = (row.role ?? "user").toString().toLowerCase();
//   const role: TextMessage["role"] = rawRole === "assistant" ? "assistant" : rawRole === "system" ? "system" : "user";

//   // helper to push a text block
//   const pushText = (text: string) => {
//     const trimmed = text?.toString()?.trim() ?? "";
//     if (trimmed.length === 0) return;
//     out.push({
//       type: "text",
//       role,
//       content: trimmed,
//     });
//   };

//   // If the DB row has an image URL attached, add a short sentinel message (keeps provider validation simple)
//   if (isNonEmptyString(row.imageUrl)) {
//     // we create a dedicated text block for the image url so provider-client shaping can detect it
//     pushText(`IMAGE_URL: ${row.imageUrl!.trim()}`);
//   }

//   const content = row.content;

//   // String content -> single text block
//   if (isNonEmptyString(content)) {
//     pushText(content as string);
//     return out;
//   }

//   // If the content is an array of items (UI toolkits sometimes store arrays), flatten them
//   if (isArrayOfUnknown(content)) {
//     for (const item of content as unknown[]) {
//       if (isNonEmptyString(item)) {
//         pushText(item);
//         continue;
//       }
//       if (isRecord(item)) {
//         const it = item as Record<string, unknown>;
//         if (isNonEmptyString(it.text)) pushText(it.text);
//         else if (isNonEmptyString(it.content)) pushText(it.content);
//         else if (it.type === "image" && isNonEmptyString(it.url)) pushText(`IMAGE_URL: ${it.url}`);
//         else if (it.type === "image_url" && isRecord(it.image_url) && isNonEmptyString((it.image_url as Record<string, unknown>).url)) {
//           pushText(`IMAGE_URL: ${(it.image_url as Record<string, unknown>).url as string}`);
//         } else {
//           // if object has fields that look useful, join them
//           const values = Object.values(it).filter(isNonEmptyString).slice(0, 3).join(" / ");
//           if (values) pushText(values);
//         }
//       }
//     }
//     return out;
//   }

//   // If content is an object, try common shapes:
//   if (isRecord(content)) {
//     const obj = content as Record<string, unknown>;
//     if (isNonEmptyString(obj.text)) {
//       pushText(obj.text);
//       return out;
//     }
//     if (isNonEmptyString(obj.content)) {
//       pushText(obj.content);
//       return out;
//     }
//     // maybe the object holds multiple readable strings -> concatenate
//     const candidate = Object.values(obj).filter(isNonEmptyString).slice(0, 5).map((s) => (s as string).trim()).join("\n");
//     if (candidate.length > 0) {
//       pushText(candidate);
//       return out;
//     }
//     // fallback: JSON-stringify a small preview
//     try {
//       const preview = JSON.stringify(obj, Object.keys(obj).slice(0, 10), 2);
//       pushText(preview);
//       return out;
//     } catch {
//       // ignore stringify errors
//     }
//   }

//   // Nothing useful found: push nothing (avoid empty messages)
//   return out;
// }

// /**
//  * Map many Prisma rows -> TextMessage[] in chronological order (oldest first).
//  * We intentionally return an array that the provider expects (role exactly "user"|"assistant"|"system",
//  * and each message has type: "text").
//  *
//  * Usage:
//  *   const messages = mapPrismaRowsToTextMessages(rows);
//  *   // If you need oldest-to-newest order:
//  *   const chronological = messages.reverse();
//  */
// export function mapPrismaRowsToTextMessages(rows: PrismaMessageRow[]): TextMessage[] {
//   const pieces: TextMessage[] = [];
//   for (const row of rows) {
//     const part = mapPrismaRowToTextMessages(row);
//     if (part.length > 0) pieces.push(...part);
//   }
//   return pieces;
// }

// src/inngest/message-mapper.ts
import type { TextMessage } from "@inngest/agent-kit";

/**
 * Prisma message row shape (only fields we actually use)
 */
export type PrismaMessageRow = {
  role: string | null | undefined; // e.g. 'USER' | 'ASSISTANT' | 'SYSTEM' or 'user'/'assistant'
  content?: unknown;
  imageUrl?: string | null | undefined;
};

/**
 * Helper to detect a non-empty string
 */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Flatten content into text lines suitable for agent `TextMessage.content`
 * - If it's a string -> trim
 * - If it's an array -> join stringish items with newlines
 * - If it's an object containing known fields -> extract common shapes
 */
function normalizeContentToString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    const lines: string[] = [];
    for (const it of raw) {
      if (isNonEmptyString(it)) lines.push(it.trim());
      else if (it && typeof it === "object") {
        const obj = it as Record<string, unknown>;
        if (isNonEmptyString(obj.text)) lines.push(obj.text.trim());
        else if (isNonEmptyString(obj.content)) lines.push(obj.content.trim());
      }
    }
    return lines.join("\n");
  }
  // object-ish
  try {
    const obj = raw as Record<string, unknown>;
    if (isNonEmptyString(obj.text)) return obj.text.trim();
    if (isNonEmptyString(obj.content)) return obj.content.trim();
    // If looks like { blocks: [...] } or UI shapes, attempt to extract text-ish props
    const collectors: string[] = [];
    for (const v of Object.values(obj)) {
      if (isNonEmptyString(v)) collectors.push(v.trim());
      else if (Array.isArray(v)) {
        for (const x of v) if (isNonEmptyString(x)) collectors.push(x.trim());
      }
    }
    if (collectors.length > 0) return collectors.join("\n");
    // Fallback to JSON
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

/**
 * Map DB role values to agent roles ('user' | 'assistant' | 'system')
 */
function normalizeRole(dbRole?: string | null): "user" | "assistant" | "system" {
  const r = String(dbRole ?? "").toLowerCase();
  if (r === "assistant" || r === "ai" || r === "bot") return "assistant";
  if (r === "system" || r === "meta") return "system";
  return "user";
}

/**
 * Main mapper
 * - Returns TextMessage[] (with required `type: "text"`)
 * - Emits optional IMAGE_URL sentinel message (user role) when imageUrl is present
 */
export function mapPrismaRowsToTextMessages(rows: PrismaMessageRow[]): TextMessage[] {
  const out: TextMessage[] = [];
  for (const r of rows) {
    const role = normalizeRole(r.role);
    const text = normalizeContentToString(r.content);
    // Only include non-empty text messages
    if (text && text.trim().length > 0) {
      out.push({
        type: "text",
        role,
        content: text,
      });
    }
    // If there is an image URL attached to the message, add a small sentinel
    if (r.imageUrl && typeof r.imageUrl === "string" && r.imageUrl.trim()) {
      out.push({
        type: "text",
        role: "user",
        content: `IMAGE_URL: ${r.imageUrl.trim()}`,
      });
    }
  }
  return out;
}
