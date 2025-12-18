// // src/inngest/functions.ts
import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { parseFilesFromSummary } from "@/inngest/parser";
import {
  createAgent,
  gemini,
  createNetwork,
  createState,
  openai,
  type TextMessage,
  type AgentResult,
} from "@inngest/agent-kit";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  parseAgentOutput,
} from "./utils";
import {
  getPromptForModel,
  FRAGMENT_TITLE_PROMPT,
  RESPONSE_PROMPT,
} from "@/prompt";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT15 } from "./types";
import { codeAgentRunSchema } from "./schema";
import {
  mapPrismaRowsToTextMessages,
  PrismaMessageRow,
} from "./message-mapper";

/* ---------------- Types & constants ---------------- */

interface AgentState {
  summary?: string;
  files?: Record<string, string>;
  error?: string;
  iteration?: number;
}

type AgentStateWithImage = AgentState & { image?: string };

type OpenAiClient = ReturnType<typeof openai>;
type GeminiClient = ReturnType<typeof gemini>;
type ModelClient = OpenAiClient | GeminiClient;

const PREFERRED_PATH = "app/page.tsx";

// CORRECTED: Updated expert models list to match 'reasoning: "expert"' in the UI component.
const EXPERT_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "deepseek-ai/deepseek-v3.1-terminus",
  "provider-6/llama-4-scout",
  "provider-3/deepseek-v3-0324",
  "provider-2/glm-4.5-air",
  "provider-6/glm-4.5-air",
  "provider-6/qwen3-coder-480b-a35b",
  "provider-2/gpt-5-nano",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "deepseek-ai/deepseek-r1-0528",
  "deepseek-ai/deepseek-r1-0528",
  "qwen/qwen3-235b-a22b",
  // Gemini models
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-pro-preview",
] as const;

type Provider = "openai" | "nvidia" | "llama" | "moonshotai" | "ibm" | "google";

// ADDED: Definitive list of A4F models for clear routing
const A4F_MODELS = [
  "provider-6/gpt-4o",
  "provider-6/gpt-4.1-mini",
  "provider-3/gpt-4o-mini",
  "provider-6/gemini-2.5-flash-thinking",
  "provider-6/o3-medium",
  "provider-6/llama-4-scout",
  "provider-6/glm-4.5-air",
  "provider-2/qwen3-coder",
  "provider-6/qwen-3-235b-a22b-2507",
  "provider-6/qwen3-coder-480b-a35b",
  "provider-6/gpt-5-nano",
  "provider-3/deepseek-v3-0324",
  "provider-2/glm-4.5-air",
  "provider-6/qwen3-coder-480b-a35b",
  "provider-3/qwen-3-235b-a22b-2507",
  "provider-6/llama-4-maverick",
  "provider-2/gpt-5-nano",
] as const;

// Models routed to NVIDIA endpoint
const NVIDIA_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "deepseek-ai/deepseek-v3.1-terminus",
  "moonshotai/kimi-k2-instruct-0905",
  "openai/gpt-oss-120b",
  "meta/llama-3.2-11b-vision-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
  "meta/codellama-70b",
  "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
  "meta/llama-3.3-70b-instruct",
  "mistralai/mistral-nemotron",
  "mistralai/mistral-small-3.2-24b-instruct",
  "mistralai/codestral-22b-instruct-v01",
  "deepseek-ai/deepseek-r1-0528",
  "deepseek-ai/deepseek-r1-distill-llama-8b",
  "qwen/qwen3-235b-a22b",
  "qwen/qwen2.5-coder-32b-instruct",
  "moonshotai/kimi-k2-instruct",
  "ibm/granite-34b-code-instruct",
  "openai/gpt-oss-120b", // Intentionally repeated per user instruction
  "google/codegemma-1.1-7b-1",
  "google/gemma-3-1b-it",
  "qwen/qwen3-coder-480b-a35b-instruct",
  "deepseek-ai/deepseek-v3.1",
  "deepseek-ai/deepseek-r1-0528",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "mistralai/mistral-large-3-675b-instruct-2512",
  "mistralai/ministral-14b-instruct-2512",
  "nvidia/nemotron-nano-12b-v2-vl",
  "mistralai/mistral-medium-3-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
] as const;

// Requested Gemini models
const GOOGLE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-pro-preview",
] as const;

/* ---------------- zod for file arrays ---------------- */

const FileItemSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

