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
  "provider-6/gemini-2.5-flash",
  "provider-6/o4-mini-medium",
  "provider-6/o3-medium",
  "provider-3/deepseek-v3-0324",
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

// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   type Message,
//   createState,
//   openai
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   // logToolResult,
//   parseAgentOutput
// } from "./utils";
// import {
//   FRAGMENT_TITLE_PROMPT,
//   RESPONSE_PROMPT,
//   SIMPLE_PROMPT,
//   PROMPT
// } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT15 } from "./types";

// /**
//  * AgentState shape stored in the agent network.
//  */
// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }

// /* ----------------- small utilities ----------------- */

// function isLikelyBalanced(code: string): boolean {
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/\{/g) || []).length,
//     curlyClose: (code.match(/\}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/\]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length
//   };

//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// /* ----------------- trivial-detection (diagnostic) ----------------- */

// function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
//   if (!files) return true;

//   const pageContent =
//     files["app/page.tsx"] ||
//     files["pages/index.tsx"] ||
//     Object.entries(files).find(([path]) => path.endsWith("page.tsx") || path.endsWith("index.tsx"))?.[1] ||
//     "";

//   if (!pageContent) return true;

//   const content = pageContent.toLowerCase();
//   const lineCount = pageContent.split("\n").length;

//   const formSignals = [
//     "<form",
//     "input",
//     "textarea",
//     "select",
//     "button",
//     "type=\"text\"",
//     "type=\"password\"",
//     "type=\"tel\"",
//     "cvv",
//     "card number",
//     "expiry",
//     "payment",
//     "credit card",
//     "card-holder",
//     "cardholder",
//     "cardholder name"
//   ];
//   if (formSignals.some((s) => content.includes(s))) return false;

//   if (lineCount < 30) return true;

//   const requiredKeywords = [
//     "hero",
//     "feature",
//     "features",
//     "call to action",
//     "cta",
//     "get started",
//     "footer",
//     "hero section"
//   ];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", "role=\"banner\"", "role=\"contentinfo\"", "aria-label=\"features\""];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));

//   return !(hasKeyword || hasStructureSignal);
// }

// /* ----------------- model lists ----------------- */

// const A4F_MODELS = [
//   "provider-3/gpt-4o-mini",
//   "provider-6/gpt-4o",
//   "provider-2/codestral",
//   "provider-6/gpt-4.1",
//   "provider-6/gpt-4.1-mini",
//   "provider-2/gpt-5-nano",
//   "provider-2/glm-4.5-air",
//   "provider-6/qwen3-coder-480b-a35b",
//   "provider-6/llama-4-maverick",
//   "provider-3/deepseek-v3",
//   "provider-6/kimi-k2-instruct",
//   "provider-6/qwen-3-235b-a22b-2507",
//   "provider-6/gemini-2.5-flash-thinking",
//   "provider-6/llama-4-scout",
//   "provider-6/gemini-2.5-flash",
//   "provider-6/o4-mini-medium",
//   "provider-6/o3-medium",
//   "provider-3/deepseek-v3-0324"
// ] as const;

// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5"
// ] as const;
// const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash"] as const;
// const OPENROUTER_MODELS = [
//   "openai/gpt-oss-20b:free",
//   "z-ai/glm-4.5-air:free",
//   "qwen/qwen3-coder:free",
//   "moonshotai/kimi-k2:free",
//   "microsoft/phi-4-mini-instruct"
// ] as const;
// const SAMURAI_MODELS = [
//   "Free/Openai/Gpt-5-mini",
//   "Free/Openai/gpt-5-nano",
//   "claude-3.5-sonnet(clinesp)",
//   "gpt-4-0314(clinesp)",
//   "deepseek-r1-0528:free(clinesp)"
// ] as const;
// const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"] as const;

// /* ----------------- typed model client ----------------- */

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// /* ----------------- model client routing (defensive) ----------------- */

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");

//   const safeIncludes = (arr: readonly string[] | unknown, id: string): boolean =>
//     Array.isArray(arr) && (arr as readonly string[]).includes(id);

