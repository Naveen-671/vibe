

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
    // If there is an image URL attached to the message, add a clear image reference
    if (r.imageUrl && typeof r.imageUrl === "string" && r.imageUrl.trim()) {
      out.push({
        type: "text",
        role: "user",
        content: `🖼️ IMAGE REFERENCE: ${r.imageUrl.trim()}`,
      });
    }
  }
  return out;
}
