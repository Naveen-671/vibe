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
//   logToolResult,
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

// /* ----------------- trivial-detection ----------------- */

// function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
//   if (!files) return true;
//   const pageContent =
//     files["app/page.tsx"] ||
//     files["pages/index.tsx"] ||
//     Object.entries(files).find(([p]) => p.endsWith("page.tsx") || p.endsWith("index.tsx"))?.[1] ||
//     "";
//   if (!pageContent) return true;

//   const content = pageContent.toLowerCase();
//   const lineCount = pageContent.split("\n").length;

//   // Heuristics:
//   if (lineCount < 45) return true;

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
//   "provider-3/deepseek-v3-0324",
// ];

// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5"
// ];
// const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash"];
// const OPENROUTER_MODELS = [
//   "openai/gpt-oss-20b:free",
//   "z-ai/glm-4.5-air:free",
//   "qwen/qwen3-coder:free",
//   "moonshotai/kimi-k2:free",
//   "microsoft/phi-4-mini-instruct"
// ];
// const SAMURAI_MODELS = [
//   "Free/Openai/Gpt-5-mini",
//   "Free/Openai/gpt-5-nano",
//   "claude-3.5-sonnet(clinesp)",
//   "gpt-4-0314(clinesp)",
//   "deepseek-r1-0528:free(clinesp)"
// ];
// const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"];

// /* ----------------- typed model client ----------------- */

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// /* ----------------- model client routing (defensive) ----------------- */

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");

//   if (!modelId) {
//     throw new Error("No modelId provided to getModelClient.");
//   }

//   const safeIncludes = (arr: unknown, id: string): boolean => Array.isArray(arr) && (arr as string[]).includes(id);

//   // A4F routing
//   if (A4F_MODELS.includes(modelId)) {
//     const key = process.env.OPENAI_A4F_API_KEY;
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // Special-case: gpt-4.1-mini -> GPT4All / custom endpoint
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // OpenRouter models
//   if (safeIncludes(OPENROUTER_MODELS, modelId)) {
//     if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY }) as OpenAiClient;
//   }

//   // NVIDIA-hosted models
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }

//   // Samurai gateway
//   if (safeIncludes(SAMURAI_MODELS, modelId)) {
//     if (!process.env.OPENAI_API_KEY_SAMURAI) throw new Error("OPENAI_API_KEY_SAMURAI is not set");
//     return openai({ model: modelId, baseUrl: "https://samuraiapi.in/v1", apiKey: process.env.OPENAI_API_KEY_SAMURAI }) as OpenAiClient;
//   }

//   // Gemini models
//   if (safeIncludes(GEMINI_MODELS, modelId)) {
//     return gemini({ model: modelId }) as GeminiClient;
//   }

//   // Heuristic: slash-containing ids (or common HF prefixes) -> Hugging Face router
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
//   if (typeof modelId === "string" && EXPERT_MODELS.includes(modelId)) return PROMPT;
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
// // type FilesToolArgs = z.infer<typeof FilesToolArgsSchema>;

// /* ----------------- helper: extract JSON block from text (robust) ----------------- */

// function extractJsonLike(text: string): string | null {
//   if (!text) return null;

//   // 1) try fenced code block first
//   const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (codeFenceMatch) return codeFenceMatch[1].trim();

//   // 2) find the first top-level {...} block (slice from first { to last })
//   const firstBraceIdx = text.indexOf("{");
//   const lastBraceIdx = text.lastIndexOf("}");
//   if (firstBraceIdx >= 0 && lastBraceIdx > firstBraceIdx) {
//     return text.slice(firstBraceIdx, lastBraceIdx + 1).trim();
//   }

//   // 3) fallback to any curly-match (rare)
//   const curlyMatch = text.match(/({[\s\S]*})/m);
//   if (curlyMatch) return curlyMatch[1].trim();

//   return null;
// }

// /* ----------------- small helper type for network.run result shape ----------------- */
// type NetworkRunResult = {
//   state?: {
//     data?: AgentState;
//   };
// } | undefined;

// /* ----------------- inngest handler ----------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const eventData = (event.data as Record<string, unknown>) ?? {};
//     const selectedModel = (eventData.model as string | undefined) ?? "provider-2/gpt-5-nano";
//     const projectId = (eventData.projectId as string) || "";

//     // Validate model selection early
//     if (!selectedModel) {
//       const errMsg = "No model selected. Please provide a 'model' in the event data.";
//       await prisma.message.create({
//         data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" }
//       });
//       return { error: errMsg };
//     }


//     // Create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT15);
//       return sandbox.sandboxId;
//     });

//     // Pull recent messages for context
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

//     // candidate models (selected -> fallback to first available expert)
//     const candidateModels: string[] = [selectedModel];
//     if (!EXPERT_MODELS.includes(selectedModel)) {
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

//     // We'll capture a successful result here
//     let successfulResult:
//       | {
//           finalSummary: string;
//           filesFromSummary: Record<string, string>;
//           usedModel: string;
//           modelClient: ModelClient;
//         }
//       | null = null;

//     // Try models in order until we get a non-trivial, valid result.
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

//       // Augment system prompt to ask for strict JSON output block
//       const baseSystem = getSystemPromptForModel(modelCandidate);
//       const enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{\n  "files": [\n    { "path": "app/page.tsx", "content": "FILE CONTENT HERE" }\n  ]\n}\n\nWrap the JSON in triple-backticks with "json" for clarity if possible. After the JSON object, include exactly one line with <task_summary>...</task_summary> describing what was created.\n\nDo NOT output any additional commentary.`;

//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       // Agent (no typed createTool to avoid the handler/never inference)
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
//         router: async ({ network }) => (network.state.data.summary ? undefined : codeAgent)
//       });

//       // Run the agent network (wrapped to capture provider errors)
//       let runResult: NetworkRunResult;
//       try {
//         runResult = (await network.run((eventData.value as string) ?? "", { state })) as NetworkRunResult;
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

//       const finalSummary = runResult?.state?.data?.summary ?? "";

//       // Attempt 1: extract JSON block from finalSummary (preferred)
//       let filesFromSummary: Record<string, string> | null = null;
//       const jsonLike = extractJsonLike(finalSummary);
//       if (jsonLike) {
//         let parsed: unknown | null = null;

//         const tryParse = (s: string) => {
//           try {
//             return JSON.parse(s);
//           } catch {
//             return null;
//           }
//         };

//         // 1) direct parse
//         parsed = tryParse(jsonLike);

//         // 2) handle quoted/stringified JSON e.g. "{ \"files\": [...] }"
//         if (!parsed) {
//           if (/^\s*["']/.test(jsonLike)) {
//             const once = tryParse(jsonLike);
//             if (typeof once === "string") {
//               parsed = tryParse(once);
//             }
//           }
//         }

//         // 3) fallback: slice from first { to last }
//         if (!parsed) {
//           const first = jsonLike.indexOf("{");
//           const last = jsonLike.lastIndexOf("}");
//           if (first >= 0 && last > first) {
//             const candidate = jsonLike.slice(first, last + 1);
//             parsed = tryParse(candidate);
//           }
//         }

//         if (parsed) {
//           const parsedZ = FilesToolArgsSchema.safeParse(parsed);
//           if (parsedZ.success) {
//             filesFromSummary = {};
//             for (const f of parsedZ.data.files) filesFromSummary[f.path] = f.content;
//             logToolResult({ toolName: "parsed-json-output", output: parsedZ.data.files });
//           } else {
//             await step.run("save-invalid-json-extract", async () => {
//               return prisma.message.create({
//                 data: {
//                   projectId,
//                   content: `Extracted JSON failed validation for ${modelCandidate}: ${JSON.stringify(parsedZ.error.format())}`,
//                   role: "ASSISTANT",
//                   type: "ERROR",
//                   model: modelCandidate
//                 }
//               });
//             });
//           }
//         } else {
//           await step.run("save-json-parse-error", async () => {
//             return prisma.message.create({
//               data: {
//                 projectId,
//                 content: `JSON.parse failed on extracted JSON for ${modelCandidate}. Raw extract: ${JSON.stringify(jsonLike.slice(0, 400))}`,
//                 role: "ASSISTANT",
//                 type: "ERROR",
//                 model: modelCandidate
//               }
//             });
//           });
//         }
//       }

//       // Attempt 2: fallback to parseFilesFromSummary (existing parser)
//       if (!filesFromSummary) {
//         try {
//           const fallback = parseFilesFromSummary(finalSummary, modelCandidate);
//           if (fallback && Object.keys(fallback).length > 0) {
//             filesFromSummary = fallback;
//             logToolResult({ toolName: "fallback-parser", output: Object.keys(fallback) });
//           }
//         } catch (e) {
//           // swallow and log
//           await step.run("save-fallback-parse-error", async () => {
//             return prisma.message.create({
//               data: {
//                 projectId,
//                 content: `parseFilesFromSummary threw for ${modelCandidate}: ${(e instanceof Error) ? e.message : String(e)}`,
//                 role: "ASSISTANT",
//                 type: "ERROR",
//                 model: modelCandidate
//               }
//             });
//           });
//         }
//       }

//       // Validate and check trivial
//       if (!filesFromSummary || Object.keys(filesFromSummary).length === 0) {
//         await step.run("save-invalid-attempt", async () => {
//           return prisma.message.create({
//             data: {
//               projectId,
//               content: `Attempt with model ${modelCandidate} did not produce parsable file content. Raw output: ${JSON.stringify(finalSummary)}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate
//             }
//           });
//         });
//         continue; // try next model
//       }

//       if (isTrivialApp(filesFromSummary)) {
//         await step.run("save-trivial-output", async () => {
//           return prisma.message.create({
//             data: {
//               projectId,
//               content: `Attempt with model ${modelCandidate} produced trivial app (too small or missing landing sections).`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate
//             }
//           });
//         });
//         continue; // try next candidate
//       }

//       // Success!
//       successfulResult = {
//         finalSummary,
//         filesFromSummary,
//         usedModel: modelCandidate,
//         modelClient
//       };
//       break;
//     } // end modelCandidates loop

//     if (!successfulResult) {
//       const errorMessage = `Agent failed validation with all attempted models.`;
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

//     // success path
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
//       for (const [p, rawContent] of Object.entries(filesFromSummary)) {
//         const content = rawContent;

//         if (!isLikelyBalanced(content)) {
//           console.warn(`File ${p} looks unbalanced (possible truncation). Writing anyway; consider re-requesting formatted output.`);
//         }

//         if (p === "app/page.tsx") {
//           try {
//             await sandbox.files.remove("pages/index.tsx");
//           } catch (e) {
//             console.log("remove pages/index.tsx error ->", (e instanceof Error) ? e.message : String(e));
//           }
//         }

//         await sandbox.files.write(p, content);
//       }
//     });

//     // Persist final result + fragment record
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

//     // Return payload
//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel
//     };
//   }
// );

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
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
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

//                                    good           GOOD                                     GOOD
// // functions.ts
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
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
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
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
//   "nvidia/llama-3.1-nemotron-ultra-253b-v1",
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

// /* ----------------- robust JSON extraction & parsing helpers ----------------- */

// /**
//  * Find the first balanced JSON object substring in `text`.
//  * Returns the substring (including outer braces) or null.
//  */
// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prevChar = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prevChar !== "\\") {
//       inString = !inString;
//     }
//     if (!inString) {
//       if (ch === "{") depth++;
//       if (ch === "}") {
//         depth--;
//         if (depth === 0) {
//           return text.slice(start, i + 1);
//         }
//       }
//     }
//     prevChar = ch;
//   }
//   return null;
// }

// /**
//  * Heuristic sanitizer for file content strings returned in the JSON.
//  * - Remove wrapping quotes accidentally left by models.
//  * - Trim excessive leading indentation/newlines.
//  * - Convert escaped newline sequences to real newlines if content appears encoded.
//  * - Remove stray trailing filename-like lines appended by some models.
//  */
// function sanitizeFileContent(raw: string): string {
//   let s = raw ?? "";
//   if (typeof s !== "string") s = String(s);

//   // Remove wrapping single/double quotes if present
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
//     s = s.slice(1, -1);
//   }

//   // If literal "\n" present but no real newlines, unescape
//   if (s.includes("\\n") && !s.includes("\n")) {
//     s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   }

//   // Remove single leading newline and trim start
//   s = s.replace(/^\s*\n/, "");

//   // Remove trailing stray file markers like "\napp\ncomponent-0.txt" or "\napp\npage.tsx"
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");

//   // Trim trailing whitespace
//   return s.trimEnd();
// }

// /**
//  * Force a single-file mapping to app/page.tsx (per requirement).
//  * Preference order: exact app/page.tsx, any page/index file, any tsx/js file, else first file.
//  */
// const PREFERRED_OUTPUT_PATH = "app/page.tsx";
// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (Object.prototype.hasOwnProperty.call(files, PREFERRED_OUTPUT_PATH)) {
//     return { [PREFERRED_OUTPUT_PATH]: sanitizeFileContent(files[PREFERRED_OUTPUT_PATH]) };
//   }

//   // prefer page/index files
//   for (const [k, v] of Object.entries(files)) {
//     const lower = k.toLowerCase();
//     if (lower.endsWith("page.tsx") || lower.endsWith("page.jsx") || lower.endsWith("index.tsx") || lower.endsWith("index.jsx")) {
//       return { [PREFERRED_OUTPUT_PATH]: sanitizeFileContent(v) };
//     }
//   }

//   // prefer any tsx/ts/jsx/js file
//   for (const [k, v] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(k.toLowerCase())) {
//       return { [PREFERRED_OUTPUT_PATH]: sanitizeFileContent(v) };
//     }
//   }

//   // fallback to first file content
//   const first = Object.entries(files)[0];
//   if (first) {
//     return { [PREFERRED_OUTPUT_PATH]: sanitizeFileContent(first[1]) };
//   }

//   return null;
// }

// /* ----------------- robust JSON parse ----------------- */

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;

//   const tryParse = (txt: string) => {
//     try {
//       return JSON.parse(txt) as unknown;
//     } catch {
//       return null;
//     }
//   };

//   // direct parse
//   let parsed = tryParse(s);
//   if (parsed) return parsed;

//   // try balanced JSON substring
//   const balanced = findBalancedJSONObject(s);
//   if (balanced) {
//     parsed = tryParse(balanced);
//     if (parsed) return parsed;
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     parsed = tryParse(cleaned);
//     if (parsed) return parsed;
//   }

//   // remove trailing commas and try again
//   const removeTrailingCommas = s.replace(/,\s*(?=[}\]])/g, "");
//   parsed = tryParse(removeTrailingCommas);
//   if (parsed) return parsed;

//   // quoted JSON string handling
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
//   const singleToDouble = s.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   parsed = tryParse(singleToDouble);
//   if (parsed) return parsed;

//   return null;
// }

// function extractJsonLike(text: string): string | null {
//   if (!text) return null;

//   // fenced JSON blocks
//   const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
//   const candidates: string[] = [];
//   let match: RegExpExecArray | null;
//   while ((match = fenceRegex.exec(text)) !== null) {
//     candidates.push(match[1].trim());
//   }

//   if (candidates.length > 0) {
//     const best = candidates.find((c) => /"files"\s*:|"\.tsx"|"\.jsx"|"\.ts"|'"path"\s*:|"\s*content"\s*:|files\s*:/.test(c));
//     let chosen = (best ?? candidates[0]).trim();
//     const lastBrace = chosen.lastIndexOf("}");
//     if (lastBrace > -1) chosen = chosen.slice(0, lastBrace + 1);
//     return chosen.trim();
//   }

//   // fallback: match first balanced curly block
//   const curlyMatches = Array.from(text.matchAll(/({[\s\S]*?})/g)).map((r) => r[1]);
//   if (curlyMatches.length > 0) {
//     const prefer = curlyMatches.find((c) => /"files"\s*:|"\.tsx"|'"path"\s*:|files\s*:/.test(c));
//     let chosen = (prefer ?? curlyMatches[0]).trim();
//     const lastBrace = chosen.lastIndexOf("}");
//     if (lastBrace > -1) chosen = chosen.slice(0, lastBrace + 1);
//     return chosen.trim();
//   }

