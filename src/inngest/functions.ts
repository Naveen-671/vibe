

import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { parseFilesFromSummary } from "@/inngest/parser";
import {
  createAgent,
  gemini,
  createNetwork,
  type Message,
  createState,
  openai
} from "@inngest/agent-kit";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  logToolResult,
  parseAgentOutput
} from "./utils";
import {
  FRAGMENT_TITLE_PROMPT,
  RESPONSE_PROMPT,
  SIMPLE_PROMPT,
  PROMPT
} from "@/prompt";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT15 } from "./types";

/**
 * AgentState shape stored in the agent network.
 */
interface AgentState {
  summary?: string;
  files?: Record<string, string>;
  error?: string;
  iteration?: number;
}

/* ----------------- small utilities ----------------- */

function isLikelyBalanced(code: string): boolean {
  const counts = {
    roundOpen: (code.match(/\(/g) || []).length,
    roundClose: (code.match(/\)/g) || []).length,
    curlyOpen: (code.match(/\{/g) || []).length,
    curlyClose: (code.match(/\}/g) || []).length,
    squareOpen: (code.match(/\[/g) || []).length,
    squareClose: (code.match(/\]/g) || []).length,
    backticks: (code.match(/`/g) || []).length
  };

  if (counts.roundOpen !== counts.roundClose) return false;
  if (counts.curlyOpen !== counts.curlyClose) return false;
  if (counts.squareOpen !== counts.squareClose) return false;
  if (counts.backticks % 2 !== 0) return false;
  return true;
}

/* ----------------- trivial-detection ----------------- */

function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
  if (!files) return true;
  const pageContent =
    files["app/page.tsx"] ||
    files["pages/index.tsx"] ||
    Object.entries(files).find(([p]) => p.endsWith("page.tsx") || p.endsWith("index.tsx"))?.[1] ||
    "";
  if (!pageContent) return true;

  const content = pageContent.toLowerCase();
  const lineCount = pageContent.split("\n").length;

  // Heuristics:
  if (lineCount < 45) return true;

  const requiredKeywords = [
    "hero",
    "feature",
    "features",
    "call to action",
    "cta",
    "get started",
    "footer",
    "hero section"
  ];
  const hasKeyword = requiredKeywords.some((k) => content.includes(k));
  const structuralSignals = ["<section", "role=\"banner\"", "role=\"contentinfo\"", "aria-label=\"features\""];
  const hasStructureSignal = structuralSignals.some((s) => content.includes(s));

  return !(hasKeyword || hasStructureSignal);
}

/* ----------------- model lists ----------------- */

const A4F_MODELS = [
  "provider-3/gpt-4o-mini",
  "provider-6/gpt-4o",
  "provider-2/codestral",
  "provider-6/gpt-4.1",
  "provider-6/gpt-4.1-mini",
  "provider-2/gpt-5-nano",
  "provider-2/glm-4.5-air",
  "provider-6/qwen3-coder-480b-a35b",
  "provider-6/llama-4-maverick",
  "provider-3/deepseek-v3",
  "provider-6/kimi-k2-instruct",
  "provider-6/qwen-3-235b-a22b-2507",
  "provider-6/gemini-2.5-flash-thinking",
  "provider-6/llama-4-scout",
];

const NVIDIA_MODELS = [
  "openai/gpt-oss-120b",
  "mistralai/mistral-nemotron",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5"
];
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash"];
const OPENROUTER_MODELS = [
  "openai/gpt-oss-20b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
  "moonshotai/kimi-k2:free",
  "microsoft/phi-4-mini-instruct"
];
const SAMURAI_MODELS = [
  "Free/Openai/Gpt-5-mini",
  "Free/Openai/gpt-5-nano",
  "claude-3.5-sonnet(clinesp)",
  "gpt-4-0314(clinesp)",
  "deepseek-r1-0528:free(clinesp)"
];
const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"];

/* ----------------- typed model client ----------------- */

type OpenAiClient = ReturnType<typeof openai>;
type GeminiClient = ReturnType<typeof gemini>;
type ModelClient = OpenAiClient | GeminiClient;

/* ----------------- model client routing (defensive) ----------------- */

const getModelClient = (rawModelId?: unknown): ModelClient => {
  const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");

  if (!modelId) {
    throw new Error("No modelId provided to getModelClient.");
  }

  const safeIncludes = (arr: unknown, id: string): boolean => Array.isArray(arr) && (arr as string[]).includes(id);

  // A4F routing
  if (A4F_MODELS.includes(modelId)) {
    const key = process.env.OPENAI_A4F_API_KEY;
    const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
    if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
    return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
  }

  // Special-case: gpt-4.1-mini -> GPT4All / custom endpoint
  if (modelId === "gpt-4.1-mini") {
    const base = process.env.OPENAI_BASE_URL_GPT4ALL;
    const key = process.env.OPENAI_API_KEY_GPT4ALL;
    if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
    if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
    return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
  }

  // OpenRouter models
  if (safeIncludes(OPENROUTER_MODELS, modelId)) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
    return openai({ model: modelId, baseUrl: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY }) as OpenAiClient;
  }

  // NVIDIA-hosted models
  if (safeIncludes(NVIDIA_MODELS, modelId)) {
    if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
    return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
  }

  // Samurai gateway
  if (safeIncludes(SAMURAI_MODELS, modelId)) {
    if (!process.env.OPENAI_API_KEY_SAMURAI) throw new Error("OPENAI_API_KEY_SAMURAI is not set");
    return openai({ model: modelId, baseUrl: "https://samuraiapi.in/v1", apiKey: process.env.OPENAI_API_KEY_SAMURAI }) as OpenAiClient;
  }

  // Gemini models
  if (safeIncludes(GEMINI_MODELS, modelId)) {
    return gemini({ model: modelId }) as GeminiClient;
  }

  // Heuristic: slash-containing ids (or common HF prefixes) -> Hugging Face router
  const looksLikeHf =
    typeof modelId === "string" && (modelId.includes("/") || /^meta-|^mistralai|^deepseek|^CohereForAI|^provider/i.test(modelId));
  if (looksLikeHf) {
    const hfKey = process.env.HUGGING_FACE_API_KEY;
    if (!hfKey) throw new Error("HUGGING_FACE_API_KEY is not set (required for Hugging Face model routing).");
    const hfBase = process.env.HUGGING_FACE_BASE_URL || "https://router.huggingface.co/v1";
    return openai({ model: modelId, baseUrl: hfBase, apiKey: hfKey }) as OpenAiClient;
  }

  throw new Error(`No client configuration found for modelId "${modelId}".`);
};

function getSystemPromptForModel(modelId?: string): string {
  if (typeof modelId === "string" && EXPERT_MODELS.includes(modelId)) return PROMPT;
  return SIMPLE_PROMPT;
}

/* ----------------- zod schema for the files payload ----------------- */

const FileItemSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});
const FilesToolArgsSchema = z.object({
  files: z.array(FileItemSchema)
});
// type FilesToolArgs = z.infer<typeof FilesToolArgsSchema>;

/* ----------------- helper: extract JSON block from text (robust) ----------------- */

function extractJsonLike(text: string): string | null {
  if (!text) return null;

  // 1) try fenced code block first
  const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeFenceMatch) return codeFenceMatch[1].trim();

  // 2) find the first top-level {...} block (slice from first { to last })
  const firstBraceIdx = text.indexOf("{");
  const lastBraceIdx = text.lastIndexOf("}");
  if (firstBraceIdx >= 0 && lastBraceIdx > firstBraceIdx) {
    return text.slice(firstBraceIdx, lastBraceIdx + 1).trim();
  }

  // 3) fallback to any curly-match (rare)
  const curlyMatch = text.match(/({[\s\S]*})/m);
  if (curlyMatch) return curlyMatch[1].trim();

  return null;
}

/* ----------------- small helper type for network.run result shape ----------------- */
type NetworkRunResult = {
  state?: {
    data?: AgentState;
  };
} | undefined;

/* ----------------- inngest handler ----------------- */

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent", concurrency: 5 },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const eventData = (event.data as Record<string, unknown>) ?? {};
    const selectedModel = (eventData.model as string | undefined) ?? "provider-2/gpt-5-nano";
    const projectId = (eventData.projectId as string) || "";

    // Validate model selection early
    if (!selectedModel) {
      const errMsg = "No model selected. Please provide a 'model' in the event data.";
      await prisma.message.create({
        data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" }
      });
      return { error: errMsg };
    }


    // Create sandbox
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-testz");
      await sandbox.setTimeout(SANDBOX_TIMEOUT15);
      return sandbox.sandboxId;
    });

    // Pull recent messages for context
    const previousMessages = await step.run("get-previous-messages", async () => {
      const messages = await prisma.message.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 5
      });
      return messages.map((msg) => ({
        type: "text",
        role: msg.role === "ASSISTANT" ? "assistant" : "user",
        content: msg.content
      } as Message));
    });

    const state = createState<AgentState>({ summary: "", files: {} }, { messages: previousMessages });

    // candidate models (selected -> fallback to first available expert)
    const candidateModels: string[] = [selectedModel];
    if (!EXPERT_MODELS.includes(selectedModel)) {
      for (const m of EXPERT_MODELS) {
        try {
          getModelClient(m);
          candidateModels.push(m);
          break;
        } catch {
          // ignore
        }
      }
    }

    // We'll capture a successful result here
    let successfulResult:
      | {
          finalSummary: string;
          filesFromSummary: Record<string, string>;
          usedModel: string;
          modelClient: ModelClient;
        }
      | null = null;

    // Try models in order until we get a non-trivial, valid result.
    for (const modelCandidate of candidateModels) {
      let modelClient: ModelClient;
      try {
        modelClient = getModelClient(modelCandidate);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await step.run("save-model-client-error", async () => {
          return prisma.message.create({
            data: {
              projectId,
              content: `Model client creation failed for ${modelCandidate}: ${msg}`,
              role: "ASSISTANT",
              type: "ERROR",
              model: modelCandidate
            }
          });
        });
        continue;
      }

      // Augment system prompt to ask for strict JSON output block
      const baseSystem = getSystemPromptForModel(modelCandidate);
      const enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{\n  "files": [\n    { "path": "app/page.tsx", "content": "FILE CONTENT HERE" }\n  ]\n}\n\nWrap the JSON in triple-backticks with "json" for clarity if possible. After the JSON object, include exactly one line with <task_summary>...</task_summary> describing what was created.\n\nDo NOT output any additional commentary.`;

      const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

      // Agent (no typed createTool to avoid the handler/never inference)
      const codeAgent = createAgent<AgentState>({
        name: "code-agent",
        system: systemPrompt,
        model: modelClient,
        lifecycle: {
          onResponse: async ({ result, network }) => {
            if (!network) return result;
            const text = lastAssistantTextMessageContent(result);
            if (text) network.state.data.summary = text;
            return result;
          }
        }
      });

      const network = createNetwork<AgentState>({
        name: "coding-agent-network",
        agents: [codeAgent],
        maxIter: 1,
        router: async ({ network }) => (network.state.data.summary ? undefined : codeAgent)
      });

      // Run the agent network (wrapped to capture provider errors)
      let runResult: NetworkRunResult;
      try {
        runResult = (await network.run((eventData.value as string) ?? "", { state })) as NetworkRunResult;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await step.run("save-provider-error", async () => {
          return prisma.message.create({
            data: {
              projectId,
              content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`,
              role: "ASSISTANT",
              type: "ERROR",
              model: modelCandidate
            }
          });
        });
        continue;
      }

      const finalSummary = runResult?.state?.data?.summary ?? "";

      // Attempt 1: extract JSON block from finalSummary (preferred)
      let filesFromSummary: Record<string, string> | null = null;
      const jsonLike = extractJsonLike(finalSummary);
      if (jsonLike) {
        let parsed: unknown | null = null;

        const tryParse = (s: string) => {
          try {
            return JSON.parse(s);
          } catch {
            return null;
          }
        };

        // 1) direct parse
        parsed = tryParse(jsonLike);

        // 2) handle quoted/stringified JSON e.g. "{ \"files\": [...] }"
        if (!parsed) {
          if (/^\s*["']/.test(jsonLike)) {
            const once = tryParse(jsonLike);
            if (typeof once === "string") {
              parsed = tryParse(once);
            }
          }
        }

        // 3) fallback: slice from first { to last }
        if (!parsed) {
          const first = jsonLike.indexOf("{");
          const last = jsonLike.lastIndexOf("}");
          if (first >= 0 && last > first) {
            const candidate = jsonLike.slice(first, last + 1);
            parsed = tryParse(candidate);
          }
        }

        if (parsed) {
          const parsedZ = FilesToolArgsSchema.safeParse(parsed);
          if (parsedZ.success) {
            filesFromSummary = {};
            for (const f of parsedZ.data.files) filesFromSummary[f.path] = f.content;
            logToolResult({ toolName: "parsed-json-output", output: parsedZ.data.files });
          } else {
            await step.run("save-invalid-json-extract", async () => {
              return prisma.message.create({
                data: {
                  projectId,
                  content: `Extracted JSON failed validation for ${modelCandidate}: ${JSON.stringify(parsedZ.error.format())}`,
                  role: "ASSISTANT",
                  type: "ERROR",
                  model: modelCandidate
                }
              });
            });
          }
        } else {
          await step.run("save-json-parse-error", async () => {
            return prisma.message.create({
              data: {
                projectId,
                content: `JSON.parse failed on extracted JSON for ${modelCandidate}. Raw extract: ${JSON.stringify(jsonLike.slice(0, 400))}`,
                role: "ASSISTANT",
                type: "ERROR",
                model: modelCandidate
              }
            });
          });
        }
      }

      // Attempt 2: fallback to parseFilesFromSummary (existing parser)
      if (!filesFromSummary) {
        try {
          const fallback = parseFilesFromSummary(finalSummary, modelCandidate);
          if (fallback && Object.keys(fallback).length > 0) {
            filesFromSummary = fallback;
            logToolResult({ toolName: "fallback-parser", output: Object.keys(fallback) });
          }
        } catch (e) {
          // swallow and log
          await step.run("save-fallback-parse-error", async () => {
            return prisma.message.create({
              data: {
                projectId,
                content: `parseFilesFromSummary threw for ${modelCandidate}: ${(e instanceof Error) ? e.message : String(e)}`,
                role: "ASSISTANT",
                type: "ERROR",
                model: modelCandidate
              }
            });
          });
        }
      }

      // Validate and check trivial
      if (!filesFromSummary || Object.keys(filesFromSummary).length === 0) {
        await step.run("save-invalid-attempt", async () => {
          return prisma.message.create({
            data: {
              projectId,
              content: `Attempt with model ${modelCandidate} did not produce parsable file content. Raw output: ${JSON.stringify(finalSummary)}`,
              role: "ASSISTANT",
              type: "ERROR",
              model: modelCandidate
            }
          });
        });
        continue; // try next model
      }

      if (isTrivialApp(filesFromSummary)) {
        await step.run("save-trivial-output", async () => {
          return prisma.message.create({
            data: {
              projectId,
              content: `Attempt with model ${modelCandidate} produced trivial app (too small or missing landing sections).`,
              role: "ASSISTANT",
              type: "ERROR",
              model: modelCandidate
            }
          });
        });
        continue; // try next candidate
      }

      // Success!
      successfulResult = {
        finalSummary,
        filesFromSummary,
        usedModel: modelCandidate,
        modelClient
      };
      break;
    } // end modelCandidates loop

    if (!successfulResult) {
      const errorMessage = `Agent failed validation with all attempted models.`;
      await step.run("save-error-result-final", async () => {
        return prisma.message.create({
          data: {
            projectId,
            content: errorMessage,
            role: "ASSISTANT",
            type: "ERROR",
            model: selectedModel
          }
        });
      });
      return { error: "Agent failed validation on all attempts." };
    }

    // success path
    const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;

    // Title & response generation
    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: modelClient
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: modelClient
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
    const { output: responseOutput } = await responseGenerator.run(finalSummary);

    // Get sandbox public URL
    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    // Write parsed files to sandbox
    await step.run("write-parsed-files-to-sandbox", async () => {
      const sandbox = await getSandbox(sandboxId);
      for (const [p, rawContent] of Object.entries(filesFromSummary)) {
        const content = rawContent;

        if (!isLikelyBalanced(content)) {
          console.warn(`File ${p} looks unbalanced (possible truncation). Writing anyway; consider re-requesting formatted output.`);
        }

        if (p === "app/page.tsx") {
          try {
            await sandbox.files.remove("pages/index.tsx");
          } catch (e) {
            console.log("remove pages/index.tsx error ->", (e instanceof Error) ? e.message : String(e));
          }
        }

        await sandbox.files.write(p, content);
      }
    });

    // Persist final result + fragment record
    await step.run("save-success-result", async () => {
      const summaryMatch = finalSummary.match(/<task_summary>([\s\S]*?)<\/task_summary>/i);
      const cleanSummary = summaryMatch ? summaryMatch[1].trim() : "Task completed.";
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
              title: parseAgentOutput(fragmentTitleOutput) || "New Fragment",
              files: filesFromSummary
            }
          }
        }
      });
    });

    // Return payload
    return {
      url: sandboxUrl,
      title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
      files: filesFromSummary,
      summary: finalSummary,
      model: usedModel || selectedModel
    };
  }
);