//   if (safeIncludes(A4F_MODELS, modelId)) {
//     const key = process.env.OPENAI_A4F_API_KEY;
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   if (safeIncludes(OPENROUTER_MODELS, modelId)) {
//     if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY }) as OpenAiClient;
//   }

//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }

//   if (safeIncludes(SAMURAI_MODELS, modelId)) {
//     if (!process.env.OPENAI_API_KEY_SAMURAI) throw new Error("OPENAI_API_KEY_SAMURAI is not set");
//     return openai({ model: modelId, baseUrl: "https://samuraiapi.in/v1", apiKey: process.env.OPENAI_API_KEY_SAMURAI }) as OpenAiClient;
//   }

//   if (safeIncludes(GEMINI_MODELS, modelId)) {
//     return gemini({ model: modelId }) as GeminiClient;
//   }

//   const looksLikeHf =
//     typeof modelId === "string" && (modelId.includes("/") || /^meta-|^mistralai|^deepseek|^CohereForAI|^provider/i.test(modelId));
//   if (looksLikeHf) {
//     const hfKey = process.env.HUGGING_FACE_API_KEY;
//     if (!hfKey) throw new Error("HUGGING_FACE_API_KEY is not set (required for Hugging Face model routing).");
//     const hfBase = process.env.HUGGING_FACE_BASE_URL || "https://router.huggingface.co/v1";
//     return openai({ model: modelId, baseUrl: hfBase, apiKey: hfKey }) as OpenAiClient;
//   }

//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ----------------- zod schema for the files payload ----------------- */

// const FileItemSchema = z.object({
//   path: z.string().min(1),
//   content: z.string()
// });
// const FilesToolArgsSchema = z.object({
//   files: z.array(FileItemSchema)
// });

// /* ----------------- robust JSON extraction & parsing ----------------- */

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const tryParse = (text: string) => {
//     try {
//       return JSON.parse(text) as unknown;
//     } catch {
//       return null;
//     }
//   };

//   // direct
//   let parsed = tryParse(s);
//   if (parsed) return parsed;

//   // strip trailing commas
//   const removeTrailingCommas = s.replace(/,\s*(?=[}\]])/g, "");
//   parsed = tryParse(removeTrailingCommas);
//   if (parsed) return parsed;

//   // quoted JSON string
//   const trimmed = s.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unquoted = trimmed.slice(1, -1);
//     parsed = tryParse(unquoted);
//     if (parsed) return parsed;
//     const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\'/g, "'");
//     parsed = tryParse(unescaped);
//     if (parsed) return parsed;
//   }

//   // conservative key-quote fix
//   const singleToDouble = s.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, (_, __, key) => `"${key}":`);
//   parsed = tryParse(singleToDouble);
//   if (parsed) return parsed;

//   return null;
// }

// function extractJsonLike(text: string): string | null {
//   if (!text) return null;
//   const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
//   const candidates: string[] = [];
//   let match: RegExpExecArray | null;
//   while ((match = fenceRegex.exec(text)) !== null) candidates.push(match[1].trim());
//   if (candidates.length > 0) {
//     const best = candidates.find((c) => /"files"\s*:|"\.tsx"|"\.jsx"|"\.ts"|'"path"\s*:|"\s*content"\s*:|files\s*:/.test(c));
//     return (best ?? candidates[0]).trim();
//   }
//   const curlyMatches = Array.from(text.matchAll(/({[\s\S]*?})/g)).map((r) => r[1]);
//   if (curlyMatches.length > 0) {
//     const prefer = curlyMatches.find((c) => /"files"\s*:|"\.tsx"|'"path"\s*:|files\s*:/.test(c));
//     return (prefer ?? curlyMatches[0]).trim();
//   }
//   return null;
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object" || parsed === null) return null;
//   const obj = parsed as Record<string, unknown>;

//   // files array
//   if (Array.isArray(obj.files)) {
//     const arr = obj.files as unknown[];
//     const out: Record<string, string> = {};
//     for (const item of arr) {
//       if (item && typeof item === "object") {
//         const itemObj = item as Record<string, unknown>;
//         const pathVal = itemObj.path;
//         const contentVal = itemObj.content;
//         if (typeof pathVal === "string" && typeof contentVal === "string") out[pathVal] = contentVal;
//       }
//     }
//     if (Object.keys(out).length > 0) return out;
//   }

//   // files mapping
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fileMap = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [k, v] of Object.entries(fileMap)) if (typeof v === "string") out[k] = v;
//     if (Object.keys(out).length > 0) return out;
//   }

//   // single file {path,content}
//   if (typeof obj.path === "string" && typeof obj.content === "string") return { [obj.path]: obj.content };

//   // direct mapping { "app/page.tsx": "..." }
//   const directMapCandidates = Object.entries(obj).filter(([k, v]) => typeof k === "string" && typeof v === "string");
//   if (directMapCandidates.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [k, v] of directMapCandidates) out[k] = v as string;
//     if (Object.keys(out).some((key) => key.includes(".") || key.includes("/"))) return out;
//   }

//   return null;
// }

// /* ----------------- conservative auto-close for truncations ----------------- */

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (str: string, ch: string) => (str.match(new RegExp(`\\${ch}`, "g")) || []).length;

//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out = out + ")".repeat(roundOpen - roundClose);

//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out = out + "}".repeat(curlyOpen - curlyClose);

//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out = out + "]".repeat(squareOpen - squareClose);

//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out = out + "`";

//   return isLikelyBalanced(out) ? out : null;
// }

// /* ----------------- helper types ----------------- */

// type ParsedResult = {
//   files: Record<string, string> | null;
//   parseText: string | null;
//   parsedRaw: unknown | null;
// };

// /* ----------------- handler: Autonomous Bug Solver with improved fixer & single final log ----------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const eventData = (event.data as Record<string, unknown>) ?? {};

//     // configurable retries (1..10)
//     const rawRetries = Number(eventData.selfFixRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetries) ? Math.floor(rawRetries) : 5));

//     // enforce landing page or accept small components/forms
//     const enforceLanding = Boolean(eventData.enforceLanding ?? false);

//     const selectedModel = (eventData.model as string | undefined) ?? "provider-2/gpt-5-nano";
//     const projectId = (eventData.projectId as string) || "";

//     if (!selectedModel) {
//       const errMsg = "No model selected. Please provide a 'model' in the event data.";
//       await prisma.message.create({
//         data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" }
//       });
//       return { error: errMsg };
//     }

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT15);
//       return sandbox.sandboxId;
//     });