//   // as last resort, try to find a balanced JSON object anywhere
//   const balanced = findBalancedJSONObject(text);
//   if (balanced) return balanced;

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
//         if (typeof pathVal === "string" && typeof contentVal === "string") {
//           out[pathVal] = sanitizeFileContent(contentVal);
//         }
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   // files mapping
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fileMap = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [k, v] of Object.entries(fileMap)) {
//       if (typeof v === "string") out[k] = sanitizeFileContent(v);
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   // single file {path,content}
//   if (typeof obj.path === "string" && typeof obj.content === "string") {
//     const single = { [obj.path]: sanitizeFileContent(obj.content) };
//     return coerceToPage(single);
//   }

//   // direct mapping { "app/page.tsx": "..." }
//   const directMapCandidates = Object.entries(obj).filter(([k, v]) => typeof k === "string" && typeof v === "string");
//   if (directMapCandidates.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [k, v] of directMapCandidates) out[k] = sanitizeFileContent(v as string);
//     if (Object.keys(out).some((key) => key.includes(".") || key.includes("/"))) return coerceToPage(out);
//   }

//   return null;
// }

// /* ----------------- conservative auto-close for truncations ----------------- */

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;

//   const countRegex = (str: string, re: RegExp) => (str.match(re) || []).length;

//   const roundOpen = countRegex(out, /\(/g);
//   const roundClose = countRegex(out, /\)/g);
//   if (roundClose < roundOpen) out = out + ")".repeat(roundOpen - roundClose);

//   const curlyOpen = countRegex(out, /{/g);
//   const curlyClose = countRegex(out, /}/g);
//   if (curlyClose < curlyOpen) out = out + "}".repeat(curlyOpen - curlyClose);

//   const squareOpen = countRegex(out, /\[/g);
//   const squareClose = countRegex(out, /]/g);
//   if (squareClose < squareOpen) out = out + "]".repeat(squareOpen - squareClose);

//   const backticks = countRegex(out, /`/g);
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
//               // sanitize and coerce
//               const sanitized: Record<string, string> = {};
//               for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//               return { files: coerceToPage(sanitized), parseText: null, parsedRaw: null };
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
//           if (fallback && Object.keys(fallback).length > 0) {
//             const sanitized: Record<string, string> = {};
//             for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//             return { files: coerceToPage(sanitized), parseText: jsonLike, parsedRaw: null };
//           }
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
//         for (const f of zres.data.files) normalizedZ[f.path] = sanitizeFileContent(f.content);
//         return { files: coerceToPage(normalizedZ), parseText: jsonLike, parsedRaw: parsedResult };
//       }

//       // final fallback
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized), parseText: jsonLike, parsedRaw: parsedResult };
//         }
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

//       // stronger enforcement instruction; add NVIDIA-specific extra note
//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{\n  "files": [\n    { "path": "app/page.tsx", "content": "FILE CONTENT HERE" }\n  ]\n}\n\nWrap the JSON in triple-backticks with "json" for clarity if possible. After the JSON object, include exactly one line with <task_summary>...</task_summary> describing what was created.\n\nDo NOT output any additional commentary.`;

//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\n\nSPECIAL NOTE FOR NVIDIA MODELS:\nOutput ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append any filenames, folder names, truncated fragments, or extra text after the JSON. If you must include any explanatory text, put it INSIDE the single <task_summary>...</task_summary> line only.`;
//       }

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
//           const possibleParsed = safeJsonParse(parseResult.parseText);
//           const normalizedPossible = normalizeParsedFiles(possibleParsed);
//           if (normalizedPossible) {
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
//               // sanitize + coerce
//               const sanitized: Record<string, string> = {};
//               for (const [p, c] of Object.entries(autoClosed)) sanitized[p] = sanitizeFileContent(c);
//               filesFromSummary = coerceToPage(sanitized);
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
//                   repaired[p] = sanitizeFileContent(closed ?? c);
//                 }
//                 // set filesFromSummary candidate to repaired (already coerced by normalize/parse)
//                 filesFromSummary = coerceToPage(repaired);
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

// // functions.ts
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
// import { SANDBOX_TIMEOUT5 } from "./types";

// /**
//  * Robust functions.ts — focused on:
//  *  - fixing TS2345 by accepting unknown where model outputs vary
//  *  - handling common malformed responses (unquoted `use client`, JSON wrappers)
//  *  - returning a single app/page.tsx file to the sandbox
//  *
//  * This version fixes the previously reported errors:
//  *  - Cannot find name 'isTrivialApp'
//  *  - Argument of type 'unknown' is not assignable to parameter of type 'string' (TS2345)
//  *  - Unused vars / schema declarations
//  */

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";

// const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"] as const;
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5"
// ] as const;

// /* ---------------- zod schema (used) ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Utility helpers ---------------- */

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);

//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);

//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);

//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";

//   return isLikelyBalanced(out) ? out : null;
// }

// /* ---------------- Parsing helpers ---------------- */

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();

//   try { return JSON.parse(pre); } catch {}

//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try { return JSON.parse(balanced); } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try { return JSON.parse(cleaned); } catch {}
//   }

//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try { return JSON.parse(wrapped); } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }

//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try { return JSON.parse(unq); } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try { return JSON.parse(b2); } catch {}
//     }
//   }

//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try { return JSON.parse(singleToDouble); } catch {}

//   return null;
// }

// /* ---------------- Sanitization (fixes TS2345) ---------------- */

// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }

//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }

// /* ---------------- Normalize parsed shapes ---------------- */

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;

//   // If parsed has zod shape { files: [...] } prefer that
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch { /* ignore */ }

//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) {
//       out[path] = sanitizeFileContent(val);
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   if (typeof obj.path === "string" && obj.content != null) {
//     return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   }

//   // direct mapping keys
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   // nested attempt: if some string values are JSON, try parsing them
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }

//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx")) return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// /* ---------------- Final sanitize before write ---------------- */

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);

//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }

//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }

//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);

//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }

//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

// /* ---------------- isTrivialApp (restored) ---------------- */

// function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
//   if (!files) return true;
//   const pageContent = files["app/page.tsx"] || files["pages/index.tsx"] || Object.entries(files).find(([path]) => path.endsWith("page.tsx") || path.endsWith("index.tsx"))?.[1] || "";
//   if (!pageContent) return true;
//   const content = pageContent.toLowerCase();
//   const lineCount = pageContent.split("\n").length;
//   const formSignals = ["<form", "input", "textarea", "select", "button", "type=\"text\"", "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", "role=\"banner\"", "role=\"contentinfo\"", "aria-label=\"features\""];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// /* ---------------- Model client helpers (kept minimal) ---------------- */

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");

//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }

//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ---------------- Main agent (keeps your fixer flow) ---------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const eventData = (event.data as Record<string, unknown>) ?? {};
//     const rawRetries = Number(eventData.selfFixRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetries) ? Math.floor(rawRetries) : 5));
//     const enforceLanding = Boolean(eventData.enforceLanding ?? false);
//     const selectedModel = (eventData.model as string | undefined) ?? "provider-2/gpt-5-nano";
//     const projectId = (eventData.projectId as string) || "";

//     if (!selectedModel) {
//       const errMsg = "No model selected. Please provide a 'model' in the event data.";
//       await prisma.message.create({ data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" } });
//       return { error: errMsg };
//     }

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // get context messages
//     const previousMessages = await step.run("get-previous-messages", async () => {
//       const messages = await prisma.message.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 5 });
//       return messages.map((m) => ({ type: "text", role: m.role === "ASSISTANT" ? "assistant" : "user", content: m.content } as Message));
//     });

//     const state = createState<AgentState>({ summary: "", files: {} }, { messages: previousMessages });

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try { getModelClient(m); candidateModels.push(m); break; } catch {}
//       }
//     }

//     let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string): Promise<{ files: Record<string, string> | null; parseText: string | null; parsedRaw: unknown | null; }> => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }

//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }

//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }

//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }

//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch {}

//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try { modelClient = getModelClient(modelCandidate); } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () => prisma.message.create({ data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//         continue;
//       }

//       const baseSystem = getSystemPromptForModel(modelCandidate);
//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }

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

//       const network = createNetwork<AgentState>({ name: "coding-agent-network", agents: [codeAgent], maxIter: 1, router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent) });

//       let runResult: { state?: { data?: AgentState } } | undefined;
//       try { runResult = (await network.run((eventData.value as string) ?? "", { state })) as { state?: { data?: AgentState } } | undefined; }
//       catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () => prisma.message.create({ data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch {}
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [`PREVIOUS ASSISTANT OUTPUT:`, finalSummary, ``, `ERROR: ${lastErrorMessage}`, ``, `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           } // end fixer attempts

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     } // end model loop

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () => prisma.message.create({ data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel } }));
//       return { error: "Agent failed validation on all attempts." };
//     }

//     // success: generate fragments, write sanitized file
//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
//     const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = (!isLikelyBalanced(sanitized)) ? (conservativeAutoClose(sanitized) ?? sanitized) : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";

//       try { await sandbox.files.remove("pages/index.tsx"); } catch { /* ignore */ }
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

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
//           fragment: { create: { sandboxUrl, title: parseAgentOutput(fragmentTitleOutput) || "New Fragment", files: filesFromSummary } }
//         }
//       });
//     });

//     return { url: sandboxUrl, title: parseAgentOutput(fragmentTitleOutput) || "Fragment", files: filesFromSummary, summary: finalSummary, model: usedModel || selectedModel };
//   }
// );


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
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema"; // Your shared schema

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }

// // The new state type that includes the optional image
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";

// // Your model constants remain unchanged
// const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"] as const;
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5"
// ] as const;

// /* ---------------- zod schema (used) ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- All Helper Functions (UNCHANGED) ---------------- */
// // All of your existing helper functions from `isLikelyBalanced` to `getSystemPromptForModel`
// // remain here exactly as they were in your original file. They are all necessary for the
// // parsing and self-correction logic to work correctly.

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try { return JSON.parse(pre); } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try { return JSON.parse(balanced); } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try { return JSON.parse(cleaned); } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try { return JSON.parse(wrapped); } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try { return JSON.parse(unq); } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try { return JSON.parse(b2); } catch {}
//     }
//   }
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try { return JSON.parse(singleToDouble); } catch {}
//   return null;
// }

// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }
//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch { /* ignore */ }
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) {
//       out[path] = sanitizeFileContent(val);
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) {
//     return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   }
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx")) return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

// function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
//   if (!files) return true;
//   const pageContent = files["app/page.tsx"] || files["pages/index.tsx"] || Object.entries(files).find(([path]) => path.endsWith("page.tsx") || path.endsWith("index.tsx"))?.[1] || "";
//   if (!pageContent) return true;
//   const content = pageContent.toLowerCase();
//   const lineCount = pageContent.split("\n").length;
//   const formSignals = ["<form", "input", "textarea", "select", "button", "type=\"text\"", "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", "role=\"banner\"", "role=\"contentinfo\"", "aria-label=\"features\""];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }


// /* ---------------- Main agent (MODIFIED) ---------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   // The schema is correctly defined in the trigger object.
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     // `event.data` is now fully typed and validated.
//     const {
//       text: textPrompt,
//       image,
//       model: selectedModel,
//       projectId,
//       selfFixRetries: rawRetries,
//       enforceLanding: enforceLandingData,
//     } = event.data;
    
//     // The original logic here is correct
//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);
    
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     const previousMessages = await step.run("get-previous-messages", async () => {
//       const messages = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 5,
//       });
//       // Corrected the mapping to align with the Message type from agent-kit
//       return messages.map(
//         (m) =>
//           ({
//             role: m.role === "ASSISTANT" ? "assistant" : "user",
//             content: m.content,
//           } as Message)
//       );
//     });
    
//     const state = createState<AgentStateWithImage>({
//         summary: "",
//         files: {},
//         image: image,
//       },
//       { messages: previousMessages }
//     );

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: {
//       finalSummary: string;
//       filesFromSummary: Record<string, string>;
//       usedModel: string;
//       modelClient: ModelClient;
//     } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string): Promise<{ files: Record<string, string> | null; parseText: string | null; parsedRaw: unknown | null; }> => {
//         const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//         if (fenced) {
//           const cleaned = stripFencedLanguageMarkers(fenced[1]);
//           const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//           if (parsed) {
//             const normalized = normalizeParsedFiles(parsed);
//             if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//           }
//         }
//         const balanced = findBalancedJSONObject(text);
//         if (balanced) {
//           const parsed = safeJsonParse(balanced);
//           if (parsed) {
//             const normalized = normalizeParsedFiles(parsed);
//             if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//           }
//         }
//         const filesArr = extractFilesArraySubstring(text);
//         if (filesArr) {
//           const wrapped = `{"files": ${filesArr}}`;
//           const parsed = safeJsonParse(wrapped);
//           if (parsed) {
//             const normalized = normalizeParsedFiles(parsed);
//             if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//           }
//         }
//         const parsedWhole = safeJsonParse(text);
//         if (parsedWhole) {
//           const normalized = normalizeParsedFiles(parsedWhole);
//           if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//         }
//         try {
//           const fallback = parseFilesFromSummary(text, modelId);
//           if (fallback && Object.keys(fallback).length > 0) {
//             const sanitized: Record<string, string> = {};
//             for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//             return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//           }
//         } catch {}
//         return { files: null, parseText: null, parsedRaw: null };
//     };

//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () =>
//           prisma.message.create({
//             data: {
//               projectId,
//               content: `Model client creation failed for ${modelCandidate}: ${msg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate,
//             },
//           })
//         );
//         continue;
//       }

//       // MODIFICATION: Dynamically adjust the system prompt based on image presence.
//       let baseSystem = getSystemPromptForModel(modelCandidate);
//       if (image) {
//         baseSystem = `An image has been provided by the user. Prioritize the visual structure, layout, and components from the image as the primary source of truth. Use the user's text prompt for additional context, such as color schemes, text content, or specific modifications. Your goal is to recreate and enhance the provided design.\n\n${baseSystem}`;
//       }
      
//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }

//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;
      
//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             const text = lastAssistantTextMessageContent(result);
//             if (text) network.state.data.summary = text;
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) =>
//           net.state.data.summary ? undefined : codeAgent,
//       });

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         const initialPrompt = textPrompt || "Generate a UI based on the provided image.";
//         runResult = (await network.run(initialPrompt, { state })) as {
//           state?: { data?: AgentStateWithImage };
//         } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: {
//               projectId,
//               content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate,
//             },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;
      
//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));
      
//       // The entire self-correction/fixer loop logic remains UNCHANGED
//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//             try {
//               const maybe = safeJsonParse(parseResult.parseText);
//               const normalized = normalizeParsedFiles(maybe);
//               if (normalized) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               }
//             } catch {}
//           }
  
//           if (!needsFix(filesFromSummary)) {
//             successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//           } else {
//             const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//             const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });
  
//             let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//             const attemptOutputs: string[] = [];
//             let fixerSucceeded = false;
  
//             for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//               const userFixPrompt = [`PREVIOUS ASSISTANT OUTPUT:`, finalSummary, ``, `ERROR: ${lastErrorMessage}`, ``, `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`].join("\n");
//               try {
//                 const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//                 const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//                 attemptOutputs.push(fixerRaw);
//                 finalSummary = fixerRaw;
  
//                 const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//                 const fixerFiles = fixParsed.files;
//                 if (fixerFiles) {
//                   const repaired: Record<string, string> = {};
//                   for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                   filesFromSummary = coerceToPage(repaired);
//                 } else filesFromSummary = null;
  
//                 if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                   successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                   fixerSucceeded = true;
//                   break;
//                 }
  
//                 if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//                 else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//               } catch (e) {
//                 const errMsg = e instanceof Error ? e.message : String(e);
//                 lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//                 attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//                 break;
//               }
//             }
  
//             if (!successfulResult) {
//               const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//               const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//               await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//               continue;
//             }
//           }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     }

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: {
//             projectId,
//             content: errMsg,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: selectedModel,
//           },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: modelClient,
//     });
//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: modelClient,
//     });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
//       finalSummary
//     );
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage =
//         filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed =
//         !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         await sandbox.files.remove("pages/index.tsx");
//       } catch {
//         /* ignore */
//       }
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

//     await step.run("save-success-result", async () => {
//       const summaryMatch = finalSummary.match(
//         /<task_summary>([\s\S]*?)<\/task_summary>/i
//       );
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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );

// src/inngest/functions.ts
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
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema"; // Your shared schema

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }

// // The new state type that includes the optional image
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";

// const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"] as const;
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5"
// ] as const;

// /* ---------------- zod schema (used) ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Helper functions (unchanged) ---------------- */
// // ... All helper functions from isLikelyBalanced through getSystemPromptForModel
// // (These are unchanged from your version — include them verbatim in your file.)
// // For brevity in this listing I include them exactly as in your source, unchanged.

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try { return JSON.parse(pre); } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try { return JSON.parse(balanced); } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try { return JSON.parse(cleaned); } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try { return JSON.parse(wrapped); } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try { return JSON.parse(unq); } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try { return JSON.parse(b2); } catch {}
//     }
//   }
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try { return JSON.parse(singleToDouble); } catch {}
//   return null;
// }

// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }
//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch { /* ignore */ }
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) {
//       out[path] = sanitizeFileContent(val);
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) {
//     return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   }
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx")) return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

// function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
//   if (!files) return true;
//   const pageContent = files["app/page.tsx"] || files["pages/index.tsx"] || Object.entries(files).find(([path]) => path.endsWith("page.tsx") || path.endsWith("index.tsx"))?.[1] || "";
//   if (!pageContent) return true;
//   const content = pageContent.toLowerCase();
//   const lineCount = pageContent.split("\n").length;
//   const formSignals = ["<form", "input", "textarea", "select", "button", "type=\"text\"", "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", "role=\"banner\"", "role=\"contentinfo\"", "aria-label=\"features\""];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }


// /* ---------------- Main agent (MODIFIED) ---------------- */

// /**
//  * INLINE_SIZE_LIMIT: images smaller than or equal to this (in bytes) will be inlined
//  * as base64 in the prompt. Larger images will be referenced by URL only.
//  */
// const INLINE_SIZE_LIMIT = 500 * 1024; // 500 KB

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   // The schema is correctly defined in the trigger object.
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     // `event.data` is now fully typed and validated.
//     const {
//       text: textPrompt,
//       image,
//       model: selectedModel,
//       projectId,
//       selfFixRetries: rawRetries,
//       enforceLanding: enforceLandingData,
//     } = event.data;
    
//     // Determine retries & flags
//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);
    
//     // Create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // Fetch previous messages
//     const previousMessages = await step.run("get-previous-messages", async () => {
//       const messages = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 5,
//       });
//       return messages.map(
//         (m) =>
//           ({
//             role: m.role === "ASSISTANT" ? "assistant" : "user",
//             content: m.content,
//           } as Message)
//       );
//     });
    
//     // Attempt to download and inline image if present and small
//     let inlinedImageData: string | undefined;
//     let imageUrlProvided: string | undefined;
//     if (image && typeof image === "string" && image.trim()) {
//       imageUrlProvided = image.trim();
//       try {
//         const resp = await fetch(imageUrlProvided);
//         if (resp.ok) {
//           const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
//           const arrayBuffer = await resp.arrayBuffer();
//           const size = arrayBuffer.byteLength;
//           if (size <= INLINE_SIZE_LIMIT) {
//             // inline small images
//             const buffer = Buffer.from(arrayBuffer);
//             const b64 = buffer.toString("base64");
//             inlinedImageData = `data:${contentType};base64,${b64}`;
//           } else {
//             // too big to inline; just keep URL
//             inlinedImageData = undefined;
//           }
//         } else {
//           // Could not fetch — fallback to URL only
//         }
//       } catch (err) {
//         // Fetch failed — leave inlinedImageData undefined and simply pass URL
//         console.warn("Image fetch/inline failed:", err);
//       }
//     }

//     // Initial agent state (include image as URL or inlined data, preferring inlined for quick access)
//     const state = createState<AgentStateWithImage>({
//         summary: "",
//         files: {},
//         image: inlinedImageData ?? imageUrlProvided,
//       },
//       { messages: previousMessages }
//     );

//     // Candidate models: prefer selected, then fallback to an expert model
//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: {
//       finalSummary: string;
//       filesFromSummary: Record<string, string>;
//       usedModel: string;
//       modelClient: ModelClient;
//     } | null = null;

//     // Helper to extract and normalize JSON-coded files (unchanged)
//     const extractAndNormalize = async (text: string, modelId?: string): Promise<{ files: Record<string, string> | null; parseText: string | null; parsedRaw: unknown | null; }> => {
//         const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//         if (fenced) {
//           const cleaned = stripFencedLanguageMarkers(fenced[1]);
//           const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//           if (parsed) {
//             const normalized = normalizeParsedFiles(parsed);
//             if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//           }
//         }
//         const balanced = findBalancedJSONObject(text);
//         if (balanced) {
//           const parsed = safeJsonParse(balanced);
//           if (parsed) {
//             const normalized = normalizeParsedFiles(parsed);
//             if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//           }
//         }
//         const filesArr = extractFilesArraySubstring(text);
//         if (filesArr) {
//           const wrapped = `{"files": ${filesArr}}`;
//           const parsed = safeJsonParse(wrapped);
//           if (parsed) {
//             const normalized = normalizeParsedFiles(parsed);
//             if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//           }
//         }
//         const parsedWhole = safeJsonParse(text);
//         if (parsedWhole) {
//           const normalized = normalizeParsedFiles(parsedWhole);
//           if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//         }
//         try {
//           const fallback = parseFilesFromSummary(text, modelId);
//           if (fallback && Object.keys(fallback).length > 0) {
//             const sanitized: Record<string, string> = {};
//             for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//             return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//           }
//         } catch {}
//         return { files: null, parseText: null, parsedRaw: null };
//     };

//     // Loop over candidate models
//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () =>
//           prisma.message.create({
//             data: {
//               projectId,
//               content: `Model client creation failed for ${modelCandidate}: ${msg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate,
//             },
//           })
//         );
//         continue;
//       }

//       // Build system prompt: include image instructions if image present
//       let baseSystem = getSystemPromptForModel(modelCandidate);
//       if (imageUrlProvided || inlinedImageData) {
//         // We add a short, clear IMAGE section. If an inline data URL exists (small image),
//         // we include the inline data; otherwise we include a fetchable URL.
//         const imgNoteParts: string[] = [];
//         imgNoteParts.push("IMAGE INFORMATION:");
//         if (inlinedImageData) {
//           // Inline (small) image — include for multimodal models that can accept Base64 in prompt
//           imgNoteParts.push("An image was uploaded by the user and has been inlined as a base64 data URI. Use it as primary visual reference.");
//           imgNoteParts.push(`INLINE_IMAGE_BASE64: ${inlinedImageData}`);
//         } else if (imageUrlProvided) {
//           imgNoteParts.push("An image was uploaded by the user and is available at the following URL. If your model runtime can fetch external URLs, fetch and analyze the image at the URL and prioritize the visual layout and structure from the image. If the model runtime cannot fetch URLs, use the textual prompt as the fallback.");
//           imgNoteParts.push(`IMAGE_URL: ${imageUrlProvided}`);
//         }
//         baseSystem = `${imgNoteParts.join("\n")}\n\n${baseSystem}`;
//       }

//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }

//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;
      
//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             const text = lastAssistantTextMessageContent(result);
//             if (text) network.state.data.summary = text;
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) =>
//           net.state.data.summary ? undefined : codeAgent,
//       });

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         // Build initial prompt. If an image exists, instruct the assistant to use it.
//         const initialPromptParts: string[] = [];
//         if (imageUrlProvided || inlinedImageData) {
//           initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//           if (inlinedImageData) {
//             initialPromptParts.push("Inline base64 image provided in the system prompt. Use it to derive structure & layout.");
//           } else if (imageUrlProvided) {
//             initialPromptParts.push(`Image URL: ${imageUrlProvided} (fetch if possible).`);
//           }
//         }
//         if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
//         const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//         runResult = (await network.run(initialPrompt, { state })) as {
//           state?: { data?: AgentStateWithImage };
//         } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: {
//               projectId,
//               content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate,
//             },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;
      
//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));
      
//       // The entire self-correction/fixer loop logic remains UNCHANGED
//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//             try {
//               const maybe = safeJsonParse(parseResult.parseText);
//               const normalized = normalizeParsedFiles(maybe);
//               if (normalized) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               }
//             } catch {}
//           }
  
//           if (!needsFix(filesFromSummary)) {
//             successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//           } else {
//             const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//             const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });
  
//             let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//             const attemptOutputs: string[] = [];
//             let fixerSucceeded = false;
  
//             for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//               const userFixPrompt = [`PREVIOUS ASSISTANT OUTPUT:`, finalSummary, ``, `ERROR: ${lastErrorMessage}`, ``, `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`].join("\n");
//               try {
//                 const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//                 const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//                 attemptOutputs.push(fixerRaw);
//                 finalSummary = fixerRaw;
  
//                 const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//                 const fixerFiles = fixParsed.files;
//                 if (fixerFiles) {
//                   const repaired: Record<string, string> = {};
//                   for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                   filesFromSummary = coerceToPage(repaired);
//                 } else filesFromSummary = null;
  
//                 if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                   successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                   fixerSucceeded = true;
//                   break;
//                 }
  
//                 if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//                 else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//               } catch (e) {
//                 const errMsg = e instanceof Error ? e.message : String(e);
//                 lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//                 attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//                 break;
//               }
//             }
  
//             if (!successfulResult) {
//               const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//               const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//               await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//               continue;
//             }
//           }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     }

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: {
//             projectId,
//             content: errMsg,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: selectedModel,
//           },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: modelClient,
//     });
//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: modelClient,
//     });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
//       finalSummary
//     );
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage =
//         filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed =
//         !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         await sandbox.files.remove("pages/index.tsx");
//       } catch {
//         /* ignore */
//       }
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

//     await step.run("save-success-result", async () => {
//       const summaryMatch = finalSummary.match(
//         /<task_summary>([\s\S]*?)<\/task_summary>/i
//       );
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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );

// src/inngest/functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   createState,
//   openai
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
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
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema";

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }

// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";

// const EXPERT_MODELS = ["gpt-4.1-mini", "gpt-4", "o3", "o4-mini", "o3-mini", "gpt-4o"] as const;
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5"
// ] as const;

// /* ---------------- zod schema (used) ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Helper utilities ---------------- */

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try { return JSON.parse(pre); } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try { return JSON.parse(balanced); } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try { return JSON.parse(cleaned); } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try { return JSON.parse(wrapped); } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try { return JSON.parse(unq); } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try { return JSON.parse(b2); } catch {}
//     }
//   }
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try { return JSON.parse(singleToDouble); } catch {}
//   return null;
// }

// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }
//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch (err) {
//     console.debug("normalizeParsedFiles zod parse error:", err);
//   }
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) {
//       out[path] = sanitizeFileContent(val);
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) {
//     return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   }
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx")) return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

// function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
//   if (!files) return true;
//   const pageContent = files["app/page.tsx"] || files["pages/index.tsx"] || Object.entries(files).find(([path]) => path.endsWith("page.tsx") || path.endsWith("index.tsx"))?.[1] || "";
//   if (!pageContent) return true;
//   const content = pageContent.toLowerCase();
//   const lineCount = pageContent.split("\n").length;
//   const formSignals = ["<form", "input", "textarea", "select", "button", "type=\"text\"", "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", "role=\"banner\"", "role=\"contentinfo\"", "aria-label=\"features\""];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// /* ---------------- Model client factory ---------------- */

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ---------------- Safe error extraction helper ---------------- */

// function extractErrorDetails(err: unknown): string {
//   try {
//     if (err instanceof Error) {
//       return String(err.stack ?? err.message ?? String(err)).slice(0, 2000);
//     }
//     if (typeof err === "object" && err !== null) {
//       const o = err as Record<string, unknown>;
//       const pieces: string[] = [];
//       if (typeof o.message === "string") pieces.push(o.message);
//       if (o && typeof (o as Record<string, unknown>).response === "object") {
//         const resp = (o as Record<string, unknown>).response as Record<string, unknown>;
//         if (typeof resp.status === "number") pieces.push(`status:${resp.status}`);
//         if (typeof resp.body === "string") pieces.push(resp.body.slice(0, 1000));
//       }
//       const joined = pieces.join(" | ");
//       if (joined) return joined.slice(0, 2000);
//       try { return JSON.stringify(err).slice(0, 2000); } catch {}
//     }
//     return String(err).slice(0, 2000);
//   } catch {
//     return "Unknown error (failed to stringify)";
//   }
// }

// /* ---------------- Main code agent function ---------------- */

// /**
//  * INLINE_SIZE_LIMIT: images smaller than or equal to this (in bytes) will be inlined
//  * as base64 in the prompt. Larger images will be referenced by URL only.
//  */
// const INLINE_SIZE_LIMIT = 500 * 1024; // 500 KB

// // Local chat-message shape (avoid colliding with other `Message` types)
// interface ChatMessage {
//   role: "assistant" | "user";
//   content: string;
// }

// // Type alias for createState options (type-only use)
// type CreateStateOptions = Parameters<typeof createState>[1];

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     const {
//       text: textPrompt,
//       image,
//       model: selectedModel,
//       selfFixRetries: rawRetries,
//       enforceLanding: enforceLandingData,
//       projectId
//     } = event.data;

//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);

//     // Create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // Fetch previous messages robustly
//     const previousMessages: ChatMessage[] = await step.run("get-previous-messages", async () => {
//       try {
//         const rows = await prisma.message.findMany({
//           where: { projectId },
//           orderBy: { createdAt: "asc" },
//           take: 20,
//         });

//         const mapped: ChatMessage[] = rows
//           .map((m) => {
//             const r: ChatMessage["role"] = m.role === "ASSISTANT" ? "assistant" : "user";
//             const content = m.content ?? "";
//             return { role: r, content: String(content) };
//           })
//           .filter((msg) => typeof msg.content === "string" && msg.content.trim().length > 0);

//         return mapped;
//       } catch (err) {
//         console.error("get-previous-messages failed:", extractErrorDetails(err));
//         return [];
//       }
//     });

//     // Try to download and inline image if present and small
//     let inlinedImageData: string | undefined;
//     let imageUrlProvided: string | undefined;
//     if (image && typeof image === "string" && image.trim()) {
//       imageUrlProvided = image.trim();
//       try {
//         const resp = await fetch(imageUrlProvided);
//         if (resp.ok) {
//           const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
//           const arrayBuffer = await resp.arrayBuffer();
//           const size = arrayBuffer.byteLength;
//           if (size <= INLINE_SIZE_LIMIT) {
//             const buffer = Buffer.from(arrayBuffer);
//             const b64 = buffer.toString("base64");
//             inlinedImageData = `data:${contentType};base64,${b64}`;
//           } else {
//             // too large to inline — keep URL
//           }
//         } else {
//           await prisma.message.create({
//             data: {
//               projectId,
//               content: `Image fetch returned status ${resp.status} for URL: ${imageUrlProvided}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//             },
//           });
//         }
//       } catch (err) {
//         await prisma.message.create({
//           data: {
//             projectId,
//             content: `Image fetch failed for URL: ${imageUrlProvided} (${extractErrorDetails(err)})`,
//             role: "ASSISTANT",
//             type: "ERROR",
//           },
//         });
//       }
//     }

//     // Create state. Cast the options to the expected type using a type-only alias (no `any` used).
//     const state = createState<AgentStateWithImage>(
//       {
//         summary: "",
//         files: {},
//         image: inlinedImageData ?? imageUrlProvided,
//       },
//       ({ messages: previousMessages } as unknown) as CreateStateOptions
//     );

//     // Build candidate models (selected first, fallback expert)
//     const candidateModels: string[] = [];
//     if (typeof selectedModel === "string" && selectedModel.trim()) {
//       try {
//         getModelClient(selectedModel);
//         candidateModels.push(selectedModel);
//       } catch (err) {
//         await prisma.message.create({
//           data: {
//             projectId,
//             content: `Model client creation failed for selected model ${String(selectedModel)}: ${extractErrorDetails(err)}`,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: String(selectedModel),
//           },
//         });
//       }
//     }

//     for (const m of EXPERT_MODELS) {
//       if (!candidateModels.includes(m)) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch (err) {
//           // don't spam DB — debug log ok
//           console.debug(`Skipping expert model ${m}: ${extractErrorDetails(err)}`);
//         }
//       }
//     }

//     if (candidateModels.length === 0) {
//       const err = "No usable model client configured (check provider API keys and env).";
//       await prisma.message.create({
//         data: { projectId, content: err, role: "ASSISTANT", type: "ERROR", model: selectedModel ?? "none" }
//       });
//       return { error: err };
//     }

//     let successfulResult: {
//       finalSummary: string;
//       filesFromSummary: Record<string, string>;
//       usedModel: string;
//       modelClient: ModelClient;
//     } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string): Promise<{ files: Record<string, string> | null; parseText: string | null; parsedRaw: unknown | null; }> => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }
//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }
//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }
//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch (err) {
//         console.debug("parseFilesFromSummary fallback parse error:", err);
//       }
//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     // Loop through candidate models and attempt agent runs
//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         await prisma.message.create({
//           data: {
//             projectId,
//             content: `Model client creation failed for ${modelCandidate}: ${extractErrorDetails(err)}`,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: modelCandidate,
//           },
//         });
//         continue;
//       }

//       // Build system prompt including image instructions when available
//       let baseSystem = getSystemPromptForModel(modelCandidate);
//       if (imageUrlProvided || inlinedImageData) {
//         const imgNoteParts: string[] = [];
//         imgNoteParts.push("IMAGE INFORMATION:");
//         if (inlinedImageData) {
//           imgNoteParts.push("An image was uploaded by the user and has been inlined as a base64 data URI. Use it as primary visual reference.");
//           imgNoteParts.push(`INLINE_IMAGE_BASE64: ${inlinedImageData}`);
//         } else if (imageUrlProvided) {
//           imgNoteParts.push("An image was uploaded by the user and is available at the following URL. If your model runtime can fetch external URLs, fetch and analyze the image at the URL and prioritize the visual layout and structure from the image. If the model runtime cannot fetch URLs, use the textual prompt as the fallback.");
//           imgNoteParts.push(`IMAGE_URL: ${imageUrlProvided}`);
//         }
//         baseSystem = `${imgNoteParts.join("\n")}\n\n${baseSystem}`;
//       }

//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if (safeIncludes(NVIDIA_MODELS, modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }

//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             const text = lastAssistantTextMessageContent(result);
//             if (text) network.state.data.summary = text;
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) =>
//           net.state.data.summary ? undefined : codeAgent,
//       });

//       // Build initial prompt
//       const initialPromptParts: string[] = [];
//       if (imageUrlProvided || inlinedImageData) {
//         initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//         if (inlinedImageData) {
//           initialPromptParts.push("Inline base64 image provided in the system prompt. Use it to derive structure & layout.");
//         } else if (imageUrlProvided) {
//           initialPromptParts.push(`Image URL: ${imageUrlProvided} (fetch if possible).`);
//         }
//       }
//       if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
//       const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//       // Run network and handle provider errors
//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
//       } catch (err) {
//         const details = extractErrorDetails(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: {
//               projectId,
//               content: `Provider/network error when running agent (${modelCandidate}): ${details}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: modelCandidate,
//             },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       // Self-correct / fixer logic
//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch (err) {
//             console.debug("repair parse attempt failed:", err);
//           }
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary>...</task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [`PREVIOUS ASSISTANT OUTPUT:`, finalSummary, ``, `ERROR: ${lastErrorMessage}`, ``, `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (err) {
//               const errMsg = extractErrorDetails(err);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           }

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     }

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: {
//             projectId,
//             content: errMsg,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: selectedModel,
//           },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: modelClient,
//     });
//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: modelClient,
//     });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         try { await sandbox.files.remove("pages/index.tsx"); } catch {
//           // ignore
//         }
//         await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//       } catch (err) {
//         const msg = extractErrorDetails(err);
//         await prisma.message.create({ data: { projectId, content: `Failed to write to sandbox: ${msg}`, role: "ASSISTANT", type: "ERROR", model: usedModel ?? selectedModel } });
//         throw err;
//       }
//     });

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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );

// // src/inngest/functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   createState,
//   openai,
//   type TextMessage,
//   type AgentResult,
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   parseAgentOutput,
// } from "./utils";
// import {
//   FRAGMENT_TITLE_PROMPT,
//   RESPONSE_PROMPT,
//   SIMPLE_PROMPT,
//   PROMPT,
// } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema";
// import { mapPrismaRowsToTextMessages } from "./message-mapper";

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";
// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "gpt-4",
//   "o3",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o",
// ] as const;
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
// ] as const;

// /* ---------------- zod for file arrays ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Parsing + sanitization helpers (omitted small docs for brevity) ---------------- */

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length,
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }
// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }
// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }
// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try {
//     return JSON.parse(pre);
//   } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try {
//       return JSON.parse(balanced);
//     } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try {
//       return JSON.parse(cleaned);
//     } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try {
//       return JSON.parse(wrapped);
//     } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try {
//       return JSON.parse(unq);
//     } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try {
//         return JSON.parse(b2);
//       } catch {}
//     }
//   }
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try {
//     return JSON.parse(singleToDouble);
//   } catch {}
//   return null;
// }
// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }
//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }
// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch {}
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) out[path] = sanitizeFileContent(val);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }
// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx"))
//       return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }
// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }
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
//   const formSignals = ["<form", "input", "textarea", "select", "button", 'type="text"', "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", 'role="banner"', 'role="contentinfo"', 'aria-label="features"'];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ---------------- Main agent function ---------------- */

// const INLINE_SIZE_LIMIT = 500 * 1024; // 500KB

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     const { text: textPrompt, image, model: selectedModelRaw, projectId, selfFixRetries: rawRetries, enforceLanding: enforceLandingData } = event.data;

//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // fetch previous messages and map to typed TextMessage[]
//     const previousMessages: TextMessage[] = await step.run("get-previous-messages", async () => {
//       const rows = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 10,
//       });
//       // rows -> typed text messages
//       const mapped = mapPrismaRowsToTextMessages(rows.map((r) => ({ role: r.role, content: r.content, imageUrl: r.imageUrl })));
//       // provider typically expects chronological order oldest -> newest
//       return mapped.reverse();
//     });

//     // inline image if small
//     let inlinedImageData: string | undefined;
//     let imageUrlProvided: string | undefined;
//     if (image && typeof image === "string" && image.trim()) {
//       imageUrlProvided = image.trim();
//       try {
//         const resp = await fetch(imageUrlProvided);
//         if (resp.ok) {
//           const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
//           const arrayBuffer = await resp.arrayBuffer();
//           const size = arrayBuffer.byteLength;
//           if (size <= INLINE_SIZE_LIMIT) {
//             const buffer = Buffer.from(arrayBuffer);
//             const b64 = buffer.toString("base64");
//             inlinedImageData = `data:${contentType};base64,${b64}`;
//           }
//         } else {
//           console.warn("Image fetch returned non-ok status:", resp.status);
//         }
//       } catch (err) {
//         console.warn("Image fetch/inline failed:", err);
//       }
//     }

//     // create state. second arg type is Parameters<typeof createState>[1]
//     type CreateStateOpts = Parameters<typeof createState>[1];
//     const state = createState<AgentStateWithImage>(
//       { summary: "", files: {}, image: inlinedImageData ?? imageUrlProvided },
//       ({ messages: previousMessages } as unknown) as CreateStateOpts
//     );

//     // debug preview (safe)
//     try {
//       const preview = previousMessages.slice(0, 20).map((m) => ({
//         type: m.type,
//         role: m.role,
//         content: typeof m.content === "string" ? (m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content) : "[complex]",
//       }));
//       console.info("Provider-ready messages before run:", JSON.stringify(preview, null, 2));
//     } catch {}

//     const fallbackModel = process.env.DEFAULT_MODEL || "provider-2/gpt-5-nano";
//     const selectedModel = (typeof selectedModelRaw === "string" && selectedModelRaw.trim()) ? selectedModelRaw.trim() : fallbackModel;

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string) => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }
//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }
//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }
//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch {}
//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let baseSystem = getSystemPromptForModel(modelCandidate);
//       if (imageUrlProvided || inlinedImageData) {
//         const imgNoteParts: string[] = [];
//         imgNoteParts.push("IMAGE INFORMATION:");
//         if (inlinedImageData) {
//           imgNoteParts.push("An image was uploaded by the user and has been inlined as a base64 data URI. Use it as primary visual reference.");
//           imgNoteParts.push(`INLINE_IMAGE_BASE64: ${inlinedImageData}`);
//         } else if (imageUrlProvided) {
//           imgNoteParts.push("An image was uploaded by the user and is available at the following URL. If your model runtime can fetch external URLs, fetch and analyze the image at the URL and prioritize the visual layout and structure from the image. If the model runtime cannot fetch URLs, use the textual prompt as the fallback.");
//           imgNoteParts.push(`IMAGE_URL: ${imageUrlProvided}`);
//         }
//         baseSystem = `${imgNoteParts.join("\n")}\n\n${baseSystem}`;
//       }

//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }
//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             // result is AgentResult type at runtime; cast to AgentResult safely
//             try {
//               const ar = result as unknown as AgentResult;
//               const text = lastAssistantTextMessageContent(ar);
//               if (text) network.state.data.summary = text;
//             } catch (e) {
//               console.warn("Failed to extract assistant text from result (onResponse):", e);
//             }
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent),
//       });

//       const initialPromptParts: string[] = [];
//       if (imageUrlProvided || inlinedImageData) {
//         initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//         if (inlinedImageData) initialPromptParts.push("Inline base64 image provided in the system prompt. Use it to derive structure & layout.");
//         else if (imageUrlProvided) initialPromptParts.push(`Image URL: ${imageUrlProvided} (fetch if possible).`);
//       }
//       if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
//       const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch {}
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [
//               `PREVIOUS ASSISTANT OUTPUT:`,
//               finalSummary,
//               "",
//               `ERROR: ${lastErrorMessage}`,
//               "",
//               `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`,
//             ].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           }

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     } // end model loop

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
//     const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         await sandbox.files.remove("pages/index.tsx");
//       } catch {}
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );


// src/inngest/functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   createState,
//   openai,
//   type TextMessage,
//   type AgentResult,
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   parseAgentOutput,
// } from "./utils";
// import {
//   FRAGMENT_TITLE_PROMPT,
//   RESPONSE_PROMPT,
//   SIMPLE_PROMPT,
//   PROMPT,
// } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema";
// import { mapPrismaRowsToTextMessages, PrismaMessageRow } from "./message-mapper";

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";
// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "gpt-4",
//   "o3",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o",
// ] as const;
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
// ] as const;

// /* ---------------- zod for file arrays ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Parsing + sanitization helpers (omitted small docs for brevity) ---------------- */

// // (reuse the utility helpers from your prior working code - kept identical but typed)
// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length,
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try {
//     return JSON.parse(pre);
//   } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try {
//       return JSON.parse(balanced);
//     } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try {
//       return JSON.parse(cleaned);
//     } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try {
//       return JSON.parse(wrapped);
//     } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try {
//       return JSON.parse(unq);
//     } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try {
//         return JSON.parse(b2);
//       } catch {}
//     }
//   }
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try {
//     return JSON.parse(singleToDouble);
//   } catch {}
//   return null;
// }

// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }
//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch {}
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) out[path] = sanitizeFileContent(val);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx"))
//       return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

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
//   const formSignals = ["<form", "input", "textarea", "select", "button", 'type="text"', "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", 'role="banner"', 'role="contentinfo"', 'aria-label="features"'];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// /* ---------------- Model client helper with Groq integration ---------------- */

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");

//   // NVIDIA models (use a special base URL)
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }

//   // gpt-4.1-mini local/gpt4all-style model
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // GROQ provider integration (example): allow model IDs or keys that indicate Groq usage
//   if (modelId.toLowerCase().includes("groq") || (process.env.GROQ_BASE_URL && modelId.startsWith("deepseek"))) {
//     const base = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
//     const key = process.env.GROQ_API_KEY;
//     if (!key) throw new Error("GROQ_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // A4F / other provider base
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ---------------- Main agent function ---------------- */

// const INLINE_SIZE_LIMIT = 500 * 1024; // 500KB

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     const { text: textPrompt, image, model: selectedModelRaw, projectId, selfFixRetries: rawRetries, enforceLanding: enforceLandingData } = event.data;

//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);

//     if (!projectId) {
//       await prisma.message.create({ data: { projectId: "", content: "No projectId supplied to code-agent/run", role: "ASSISTANT", type: "ERROR", model: selectedModelRaw as string } }).catch(() => {});
//       return { error: "No projectId provided." };
//     }

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // fetch previous messages and map to typed TextMessage[]
//     const previousMessages: TextMessage[] = await step.run("get-previous-messages", async () => {
//       const rows = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 10,
//       });

//       // Convert to our lightweight Prisma row shape and map
//       const prismaRows: PrismaMessageRow[] = rows.map((r) => ({ role: r.role, content: r.content, imageUrl: r.imageUrl ?? null }));
//       const mapped = mapPrismaRowsToTextMessages(prismaRows);

//       // provider typically expects chronological order oldest -> newest
//       return mapped.reverse();
//     });

//     // inline image if small
//     let inlinedImageData: string | undefined;
//     let imageUrlProvided: string | undefined;
//     if (image && typeof image === "string" && image.trim()) {
//       imageUrlProvided = image.trim();
//       try {
//         const resp = await fetch(imageUrlProvided);
//         if (resp.ok) {
//           const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
//           const arrayBuffer = await resp.arrayBuffer();
//           const size = arrayBuffer.byteLength;
//           if (size <= INLINE_SIZE_LIMIT) {
//             const buffer = Buffer.from(arrayBuffer);
//             const b64 = buffer.toString("base64");
//             inlinedImageData = `data:${contentType};base64,${b64}`;
//           }
//         } else {
//           console.warn("Image fetch returned non-ok status:", resp.status);
//         }
//       } catch (err) {
//         console.warn("Image fetch/inline failed:", err);
//       }
//     }

//     // create state. second arg type is Parameters<typeof createState>[1]
//     type CreateStateOpts = Parameters<typeof createState>[1];
//     const state = createState<AgentStateWithImage>(
//       { summary: "", files: {}, image: inlinedImageData ?? imageUrlProvided },
//       ({ messages: previousMessages } as unknown) as CreateStateOpts
//     );

//     // debug preview (safe)
//     try {
//       const preview = previousMessages.slice(0, 20).map((m) => ({
//         type: m.type,
//         role: m.role,
//         content: typeof m.content === "string" ? (m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content) : "[complex]",
//       }));
//       console.info("Provider-ready messages before run:", JSON.stringify(preview, null, 2));
//     } catch {}

//     const fallbackModel = process.env.DEFAULT_MODEL || "provider-2/gpt-5-nano";
//     const selectedModel = (typeof selectedModelRaw === "string" && selectedModelRaw.trim()) ? selectedModelRaw.trim() : fallbackModel;

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string) => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }
//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }
//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }
//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch {}
//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let baseSystem = getSystemPromptForModel(modelCandidate);
//       if (imageUrlProvided || inlinedImageData) {
//         const imgNoteParts: string[] = [];
//         imgNoteParts.push("IMAGE INFORMATION:");
//         if (inlinedImageData) {
//           imgNoteParts.push("An image was uploaded by the user and has been inlined as a base64 data URI. Use it as primary visual reference.");
//           imgNoteParts.push(`INLINE_IMAGE_BASE64: ${inlinedImageData}`);
//         } else if (imageUrlProvided) {
//           imgNoteParts.push("An image was uploaded by the user and is available at the following URL. If your model runtime can fetch external URLs, fetch and analyze the image at the URL and prioritize the visual layout and structure from the image. If the model runtime cannot fetch URLs, use the textual prompt as the fallback.");
//           imgNoteParts.push(`IMAGE_URL: ${imageUrlProvided}`);
//         }
//         baseSystem = `${imgNoteParts.join("\n")}\n\n${baseSystem}`;
//       }

//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }
//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             try {
//               const ar = result as unknown as AgentResult;
//               const text = lastAssistantTextMessageContent(ar);
//               if (text) network.state.data.summary = text;
//             } catch (e) {
//               console.warn("Failed to extract assistant text from result (onResponse):", e);
//             }
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent),
//       });

//       const initialPromptParts: string[] = [];
//       if (imageUrlProvided || inlinedImageData) {
//         initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//         if (inlinedImageData) initialPromptParts.push("Inline base64 image provided in the system prompt. Use it to derive structure & layout.");
//         else if (imageUrlProvided) initialPromptParts.push(`Image URL: ${imageUrlProvided} (fetch if possible).`);
//       }
//       if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
//       const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch {}
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [
//               `PREVIOUS ASSISTANT OUTPUT:`,
//               finalSummary,
//               "",
//               `ERROR: ${lastErrorMessage}`,
//               "",
//               `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`,
//             ].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           }

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     } // end model loop

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
//     const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         await sandbox.files.remove("pages/index.tsx");
//       } catch {}
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );

// src/inngest/functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   createState,
//   openai,
//   type TextMessage,
//   type AgentResult,
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   parseAgentOutput,
// } from "./utils";
// import {
//   FRAGMENT_TITLE_PROMPT,
//   RESPONSE_PROMPT,
//   SIMPLE_PROMPT,
//   PROMPT,
// } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema";

// /* ---------------- Types ---------------- */

// type PrismaMessageRow = {
//   role: string | null | undefined;
//   content?: unknown;
//   imageUrl?: string | null | undefined;
//   createdAt?: Date | string;
// };

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// /* ---------------- Constants ---------------- */

// const PREFERRED_PATH = "app/page.tsx";

// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "gpt-4",
//   "o3",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o",
// ] as const;

// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
//   "nvidia/llama-3.1-nemotron-ultra-253b-v1",
// ] as const;

// /* ---------------- zod schemas ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Helpers: type guards & mapping ---------------- */

// function isNonEmptyString(v: unknown): v is string {
//   return typeof v === "string" && v.trim().length > 0;
// }

// /**
//  * Map Prisma rows to provider-ready TextMessage[].
//  * Ensures `type: "text"` is present (agent-kit expects it).
//  */
// export function mapPrismaRowsToTextMessages(rows: PrismaMessageRow[]): TextMessage[] {
//   const out: TextMessage[] = [];

//   for (const r of rows) {
//     const roleRaw = (r.role ?? "USER").toString().toUpperCase();
//     const role = roleRaw === "ASSISTANT" ? "assistant" : "user";

//     const content = r.content;
//     if (isNonEmptyString(content)) {
//       out.push({ type: "text", role, content: content.trim() });
//       continue;
//     }

//     // The UI may have stored arrays/objects — flatten common shapes:
//     if (Array.isArray(content)) {
//       for (const item of content) {
//         if (isNonEmptyString(item)) {
//           out.push({ type: "text", role, content: item.trim() });
//         } else if (item && typeof item === "object") {
//           const it = item as Record<string, unknown>;
//           if (isNonEmptyString(it.text)) out.push({ type: "text", role, content: it.text.trim() });
//           else if (isNonEmptyString(it.content)) out.push({ type: "text", role, content: it.content.trim() });
//           else if (it.type === "image" && isNonEmptyString(it.url)) out.push({ type: "text", role, content: `IMAGE_URL: ${it.url}` });
//         }
//       }
//       continue;
//     }

//     if (content && typeof content === "object") {
//       const c = content as Record<string, unknown>;
//       if (isNonEmptyString(c.text)) out.push({ type: "text", role, content: c.text.trim() });
//       else if (isNonEmptyString(c.content)) out.push({ type: "text", role, content: c.content.trim() });
//       else {
//         // Fallback: stringify object safely
//         try {
//           const s = JSON.stringify(c, null, 2);
//           out.push({ type: "text", role, content: s });
//         } catch {
//           // ignore
//         }
//       }
//       continue;
//     }

//     // If there is an image URL on the row (upload UI), create a sentinel text message
//     if (isNonEmptyString(r.imageUrl)) {
//       out.push({ type: "text", role, content: `IMAGE_URL: ${r.imageUrl}` });
//     }

//     // If nothing usable, skip
//   }

//   return out;
// }

// /* ---------------- Parsing & sanitization helpers ---------------- */

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length,
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try {
//     return JSON.parse(pre);
//   } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try {
//       return JSON.parse(balanced);
//     } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try {
//       return JSON.parse(cleaned);
//     } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try {
//       return JSON.parse(wrapped);
//     } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try {
//       return JSON.parse(unq);
//     } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try {
//         return JSON.parse(b2);
//       } catch {}
//     }
//   }
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try {
//     return JSON.parse(singleToDouble);
//   } catch {}
//   return null;
// }

// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }
//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);
//   if (
//     (s.startsWith('"') && s.endsWith('"')) ||
//     (s.startsWith("'") && s.endsWith("'")) ||
//     (s.startsWith("`") && s.endsWith("`"))
//   ) {
//     if (s.length >= 2) s = s.slice(1, -1);
//   }
//   if (s.includes("\\n") && !s.includes("\n")) {
//     s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
//   }
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   return s.trim();
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;

//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch {}

//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) {
//       out[path] = sanitizeFileContent(val);
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   if (typeof obj.path === "string" && obj.content != null) {
//     return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   }

//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }

//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }

//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx")) return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);

//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }

//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);

//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }

//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);

//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }

//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

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
//   const formSignals = ["<form", "input", "textarea", "select", "button", 'type="text"', "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", 'role="banner"', 'role="contentinfo"', 'aria-label="features"'];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// /* ---------------- Model client selection (Groq/NVIDIA/A4F/OpenAI) ---------------- */

// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId.trim() : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");

//   // GROQ provider: detect model names that mean Groq (user asked to integrate groq)
//   if (modelId.includes("groq") || modelId.startsWith("deepseek") || modelId.startsWith("deepseek-")) {
//     const base = process.env.GROQ_BASE_URL || process.env.GROQ_BASE_URL_ALT || "https://api.groq.com/openai/v1";
//     const key = process.env.GROQ_API_KEY;
//     if (!key) throw new Error("GROQ_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // NVIDIA models
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }

//   // Special gpt-4.1-mini route (example local/gpt4all)
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // A4F / provider examples
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY (A4F) is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }

//   // Default: require OPENAI_API_KEY
//   const key = process.env.OPENAI_API_KEY;
//   if (!key) throw new Error("OPENAI_API_KEY is not set for default models");
//   return openai({ model: modelId, apiKey: key }) as OpenAiClient;
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ---------------- Main agent function ---------------- */

// const INLINE_SIZE_LIMIT = 500 * 1024; // 500KB

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     const { text: textPrompt, image, model: selectedModelRaw, projectId, selfFixRetries: rawRetries, enforceLanding: enforceLandingData } = event.data;

//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // fetch previous messages and map to typed TextMessage[]
//     const previousMessages: TextMessage[] = await step.run("get-previous-messages", async () => {
//       const rows = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 10,
//       });
//       const mapped = mapPrismaRowsToTextMessages(rows);
//       return mapped.reverse(); // oldest -> newest
//     });

//     // inline image if small and reachable
//     let inlinedImageData: string | undefined;
//     let imageUrlProvided: string | undefined;
//     if (isNonEmptyString(image)) {
//       imageUrlProvided = image!;
//       try {
//         const resp = await fetch(imageUrlProvided);
//         if (resp.ok) {
//           const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
//           const arrayBuffer = await resp.arrayBuffer();
//           const size = arrayBuffer.byteLength;
//           if (size <= INLINE_SIZE_LIMIT) {
//             const buffer = Buffer.from(arrayBuffer);
//             const b64 = buffer.toString("base64");
//             inlinedImageData = `data:${contentType};base64,${b64}`;
//           }
//         } else {
//           console.warn("Image fetch returned non-ok status:", resp.status);
//         }
//       } catch (err) {
//         console.warn("Image fetch/inline failed:", err);
//       }
//     }

//     // create state. cast second arg safely
//     type CreateStateOpts = Parameters<typeof createState>[1];
//     const state = createState<AgentStateWithImage>(
//       { summary: "", files: {}, image: inlinedImageData ?? imageUrlProvided },
//       ({ messages: previousMessages } as unknown) as CreateStateOpts
//     );

//     // debug preview
//     try {
//       const preview = previousMessages.slice(0, 20).map((m) => ({
//         type: m.type,
//         role: m.role,
//         content: typeof m.content === "string" ? (m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content) : "[complex]",
//       }));
//       console.info("Provider-ready messages before run:", JSON.stringify(preview, null, 2));
//     } catch {}

//     // fallback and candidate selection
//     const fallbackModel = process.env.DEFAULT_MODEL || "provider-2/gpt-5-nano";
//     const selectedModel = (typeof selectedModelRaw === "string" && selectedModelRaw.trim()) ? selectedModelRaw.trim() : fallbackModel;

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string) => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }

//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }

//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }

//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }

//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch {}

//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     // iterate candidate models
//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () => prisma.message.create({ data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//         continue;
//       }

//       let baseSystem = getSystemPromptForModel(modelCandidate);

//       // Add image hint to system prompt for vision-capable flows
//       if (inlinedImageData || imageUrlProvided) {
//         const imgNoteParts: string[] = [];
//         imgNoteParts.push("IMAGE INFORMATION:");
//         if (inlinedImageData) {
//           imgNoteParts.push("An image was uploaded by the user and has been inlined as a base64 data URI. Use it as primary visual reference.");
//           imgNoteParts.push(`INLINE_IMAGE_BASE64: ${inlinedImageData}`);
//         } else if (imageUrlProvided) {
//           imgNoteParts.push("An image was uploaded by the user and is available at the following URL. If your model runtime can fetch external URLs, fetch and analyze the image at the URL and prioritize the visual layout and structure from the image. If the model runtime cannot fetch URLs, use the textual prompt as the fallback.");
//           imgNoteParts.push(`IMAGE_URL: ${imageUrlProvided}`);
//         }
//         baseSystem = `${imgNoteParts.join("\n")}\n\n${baseSystem}`;
//       }

//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }
//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             try {
//               const ar = result as unknown as AgentResult;
//               const text = lastAssistantTextMessageContent(ar);
//               if (text) network.state.data.summary = text;
//             } catch (e) {
//               console.warn("Failed to extract assistant text from result (onResponse):", e);
//             }
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({ name: "coding-agent-network", agents: [codeAgent], maxIter: 1, router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent) });

//       const initialPromptParts: string[] = [];
//       if (imageUrlProvided || inlinedImageData) {
//         initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//         if (inlinedImageData) initialPromptParts.push("Inline base64 image provided in the system prompt. Use it to derive structure & layout.");
//         else if (imageUrlProvided) initialPromptParts.push(`Image URL: ${imageUrlProvided} (fetch if possible).`);
//       }
//       if (isNonEmptyString(textPrompt)) initialPromptParts.push(`User prompt: ${textPrompt!.trim()}`);
//       const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () => prisma.message.create({ data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch {}
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [
//               `PREVIOUS ASSISTANT OUTPUT:`,
//               finalSummary,
//               "",
//               `ERROR: ${lastErrorMessage}`,
//               "",
//               `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`
//             ].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           } // end fixer attempts

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${s.slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     } // end candidate model loop

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () => prisma.message.create({ data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel } }));
//       return { error: "Agent failed validation on all attempts." };
//     }

//     // success: generate fragments, write sanitized file to sandbox and persist
//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
//     const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = (!isLikelyBalanced(sanitized)) ? (conservativeAutoClose(sanitized) ?? sanitized) : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";

//       try { await sandbox.files.remove("pages/index.tsx"); } catch { /* ignore */ }
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return { url: sandboxUrl, title: parseAgentOutput(fragmentTitleOutput) || "Fragment", files: filesFromSummary, summary: finalSummary, model: usedModel || selectedModel };
//   }
// );

// // src/inngest/functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   createState,
//   openai,
//   type TextMessage,
//   type AgentResult,
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   parseAgentOutput,
// } from "./utils";
// import {
//   FRAGMENT_TITLE_PROMPT,
//   RESPONSE_PROMPT,
//   SIMPLE_PROMPT,
//   PROMPT,
// } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema";
// import { mapPrismaRowsToTextMessages, PrismaMessageRow } from "./message-mapper";

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";
// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "gpt-4",
//   "o3",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o",
// ] as const;

// //   "openai/gpt-oss-120b",
// //   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
// //   "meta/llama-3.3-70b-instruct",
// //   "mistralai/mistral-nemotron",
// //   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
// //   "nvidia/llama-3.1-nemotron-ultra-253b-v1",
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   'meta/llama-3.2-11b-vision-instruct',
//   'meta/llama-4-maverick-17b-128e-instruct',
//    'meta/codellama-70b',
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//    "mistralai/mistral-small-3.2-24b-instruct",
//    "mistralai/codestral-22b-instruct-v01",
//    "deepseek-ai/deepseek-r1-0528",
//    "deepseek-ai/deepseek-r1-distill-llama-8b",
//    "qwen/qwen3-235b-a22b",
//    "qwen/qwen2.5-coder-32b-instruct",
//    "moonshotai/kimi-k2-instruct",
//    "ibm/granite-34b-code-instruct",
//    "openai/gpt-oss-120b",
//    "google/codegemma-1.1-7b-1",
//    "google/gemma-3-1b-it",
//    "nvidia/llama-3.1-nemotron-ultra-253b-v1",
//    "nvidia/llama-3.1-nemotron-70b-instruct",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
// ] as const;

// /* ---------------- zod for file arrays ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Parsing + sanitization helpers ---------------- */

// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length,
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// /**
//  * Attempt to parse JSON heuristically, stripping fence markers, fixing trailing commas etc.
//  */
// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try {
//     return JSON.parse(pre);
//   } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try {
//       return JSON.parse(balanced);
//     } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try {
//       return JSON.parse(cleaned);
//     } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try {
//       return JSON.parse(wrapped);
//     } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   // Unwrap wrapped string literal
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try {
//       return JSON.parse(unq);
//     } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try {
//         return JSON.parse(b2);
//       } catch {}
//     }
//   }
//   // Attempt to convert single quotes / unquoted keys into valid JSON
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try {
//     return JSON.parse(singleToDouble);
//   } catch {}
//   return null;
// }

// /**
//  * Robust normalization of file content coming from model output.
//  * Removes fencing, unwraps quotes, unescapes common escapes, trims spurious filenames, etc.
//  */
// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }

//   // normalize CRLF -> LF
//   s = s.replace(/\r\n/g, "\n");

//   // Remove triple-fence markers and leading labels
//   s = stripFencedLanguageMarkers(s);

//   // If starts/ends with matching quotes, unwrap
//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
//     s = s.slice(1, -1);
//   }

//   // If string contains escaped newlines and no real newlines, unescape
//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");

//   // Remove stray trailing filename lines like:
//   // "\nSomeFile.tsx"
//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");

//   // Remove tool wrapper prefixes
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");

//   // Common broken-case: double quotes before use client: e.g. ""use client";  or 'use client' within double quotes
//   s = s.replace(/^['"]\s*use client\s*['"]\s*;?/, "'use client';\n\n");
//   // ensure use client appears properly if looks like TSX
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }

//   // Try to auto-close brackets if unbalanced
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");

//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");

//   // ensure balanced
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }

//   // ensure trailing newline
//   if (!s.endsWith("\n")) s += "\n";
//   return s.trimEnd() + "\n";
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch {}
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) out[path] = sanitizeFileContent(val);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx"))
//       return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   // if it's JSON-like that contains files object, prefer the normalized page
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   // ensure 'use client' present if looks like TSX/React
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

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
//   const formSignals = ["<form", "input", "textarea", "select", "button", 'type="text"', "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", 'role="banner"', 'role="contentinfo"', 'aria-label="features"'];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// /* ---------------- Provider / client selection ---------------- */

// /**
//  * NOTE: If you want provider-specific request shaping for true multimodal fields,
//  * add code here to wrap the low-level client or to pass provider-specific
//  * options into createAgent/network.run. For now we keep it simple:
//  * - include image hints in system prompt and inline small images as base64
//  * - include IMAGE_URL sentinel messages via message-mapper
//  */
// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");
//   // NVIDIA models use the NVIDIA endpoint (example)
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }
//   // Example: local gpt4all base
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   // generic A4F / provider endpoints
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   // Groq example hook (if you add support, do it here)
//   if (modelId.startsWith("deepseek") || modelId.startsWith("deepseek-") || modelId.startsWith("deepseek-r1")) {
//     const base = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
//     const key = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY;
//     if (!key) throw new Error("GROQ_API_KEY not set");
//     // This library uses openai(...) as a thin HTTP client wrapper; pass baseUrl/key accordingly.
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// function getSystemPromptForModel(modelId?: string): string {
//   if (typeof modelId === "string" && (EXPERT_MODELS as readonly string[]).includes(modelId)) return PROMPT;
//   return SIMPLE_PROMPT;
// }

// /* ---------------- Main agent function ---------------- */

// const INLINE_SIZE_LIMIT = 500 * 1024; // 500KB

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     const { text: textPrompt, image, model: selectedModelRaw, projectId, selfFixRetries: rawRetries, enforceLanding: enforceLandingData } = event.data;

//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // fetch previous messages and map to typed TextMessage[]
//     const previousMessages: TextMessage[] = await step.run("get-previous-messages", async () => {
//       const rows = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 10,
//       });
//       // map rows to the agent TextMessage[] shape
//       const prismaRows: PrismaMessageRow[] = rows.map((r) => ({
//         role: r.role ?? "USER",
//         content: r.content,
//         imageUrl: r.imageUrl ?? null,
//       }));
//       const mapped = mapPrismaRowsToTextMessages(prismaRows);
//       // provider typically expects chronological order oldest -> newest
//       return mapped.reverse();
//     });

//     // inline image if small (base64) OR pass URL via IMAGE_URL sentinel
//     let inlinedImageData: string | undefined;
//     let imageUrlProvided: string | undefined;
//     if (image && typeof image === "string" && image.trim()) {
//       imageUrlProvided = image.trim();
//       try {
//         const resp = await fetch(imageUrlProvided);
//         if (resp.ok) {
//           const contentType = (resp.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
//           const arrayBuffer = await resp.arrayBuffer();
//           const size = arrayBuffer.byteLength;
//           if (size <= INLINE_SIZE_LIMIT) {
//             const buffer = Buffer.from(arrayBuffer);
//             const b64 = buffer.toString("base64");
//             inlinedImageData = `data:${contentType};base64,${b64}`;
//           }
//         } else {
//           console.warn("Image fetch returned non-ok status:", resp.status);
//         }
//       } catch (err) {
//         console.warn("Image fetch/inline failed:", err);
//       }
//     }

//     // create state. second arg type is Parameters<typeof createState>[1]
//     type CreateStateOpts = Parameters<typeof createState>[1];
//     const state = createState<AgentStateWithImage>(
//       { summary: "", files: {}, image: inlinedImageData ?? imageUrlProvided },
//       ({ messages: previousMessages } as unknown) as CreateStateOpts
//     );

//     // debug preview (safe)
//     try {
//       const preview = previousMessages.slice(0, 20).map((m) => ({
//         type: m.type,
//         role: m.role,
//         content: typeof m.content === "string" ? (m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content) : "[complex]",
//       }));
//       console.info("Provider-ready messages before run:", JSON.stringify(preview, null, 2));
//     } catch {}

//     const fallbackModel = process.env.DEFAULT_MODEL || "provider-2/gpt-5-nano";
//     const selectedModel = (typeof selectedModelRaw === "string" && selectedModelRaw.trim()) ? selectedModelRaw.trim() : fallbackModel;

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string) => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }
//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }
//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }
//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch {}
//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let baseSystem = getSystemPromptForModel(modelCandidate);
//       if (imageUrlProvided || inlinedImageData) {
//         const imgNoteParts: string[] = [];
//         imgNoteParts.push("IMAGE INFORMATION:");
//         if (inlinedImageData) {
//           imgNoteParts.push("An image was uploaded by the user and has been inlined as a base64 data URI. Use it as primary visual reference.");
//           imgNoteParts.push(`INLINE_IMAGE_BASE64: ${inlinedImageData}`);
//         } else if (imageUrlProvided) {
//           imgNoteParts.push("An image was uploaded by the user and is available at the following URL. If your model runtime can fetch external URLs, fetch and analyze the image at the URL and prioritize the visual layout and structure from the image. If the model runtime cannot fetch URLs, use the textual prompt as the fallback.");
//           imgNoteParts.push(`IMAGE_URL: ${imageUrlProvided}`);
//         }
//         baseSystem = `${imgNoteParts.join("\n")}\n\n${baseSystem}`;
//       }

//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }
//       const systemPrompt = `${baseSystem}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             try {
//               const ar = result as unknown as AgentResult;
//               const text = lastAssistantTextMessageContent(ar);
//               if (text) network.state.data.summary = text;
//             } catch (e) {
//               console.warn("Failed to extract assistant text from result (onResponse):", e);
//             }
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent),
//       });

//       const initialPromptParts: string[] = [];
//       if (imageUrlProvided || inlinedImageData) {
//         initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//         if (inlinedImageData) initialPromptParts.push("Inline base64 image provided in the system prompt. Use it to derive structure & layout.");
//         else if (imageUrlProvided) initialPromptParts.push(`Image URL: ${imageUrlProvided} (fetch if possible).`);
//       }
//       if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
//       const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch {}
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystem}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [
//               `PREVIOUS ASSISTANT OUTPUT:`,
//               finalSummary,
//               "",
//               `ERROR: ${lastErrorMessage}`,
//               "",
//               `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`,
//             ].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           }

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${String(s).slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     } // end model loop

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
//     const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       // Final sanitization/unwrapping to ensure it's valid TSX/JS source (not a JSON string literal)
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         await sandbox.files.remove("pages/index.tsx");
//       } catch {}
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );


// // src/inngest/functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   gemini,
//   createNetwork,
//   createState,
//   openai,
//   type TextMessage,
//   type AgentResult,
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   parseAgentOutput,
// } from "./utils";
// import { getPromptForModel, FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT5 } from "./types";
// import { codeAgentRunSchema } from "./schema";
// import { mapPrismaRowsToTextMessages, PrismaMessageRow } from "./message-mapper";

// /* ---------------- Types & constants ---------------- */

// interface AgentState {
//   summary?: string;
//   files?: Record<string, string>;
//   error?: string;
//   iteration?: number;
// }
// type AgentStateWithImage = AgentState & { image?: string };

// type OpenAiClient = ReturnType<typeof openai>;
// type GeminiClient = ReturnType<typeof gemini>;
// type ModelClient = OpenAiClient | GeminiClient;

// const PREFERRED_PATH = "app/page.tsx";
// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "gpt-4",
//   "o3",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o",
// ] as const;

// type Provider = "openai" | "nvidia" | "llama" | "moonshotai" | "ibm" | "google";
// // type ModelCategory = "vision" | "general" | "code";

// // Models routed to NVIDIA endpoint (example)
// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "meta/llama-3.2-11b-vision-instruct",
//   "meta/llama-4-maverick-17b-128e-instruct",
//   "meta/codellama-70b",
//   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//   "meta/llama-3.3-70b-instruct",
//   "mistralai/mistral-nemotron",
//   "mistralai/mistral-small-3.2-24b-instruct",
//   "mistralai/codestral-22b-instruct-v01",
//   "deepseek-ai/deepseek-r1-0528",
//   "deepseek-ai/deepseek-r1-distill-llama-8b",
//   "qwen/qwen3-235b-a22b",
//   "qwen/qwen2.5-coder-32b-instruct",
//   "moonshotai/kimi-k2-instruct",
//   "ibm/granite-34b-code-instruct",
//   "openai/gpt-oss-120b",
//   "google/codegemma-1.1-7b-1",
//   "google/gemma-3-1b-it",
//   "nvidia/llama-3.1-nemotron-ultra-253b-v1",
//   "nvidia/llama-3.1-nemotron-70b-instruct",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
// ] as const;

// /* ---------------- zod for file arrays ---------------- */

// const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
// const FilesToolArgsSchema = z.object({ files: z.array(FileItemSchema) });

// /* ---------------- Parsing + sanitization helpers ---------------- */

// // (unchanged helper functions kept as-is)
// function isLikelyBalanced(code: string): boolean {
//   if (typeof code !== "string") return true;
//   const counts = {
//     roundOpen: (code.match(/\(/g) || []).length,
//     roundClose: (code.match(/\)/g) || []).length,
//     curlyOpen: (code.match(/{/g) || []).length,
//     curlyClose: (code.match(/}/g) || []).length,
//     squareOpen: (code.match(/\[/g) || []).length,
//     squareClose: (code.match(/]/g) || []).length,
//     backticks: (code.match(/`/g) || []).length,
//   };
//   if (counts.roundOpen !== counts.roundClose) return false;
//   if (counts.curlyOpen !== counts.curlyClose) return false;
//   if (counts.squareOpen !== counts.squareClose) return false;
//   if (counts.backticks % 2 !== 0) return false;
//   return true;
// }

// function conservativeAutoClose(content: string): string | null {
//   if (!content) return null;
//   let out = content;
//   const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
//   const roundOpen = count(out, "(");
//   const roundClose = count(out, ")");
//   if (roundClose < roundOpen) out += ")".repeat(roundOpen - roundClose);
//   const curlyOpen = count(out, "{");
//   const curlyClose = count(out, "}");
//   if (curlyClose < curlyOpen) out += "}".repeat(curlyOpen - curlyClose);
//   const squareOpen = count(out, "[");
//   const squareClose = count(out, "]");
//   if (squareClose < squareOpen) out += "]".repeat(squareOpen - squareClose);
//   const backticks = count(out, "`");
//   if (backticks % 2 !== 0) out += "`";
//   return isLikelyBalanced(out) ? out : null;
// }

// function stripFencedLanguageMarkers(s: string): string {
//   let out = s ?? "";
//   out = out.replace(/^\s*```(?:json|tsx|ts|js)?\s*/i, "");
//   out = out.replace(/\s*```\s*$/i, "");
//   out = out.replace(/^\s*(json|createOrUpdateFiles|createOrUpdate):\s*/i, "");
//   out = out.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   return out;
// }

// function findBalancedJSONObject(text: string): string | null {
//   if (!text) return null;
//   const start = text.indexOf("{");
//   if (start === -1) return null;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = start; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "{") depth++;
//       else if (ch === "}") {
//         depth--;
//         if (depth === 0) return text.slice(start, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// function extractFilesArraySubstring(text: string): string | null {
//   if (!text) return null;
//   const lower = text.toLowerCase();
//   const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
//   if (idx === -1) return null;
//   const after = text.slice(idx);
//   const arrStart = after.indexOf("[");
//   if (arrStart === -1) return null;
//   const globalStart = idx + arrStart;
//   let depth = 0;
//   let inString = false;
//   let prev = "";
//   for (let i = globalStart; i < text.length; i++) {
//     const ch = text[i];
//     if (ch === '"' && prev !== "\\") inString = !inString;
//     if (!inString) {
//       if (ch === "[") depth++;
//       else if (ch === "]") {
//         depth--;
//         if (depth === 0) return text.slice(globalStart, i + 1);
//       }
//     }
//     prev = ch;
//   }
//   return null;
// }

// /**
//  * Attempt to parse JSON heuristically, stripping fence markers, fixing trailing commas etc.
//  */
// function safeJsonParse(s: string): unknown | null {
//   if (!s) return null;
//   const pre = stripFencedLanguageMarkers(s).trim();
//   try {
//     return JSON.parse(pre);
//   } catch {}
//   const balanced = findBalancedJSONObject(pre);
//   if (balanced) {
//     try {
//       return JSON.parse(balanced);
//     } catch {}
//     const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
//     try {
//       return JSON.parse(cleaned);
//     } catch {}
//   }
//   const arr = extractFilesArraySubstring(pre);
//   if (arr) {
//     const wrapped = `{"files": ${arr}}`;
//     try {
//       return JSON.parse(wrapped);
//     } catch {
//       try {
//         const cleaned = wrapped.replace(/,\s*(?=[}\]])/g, "");
//         return JSON.parse(cleaned);
//       } catch {}
//     }
//   }
//   const trimmed = pre.trim();
//   // Unwrap wrapped string literal
//   if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
//     const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
//     try {
//       return JSON.parse(unq);
//     } catch {}
//     const b2 = findBalancedJSONObject(unq);
//     if (b2) {
//       try {
//         return JSON.parse(b2);
//       } catch {}
//     }
//   }
//   // Attempt to convert single quotes / unquoted keys into valid JSON
//   const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
//   try {
//     return JSON.parse(singleToDouble);
//   } catch {}
//   return null;
// }



// /**
//  * Robust normalization of file content coming from model output.
//  * Removes fencing, unwraps quotes, unescapes common escapes, trims spurious filenames, etc.
//  */
// function sanitizeFileContent(raw: unknown): string {
//   let s: string;
//   if (raw == null) s = "";
//   else if (typeof raw === "string") s = raw;
//   else {
//     try {
//       s = typeof raw === "object" ? JSON.stringify(raw, null, 2) : String(raw);
//     } catch {
//       s = String(raw);
//     }
//   }

//   s = s.replace(/\r\n/g, "\n");
//   s = stripFencedLanguageMarkers(s);

//   if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
//     s = s.slice(1, -1);
//   }

//   if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");

//   s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
//   s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
//   s = s.replace(/^['"]\s*use client\s*['"]\s*;?/, "'use client';\n\n");

//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }

//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");

//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }

//   if (!s.endsWith("\n")) s += "\n";
//   return s.trimEnd() + "\n";
// }

// function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
//   if (!parsed || typeof parsed !== "object") return null;
//   const obj = parsed as Record<string, unknown>;
//   try {
//     const zRes = FilesToolArgsSchema.safeParse(obj);
//     if (zRes.success) {
//       const out: Record<string, string> = {};
//       for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
//       return coerceToPage(out);
//     }
//   } catch {}
//   if (Array.isArray(obj.files)) {
//     const out: Record<string, string> = {};
//     for (const item of obj.files as unknown[]) {
//       if (item && typeof item === "object") {
//         const it = item as Record<string, unknown>;
//         if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
//       }
//     }
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
//     const fm = obj.files as Record<string, unknown>;
//     const out: Record<string, string> = {};
//     for (const [path, val] of Object.entries(fm)) out[path] = sanitizeFileContent(val);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   if (typeof obj.path === "string" && obj.content != null) return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
//   const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
//   if (direct.length > 0) {
//     const out: Record<string, string> = {};
//     for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
//     if (Object.keys(out).length > 0) return coerceToPage(out);
//   }
//   for (const [, v] of Object.entries(obj)) {
//     if (typeof v === "string") {
//       const maybe = safeJsonParse(v);
//       if (maybe) {
//         const nested = normalizeParsedFiles(maybe);
//         if (nested) return nested;
//       }
//     }
//   }
//   return null;
// }

// function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
//   if (!files) return null;
//   if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
//   for (const [path, content] of Object.entries(files)) {
//     const low = path.toLowerCase();
//     if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx"))
//       return { [PREFERRED_PATH]: content };
//   }
//   for (const [path, content] of Object.entries(files)) {
//     if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
//   }
//   const first = Object.entries(files)[0];
//   return first ? { [PREFERRED_PATH]: first[1] } : null;
// }

// function finalSanitizeBeforeWrite(content: string): string {
//   let s = sanitizeFileContent(content);
//   if (/"files"\s*:|"\.tsx"|'"path"\s*:/.test(s)) {
//     const parsed = safeJsonParse(s);
//     if (parsed) {
//       const normalized = normalizeParsedFiles(parsed);
//       if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
//       if (normalized) s = Object.values(normalized)[0];
//     }
//   }
//   const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
//   const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
//   if (hasUnquotedUseClient && !hasProperUseClient) {
//     s = s.replace(/^\s*use client\s*;?/i, "");
//     s = `'use client';\n\n${s.trimStart()}`;
//   } else if (!hasProperUseClient) {
//     const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
//     if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
//   } else {
//     s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
//     s = s.replace(/^'use client';\s*/i, `'use client';\n\n`);
//   }
//   s = s.replace(/^\s*\]\s*$/gm, "");
//   s = s.replace(/^\s*"\w+"\s*:\s*\[.*$/m, "");
//   s = s.replace(/from\s+(['"][^'"]+['"])\s*\];/g, "from $1;");
//   s = s.replace(/^\s*{+\s*/g, "");
//   s = s.replace(/\s*}+\s*$/g, "");
//   s = sanitizeFileContent(s);
//   if (!isLikelyBalanced(s)) {
//     const closed = conservativeAutoClose(s);
//     if (closed) s = closed;
//   }
//   if (!s.endsWith("\n")) s += "\n";
//   return s;
// }

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
//   const formSignals = ["<form", "input", "textarea", "select", "button", 'type="text"', "payment", "credit card"];
//   if (formSignals.some((s) => content.includes(s))) return false;
//   if (lineCount < 30) return true;
//   const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
//   const hasKeyword = requiredKeywords.some((k) => content.includes(k));
//   const structuralSignals = ["<section", 'role="banner"', 'role="contentinfo"', 'aria-label="features"'];
//   const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
//   return !(hasKeyword || hasStructureSignal);
// }

// function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
//   return Array.isArray(arr) && (arr as readonly string[]).includes(id);
// }

// /* ---------------- Provider / client selection ---------------- */

// /**
//  * NOTE: provider-specific request shaping can be added here.
//  * Currently we route NVIDIA listed modelIds to a NVIDIA baseUrl if present.
//  */
// const getModelClient = (rawModelId?: unknown): ModelClient => {
//   const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
//   if (!modelId) throw new Error("No modelId provided to getModelClient.");
//   if (safeIncludes(NVIDIA_MODELS, modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
//   }
//   if (modelId === "gpt-4.1-mini") {
//     const base = process.env.OPENAI_BASE_URL_GPT4ALL;
//     const key = process.env.OPENAI_API_KEY_GPT4ALL;
//     if (!base) throw new Error("OPENAI_BASE_URL_GPT4ALL is not set for gpt-4.1-mini.");
//     if (!key) throw new Error("OPENAI_API_KEY_GPT4ALL is not set for gpt-4.1-mini.");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   if (modelId.includes("/") || modelId.includes(":")) {
//     const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
//     const key = process.env.OPENAI_A4F_API_KEY;
//     if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   if (modelId.startsWith("deepseek") || modelId.startsWith("deepseek-") || modelId.startsWith("deepseek-r1")) {
//     const base = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
//     const key = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY;
//     if (!key) throw new Error("GROQ_API_KEY not set");
//     return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
//   }
//   throw new Error(`No client configuration found for modelId "${modelId}".`);
// };

// /* ---------------- Helper: derive provider key from modelId ---------------- */
// // function deriveProviderFromModelId(modelId: string | undefined): string {
// //   if (!modelId) return "other";
// //   const id = modelId.toLowerCase();
// //   if (id.startsWith("nvidia/")) return "nvidia";
// //   if (id.startsWith("openai/") || id.startsWith("gpt-")) return "openai";
// //   if (id.startsWith("provider-") || id.includes("a4f")) return "a4f";
// //   if (id.startsWith("meta/") || id.includes("llama") || id.includes("codellama")) return "llama";
// //   if (id.startsWith("qwen/") || id.includes("qwen")) return "qwen";
// //   if (id.startsWith("google/") || id.includes("gemma")) return "google";
// //   return "other";
// // }

// function deriveProviderFromModelId(modelId: string): Provider {
//   if (modelId.startsWith("gpt-")) return "openai";
//   if (modelId.startsWith("nvidia/")) return "nvidia";
//   if (modelId.startsWith("llama-")) return "llama";
//   if (modelId.startsWith("moonshot")) return "moonshotai";
//   if (modelId.startsWith("ibm-")) return "ibm";
//   if (modelId.startsWith("google-")) return "google";
//   return "openai"; // default fallback
// }

// /* ---------------- Main agent function ---------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run", schema: codeAgentRunSchema },
//   async ({ event, step }) => {
//     const { text: textPrompt, image, model: selectedModelRaw, projectId, selfFixRetries: rawRetries, enforceLanding: enforceLandingData } = event.data;

//     const rawRetriesNum = Number(rawRetries ?? 5);
//     const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
//     const enforceLanding = Boolean(enforceLandingData ?? false);

//     // create sandbox
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT5);
//       return sandbox.sandboxId;
//     });