/* ---------------- Parsing + sanitization helpers ---------------- */

// (unchanged helper functions)
function isLikelyBalanced(code: string): boolean {
  if (typeof code !== "string") return true;
  const counts = {
    roundOpen: (code.match(/\(/g) || []).length,
    roundClose: (code.match(/\)/g) || []).length,
    curlyOpen: (code.match(/{/g) || []).length,
    curlyClose: (code.match(/}/g) || []).length,
    squareOpen: (code.match(/\[/g) || []).length,
    squareClose: (code.match(/]/g) || []).length,
    backticks: (code.match(/`/g) || []).length,
  };
  if (counts.roundOpen !== counts.roundClose) return false;
  if (counts.curlyOpen !== counts.curlyClose) return false;
  if (counts.squareOpen !== counts.squareClose) return false;
  if (counts.backticks % 2 !== 0) return false;
  return true;
}

function conservativeAutoClose(content: string): string | null {
  if (!content) return null;
  let out = content;
  const count = (s: string, ch: string) =>
    (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
  const roundOpen = count(out, "(");
  const roundClose = count(out, ")");
  if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
  const curlyOpen = count(out, "{");
  const curlyClose = count(out, "}");
  if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
  const squareOpen = count(out, "[");
  const squareClose = count(out, "]");
  if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
  const backticks = count(out, "`");
  if (backticks % 2 !== 0) out += "`";
  return isLikelyBalanced(out) ? out : null;
}

function stripFencedLanguageMarkers(s: string): string {
  let out = s ?? "";
  out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
  out = out.replace(/\s*```\s*$/i, "");
  out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
  out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
  return out;
}

function findBalancedJSONObject(text: string): string | null {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let prev = "";
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && prev !== "\\") inString = !inString;
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    prev = ch;
  }
  return null;
}

function extractFilesArraySubstring(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const idx =
    lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
  if (idx === -1) return null;
  const after = text.slice(idx);
  const arrStart = after.indexOf("[");
  if (arrStart === -1) return null;
  const globalStart = idx + arrStart;
  let depth = 0;
  let inString = false;
  let prev = "";
  for (let i = globalStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && prev !== "\\") inString = !inString;
    if (!inString) {
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) return text.slice(globalStart, i + 1);
      }
    }
    prev = ch;
  }
  return null;
}

function safeJsonParse(s: string): unknown | null {
  if (!s) return null;
  const pre = stripFencedLanguageMarkers(s).trim();
  try {
    return JSON.parse(pre);
  } catch { }
  const balanced = findBalancedJSONObject(pre);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch { }
    const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
    try {
      return JSON.parse(cleaned);
    } catch { }
  }
  const arr = extractFilesArraySubstring(pre);
  if (arr) {
    const wrapped = `{"files": ${arr}}`;
    try {
      return JSON.parse(wrapped);
    } catch {
      try {
        const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
        return JSON.parse(cleaned);
      } catch { }
    }
  }
  const trimmed = pre.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unq = trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
    try {
      return JSON.parse(unq);
    } catch { }
    const b2 = findBalancedJSONObject(unq);
    if (b2) {
      try {
        return JSON.parse(b2);
      } catch { }
    }
  }
  const singleToDouble = pre.replace(
    /(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g,
    '"$2":',
  );
  try {
    return JSON.parse(singleToDouble);
  } catch { }
  return null;
}

function sanitizeFileContent(raw: unknown): string {
  let s: string;
  if (raw == null) s = "";
  else if (typeof raw === "string") s = raw;
  else {
    try {
      s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
    } catch {
      s = String(raw);
    }
  }

  s = s.replace(/\r\n/g, "\n");
  s = stripFencedLanguageMarkers(s);

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }

  if (s.includes("\\n") && !s.includes("\n"))
    s = s
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");

  s = s.replace(
    /\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i,
    "",
  );
  s = s.replace(
    /^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i,
    "",
  );
  s = s.replace(
    /^['"]\s*use client\s*['"]\s*;?/,
    "'use client';\n\n",
  );

  const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
  const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
  if (hasUnquotedUseClient && !hasProperUseClient) {
    s = s.replace(/^\s*use client\s*;?/i, "");
    s = `'use client';\n\n${s.trimStart()}`;
  } else if (!hasProperUseClient) {
    const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
    if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
  } else {
    s = s.replace(
      /^\s*(['"]?)use client\1\s*;?/i,
      `'use client';`,
    );
    s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
  }

  s = s.replace(/^\s*\]\s*$/gm, "");
  s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
  s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
  s = s.replace(/^\s*{+\s*/g, "");
  s = s.replace(/\s*}+\s*$/g, "");

  if (!isLikelyBalanced(s)) {
    const closed = conservativeAutoClose(s);
    if (closed) s = closed;
  }

  if (!s.endsWith("\n")) s += "\n";
  return s.trimEnd() + "\n";
}

function normalizeParsedFiles(
  parsed: unknown,
): Record<string, string> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  try {
    const zRes = FilesToolArgsSchema.safeParse(obj);
    if (zRes.success) {
      const out: Record<string, string> = {};
      for (const f of zRes.data.files)
        out[f.path] = sanitizeFileContent(f.content);
      return coerceToPage(out);
    }
  } catch { }
  if (Array.isArray(obj.files)) {
    const out: Record<string, string> = {};
    for (const item of obj.files as unknown[]) {
      if (item && typeof item === "object") {
        const it = item as Record<string, unknown>;
        if (typeof it.path === "string" && it.content != null)
          out[it.path] = sanitizeFileContent(it.content);
      }
    }
    if (Object.keys(out).length > 0) return coerceToPage(out);
  }
  if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
    const fm = obj.files as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [path, val] of Object.entries(fm))
      out[path] = sanitizeFileContent(val);
    if (Object.keys(out).length > 0) return coerceToPage(out);
  }
  if (typeof obj.path === "string" && obj.content != null)
    return coerceToPage({
      [obj.path]: sanitizeFileContent(obj.content),
    });
  const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
  if (direct.length > 0) {
    const out: Record<string, string> = {};
    for (const [path, val] of direct)
      out[path] = sanitizeFileContent(val as string);
    if (Object.keys(out).length > 0) return coerceToPage(out);
  }
  for (const [, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      const maybe = safeJsonParse(v);
      if (maybe) {
        const nested = normalizeParsedFiles(maybe);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function coerceToPage(
  files: Record<string, string> | null,
): Record<string, string> | null {
  if (!files) return null;
  if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
  for (const [path, content] of Object.entries(files)) {
    const low = path.toLowerCase();
    if (
      low.endsWith("page.tsx") ||
      low.endsWith("index.tsx") ||
      low.endsWith("page.jsx") ||
      low.endsWith("index.jsx")
    )
      return { [PREFERRED_PATH]: content };
  }
  for (const [path, content] of Object.entries(files)) {
    if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase()))
      return { [PREFERRED_PATH]: content };
  }
  const first = Object.entries(files)[0];
  return first ? { [PREFERRED_PATH]: first[1] } : null;
}

function finalSanitizeBeforeWrite(content: string): string {
  let s = sanitizeFileContent(content);
  if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
    const parsed = safeJsonParse(s);
    if (parsed) {
      const normalized = normalizeParsedFiles(parsed);
      if (normalized && normalized[PREFERRED_PATH])
        return normalized[PREFERRED_PATH];
      if (normalized) s = Object.values(normalized)[0];
    }
  }
  const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
  const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
  if (hasUnquotedUseClient && !hasProperUseClient) {
    s = s.replace(/^\s*use client\s*;?/i, "");
    s = `'use client';\n\n${s.trimStart()}`;
  } else if (!hasProperUseClient) {
    const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
    if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
  } else {
    s = s.replace(
      /^\s*(['"]?)use client\1\s*;?/i,
      `'use client';`,
    );
    s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
  }
  s = s.replace(/^\s*\]\s*$/gm, "");
  s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
  s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
  s = s.replace(/^\s*{+\s*/g, "");
  s = s.replace(/\s*}+\s*$/g, "");
  s = sanitizeFileContent(s);
  if (!isLikelyBalanced(s)) {
    const closed = conservativeAutoClose(s);
    if (closed) s = closed;
  }
  if (!s.endsWith("\n")) s += "\n";
  return s;
}

function isTrivialApp(
  files: Record<string, string> | null | undefined,
): boolean {
  if (!files) return true;
  const pageContent =
    files["app/page.tsx"] ||
    files["pages/index.tsx"] ||
    Object.entries(files).find(
      ([path]) =>
        path.endsWith("page.tsx") || path.endsWith("index.tsx"),
    )?.[1] ||
    "";
  if (!pageContent) return true;
  const content = pageContent.toLowerCase();
  const lineCount = pageContent.split("\n").length;
  const formSignals = [
    "<form",
    "input",
    "textarea",
    "select",
    "button",
    'type="text"',
    "payment",
    "credit card",
  ];
  if (formSignals.some((s) => content.includes(s))) return false;
  if (lineCount < 30) return true;
  const requiredKeywords = [
    "hero",
    "feature",
    "features",
    "call to action",
    "cta",
    "get started",
    "footer",
  ];
  const hasKeyword = requiredKeywords.some((k) => content.includes(k));
  const structuralSignals = [
    "<section",
    'role="banner"',
    'role="contentinfo"',
    'aria-label="features"',
  ];
  const hasStructureSignal = structuralSignals.some((s) =>
    content.includes(s),
  );
  return !(hasKeyword || hasStructureSignal);
}

function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
  return Array.isArray(arr) && (arr as readonly string[]).includes(id);
}

/* ---------------- Provider / client selection ---------------- */

const getModelClient = (rawModelId?: unknown): ModelClient => {
  const modelId =
    typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
  if (!modelId) throw new Error("No modelId provided to getModelClient.");

  if (safeIncludes(NVIDIA_MODELS, modelId)) {
    if (!process.env.NVIDIA_API_KEY)
      throw new Error("NVIDIA_API_KEY is not set");
    return openai({
      model: modelId,
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.NVIDIA_API_KEY,
    }) as OpenAiClient;
  }

  // Handle native Google/Gemini models
  if (safeIncludes(GOOGLE_MODELS, modelId) || modelId.startsWith("google/") || modelId.startsWith("gemini-")) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
    // @inngest/agent-kit gemini client usage
    return gemini({
      model: modelId,
      apiKey: process.env.GEMINI_API_KEY,
    }) as GeminiClient;
  }

  // The logic below correctly handles all A4F models via their 'provider-' prefix.
  if (safeIncludes(A4F_MODELS, modelId) || modelId.startsWith("provider-")) {
    const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
    const key = process.env.OPENAI_A4F_API_KEY;
    if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
    return openai({
      model: modelId,
      baseUrl: base,
      apiKey: key,
    }) as OpenAiClient;
  }

  throw new Error(`No client configuration found for modelId "${modelId}".`);
};

// FIXED: Replaced with a more robust provider detection function
function deriveProviderFromModelId(modelId: string): Provider {
  const lower = modelId.toLowerCase();

  // More specific prefixes should come first
  if (lower.startsWith("nvidia/")) return "nvidia";
  if (lower.startsWith("meta/")) return "llama";
  if (lower.startsWith("nvidia/")) return "nvidia";
  if (lower.startsWith("meta/")) return "llama";
  if (lower.startsWith("google/") || lower.startsWith("gemini-")) return "google";
  if (lower.startsWith("moonshotai/")) return "moonshotai";
  if (lower.startsWith("moonshotai/")) return "moonshotai";
  if (lower.startsWith("ibm/")) return "ibm";

  // Broader or OpenAI-compatible prefixes
  if (
    lower.startsWith("provider-") ||
    lower.startsWith("openai/") ||
    lower.startsWith("gpt-") ||
    lower.startsWith("mistralai/") ||
    lower.startsWith("qwen/") ||
    lower.startsWith("deepseek-ai/")
  ) {
    return "openai";
  }

  // Default fallback for any other cases
  return "openai";
}

/* ---------------- Main agent function ---------------- */

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent", concurrency: 5 },
  { event: "code-agent/run", schema: codeAgentRunSchema },
  async ({ event, step }) => {
    const {
      text: textPrompt,
      image,
      model: selectedModelRaw,
      projectId,
      selfFixRetries: rawRetries,
      enforceLanding: enforceLandingData,
    } = event.data;

    const rawRetriesNum = Number(rawRetries ?? 5);
    const selfFixRetries = Math.min(
      10,
      Math.max(
        1,
        Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5,
      ),
    );
    const enforceLanding = Boolean(enforceLandingData ?? false);

    // create sandbox
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-testz");
      await sandbox.setTimeout(SANDBOX_TIMEOUT15);
      return sandbox.sandboxId;
    });

    // IMAGE HANDLING: do NOT inline images. Only accept public HTTPS URLs (UploadThing / signed URLs).
    let imageUrlProvided: string | undefined;
    if (image && typeof image === "string" && image.trim()) {
      console.log("🖼️ Processing image URL:", image.trim());
      try {
        const u = new URL(image.trim());
        if (u.protocol !== "https:" && u.protocol !== "data:") {
          console.warn(
            "❌ Rejected non-HTTPS/non-data image URL;",
          );
        } else {
          imageUrlProvided = u.toString();
          console.log("✅ Image URL validated:", imageUrlProvided);
          // OPTIONAL: quick HEAD to check reachability and content-type (do not download).
          try {
            const headResp = await fetch(imageUrlProvided, {
              method: "HEAD",
              redirect: "follow",
            });
            if (!headResp.ok) {
              console.warn(
                "⚠️ Image HEAD request returned non-OK status:",
                headResp.status,
              );
              // still allow — model will fallback to textual prompt if needed
            } else {
              const ct = headResp.headers.get("content-type") ?? "";
              if (!ct.startsWith("image/")) {
                console.warn(
                  "⚠️ Image URL content-type is not image/*:",
                  ct,
                );
              } else {
                console.log(
                  "✅ Image URL verified as valid image:",
                  ct,
                );
              }
            }
          } catch (e) {
            console.warn(
              "⚠️ Image HEAD check failed; proceeding with URL-only approach:",
              e,
            );
          }
        }
      } catch (err) {
        console.error("❌ Invalid image URL provided:", image, err);
      }
    } else {
      console.log("ℹ️ No image provided for this request");
    }

    // ---------------------------
    // LOAD PREVIOUS MESSAGES (MOVED AFTER IMAGE HANDLING)
    // ---------------------------
    const previousMessages: TextMessage[] = await step.run(
      "get-previous-messages",
      async () => {
        if (imageUrlProvided) {
          // Fresh conversation for image-driven tasks
          return [] as TextMessage[];
        }

        const rows = await prisma.message.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        const prismaRows: PrismaMessageRow[] = rows.map((r) => ({
          role: r.role ?? "USER",
          content: r.content,
          imageUrl: r.imageUrl ?? null,
        }));

        const mapped = mapPrismaRowsToTextMessages(prismaRows);
        return mapped.reverse();
      },
    );

    // create state. second arg type is Parameters<typeof createState>[1]
    type CreateStateOpts = Parameters<typeof createState>[1];
    const state = createState<AgentStateWithImage>(
      { summary: "", files: {}, image: imageUrlProvided },
      ({ messages: previousMessages } as unknown) as CreateStateOpts,
    );

    // debug preview
    try {
      const preview = previousMessages.slice(0, 20).map((m) => ({
        type: (m as any).type,
        role: m.role,
        content:
          typeof (m as any).content === "string"
            ? (m as any).content.length > 300
              ? (m as any).content.slice(0, 300) + "…"
              : (m as any).content
            : "[complex]",
      }));
      console.info(
        "Provider-ready messages before run:",
        JSON.stringify(preview, null, 2),
      );
    } catch { }

    const fallbackModel =
      process.env.DEFAULT_MODEL || "qwen/qwen3-coder-480b-a35b-instruct";
    const selectedModel =
      typeof selectedModelRaw === "string" && selectedModelRaw.trim()
        ? selectedModelRaw.trim()
        : fallbackModel;

    const candidateModels: string[] = [selectedModel];
    if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
      for (const m of EXPERT_MODELS) {
        try {
          getModelClient(m);
          candidateModels.push(m);
          break;
        } catch { }
      }
    }

    let successfulResult: {
      finalSummary: string;
      filesFromSummary: Record<string, string>;
      usedModel: string;
      modelClient: ModelClient;
    } | null = null;

    const extractAndNormalize = async (text: string, modelId?: string) => {
      const fenced = text.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/i,
      );
      if (fenced) {
        const cleaned = stripFencedLanguageMarkers(fenced[1]);
        const parsed =
          safeJsonParse(cleaned) ??
          safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
        if (parsed) {
          const normalized = normalizeParsedFiles(parsed);
          if (normalized)
            return {
              files: normalized,
              parseText: cleaned,
              parsedRaw: parsed,
            };
        }
      }
      const balanced = findBalancedJSONObject(text);
      if (balanced) {
        const parsed = safeJsonParse(balanced);
        if (parsed) {
          const normalized = normalizeParsedFiles(parsed);
          if (normalized)
            return {
              files: normalized,
              parseText: balanced,
              parsedRaw: parsed,
            };
        }
      }
      const filesArr = extractFilesArraySubstring(text);
      if (filesArr) {
        const wrapped = `{"files": ${filesArr}}`;
        const parsed = safeJsonParse(wrapped);
        if (parsed) {
          const normalized = normalizeParsedFiles(parsed);
          if (normalized)
            return {
              files: normalized,
              parseText: filesArr,
              parsedRaw: parsed,
            };
        }
      }
      const parsedWhole = safeJsonParse(text);
      if (parsedWhole) {
        const normalized = normalizeParsedFiles(parsedWhole);
        if (normalized)
          return {
            files: normalized,
            parseText: text,
            parsedRaw: parsedWhole,
          };
      }
      try {
        const fallback = parseFilesFromSummary(text, modelId);
        if (fallback && Object.keys(fallback).length > 0) {
          const sanitized: Record<string, string> = {};
          for (const [p, c] of Object.entries(fallback))
            sanitized[p] = sanitizeFileContent(c);
          return {
            files: coerceToPage(sanitized) ?? sanitized,
            parseText: null,
            parsedRaw: null,
          };
        }
      } catch { }
      return { files: null, parseText: null, parsedRaw: null };
    };

    for (const modelCandidate of candidateModels) {
      let modelClient: ModelClient;
      try {
        modelClient = getModelClient(modelCandidate);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await step.run("save-model-client-error", async () =>
          prisma.message.create({
            data: {
              projectId,
              content: `Model client creation failed for ${modelCandidate}: ${msg}`,
              role: "ASSISTANT",
              type: "ERROR",
              model: modelCandidate,
            },
          }),
        );
        continue;
      }

      const providerKey: Provider =
        deriveProviderFromModelId(modelCandidate);
      const isVision = Boolean(imageUrlProvided);

      console.log(
        `🤖 Model: ${modelCandidate}, Provider: ${providerKey}, Vision: ${isVision}`,
      );

      const baseSystem = getPromptForModel(
        providerKey,
        isVision ? "vision" : "general",
        { expert: (EXPERT_MODELS as readonly string[]).includes(modelCandidate) },
      );

      console.log(
        `📝 Using ${isVision ? "VISION" : "GENERAL"} prompt for model: ${modelCandidate}`,
      );

      // Add explicit image URL sentinel only (no inlining)
      let baseSystemWithImage = baseSystem;
      if (imageUrlProvided) {
        baseSystemWithImage = `${baseSystem}\n\n- The visual reference is supplied as a proper input_image message.\n- Use the image as the primary source of truth for layout and UI recreation.`;
      }

      // Enforce JSON output instructions (keeps downstream parsing deterministic)
      let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
      if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
        enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
      }
      const systemPrompt = `${baseSystemWithImage}\n\n${enforceJsonInstruction}`;

      const codeAgent = createAgent<AgentStateWithImage>({
        name: "code-agent",
        system: systemPrompt,
        model: modelClient,
        lifecycle: {
          onResponse: async ({ result, network }) => {
            if (!network) return result;
            try {
              const ar = result as unknown as AgentResult;
              const text = lastAssistantTextMessageContent(ar);
              if (text) network.state.data.summary = text;
            } catch (e) {
              console.warn(
                "Failed to extract assistant text from result (onResponse):",
                e,
              );
            }
            return result;
          },
        },
      });

      const network = createNetwork<AgentStateWithImage>({
        name: "coding-agent-network",
        agents: [codeAgent],
        maxIter: 1,
        router: async ({ network: net }) =>
          net.state.data.summary ? undefined : codeAgent,
      });

      const initialPromptParts: string[] = [];
      if (imageUrlProvided) {
        initialPromptParts.push("🎨 DESIGN RECONSTRUCTION TASK");
        initialPromptParts.push(
          `User has uploaded an image to use as the primary design reference.`,
        );
        initialPromptParts.push(`📸 Image URL: ${imageUrlProvided}`);
        initialPromptParts.push(
          `🔍 Your task: Analyze this image and recreate it as a pixel-perfect Next.js application.`,
        );
        initialPromptParts.push(`📋 Requirements:`);
        initialPromptParts.push(
          `- Match the exact layout, colors, and typography from the image`,
        );
        initialPromptParts.push(
          `- Use appropriate Shadcn UI components`,
        );
        initialPromptParts.push(`- Ensure responsive design`);
        initialPromptParts.push(
          `- Pay attention to spacing, shadows, and visual hierarchy`,
        );
      }
      if (textPrompt && textPrompt.trim()) {
        if (imageUrlProvided) {
          initialPromptParts.push(
            `\n💬 Additional user requirements: ${textPrompt.trim()}`,
          );
        } else {
          initialPromptParts.push(
            `User prompt: ${textPrompt.trim()}`,
          );
        }
      }
      const initialPrompt =
        initialPromptParts.length > 0
          ? initialPromptParts.join("\n")
          : textPrompt || "Generate a UI based on the provided image.";

      let runResult:
        | { state?: { data?: AgentStateWithImage } }
        | undefined;

      // CORRECTED VISION PAYLOAD
      // CORRECTED VISION PAYLOAD
      // Gemini/Google via Vercel AI SDK expects { type: "image", image: url }
      // OpenAI expects { type: "image_url", image_url: { url } }
      const multimodalMessage =
        imageUrlProvided
          ? (providerKey === "google"
            ? [
              { type: "image", image: imageUrlProvided },
              { type: "text", text: initialPrompt }
            ]
            : [
              { type: "image_url", image_url: { url: imageUrlProvided } },
              { type: "text", text: initialPrompt }
            ]
          )
          : [
            { type: "text", text: initialPrompt }
          ];

      console.log("🖼️ Vision message payload:", JSON.stringify(multimodalMessage, null, 2));

      try {
        // Cast to any to bypass strict TS checks for network.run input types logic
        runResult = (await network.run(multimodalMessage as any, {
          state,
        })) as { state?: { data?: AgentStateWithImage } } | undefined;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await step.run("save-provider-error", async () =>
          prisma.message.create({
            data: {
              projectId,
              content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`,
              role: "ASSISTANT",
              type: "ERROR",
              model: modelCandidate,
            },
          }),
        );
        continue;
      }

      let finalSummary = runResult?.state?.data?.summary ?? "";
      const parseResult = await extractAndNormalize(
        finalSummary,
        modelCandidate,
      );
      let filesFromSummary = parseResult.files;

      const needsFix = (files: Record<string, string> | null) =>
        !files ||
        Object.keys(files).length === 0 ||
        (enforceLanding && isTrivialApp(files));

      if (!needsFix(filesFromSummary)) {
        successfulResult = {
          finalSummary,
          filesFromSummary: filesFromSummary as Record<
            string,
            string
          >,
          usedModel: modelCandidate,
          modelClient,
        };
      } else {
        if (parseResult.parseText && typeof parseResult.parseText === "string") {
          try {
            const maybe = safeJsonParse(parseResult.parseText);
            const normalized = normalizeParsedFiles(maybe);
            if (normalized) {
              const repaired: Record<string, string> = {};
              for (const [p, c] of Object.entries(normalized))
                repaired[p] =
                  conservativeAutoClose(c) ?? sanitizeFileContent(c);
              filesFromSummary = coerceToPage(repaired);
            }
          } catch { }
        }

        if (!needsFix(filesFromSummary)) {
          successfulResult = {
            finalSummary,
            filesFromSummary: filesFromSummary as Record<
              string,
              string
            >,
            usedModel: modelCandidate,
            modelClient,
          };
        } else {
          const FIXER_SYSTEM = `${baseSystemWithImage}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
          const fixerAgent = createAgent({
            name: "fixer-agent",
            system: FIXER_SYSTEM,
            model: modelClient,
          });

          let lastErrorMessage: string = parseResult.parseText
            ? "JSON block found but parsing/validation failed."
            : "No JSON block found in the model output.";
          const attemptOutputs: string[] = [];
          let fixerSucceeded = false;

          for (
            let attempt = 0;
            attempt < selfFixRetries && !fixerSucceeded;
            attempt++
          ) {
            const userFixPrompt = [
              `PREVIOUS ASSISTANT OUTPUT:`,
              finalSummary,
              "",
              `ERROR: ${lastErrorMessage}`,
              "",
              `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`,
            ].join("\n");
            try {
              const { output: fixerOutput } = await fixerAgent.run(
                userFixPrompt,
              );
              const fixerRaw =
                typeof fixerOutput === "string"
                  ? fixerOutput
                  : String(fixerOutput ?? "");
              attemptOutputs.push(fixerRaw);
              finalSummary = fixerRaw;

              const fixParsed = await extractAndNormalize(
                fixerRaw,
                modelCandidate,
              );
              const fixerFiles = fixParsed.files;
              if (fixerFiles) {
                const repaired: Record<string, string> = {};
                for (const [p, c] of Object.entries(fixerFiles))
                  repaired[p] =
                    conservativeAutoClose(c) ??
                    sanitizeFileContent(c);
                filesFromSummary = coerceToPage(repaired);
              } else filesFromSummary = null;

              if (
                filesFromSummary &&
                Object.keys(filesFromSummary).length > 0 &&
                (!enforceLanding || !isTrivialApp(filesFromSummary))
              ) {
                successfulResult = {
                  finalSummary,
                  filesFromSummary: filesFromSummary as Record<
                    string,
                    string
                  >,
                  usedModel: modelCandidate,
                  modelClient,
                };
                fixerSucceeded = true;
                break;
              }

              if (!filesFromSummary)
                lastErrorMessage = fixParsed.parseText
                  ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.`
                  : `Fix attempt #${attempt + 1} returned no JSON block.`;
              else
                lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              lastErrorMessage = `Fixer agent threw: ${errMsg}`;
              attemptOutputs.push(`FIXER_THROW:${errMsg}`);
              break;
            }
          }

          if (!successfulResult) {
            const truncated = attemptOutputs
              .slice(0, 5)
              .map(
                (s, i) =>
                  `attempt#${i + 1}:${String(s).slice(0, 200)}`,
              )
              .join("\n---\n");
            const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
            await step.run("save-fixer-exhausted", async () =>
              prisma.message.create({
                data: {
                  projectId,
                  content: consolidated,
                  role: "ASSISTANT",
                  type: "ERROR",
                  model: modelCandidate,
                },
              }),
            );
            continue;
          }
        }
      }

      if (successfulResult) {
        const repaired: Record<string, string> = {
          ...successfulResult.filesFromSummary,
        };
        for (const [p, c] of Object.entries(repaired)) {
          if (!isLikelyBalanced(c)) {
            const cons = conservativeAutoClose(c);
            if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
          }
        }
        successfulResult.filesFromSummary = repaired;
        break;
      }
    } // end model loop

    if (!successfulResult) {
      const errMsg =
        "Agent failed validation with all attempted models (including self-fix attempts).";
      await step.run("save-error-result-final", async () =>
        prisma.message.create({
          data: {
            projectId,
            content: errMsg,
            role: "ASSISTANT",
            type: "ERROR",
            model: selectedModel,
          },
        }),
      );
      return { error: "Agent failed validation on all attempts." };
    }

    const { finalSummary, filesFromSummary, usedModel, modelClient } =
      successfulResult;
    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: modelClient,
    });
    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: modelClient,
    });

    const { output: fragmentTitleOutput } =
      await fragmentTitleGenerator.run(finalSummary);
    const { output: responseOutput } =
      await responseGenerator.run(finalSummary);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("write-parsed-files-to-sandbox", async () => {
      const sandbox = await getSandbox(sandboxId);
      const rawPage =
        filesFromSummary[PREFERRED_PATH] ??
        Object.values(filesFromSummary)[0] ??
        "";
      const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
      const closed = !isLikelyBalanced(sanitized)
        ? conservativeAutoClose(sanitized) ?? sanitized
        : sanitized;
      const contentToWrite = closed.endsWith("\n")
        ? closed
        : closed + "\n";
      try {
        await sandbox.files.remove("pages/index.tsx");
      } catch { }
      await sandbox.files.write(PREFERRED_PATH, contentToWrite);
    });

    await step.run("save-success-result", async () => {
      const summaryMatch = finalSummary.match(
        /<task_summary>([\s\S]*?)<\/task_summary>/i,
      );
      const cleanSummary = summaryMatch
        ? summaryMatch[1].trim()
        : "Task completed.";
      return await prisma.message.create({
        data: {
          projectId,
          content: parseAgentOutput(responseOutput) || cleanSummary,
          role: "ASSISTANT",
          type: "RESULT",
          model: usedModel || selectedModel,
          fragment: {
            create: {
              sandboxUrl,
              title:
                parseAgentOutput(fragmentTitleOutput) || "New Fragment",
              files: filesFromSummary,
            },
          },
        },
      });
    });

    return {
      url: sandboxUrl,
      title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
      files: filesFromSummary,
      summary: finalSummary,
      model: usedModel || selectedModel,
    };
  },
);