//     // pull recent messages for context
//     const previousMessages = await step.run("get-previous-messages", async () => {
//       const messages = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 5
//       });
//       return messages.map((msg) => ({
//         type: "text",
//         role: msg.role === "ASSISTANT" ? "assistant" : "user",
//         content: msg.content
//       } as Message));
//     });

//     const state = createState<AgentState>({ summary: "", files: {} }, { messages: previousMessages });

//     // candidate models
//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {
//           // ignore
//         }
//       }
//     }

//     let successfulResult:
//       | {
//           finalSummary: string;
//           filesFromSummary: Record<string, string>;
//           usedModel: string;
//           modelClient: ModelClient;
//         }
//       | null = null;

//     // helper: parsing + fallback using parseFilesFromSummary
//     const extractAndNormalize = async (text: string, modelId?: string): Promise<ParsedResult> => {
//       const jsonLike = extractJsonLike(text);
//       if (!jsonLike) {
//         // fallback to parseFilesFromSummary when no JSON block
//         if (text.trim().length > 0) {
//           try {
//             const fallback = parseFilesFromSummary(text, modelId);
//             if (fallback && Object.keys(fallback).length > 0) {
//               return { files: fallback, parseText: null, parsedRaw: null };
//             }
//           } catch {
//             // ignore fallback errors
//           }
//         }
//         return { files: null, parseText: null, parsedRaw: null };
//       }

//       const parseCandidates = [jsonLike, text];
//       let parsedResult: unknown | null = null;
//       for (const candidate of parseCandidates) {
//         parsedResult = safeJsonParse(candidate);
//         if (parsedResult) break;
//       }

//       if (!parsedResult) {
//         // fallback parser
//         try {
//           const fallback = parseFilesFromSummary(text, modelId);
//           if (fallback && Object.keys(fallback).length > 0) return { files: fallback, parseText: jsonLike, parsedRaw: null };
//         } catch {
//           // ignore
//         }
//         return { files: null, parseText: jsonLike, parsedRaw: null };
//       }

//       const normalized = normalizeParsedFiles(parsedResult);
//       if (normalized) return { files: normalized, parseText: jsonLike, parsedRaw: parsedResult };

//       const zres = FilesToolArgsSchema.safeParse(parsedResult);
//       if (zres.success) {
//         const normalizedZ: Record<string, string> = {};
//         for (const f of zres.data.files) normalizedZ[f.path] = f.content;
//         return { files: normalizedZ, parseText: jsonLike, parsedRaw: parsedResult };
//       }

//       // final fallback
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) return { files: fallback, parseText: jsonLike, parsedRaw: parsedResult };
//       } catch {
//         // ignore
//       }