//     // fetch previous messages and map to typed TextMessage[]
//     const previousMessages: TextMessage[] = await step.run("get-previous-messages", async () => {
//       const rows = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "desc" },
//         take: 10,
//       });
//       const prismaRows: PrismaMessageRow[] = rows.map((r) => ({
//         role: r.role ?? "USER",
//         content: r.content,
//         imageUrl: r.imageUrl ?? null,
//       }));
//       const mapped = mapPrismaRowsToTextMessages(prismaRows);
//       return mapped.reverse();
//     });

//     // IMAGE HANDLING: do NOT inline images. Only accept public HTTPS URLs (UploadThing / signed URLs).
//     let imageUrlProvided: string | undefined;
//     if (image && typeof image === "string" && image.trim()) {
//       try {
//         const u = new URL(image.trim());
//         if (u.protocol !== "https:") {
//           console.warn("Rejected non-HTTPS image URL; only HTTPS is allowed for image inputs.");
//         } else {
//           imageUrlProvided = u.toString();
//           // OPTIONAL: quick HEAD to check reachability and content-type (do not download).
//           try {
//             const headResp = await fetch(imageUrlProvided, { method: "HEAD", redirect: "follow" });
//             if (!headResp.ok) {
//               console.warn("Image HEAD request returned non-OK status:", headResp.status);
//               // still allow — model will fallback to textual prompt if needed
//             } else {
//               const ct = headResp.headers.get("content-type") ?? "";
//               if (!ct.startsWith("image/")) {
//                 console.warn("Image URL content-type is not image/*:", ct);
//               }
//             }
//           } catch (e) {
//             console.warn("Image HEAD check failed; proceeding with URL-only approach:", e);
//           }
//         }
//       } catch (err) {
//         console.log(err)
//         console.warn("Invalid image URL provided:", image);
//       }
//     }

    