//       return { files: null, parseText: jsonLike, parsedRaw: parsedResult };
//     };

//     // iterate candidate models
//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () => {
//           return prisma.message.create({
//             data: {
//               projectId,
//               content: `Model client creation failed for ${modelCandidate}: ${msg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate
//             }
//           });
//         });
//         continue;
//       }

//       const baseSystem = getSystemPromptForModel(modelCandidate);
//       const enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{\n  "files": [\n    { "path": "app/page.tsx", "content": "FILE CONTENT HERE" }\n  ]\n}\n\nWrap the JSON in triple-backticks with "json" for clarity if possible. After the JSON object, include exactly one line with <task_summary>...</task_summary> describing what was created.\n\nDo NOT output any additional commentary.`;

//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentState>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             const text = lastAssistantTextMessageContent(result);
//             if (text) network.state.data.summary = text;
//             return result;
//           }
//         }
//       });

//       const network = createNetwork<AgentState>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent)
//       });

//       // run primary agent once
//       let runResult: { state?: { data?: AgentState } } | undefined;
//       try {
//         runResult = (await network.run((eventData.value as string) ?? "", { state })) as { state?: { data?: AgentState } } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () => {
//           return prisma.message.create({
//             data: {
//               projectId,
//               content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate
//             }
//           });
//         });
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";

//       // initial parse+normalize
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) =>
//         !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = {
//           finalSummary,
//           filesFromSummary: filesFromSummary as Record<string, string>,
//           usedModel: modelCandidate,
//           modelClient
//         };
//       } else {
//         // Try conservative auto-fix first on any extracted parseText (if available)
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           // If parseText includes file contents, try to auto-close each content block heuristically:
//           const possibleParsed = safeJsonParse(parseResult.parseText);
//           const normalizedPossible = normalizeParsedFiles(possibleParsed);
//           if (normalizedPossible) {
//             // attempt auto-close on each file's content
//             const autoClosed: Record<string, string> = {};
//             let anyClosed = false;
//             for (const [p, c] of Object.entries(normalizedPossible)) {
//               const closed = conservativeAutoClose(c);
//               if (closed) {
//                 autoClosed[p] = closed;
//                 anyClosed = true;
//               } else {
//                 autoClosed[p] = c;
//               }
//             }
//             if (anyClosed) {
//               filesFromSummary = autoClosed;
//             }
//           }
//         }

//         // Re-check after conservative fixes
//         if (!needsFix(filesFromSummary)) {
//           successfulResult = {
//             finalSummary,
//             filesFromSummary: filesFromSummary as Record<string, string>,
//             usedModel: modelCandidate,
//             modelClient
//           };
//         } else {
//           // Prepare clearer fixer prompt and run iterative fixer attempts
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the PREVIOUS ASSISTANT OUTPUT (which may contain JSON and a <task_summary>) and a short ERROR message describing why the output failed validation.\n\nTASK (strict): Return ONLY a single JSON object (and NOTHING else) that exactly matches one of these shapes:\n1) { \"files\": [ { \"path\": \"app/page.tsx\", \"content\": \"<FULL FILE CONTENT>\" }, ... ] }\n2) { \"files\": { \"app/page.tsx\": \"<FULL FILE CONTENT>\", ... } }\n\nAfter the JSON, include exactly one line with <task_summary> describing what you changed.\n\nREQUIREMENTS:\n- Include all files needed to run the fragment (at least app/page.tsx or pages/index.tsx when appropriate).\n- If any file appears truncated, complete it (close braces/parentheses/backticks) so that delimiters are balanced.\n- Do not include any commentary, code fences, or explanation outside the required JSON + single <task_summary> line.\n- Ensure path values are strings and content values are strings containing the full file content.\n\nDo NOT output anything else.`;

//           const fixerAgent = createAgent({
//             name: "fixer-agent",
//             system: FIXER_SYSTEM,
//             model: modelClient
//           });

//           // prepare initial lastErrorMessage and collect attempt outputs for possible later logging
//           let lastErrorMessage: string;
//           if (!parseResult.files) {
//             lastErrorMessage = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           } else {
//             lastErrorMessage = "Generated result considered trivial or missing required structure.";
//           }

//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [
//               `PREVIOUS ASSISTANT OUTPUT:`,
//               finalSummary,
//               ``,
//               `ERROR: ${lastErrorMessage}`,
//               ``,
//               `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON describing the fix.`
//             ].join("\n");

//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerOutputRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerOutputRaw);
//               // Update finalSummary so next attempt includes the last fixer output as context
//               finalSummary = fixerOutputRaw;

//               // parse the fixer output
//               const fixerParseResult = await extractAndNormalize(fixerOutputRaw, modelCandidate);
//               const fixerFiles = fixerParseResult.files;

//               // try conservative auto-close on returned files if needed
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) {
//                   const closed = conservativeAutoClose(c);
//                   repaired[p] = closed ?? c;
//                 }
//                 // set filesFromSummary candidate to repaired
//                 filesFromSummary = repaired;
//               } else {
//                 filesFromSummary = null;
//               }

//               // determine success
//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = {
//                   finalSummary,
//                   filesFromSummary: filesFromSummary as Record<string, string>,
//                   usedModel: modelCandidate,
//                   modelClient
//                 };
//                 fixerSucceeded = true;
//                 break;
//               }

//               // update lastErrorMessage and continue loop
//               if (!filesFromSummary) {
//                 lastErrorMessage = fixerParseResult.parseText
//                   ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.`
//                   : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               } else {
//                 lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//               }
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               // store as last error and break attempts (will be logged once below)
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           } // end attempts loop