//     // create state. second arg type is Parameters<typeof createState>[1]
//     type CreateStateOpts = Parameters<typeof createState>[1];
//     const state = createState<AgentStateWithImage>(
//       { summary: "", files: {}, image: imageUrlProvided },
//       ({ messages: previousMessages } as unknown) as CreateStateOpts
//     );

//     // debug preview
//     try {
//       const preview = previousMessages.slice(0, 20).map((m) => ({
//         type: m.type,
//         role: m.role,
//         content: typeof m.content === "string" ? (m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content) : "[complex]",
//       }));
//       console.info("Provider-ready messages before run:", JSON.stringify(preview, null, 2));
//     } catch {}

//     const fallbackModel = process.env.DEFAULT_MODEL || "provider-2/gpt-5-nano";
//     const selectedModel = (typeof selectedModelRaw === "string" && selectedModelRaw.trim()) ? selectedModelRaw.trim() : fallbackModel;

//     const candidateModels: string[] = [selectedModel];
//     if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
//       for (const m of EXPERT_MODELS) {
//         try {
//           getModelClient(m);
//           candidateModels.push(m);
//           break;
//         } catch {}
//       }
//     }

//     let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

//     const extractAndNormalize = async (text: string, modelId?: string) => {
//       const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//       if (fenced) {
//         const cleaned = stripFencedLanguageMarkers(fenced[1]);
//         const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
//         }
//       }
//       const balanced = findBalancedJSONObject(text);
//       if (balanced) {
//         const parsed = safeJsonParse(balanced);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
//         }
//       }
//       const filesArr = extractFilesArraySubstring(text);
//       if (filesArr) {
//         const wrapped = `{"files": ${filesArr}}`;
//         const parsed = safeJsonParse(wrapped);
//         if (parsed) {
//           const normalized = normalizeParsedFiles(parsed);
//           if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
//         }
//       }
//       const parsedWhole = safeJsonParse(text);
//       if (parsedWhole) {
//         const normalized = normalizeParsedFiles(parsedWhole);
//         if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
//       }
//       try {
//         const fallback = parseFilesFromSummary(text, modelId);
//         if (fallback && Object.keys(fallback).length > 0) {
//           const sanitized: Record<string, string> = {};
//           for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
//           return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
//         }
//       } catch {}
//       return { files: null, parseText: null, parsedRaw: null };
//     };

//     for (const modelCandidate of candidateModels) {
//       let modelClient: ModelClient;
//       try {
//         modelClient = getModelClient(modelCandidate);
//       } catch (err) {
//         const msg = err instanceof Error ? err.message : String(err);
//         await step.run("save-model-client-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

// const providerKey: Provider = deriveProviderFromModelId(modelCandidate);
// const isVision = Boolean(imageUrlProvided);

// const baseSystem = getPromptForModel(
//   providerKey,
//   isVision ? "vision" : "general",
//   { expert: (EXPERT_MODELS as readonly string[]).includes(modelCandidate) }
// );

//       // Add explicit image URL sentinel only (no inlining)
//       let baseSystemWithImage = baseSystem;
//       if (imageUrlProvided) {
//         baseSystemWithImage = `${baseSystem}\n\nIMAGE_INFORMATION:\n- IMAGE_URL: ${imageUrlProvided}\n- NOTE: The image is provided as a public HTTPS URL (UploadThing-style signed/public URL). Use it as the primary visual reference. Do NOT expect inline/base64 data. If you cannot fetch the URL, fallback to the textual prompt.`;
//       }

//       // Enforce JSON output instructions (keeps downstream parsing deterministic)
//       let enforceJsonInstruction = `\nIMPORTANT:\nWhen you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:\n\n{ "files": [ { "path": "app/page.tsx", "content": "FILE CONTENT HERE" } ] }\n\nWrap the JSON in triple-backticks with "json" if possible. After JSON include exactly one line with <task_summary>...</task_summary>. Do NOT output any additional commentary.`;
//       if ((NVIDIA_MODELS as readonly string[]).includes(modelCandidate)) {
//         enforceJsonInstruction += `\nSPECIAL NOTE FOR NVIDIA MODELS: Output ONLY the single JSON object as specified above (optionally wrapped in a single \`\`\`json block\`\`\`). Do NOT append filenames or other stray text after the JSON object.`;
//       }
//       const systemPrompt = `${baseSystemWithImage}\n\n${enforceJsonInstruction}`;

//       const codeAgent = createAgent<AgentStateWithImage>({
//         name: "code-agent",
//         system: systemPrompt,
//         model: modelClient,
//         lifecycle: {
//           onResponse: async ({ result, network }) => {
//             if (!network) return result;
//             try {
//               const ar = result as unknown as AgentResult;
//               const text = lastAssistantTextMessageContent(ar);
//               if (text) network.state.data.summary = text;
//             } catch (e) {
//               console.warn("Failed to extract assistant text from result (onResponse):", e);
//             }
//             return result;
//           },
//         },
//       });

//       const network = createNetwork<AgentStateWithImage>({
//         name: "coding-agent-network",
//         agents: [codeAgent],
//         maxIter: 1,
//         router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent),
//       });

//       const initialPromptParts: string[] = [];
//       if (imageUrlProvided) {
//         initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
//         initialPromptParts.push(`Image URL (public HTTPS): ${imageUrlProvided} (use this URL as the canonical design reference; do NOT expect inline/base64).`);
//       }
//       if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
//       const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

//       let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
//       try {
//         runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
//       } catch (err) {
//         const errMsg = err instanceof Error ? err.message : String(err);
//         await step.run("save-provider-error", async () =>
//           prisma.message.create({
//             data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
//           })
//         );
//         continue;
//       }

//       let finalSummary = runResult?.state?.data?.summary ?? "";
//       const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
//       let filesFromSummary = parseResult.files;

//       const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

//       if (!needsFix(filesFromSummary)) {
//         successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//       } else {
//         if (parseResult.parseText && typeof parseResult.parseText === "string") {
//           try {
//             const maybe = safeJsonParse(parseResult.parseText);
//             const normalized = normalizeParsedFiles(maybe);
//             if (normalized) {
//               const repaired: Record<string, string> = {};
//               for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//               filesFromSummary = coerceToPage(repaired);
//             }
//           } catch {}
//         }

//         if (!needsFix(filesFromSummary)) {
//           successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//         } else {
//           const FIXER_SYSTEM = `${baseSystemWithImage}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
//           const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

//           let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
//           const attemptOutputs: string[] = [];
//           let fixerSucceeded = false;

//           for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
//             const userFixPrompt = [
//               `PREVIOUS ASSISTANT OUTPUT:`,
//               finalSummary,
//               "",
//               `ERROR: ${lastErrorMessage}`,
//               "",
//               `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`,
//             ].join("\n");
//             try {
//               const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
//               const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
//               attemptOutputs.push(fixerRaw);
//               finalSummary = fixerRaw;

//               const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
//               const fixerFiles = fixParsed.files;
//               if (fixerFiles) {
//                 const repaired: Record<string, string> = {};
//                 for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
//                 filesFromSummary = coerceToPage(repaired);
//               } else filesFromSummary = null;

//               if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
//                 successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
//                 fixerSucceeded = true;
//                 break;
//               }

//               if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
//               else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
//             } catch (e) {
//               const errMsg = e instanceof Error ? e.message : String(e);
//               lastErrorMessage = `Fixer agent threw: ${errMsg}`;
//               attemptOutputs.push(`FIXER_THROW:${errMsg}`);
//               break;
//             }
//           }

//           if (!successfulResult) {
//             const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${String(s).slice(0, 200)}`).join("\n---\n");
//             const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
//             await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
//             continue;
//           }
//         }
//       }

//       if (successfulResult) {
//         const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
//         for (const [p, c] of Object.entries(repaired)) {
//           if (!isLikelyBalanced(c)) {
//             const cons = conservativeAutoClose(c);
//             if (cons && isLikelyBalanced(cons)) repaired[p] = cons;
//           }
//         }
//         successfulResult.filesFromSummary = repaired;
//         break;
//       }
//     } // end model loop

//     if (!successfulResult) {
//       const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
//       await step.run("save-error-result-final", async () =>
//         prisma.message.create({
//           data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel },
//         })
//       );
//       return { error: "Agent failed validation on all attempts." };
//     }

//     const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
//     const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
//     const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
//       const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
//       const closed = !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
//       const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
//       try {
//         await sandbox.files.remove("pages/index.tsx");
//       } catch {}
//       await sandbox.files.write(PREFERRED_PATH, contentToWrite);
//     });

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
//               files: filesFromSummary,
//             },
//           },
//         },
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: usedModel || selectedModel,
//     };
//   }
// );


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
import { getPromptForModel, FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT5 } from "./types";
import { codeAgentRunSchema } from "./schema";
import { mapPrismaRowsToTextMessages, PrismaMessageRow } from "./message-mapper";

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
  "provider-6/llama-4-scout",
  "provider-3/deepseek-v3-0324",
  "provider-2/glm-4.5-air",
  "provider-6/glm-4.5-air",
  "provider-6/qwen3-coder-480b-a35b",
  "provider-2/gpt-5-nano",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "deepseek-ai/deepseek-r1-0528",
  "qwen/qwen3-235b-a22b",
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
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
] as const;

/* ---------------- zod for file arrays ---------------- */