//           // If fixer did not succeed, write a single consolidated DB error log (per user request)
//           if (!successfulResult) {
//             const truncatedAttempts = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//             const consolidatedMsg = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncatedAttempts}`;
//             await step.run("save-fixer-exhausted", async () => {
//               return prisma.message.create({
//                 data: {
//                   projectId,
//                   content: consolidatedMsg,
//                   role: "ASSISTANT",
//                   type: "ERROR",
//                   model: modelCandidate
//                 }
//               });
//             });
//             // continue to next modelCandidate
//             continue;
//           }
//         } // end fixer flow
//       } // end needsFix handling

//       // if we have a successful result, perform conservative repairs on any unbalanced files and then break out
//       if (successfulResult) {
//         const repairedFiles: Record<string, string> = { ...successfulResult.filesFromSummary };
//         const filesToRepair = Object.entries(repairedFiles).filter(([, c]) => !isLikelyBalanced(c));
//         if (filesToRepair.length > 0) {
//           for (const [path, content] of filesToRepair) {
//             const cons = conservativeAutoClose(content);
//             if (cons && isLikelyBalanced(cons)) {
//               repairedFiles[path] = cons;
//             }
//           }
//           successfulResult.filesFromSummary = repairedFiles;
//         }
//         // success: break candidate model loop
//         break;
//       }
//     } // end candidateModels loop

//     if (!successfulResult) {
//       const errorMessage = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () => {
//         return prisma.message.create({
//           data: {
//             projectId,
//             content: errorMessage,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: selectedModel
//           }
//         });
//       });
//       return { error: "Agent failed validation on all attempts." };
//     }

//     // success path: persist and return
//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;

//     // Title & response generation
//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: modelClient
//     });

//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: modelClient
//     });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     // Get sandbox public URL
//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     // Write parsed files to sandbox
//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       for (const [path, rawContent] of Object.entries(filesFromSummary)) {
//         const content = rawContent;
//         if (!isLikelyBalanced(content)) {
//           console.warn(`File ${path} looks unbalanced (possible truncation). Writing anyway; consider re-requesting formatted output.`);
//         }
//         if (path === "app/page.tsx") {
//           try {
//             await sandbox.files.remove("pages/index.tsx");
//           } catch (e) {
//             const em = e instanceof Error ? e.message : String(e);
//             console.log("remove pages/index.tsx error ->", em);
//           }
//         }
//         await sandbox.files.write(path, content);
//       }
//     });

//     // Persist final result + fragment record (single RESULT)
//     await step.run("save-success-result", async () => {
//       const summaryMatch = finalSummary.match(/<task_summary>([\s\S]*?)<\/task_summary>/i);
//       const cleanSummary = summaryMatch ? summaryMatch[1].trim() : "Task completed.";
//       return await prisma.message.create({
//         data: {
//           projectId,
//           content: parseAgentOutput(responseOutput) || cleanSummary,
//           role: "ASSISTANT",
//           type: "RESULT",
//           model: usedModel || selectedModel,
//           fragment: {
//             create: {
//               sandboxUrl,
//               title: parseAgentOutput(fragmentTitleOutput) || "New Fragment",
//               files: filesFromSummary
//             }
//           }
//         }
//       });
//     });

//     // Return final payload
//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel
//     };
//   }
// );