const FileItemSchema = z.object({ path: z.string().min(1), content: z.string() });
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
  const count = (s: string, ch: string) => (s.match(new RegExp(`\\${ch}`, "g")) || []).length;
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
  const idx = lower.indexOf('"files"') >= 0 ? lower.indexOf('"files"') : lower.indexOf("files");
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
  } catch {}
  const balanced = findBalancedJSONObject(pre);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {}
    const cleaned = balanced.replace(/,\s*(?=[}\]])/g, "");
    try {
      return JSON.parse(cleaned);
    } catch {}
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
      } catch {}
    }
  }
  const trimmed = pre.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unq = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
    try {
      return JSON.parse(unq);
    } catch {}
    const b2 = findBalancedJSONObject(unq);
    if (b2) {
      try {
        return JSON.parse(b2);
      } catch {}
    }
  }
  const singleToDouble = pre.replace(/(['"])?([a-zA-Z0-9_\-\/\.]+)\1\s*:/g, '"$2":');
  try {
    return JSON.parse(singleToDouble);
  } catch {}
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

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");

  s = s.replace(/\n\s*[A-Za-z0-9_\-\/]+(\.txt|\.tsx|\.jsx|\.ts)?\s*$/i, "");
  s = s.replace(/^\s*(createOrUpdateFiles|createOrUpdate|create_or_update|createOrUpdate):\s*/i, "");
  s = s.replace(/^['"]\s*use client\s*['"]\s*;?/, "'use client';\n\n");

  const hasProperUseClient = /^\s*(['"])use client\1\s*;?/i.test(s);
  const hasUnquotedUseClient = /^\s*use client\s*;?/i.test(s);
  if (hasUnquotedUseClient && !hasProperUseClient) {
    s = s.replace(/^\s*use client\s*;?/i, "");
    s = `'use client';\n\n${s.trimStart()}`;
  } else if (!hasProperUseClient) {
    const looksLikeTsx = /import\s+.*from\s+['"].*['"]|<\w+/i.test(s);
    if (looksLikeTsx) s = `'use client';\n\n${s.trimStart()}`;
  } else {
    s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
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

function normalizeParsedFiles(parsed: unknown): Record<string, string> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  try {
    const zRes = FilesToolArgsSchema.safeParse(obj);
    if (zRes.success) {
      const out: Record<string, string> = {};
      for (const f of zRes.data.files) out[f.path] = sanitizeFileContent(f.content);
      return coerceToPage(out);
    }
  } catch {}
  if (Array.isArray(obj.files)) {
    const out: Record<string, string> = {};
    for (const item of obj.files as unknown[]) {
      if (item && typeof item === "object") {
        const it = item as Record<string, unknown>;
        if (typeof it.path === "string" && it.content != null) out[it.path] = sanitizeFileContent(it.content);
      }
    }
    if (Object.keys(out).length > 0) return coerceToPage(out);
  }
  if (obj.files && typeof obj.files === "object" && !Array.isArray(obj.files)) {
    const fm = obj.files as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [path, val] of Object.entries(fm)) out[path] = sanitizeFileContent(val);
    if (Object.keys(out).length > 0) return coerceToPage(out);
  }
  if (typeof obj.path === "string" && obj.content != null) return coerceToPage({ [obj.path]: sanitizeFileContent(obj.content) });
  const direct = Object.entries(obj).filter(([, v]) => typeof v === "string");
  if (direct.length > 0) {
    const out: Record<string, string> = {};
    for (const [path, val] of direct) out[path] = sanitizeFileContent(val as string);
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

function coerceToPage(files: Record<string, string> | null): Record<string, string> | null {
  if (!files) return null;
  if (files[PREFERRED_PATH]) return { [PREFERRED_PATH]: files[PREFERRED_PATH] };
  for (const [path, content] of Object.entries(files)) {
    const low = path.toLowerCase();
    if (low.endsWith("page.tsx") || low.endsWith("index.tsx") || low.endsWith("page.jsx") || low.endsWith("index.jsx"))
      return { [PREFERRED_PATH]: content };
  }
  for (const [path, content] of Object.entries(files)) {
    if (/\.(tsx|jsx|ts|js)$/.test(path.toLowerCase())) return { [PREFERRED_PATH]: content };
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
      if (normalized && normalized[PREFERRED_PATH]) return normalized[PREFERRED_PATH];
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
    s = s.replace(/^\s*(['"]?)use client\1\s*;?/i, `'use client';`);
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

function isTrivialApp(files: Record<string, string> | null | undefined): boolean {
  if (!files) return true;
  const pageContent =
    files["app/page.tsx"] ||
    files["pages/index.tsx"] ||
    Object.entries(files).find(([path]) => path.endsWith("page.tsx") || path.endsWith("index.tsx"))?.[1] ||
    "";
  if (!pageContent) return true;
  const content = pageContent.toLowerCase();
  const lineCount = pageContent.split("\n").length;
  const formSignals = ["<form", "input", "textarea", "select", "button", 'type="text"', "payment", "credit card"];
  if (formSignals.some((s) => content.includes(s))) return false;
  if (lineCount < 30) return true;
  const requiredKeywords = ["hero", "feature", "features", "call to action", "cta", "get started", "footer"];
  const hasKeyword = requiredKeywords.some((k) => content.includes(k));
  const structuralSignals = ["<section", 'role="banner"', 'role="contentinfo"', 'aria-label="features"'];
  const hasStructureSignal = structuralSignals.some((s) => content.includes(s));
  return !(hasKeyword || hasStructureSignal);
}

function safeIncludes(arr: readonly string[] | unknown, id: string): boolean {
  return Array.isArray(arr) && (arr as readonly string[]).includes(id);
}

/* ---------------- Provider / client selection ---------------- */

const getModelClient = (rawModelId?: unknown): ModelClient => {
  const modelId = typeof rawModelId === "string" ? rawModelId : String(rawModelId ?? "");
  if (!modelId) throw new Error("No modelId provided to getModelClient.");

  if (safeIncludes(NVIDIA_MODELS, modelId)) {
    if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
    return openai({ model: modelId, baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: process.env.NVIDIA_API_KEY }) as OpenAiClient;
  }
  
  // The logic below correctly handles all A4F models via their 'provider-' prefix.
  if (safeIncludes(A4F_MODELS, modelId) || modelId.startsWith("provider-")) {
    const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
    const key = process.env.OPENAI_A4F_API_KEY;
    if (!key) throw new Error("OPENAI_A4F_API_KEY is not set");
    return openai({ model: modelId, baseUrl: base, apiKey: key }) as OpenAiClient;
  }
  
  throw new Error(`No client configuration found for modelId "${modelId}".`);
};


// FIXED: Replaced with a more robust provider detection function
function deriveProviderFromModelId(modelId: string): Provider {
    const lower = modelId.toLowerCase();

    // More specific prefixes should come first
    if (lower.startsWith("nvidia/")) return "nvidia";
    if (lower.startsWith("meta/")) return "llama";
    if (lower.startsWith("google/")) return "google";
    if (lower.startsWith("moonshotai/")) return "moonshotai";
    if (lower.startsWith("ibm/")) return "ibm";
    
    // Broader or OpenAI-compatible prefixes
    if (lower.startsWith("provider-") || lower.startsWith("openai/") || lower.startsWith("gpt-") || lower.startsWith("mistralai/") || lower.startsWith("qwen/") || lower.startsWith("deepseek-ai/")) {
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
    const { text: textPrompt, image, model: selectedModelRaw, projectId, selfFixRetries: rawRetries, enforceLanding: enforceLandingData } = event.data;

    const rawRetriesNum = Number(rawRetries ?? 5);
    const selfFixRetries = Math.min(10, Math.max(1, Number.isFinite(rawRetriesNum) ? Math.floor(rawRetriesNum) : 5));
    const enforceLanding = Boolean(enforceLandingData ?? false);

    // create sandbox
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-testz");
      await sandbox.setTimeout(SANDBOX_TIMEOUT5);
      return sandbox.sandboxId;
    });

    // fetch previous messages and map to typed TextMessage[]
    const previousMessages: TextMessage[] = await step.run("get-previous-messages", async () => {
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
    });

    // IMAGE HANDLING: do NOT inline images. Only accept public HTTPS URLs (UploadThing / signed URLs).
    let imageUrlProvided: string | undefined;
    if (image && typeof image === "string" && image.trim()) {
      try {
        const u = new URL(image.trim());
        if (u.protocol !== "https:") {
          console.warn("Rejected non-HTTPS image URL; only HTTPS is allowed for image inputs.");
        } else {
          imageUrlProvided = u.toString();
          // OPTIONAL: quick HEAD to check reachability and content-type (do not download).
          try {
            const headResp = await fetch(imageUrlProvided, { method: "HEAD", redirect: "follow" });
            if (!headResp.ok) {
              console.warn("Image HEAD request returned non-OK status:", headResp.status);
              // still allow — model will fallback to textual prompt if needed
            } else {
              const ct = headResp.headers.get("content-type") ?? "";
              if (!ct.startsWith("image/")) {
                console.warn("Image URL content-type is not image/*:", ct);
              }
            }
          } catch (e) {
            console.warn("Image HEAD check failed; proceeding with URL-only approach:", e);
          }
        }
      } catch (err) {
        console.log(err)
        console.warn("Invalid image URL provided:", image);
      }
    }

    

    // create state. second arg type is Parameters<typeof createState>[1]
    type CreateStateOpts = Parameters<typeof createState>[1];
    const state = createState<AgentStateWithImage>(
      { summary: "", files: {}, image: imageUrlProvided },
      ({ messages: previousMessages } as unknown) as CreateStateOpts
    );

    // debug preview
    try {
      const preview = previousMessages.slice(0, 20).map((m) => ({
        type: m.type,
        role: m.role,
        content: typeof m.content === "string" ? (m.content.length > 300 ? m.content.slice(0, 300) + "…" : m.content) : "[complex]",
      }));
      console.info("Provider-ready messages before run:", JSON.stringify(preview, null, 2));
    } catch {}

    const fallbackModel = process.env.DEFAULT_MODEL || "provider-2/gpt-5-nano";
    const selectedModel = (typeof selectedModelRaw === "string" && selectedModelRaw.trim()) ? selectedModelRaw.trim() : fallbackModel;

    const candidateModels: string[] = [selectedModel];
    if (!(EXPERT_MODELS as readonly string[]).includes(selectedModel)) {
      for (const m of EXPERT_MODELS) {
        try {
          getModelClient(m);
          candidateModels.push(m);
          break;
        } catch {}
      }
    }

    let successfulResult: { finalSummary: string; filesFromSummary: Record<string, string>; usedModel: string; modelClient: ModelClient } | null = null;

    const extractAndNormalize = async (text: string, modelId?: string) => {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced) {
        const cleaned = stripFencedLanguageMarkers(fenced[1]);
        const parsed = safeJsonParse(cleaned) ?? safeJsonParse(cleaned.replace(/,\s*(?=[}\]])/g, ""));
        if (parsed) {
          const normalized = normalizeParsedFiles(parsed);
          if (normalized) return { files: normalized, parseText: cleaned, parsedRaw: parsed };
        }
      }
      const balanced = findBalancedJSONObject(text);
      if (balanced) {
        const parsed = safeJsonParse(balanced);
        if (parsed) {
          const normalized = normalizeParsedFiles(parsed);
          if (normalized) return { files: normalized, parseText: balanced, parsedRaw: parsed };
        }
      }
      const filesArr = extractFilesArraySubstring(text);
      if (filesArr) {
        const wrapped = `{"files": ${filesArr}}`;
        const parsed = safeJsonParse(wrapped);
        if (parsed) {
          const normalized = normalizeParsedFiles(parsed);
          if (normalized) return { files: normalized, parseText: filesArr, parsedRaw: parsed };
        }
      }
      const parsedWhole = safeJsonParse(text);
      if (parsedWhole) {
        const normalized = normalizeParsedFiles(parsedWhole);
        if (normalized) return { files: normalized, parseText: text, parsedRaw: parsedWhole };
      }
      try {
        const fallback = parseFilesFromSummary(text, modelId);
        if (fallback && Object.keys(fallback).length > 0) {
          const sanitized: Record<string, string> = {};
          for (const [p, c] of Object.entries(fallback)) sanitized[p] = sanitizeFileContent(c);
          return { files: coerceToPage(sanitized) ?? sanitized, parseText: null, parsedRaw: null };
        }
      } catch {}
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
            data: { projectId, content: `Model client creation failed for ${modelCandidate}: ${msg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
          })
        );
        continue;
      }

const providerKey: Provider = deriveProviderFromModelId(modelCandidate);
const isVision = Boolean(imageUrlProvided);

const baseSystem = getPromptForModel(
  providerKey,
  isVision ? "vision" : "general",
  { expert: (EXPERT_MODELS as readonly string[]).includes(modelCandidate) }
);

      // Add explicit image URL sentinel only (no inlining)
      let baseSystemWithImage = baseSystem;
      if (imageUrlProvided) {
        baseSystemWithImage = `${baseSystem}\n\nIMAGE_INFORMATION:\n- IMAGE_URL: ${imageUrlProvided}\n- NOTE: The image is provided as a public HTTPS URL (UploadThing-style signed/public URL). Use it as the primary visual reference. Do NOT expect inline/base64 data. If you cannot fetch the URL, fallback to the textual prompt.`;
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
              console.warn("Failed to extract assistant text from result (onResponse):", e);
            }
            return result;
          },
        },
      });

      const network = createNetwork<AgentStateWithImage>({
        name: "coding-agent-network",
        agents: [codeAgent],
        maxIter: 1,
        router: async ({ network: net }) => (net.state.data.summary ? undefined : codeAgent),
      });

      const initialPromptParts: string[] = [];
      if (imageUrlProvided) {
        initialPromptParts.push("User has uploaded an image to use as the primary design reference.");
        initialPromptParts.push(`Image URL (public HTTPS): ${imageUrlProvided} (use this URL as the canonical design reference; do NOT expect inline/base64).`);
      }
      if (textPrompt && textPrompt.trim()) initialPromptParts.push(`User prompt: ${textPrompt.trim()}`);
      const initialPrompt = initialPromptParts.length > 0 ? initialPromptParts.join("\n\n") : (textPrompt || "Generate a UI based on the provided image.");

      let runResult: { state?: { data?: AgentStateWithImage } } | undefined;
      try {
        runResult = (await network.run(initialPrompt, { state })) as { state?: { data?: AgentStateWithImage } } | undefined;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await step.run("save-provider-error", async () =>
          prisma.message.create({
            data: { projectId, content: `Provider/network error when running agent (${modelCandidate}): ${errMsg}`, role: "ASSISTANT", type: "ERROR", model: modelCandidate },
          })
        );
        continue;
      }

      let finalSummary = runResult?.state?.data?.summary ?? "";
      const parseResult = await extractAndNormalize(finalSummary, modelCandidate);
      let filesFromSummary = parseResult.files;

      const needsFix = (files: Record<string, string> | null) => !files || Object.keys(files).length === 0 || (enforceLanding && isTrivialApp(files));

      if (!needsFix(filesFromSummary)) {
        successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
      } else {
        if (parseResult.parseText && typeof parseResult.parseText === "string") {
          try {
            const maybe = safeJsonParse(parseResult.parseText);
            const normalized = normalizeParsedFiles(maybe);
            if (normalized) {
              const repaired: Record<string, string> = {};
              for (const [p, c] of Object.entries(normalized)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
              filesFromSummary = coerceToPage(repaired);
            }
          } catch {}
        }

        if (!needsFix(filesFromSummary)) {
          successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
        } else {
          const FIXER_SYSTEM = `${baseSystemWithImage}\n\nYou are a code-fixer assistant. You will be given the previous assistant output and an ERROR message. Return ONLY a single JSON object matching: { "files": [ { "path": "app/page.tsx", "content": "<FULL_FILE_CONTENT>" } ] } followed by exactly one <task_summary> line. No other text.`;
          const fixerAgent = createAgent({ name: "fixer-agent", system: FIXER_SYSTEM, model: modelClient });

          let lastErrorMessage: string = parseResult.parseText ? "JSON block found but parsing/validation failed." : "No JSON block found in the model output.";
          const attemptOutputs: string[] = [];
          let fixerSucceeded = false;

          for (let attempt = 0; attempt < selfFixRetries && !fixerSucceeded; attempt++) {
            const userFixPrompt = [
              `PREVIOUS ASSISTANT OUTPUT:`,
              finalSummary,
              "",
              `ERROR: ${lastErrorMessage}`,
              "",
              `Please return only a corrected JSON object (shape specified in system prompt) and nothing else. Include exactly one <task_summary>...</task_summary> line after the JSON.`,
            ].join("\n");
            try {
              const { output: fixerOutput } = await fixerAgent.run(userFixPrompt);
              const fixerRaw = typeof fixerOutput === "string" ? fixerOutput : String(fixerOutput ?? "");
              attemptOutputs.push(fixerRaw);
              finalSummary = fixerRaw;

              const fixParsed = await extractAndNormalize(fixerRaw, modelCandidate);
              const fixerFiles = fixParsed.files;
              if (fixerFiles) {
                const repaired: Record<string, string> = {};
                for (const [p, c] of Object.entries(fixerFiles)) repaired[p] = sanitizeFileContent(conservativeAutoClose(c) ?? c);
                filesFromSummary = coerceToPage(repaired);
              } else filesFromSummary = null;

              if (filesFromSummary && Object.keys(filesFromSummary).length > 0 && (!enforceLanding || !isTrivialApp(filesFromSummary))) {
                successfulResult = { finalSummary, filesFromSummary: filesFromSummary as Record<string, string>, usedModel: modelCandidate, modelClient };
                fixerSucceeded = true;
                break;
              }

              if (!filesFromSummary) lastErrorMessage = fixParsed.parseText ? `Fix attempt #${attempt + 1} returned JSON that failed normalization/validation.` : `Fix attempt #${attempt + 1} returned no JSON block.`;
              else lastErrorMessage = `Fix attempt #${attempt + 1} produced trivial/missing structure.`;
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              lastErrorMessage = `Fixer agent threw: ${errMsg}`;
              attemptOutputs.push(`FIXER_THROW:${errMsg}`);
              break;
            }
          }

          if (!successfulResult) {
            const truncated = attemptOutputs.slice(0, 5).map((s, i) => `attempt#${i + 1}:${String(s).slice(0, 200)}`).join("\n---\n");
            const consolidated = `Fix attempts exhausted for ${modelCandidate}. Last error: ${lastErrorMessage}. Attempts (truncated):\n${truncated}`;
            await step.run("save-fixer-exhausted", async () => prisma.message.create({ data: { projectId, content: consolidated, role: "ASSISTANT", type: "ERROR", model: modelCandidate } }));
            continue;
          }
        }
      }

      if (successfulResult) {
        const repaired: Record<string, string> = { ...successfulResult.filesFromSummary };
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
      const errMsg = `Agent failed validation with all attempted models (including self-fix attempts).`;
      await step.run("save-error-result-final", async () =>
        prisma.message.create({
          data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: selectedModel },
        })
      );
      return { error: "Agent failed validation on all attempts." };
    }

    const { finalSummary, filesFromSummary, usedModel, modelClient } = successfulResult;
    const fragmentTitleGenerator = createAgent({ name: "fragment-title-generator", description: "A fragment title generator", system: FRAGMENT_TITLE_PROMPT, model: modelClient });
    const responseGenerator = createAgent({ name: "response-generator", description: "A response generator", system: RESPONSE_PROMPT, model: modelClient });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
    const { output: responseOutput } = await responseGenerator.run(finalSummary);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("write-parsed-files-to-sandbox", async () => {
      const sandbox = await getSandbox(sandboxId);
      const rawPage = filesFromSummary[PREFERRED_PATH] ?? Object.values(filesFromSummary)[0] ?? "";
      const sanitized = finalSanitizeBeforeWrite(rawPage ?? "");
      const closed = !isLikelyBalanced(sanitized) ? conservativeAutoClose(sanitized) ?? sanitized : sanitized;
      const contentToWrite = closed.endsWith("\n") ? closed : closed + "\n";
      try {
        await sandbox.files.remove("pages/index.tsx");
      } catch {}
      await sandbox.files.write(PREFERRED_PATH, contentToWrite);
    });

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
  }
);

