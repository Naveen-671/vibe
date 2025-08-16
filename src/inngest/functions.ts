// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import {
//   createAgent,
//   openai,
//   createTool,
//   createNetwork,
//   type Message,
//   createState
// } from "@inngest/agent-kit";
// import {
//   getSandbox,
//   lastAssistantTextMessageContent,
//   logToolResult,
//   parseAgentOutput
// } from "./utils";
// import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
// import { z } from "zod";
// import { prisma } from "@/lib/db";
// import { SANDBOX_TIMEOUT15 } from "./types";

// interface AgentState {
//   summary?: string;
//   files?: { [path: string]: string };
//   error?: string;
//   iteration?: number;
// }

// // FIX: A much more robust parser that can handle the AI's output.
// function parseFilesFromSummary(summary: string): { [path: string]: string } {
//   const fileBlockRegex =
//     /createOrUpdateFiles:\s*({[\s\S]*?})\s*<task_summary>/im;
//   const blockMatch = fileBlockRegex.exec(summary);

//   if (!blockMatch || !blockMatch[1]) {
//     console.log("No valid 'createOrUpdateFiles' block found in summary.");
//     return {};
//   }

//   const contentBlock = blockMatch[1];

//   // Using the Function constructor is a safer way to parse the JS-like object literal
//   try {
//     const parsed = new Function(`return ${contentBlock}`)();
//     return parsed;
//   } catch (e) {
//     console.error(
//       "Failed to parse files from summary with Function constructor:",
//       e
//     );
//     return {};
//   }
// }

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent" },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");

//       await sandbox.setTimeout(SANDBOX_TIMEOUT15); // 15min
//       return sandbox.sandboxId;
//     });

//     const previousMessages = await step.run(
//       "get-previous-messages",
//       async () => {
//         const formatedMessages: Message[] = [];

//         const messages = await prisma.message.findMany({
//           where: {
//             projectId: event.data.projectId
//           },
//           orderBy: {
//             createdAt: "desc"
//             // createdAt: "desc" //TODO: Change to "asc" if AI does not understand what is the latest message
//           },
//           take: 3 // increases number of previous messages sent to ai
//         });

//         for (const message of messages) {
//           formatedMessages.push({
//             type: "text",
//             role: message.role === "ASSISTANT" ? "assistant" : "user",
//             content: message.content
//           });
//         }

//         return formatedMessages.reverse();
//       }
//     );

//     const state = createState<AgentState>(
//       {
//         summary: "",
//         files: {}
//       },
//       {
//         messages: previousMessages
//       }
//     );

//     const codeAgent = createAgent<AgentState>({
//       name: "code-agent",
//       description:
//         "An expert code agent for writing Next.js code in a sandboxed environment",
//       system: PROMPT,
//       model: openai({
//         model: "gpt-4.1-mini", // A powerful model is recommended
//         apiKey: process.env.OPENAI_API_KEY_GPT4ALL,
//         baseUrl: process.env.OPENAI_BASE_URL_GPT4ALL
//       }),
//       tools: [
//         createTool({
//           name: "terminal",
//           description: "Use the terminal to run commands like 'npm install'.",
//           parameters: z.object({ command: z.string() }),
//           handler: async (params) => {
//             const result = await (async () => {
//               try {
//                 const sandbox = await getSandbox(sandboxId);
//                 const exec = await sandbox.commands.run(params.command, {
//                   timeoutMs: 120000
//                 });
//                 return { stdout: exec.stdout, stderr: exec.stderr };
//               } catch (e: unknown) {
//                 return { error: e instanceof Error ? e.message : String(e) };
//               }
//             })();
//             logToolResult({ toolName: "terminal", output: result });
//             return result;
//           }
//         }),
//         createTool({
//           name: "deleteFiles",
//           description: "Deletes one or more files from the sandbox.",
//           parameters: z.object({ paths: z.array(z.string()) }),
//           handler: async (params) => {
//             const result = await (async () => {
//               try {
//                 const sandbox = await getSandbox(sandboxId);
//                 for (const path of params.paths) {
//                   await sandbox.files.remove(path);
//                 }
//                 return {
//                   success: true,
//                   message: `Successfully deleted ${params.paths.length} file(s).`
//                 };
//               } catch (e: unknown) {
//                 return { error: e instanceof Error ? e.message : String(e) };
//               }
//             })();
//             logToolResult({ toolName: "deleteFiles", output: result });
//             return result;
//           }
//         }),
//         createTool({
//           name: "createOrUpdateFiles",
//           description: "Create or update files in the sandbox.",
//           parameters: z.object({
//             files: z.array(z.object({ path: z.string(), content: z.string() }))
//           }),
//           handler: async ({ files }, { network }) => {
//             const result = await (async () => {
//               try {
//                 const sandbox = await getSandbox(sandboxId);
//                 for (const file of files) {
//                   await sandbox.files.write(file.path, file.content);
//                 }
//                 return { success: true, writtenFiles: files };
//               } catch (e: unknown) {
//                 return { error: e instanceof Error ? e.message : String(e) };
//               }
//             })();

//             if (network && "success" in result && result.success) {
//               const updatedFiles = network.state.data.files || {};
//               for (const file of result.writtenFiles) {
//                 updatedFiles[file.path] = file.content;
//               }
//               network.state.data.files = updatedFiles;
//             } else if (network && "error" in result && result.error) {
//               network.state.data.error = result.error as string;
//             }

//             logToolResult({ toolName: "createOrUpdateFiles", output: result });
//             return result;
//           }
//         }),
//         createTool({
//           name: "readFiles",
//           description: "Read files from the sandbox.",
//           parameters: z.object({ files: z.array(z.string()) }),
//           handler: async (params) => {
//             const result = await (async () => {
//               try {
//                 const sandbox = await getSandbox(sandboxId);
//                 const contents = [];
//                 for (const file of params.files) {
//                   const content = await sandbox.files.read(file);
//                   contents.push({ path: file, content });
//                 }
//                 return { files: contents };
//               } catch (e: unknown) {
//                 return { error: e instanceof Error ? e.message : String(e) };
//               }
//             })();
//             logToolResult({ toolName: "readFiles", output: result });
//             return result;
//           }
//         }),
//         createTool({
//           name: "runBuildCheck",
//           description:
//             "Runs a check to see if the application compiles successfully. Use this after writing files to detect errors.",
//           handler: async () => {
//             const result = await (async () => {
//               try {
//                 const sandbox = await getSandbox(sandboxId);
//                 const exec = await sandbox.commands.run("npm run build", {
//                   timeoutMs: 180000
//                 });
//                 if (
//                   exec.stderr.includes("Failed to compile") ||
//                   exec.stderr.includes("Error:") ||
//                   exec.exitCode !== 0
//                 ) {
//                   return {
//                     hasBuildErrors: true,
//                     errorLog: exec.stderr,
//                     stdout: exec.stdout
//                   };
//                 }
//                 return {
//                   hasBuildErrors: false,
//                   message: "Application compiled successfully.",
//                   stdout: exec.stdout
//                 };
//               } catch (e: unknown) {
//                 return { error: e instanceof Error ? e.message : String(e) };
//               }
//             })();
//             logToolResult({ toolName: "runBuildCheck", output: result });
//             return result;
//           }
//         })
//       ],
//       lifecycle: {
//         onResponse: async ({ result, network }) => {
//           if (!network) return result;
//           const lastAssistantMessageText =
//             lastAssistantTextMessageContent(result);
//           if (lastAssistantMessageText?.includes("<task_summary>")) {
//             network.state.data.summary = lastAssistantMessageText;
//           }
//           return result;
//         }
//       }
//     });

//     const network = createNetwork<AgentState>({
//       name: "coding-agent-network",
//       agents: [codeAgent],
//       maxIter: 1, // We only need one turn since the AI gives the full plan at once
//       defaultState: state,
//       router: async ({ network }) => {
//         if (network.state.data.summary) {
//           return;
//         }
//         return codeAgent;
//       }
//     });

//     const result = await network.run(event.data.value, { state: state });

//     // FIX: Ensure summary is never undefined by providing fallback
//     const finalSummary =
//       result.state.data.summary || "Task completed without summary.";
//     const filesFromSummary = parseFilesFromSummary(finalSummary);

//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: openai({
//         model: "gpt-4.1-mini", // A powerful model is recommended
//         apiKey: process.env.OPENAI_API_KEY_GPT4ALL,
//         baseUrl: process.env.OPENAI_BASE_URL_GPT4ALL
//       })
//     });

//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: openai({
//         model: "gpt-4.1-mini", // A powerful model is recommended
//         apiKey: process.env.OPENAI_API_KEY_GPT4ALL,
//         baseUrl: process.env.OPENAI_BASE_URL_GPT4ALL
//       })
//     });

//     // FIX: Provide fallback for summary to prevent undefined errors
//     const summaryForAgents = finalSummary || "No summary available";

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
//       summaryForAgents
//     );
//     const { output: responseOutput } = await responseGenerator.run(
//       summaryForAgents
//     );

//     const isError = !finalSummary.includes("<task_summary>");

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     if (Object.keys(filesFromSummary).length > 0) {
//       await step.run("write-parsed-files", async () => {
//         const sandbox = await getSandbox(sandboxId);
//         for (const [path, content] of Object.entries(filesFromSummary)) {
//           if (path === "app/page.tsx") {
//             try {
//               await sandbox.files.remove("pages/index.tsx");
//               console.log("Removed conflicting pages/index.tsx");
//             } catch (e) {
//               // Ignore error if file doesn't exist
//               console.log("error->" + e);
//             }
//           }
//           await sandbox.files.write(path, content);
//         }
//       });
//     }

//     await step.run("save-result", async () => {
//       if (isError || Object.keys(filesFromSummary).length === 0) {
//         return await prisma.message.create({
//           data: {
//             projectId: event.data.projectId,
//             content: "Something went wrong. Please try again.",
//             role: "ASSISTANT",
//             type: "ERROR"
//           }
//         });
//       }

//       // Enhanced: Extract clean summary content
//       const summaryContentMatch = finalSummary.match(
//         /<task_summary>([\s\S]*?)<\/task_summary>/
//       );
//       const cleanSummary = summaryContentMatch
//         ? summaryContentMatch[1].trim()
//         : "Task completed successfully.";

//       return await prisma.message.create({
//         data: {
//           projectId: event.data.projectId,
//           content: parseAgentOutput(responseOutput) || cleanSummary,
//           role: "ASSISTANT",
//           type: "RESULT",
//           fragment: {
//             create: {
//               sandboxUrl: sandboxUrl,
//               title: parseAgentOutput(fragmentTitleOutput) || "New Fragment",
//               files: filesFromSummary
//             }
//           }
//         }
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary
//     };
//   }
// );


// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import {
//   createAgent,
//   openai,
//   gemini,
//   createNetwork,
//   type Message,
//   createState,
//   createTool
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
// import fs from "fs";
// import path from "path";
// import { parseGeneratedCode, CodeBlock } from "./parser";

// interface GenerateCodeInput {
//   prompt: string;
//   modelResponse: string;
//   outputDir?: string;
// }

// interface GeneratedFile {
//   filename: string;
//   language: string;
//   content: string;
// }

// interface AgentState {
//   summary?: string;
//   files?: { [path: string]: string };
//   error?: string;
//   iteration?: number;
// }

// // --- START: Helper Functions & Constants ---

// function parseFilesFromSummary(summary: string): { [path: string]: string } {
//   try {
//     const files: { [path: string]: string } = {};
//     const fileBlockRegex = /"files"\s*:\s*\[([\s\S]*)\]/im;
//     const fileBlockMatch = summary.match(fileBlockRegex);

//     if (fileBlockMatch && fileBlockMatch[1]) {
//       const fileObjectRegex =
//         /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*['"]([\s\S]*?)['"]\s*\}/g;
//       let match;
//       while ((match = fileObjectRegex.exec(fileBlockMatch[1])) !== null) {
//         const path = match[1];
//         const content = match[2];
//         if (path && content) {
//           files[path] = content;
//         }
//       }
//     }

//     if (Object.keys(files).length > 0) {
//       console.log("Files parsed successfully using robust regex parser.");
//       return files;
//     }
//   } catch (e) {
//     console.error("Critical error in robust parser:", e);
//   }

//   console.warn("Could not parse any files from the summary.");
//   return {};
// }

// const UNSUPPORTED_MODELS = [
//   "Free/Openai/Gpt-5-mini",
//   "claude-sonnet-4(clinesp)",
//   "codex-mini(clinesp)"
// ];
// const OPENROUTER_MODELS = [
//   "openai/gpt-oss-20b:free",
//   "z-ai/glm-4.5-air:free",
//   "qwen/qwen3-coder:free",
//   "moonshotai/kimi-k2:free",
//   "microsoft/phi-4-mini-instruct"
// ];
// const NVIDIA_MODELS = ["openai/gpt-oss-120b", "mistralai/mistral-nemotron"];
// // const SIMPLE_MODELS = [
// //   "claude-3.5-sonnet(clinesp)",
// //   "gpt-4-0314(clinesp)",
// //   "deepseek-r1-0528:free(clinesp)"
// // ];
// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "o3",
//   "gpt-4",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o"
// ];

// function getSystemPromptForModel(modelId: string): string {
//   if (EXPERT_MODELS.includes(modelId)) {
//     return PROMPT;
//   }
//   return SIMPLE_PROMPT;
// }

// function validateAgentResponse(summary: string): {
//   isValid: boolean;
//   issues: string[];
// } {
//   const issues: string[] = [];
//   if (!summary || summary.trim() === "") {
//     issues.push("Agent returned an empty or null response.");
//   } else {
//     const parsedFiles = parseFilesFromSummary(summary);
//     if (Object.keys(parsedFiles).length === 0) {
//       issues.push("Agent did not produce any parsable file content.");
//     }
//     if (!summary.includes("<task_summary>")) {
//       issues.push("Response is missing the required <task_summary> tag.");
//     }
//   }
//   return { isValid: issues.length === 0, issues };
// }

// const getModelClient = (modelId: string) => {
//   if (OPENROUTER_MODELS.includes(modelId)) {
//     console.log('Routing to: OpenRouter');
//     if (!process.env.OPENROUTER_API_KEY)
//       throw new Error("OPENROUTER_API_KEY is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://openrouter.ai/api/v1",
//       apiKey: process.env.OPENROUTER_API_KEY
//     });
//   }
//   if (NVIDIA_MODELS.includes(modelId)) {
//     console.log("Routing to: NVIDIA");
//     if (!process.env.NVIDIA_API_KEY)
//       throw new Error("NVIDIA_API_KEY is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://integrate.api.nvidia.com/v1",
//       apiKey: process.env.NVIDIA_API_KEY
//     });
//   }

//   const samuraiModels = [
//     "claude-3.5-sonnet(clinesp)",
//     "gpt-4-0314(clinesp)",
//     "deepseek-r1-0528:free(clinesp)"
//   ];
//   if (samuraiModels.includes(modelId)) {
//     console.log("Routing to: Samurai");
//     if (!process.env.OPENAI_API_KEY_SAMURAI)
//       throw new Error("OPENAI_API_KEY_SAMURAI is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://samuraiapi.in/v1",
//       apiKey: process.env.OPENAI_API_KEY_SAMURAI
//     });
//   }

//   const geminiModels = ["gemini-1.5-flash", "gemini-2.5-flash"];
//   if (geminiModels.includes(modelId)) {
//     console.log("Routing to: Google Gemini");
//     return gemini({ model: modelId });
//   }

//   const gpt4AllUrl = "https://api.gpt4-all.xyz/v1";
//   if (EXPERT_MODELS.includes(modelId)) {
//     console.log(`Routing to: GPT4All with baseUrl: ${gpt4AllUrl}`);
//     if (!process.env.OPENAI_API_KEY_GPT4ALL)
//       throw new Error("OPENAI_API_KEY_GPT4ALL is not set");
//     return openai({
//       model: modelId,
//       baseUrl: gpt4AllUrl,
//       apiKey: process.env.OPENAI_API_KEY_GPT4ALL
//     });
//   }

//   console.log(`Routing to: Default OpenAI endpoint`);
//   if (!process.env.OPENAI_API_KEY)
//     throw new Error("OPENAI_API_KEY is not set for the default provider.");
//   return openai({ model: modelId, apiKey: process.env.OPENAI_API_KEY });
// };

// // --- END: Helper Functions & Constants ---

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const selectedModel = event.data.model || "gpt-4.1-mini";

//     if (UNSUPPORTED_MODELS.includes(selectedModel)) {
//       const errorMessage = `The selected model '${selectedModel}' is currently unsupported due to instability. Please choose a different model.`;
//       await step.run("save-unsupported-model-error", async () => {
//         return prisma.message.create({
//           data: {
//             projectId: event.data.projectId,
//             content: errorMessage,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: selectedModel
//           }
//         });
//       });
//       return { error: errorMessage };
//     }

//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT15);
//       return sandbox.sandboxId;
//     });

//     const previousMessages = await step.run(
//       "get-previous-messages",
//       async () => {
//         const messages = await prisma.message.findMany({
//           where: { projectId: event.data.projectId },
//           orderBy: { createdAt: "asc" },
//           take: 5
//         });
//         return messages.map(
//           (msg) =>
//             ({
//               type: "text",
//               role: msg.role === "ASSISTANT" ? "assistant" : "user",
//               content: msg.content
//             } as Message)
//         );
//       }
//     );

//     const state = createState<AgentState>(
//       { summary: "", files: {} },
//       { messages: previousMessages }
//     );
//     const modelClient = getModelClient(selectedModel);
//     const systemPrompt = getSystemPromptForModel(selectedModel);

//     const createFilesTool = createTool({
//       name: "createOrUpdateFiles",
//       description: "Create or update one or more files with the provided code.",
//       parameters: z.object({
//         files: z.array(z.object({ path: z.string(), content: z.string() }))
//       }),
//       handler: async ({ files }) => {
//         logToolResult({ toolName: "createOrUpdateFiles", output: files });
//         return { success: true };
//       }
//     });

//     const codeAgent = createAgent<AgentState>({
//       name: "code-agent",
//       system: systemPrompt,
//       model: modelClient,
//       tools: [createFilesTool],
//       lifecycle: {
//         onResponse: async ({ result, network }) => {
//           if (!network) return result;
//           const text = lastAssistantTextMessageContent(result);
//           if (text) {
//             network.state.data.summary = text;
//           }
//           return result;
//         }
//       }
//     });

//     const network = createNetwork<AgentState>({
//       name: "coding-agent-network",
//       agents: [codeAgent],
//       maxIter: 1,
//       router: async ({ network }) =>
//         network.state.data.summary ? undefined : codeAgent
//     });

//     const result = await network.run(event.data.value, { state });
//     const finalSummary = result.state.data.summary || "";
//     const validation = validateAgentResponse(finalSummary);

//     if (!validation.isValid) {
//       const errorMessage = `The agent failed to generate valid code. Issues: ${validation.issues.join(
//         ", "
//       )}. Raw Output: "${finalSummary}"`;
//       await step.run("save-error-result", async () => {
//         return prisma.message.create({
//           data: {
//             projectId: event.data.projectId,
//             content: errorMessage,
//             role: "ASSISTANT",
//             type: "ERROR",
//             model: selectedModel
//           }
//         });
//       });
//       return { error: "Agent failed validation.", issues: validation.issues };
//     }

//     const filesFromSummary = parseFilesFromSummary(finalSummary);

//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: getModelClient("gpt-4.1-mini")
//     });

//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: getModelClient("gpt-4.1-mini")
//     });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
//       finalSummary
//     );
//     const { output: responseOutput } = await responseGenerator.run(
//       finalSummary
//     );

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       for (const [path, content] of Object.entries(filesFromSummary)) {
//         const unescapedContent = content
//           .replace(/\\"/g, '"')
//           .replace(/\\'/g, "'")
//           .replace(/\\n/g, "\n")
//           .replace(/\\/g, "");

//         if (path === "app/page.tsx") {
//           try {
//             await sandbox.files.remove("pages/index.tsx");
//           } catch (e) {
//             /* Ignore */
//             console.log("error->",e)
//           }
//         }
//         await sandbox.files.write(path, unescapedContent);
//       }
//     });

//     await step.run("save-success-result", async () => {
//       const summaryMatch = finalSummary.match(
//         /<task_summary>([\s\S]*?)<\/task_summary>/
//       );
//       const cleanSummary = summaryMatch
//         ? summaryMatch[1].trim()
//         : "Task completed.";
//       return await prisma.message.create({
//         data: {
//           projectId: event.data.projectId,
//           content: parseAgentOutput(responseOutput) || cleanSummary,
//           role: "ASSISTANT",
//           type: "RESULT",
//           model: selectedModel,
//           fragment: {
//             create: {
//               sandboxUrl: sandboxUrl,
//               title: parseAgentOutput(fragmentTitleOutput) || "New Fragment",
//               files: filesFromSummary
//             }
//           }
//         }
//       });
//     });

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: selectedModel
//     };
//   }
// );

// functions.ts (updated)
// NOTE: kept your original imports and behavior, removed unused fs/path imports

// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import {
//   createAgent,
//   openai,
//   gemini,
//   createNetwork,
//   type Message,
//   createState,
//   createTool
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

// interface AgentState {
//   summary?: string;
//   files?: { [path: string]: string };
//   error?: string;
//   iteration?: number;
// }

// /* ---------------- Robust, ESLint & TS-safe parser ---------------- */

// /**
//  * Safely attempt JSON.parse and return null on failure.
//  */
// function tryParseJson<T = unknown>(input: string): T | null {
//   try {
//     return JSON.parse(input.trim()) as T;
//   } catch {
//     return null;
//   }
// }

// /**
//  * Unescape common escape sequences LLMs include in JSON strings.
//  */
// function unescapeContent(s: string): string {
//   return s
//     .replace(/\\n/g, "\n")
//     .replace(/\\r/g, "\r")
//     .replace(/\\t/g, "\t")
//     .replace(/\\"/g, '"')
//     .replace(/\\'/g, "'")
//     .replace(/\\\\/g, "\\")
//     .replace(/^\s*"(.*)"\s*$/s, "$1");
// }

// /**
//  * Heuristic: normalize JS-like object string into JSON-friendly string:
//  * - convert backticks and single quotes into double-quoted strings,
//  * - quote unquoted keys (basic).
//  *
//  * This is an approximation to help JSON.parse for many LLM outputs.
//  */
// function normalizeToJsonLike(input: string): string {
//   let s = input.trim();

//   // Convert backtick blocks to quoted strings (backticks may contain newlines).
//   // Use [^`]* (no dotAll flag needed) because it matches everything except backtick including newlines.
//   s = s.replace(/`([^`]*)`/g, (_m, inner) => {
//     const escaped = inner
//       .replace(/\\/g, "\\\\")
//       .replace(/"/g, '\\"')
//       .replace(/\n/g, "\\n");
//     return `"${escaped}"`;
//   });

//   // Convert single-quoted strings to double-quoted strings
//   s = s.replace(/'([^']*)'/g, (_m, inner) => {
//     const escaped = inner
//       .replace(/\\/g, "\\\\")
//       .replace(/"/g, '\\"')
//       .replace(/\n/g, "\\n");
//     return `"${escaped}"`;
//   });

//   // Ensure simple unquoted keys become quoted: { key: -> { "key":
//   s = s.replace(/([{,]\s*)([A-Za-z0-9_\-./$]+)\s*:/g, (_m, pre, key) => `${pre}"${key}":`);

//   return s;
// }

// /**
//  * Try to find a filename hint in a nearby text block.
//  */
// function findFilenameHint(text: string | null): string | null {
//   if (!text) return null;
//   const patterns = [
//     /file[:\s]+([^\s\)]+?\.(?:ts|tsx|js|jsx|json|css|html))/i,
//     /path[:\s]+([^\s\)]+?\.(?:ts|tsx|js|jsx|json|css|html))/i,
//     /([^\s\)]+?\.(?:ts|tsx|js|jsx|json|css|html))/i
//   ];
//   for (const p of patterns) {
//     const m = text.match(p);
//     if (m?.[1]) return m[1].trim();
//   }
//   return null;
// }

// /**
//  * Robust parsing of files from various AI response shapes.
//  * Returns a map: path -> content
//  */
// function parseFilesFromSummary(summary: string): { [path: string]: string } {
//   const files: { [path: string]: string } = {};
//   if (!summary) return files;

//   // Method 1: tool call arguments JSON: "createOrUpdateFiles", "arguments": { files: [...] }
//   try {
//     const toolArgsRegex = /"createOrUpdateFiles"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})/i;
//     const match = summary.match(toolArgsRegex);
//     if (match?.[1]) {
//       const parsed = tryParseJson<Record<string, unknown>>(match[1]);
//       if (parsed && parsed.files) {
//         const maybeFiles = parsed.files;
//         if (Array.isArray(maybeFiles)) {
//           for (const it of maybeFiles) {
//             if (
//               typeof it === "object" &&
//               it !== null &&
//               "path" in it &&
//               "content" in it &&
//               typeof (it as Record<string, unknown>).path === "string" &&
//               typeof (it as Record<string, unknown>).content === "string"
//             ) {
//               files[(it as Record<string, string>).path] = unescapeContent(
//                 (it as Record<string, string>).content
//               );
//             }
//           }
//         } else if (typeof maybeFiles === "object" && maybeFiles !== null) {
//           for (const [p, c] of Object.entries(maybeFiles as Record<string, unknown>)) {
//             if (typeof c === "string") files[p] = unescapeContent(c);
//           }
//         }
//         if (Object.keys(files).length) {
//           console.log("parseFilesFromSummary: parsed via tool-arguments JSON");
//           return files;
//         }
//       }
//     }
//   } catch (e) {
//     console.error("parseFilesFromSummary method1 error", e);
//   }

//   // Method 2: createOrUpdateFiles: { ... } non-strict JSON
//   try {
//     const createObjRegex = /createOrUpdateFiles\s*:\s*(\{[\s\S]*?\})/i;
//     const createMatch = summary.match(createObjRegex);
//     if (createMatch?.[1]) {
//       const normalized = normalizeToJsonLike(createMatch[1]);
//       const parsed = tryParseJson<Record<string, unknown>>(normalized);
//       if (parsed) {
//         for (const [k, v] of Object.entries(parsed)) {
//           if (typeof v === "string" && k.match(/\.(?:ts|tsx|js|jsx|json|css|html)$/i)) {
//             files[k] = unescapeContent(v);
//           }
//         }
//         if (Object.keys(files).length) {
//           console.log("parseFilesFromSummary: parsed via createOrUpdateFiles object");
//           return files;
//         }
//       }
//     }
//   } catch (e) {
//     console.error("parseFilesFromSummary method2 error", e);
//   }

//   // Method 3: quoted key:value pairs anywhere "app/page.tsx": "content"
//   try {
//     const quotedKeyValueRegex = /["'`]([^"'`]+?\.(?:ts|tsx|js|jsx|json|css|html))["'`]\s*:\s*["'`]([\s\S]*?)["'`]\s*(?:,|\n|\})/gim;
//     let m: RegExpExecArray | null;
//     while ((m = quotedKeyValueRegex.exec(summary)) !== null) {
//       const p = m[1].trim();
//       const c = m[2];
//       if (p && c) files[p] = unescapeContent(c);
//     }
//     if (Object.keys(files).length) {
//       console.log("parseFilesFromSummary: parsed via quoted key/value");
//       return files;
//     }
//   } catch (e) {
//     console.error("parseFilesFromSummary method3 error", e);
//   }

//   // Method 4: Markdown code fences ```lang\ncode\n```
//   try {
//     const fenceRegex = /```(?:([\w-+.]+))?\n([\s\S]*?)\n```/g;
//     let fm: RegExpExecArray | null;
//     let idx = 0;
//     while ((fm = fenceRegex.exec(summary)) !== null) {
//       const lang = fm[1] || "";
//       const code = fm[2] || "";
//       const before = summary.slice(Math.max(0, fm.index - 200), fm.index);
//       const hint = findFilenameHint(before) || findFilenameHint(code) || null;
//       const filename = hint ?? (lang.includes("ts") ? `app/component-${idx}.tsx` : `app/component-${idx}.txt`);
//       files[filename] = unescapeContent(code.trim());
//       idx++;
//     }
//     if (Object.keys(files).length) {
//       console.log("parseFilesFromSummary: parsed via code fences");
//       return files;
//     }
//   } catch (e) {
//     console.error("parseFilesFromSummary method4 error", e);
//   }

//   // Method 5: Generic JSON blocks heuristics
//   try {
//     const jsonBlockRegex = /(\{[\s\S]*?\})/g;
//     let jb: RegExpExecArray | null;
//     while ((jb = jsonBlockRegex.exec(summary)) !== null) {
//       const candidate = jb[1];
//       const normalized = normalizeToJsonLike(candidate);
//       const parsed = tryParseJson<Record<string, unknown>>(normalized);
//       if (!parsed) continue;

//       if (parsed.files && Array.isArray(parsed.files)) {
//         for (const it of parsed.files) {
//           if (
//             typeof it === "object" &&
//             it !== null &&
//             "path" in it &&
//             "content" in it &&
//             typeof (it as Record<string, unknown>).path === "string" &&
//             typeof (it as Record<string, unknown>).content === "string"
//           ) {
//             files[(it as Record<string, string>).path] = unescapeContent(
//               (it as Record<string, string>).content
//             );
//           }
//         }
//       } else {
//         for (const [k, v] of Object.entries(parsed)) {
//           if (typeof v === "string" && k.match(/\.(?:ts|tsx|js|jsx|json|css|html)$/i)) {
//             files[k] = unescapeContent(v);
//           }
//         }
//       }

//       if (Object.keys(files).length) {
//         console.log("parseFilesFromSummary: parsed via generic JSON heuristics");
//         return files;
//       }
//     }
//   } catch (e) {
//     console.error("parseFilesFromSummary method5 error", e);
//   }

//   // No files found
//   console.warn("parseFilesFromSummary: no files parsed from summary.");
//   return files;
// }

// /* ---------------- Validation ---------------- */

// function validateAgentResponseSummary(summary: string): { isValid: boolean; issues: string[] } {
//   const issues: string[] = [];
//   if (!summary || summary.trim() === "") {
//     issues.push("Agent returned an empty or null response.");
//   } else {
//     const parsedFiles = parseFilesFromSummary(summary);
//     if (Object.keys(parsedFiles).length === 0) {
//       issues.push("Agent did not produce any parsable file content.");
//     }
//     if (!/<task_summary>[\s\S]*?<\/task_summary>/i.test(summary)) {
//       issues.push("Response is missing the required <task_summary> tag.");
//     }
//   }
//   return { isValid: issues.length === 0, issues };
// }

// /* ---------------- Model routing helpers (unchanged) ---------------- */

// const UNSUPPORTED_MODELS = [
//   "Free/Openai/Gpt-5-mini",
//   "claude-sonnet-4(clinesp)",
//   "codex-mini(clinesp)"
// ];
// const OPENROUTER_MODELS = [
//   "openai/gpt-oss-20b:free",
//   "z-ai/glm-4.5-air:free",
//   "qwen/qwen3-coder:free",
//   "moonshotai/kimi-k2:free",
//   "microsoft/phi-4-mini-instruct"
// ];
// const NVIDIA_MODELS = ["openai/gpt-oss-120b", "mistralai/mistral-nemotron"];
// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "o3",
//   "gpt-4",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o"
// ];

// function getSystemPromptForModel(modelId: string): string {
//   return EXPERT_MODELS.includes(modelId) ? PROMPT : SIMPLE_PROMPT;
// }

// const getModelClient = (modelId: string) => {
//   if (OPENROUTER_MODELS.includes(modelId)) {
//     console.log("Routing to: OpenRouter");
//     if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://openrouter.ai/api/v1",
//       apiKey: process.env.OPENROUTER_API_KEY
//     });
//   }

//   if (NVIDIA_MODELS.includes(modelId)) {
//     console.log("Routing to: NVIDIA");
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://integrate.api.nvidia.com/v1",
//       apiKey: process.env.NVIDIA_API_KEY
//     });
//   }

//   const samuraiModels = [
//     "claude-3.5-sonnet(clinesp)",
//     "gpt-4-0314(clinesp)",
//     "deepseek-r1-0528:free(clinesp)"
//   ];
//   if (samuraiModels.includes(modelId)) {
//     console.log("Routing to: Samurai");
//     if (!process.env.OPENAI_API_KEY_SAMURAI) throw new Error("OPENAI_API_KEY_SAMURAI is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://samuraiapi.in/v1",
//       apiKey: process.env.OPENAI_API_KEY_SAMURAI
//     });
//   }

//   const geminiModels = ["gemini-1.5-flash", "gemini-2.5-flash"];
//   if (geminiModels.includes(modelId)) {
//     console.log("Routing to: Google Gemini");
//     return gemini({ model: modelId });
//   }

//   const gpt4AllUrl = "https://api.gpt4-all.xyz/v1";
//   if (EXPERT_MODELS.includes(modelId)) {
//     console.log(`Routing to: GPT4All with baseUrl: ${gpt4AllUrl}`);
//     if (!process.env.OPENAI_API_KEY_GPT4ALL) throw new Error("OPENAI_API_KEY_GPT4ALL is not set");
//     return openai({
//       model: modelId,
//       baseUrl: gpt4AllUrl,
//       apiKey: process.env.OPENAI_API_KEY_GPT4ALL
//     });
//   }

//   console.log("Routing to: Default OpenAI endpoint");
//   if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set for the default provider.");
//   return openai({ model: modelId, apiKey: process.env.OPENROUTER_API_KEY ,baseUrl: process.env.OPENAI_BASE_URL});
// };

// /* ---------------- Main Inngest function (adapted from your original) ---------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const eventData = (event.data as Record<string, unknown>) ?? {};
//     const selectedModel = (eventData.model as string) || "gpt-4.1-mini";
//     const projectId = (eventData.projectId as string) || "";

//     if (UNSUPPORTED_MODELS.includes(selectedModel)) {
//       const errorMessage = `The selected model '${selectedModel}' is currently unsupported due to instability. Please choose a different model.`;
//       await step.run("save-unsupported-model-error", async () => {
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
//       return { error: errorMessage };
//     }

//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT15);
//       return sandbox.sandboxId;
//     });

//     const previousMessages = await step.run("get-previous-messages", async () => {
//       const messages = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "asc" },
//         take: 5
//       });
//       return messages.map((msg) => ({
//         type: "text",
//         role: msg.role === "ASSISTANT" ? "assistant" : "user",
//         content: msg.content
//       } as Message));
//     });

//     const state = createState<AgentState>({ summary: "", files: {} }, { messages: previousMessages });
//     const modelClient = getModelClient(selectedModel);
//     const systemPrompt = getSystemPromptForModel(selectedModel);

//     const createFilesTool = createTool({
//       name: "createOrUpdateFiles",
//       description: "Create or update one or more files with the provided code.",
//       parameters: z.object({
//         files: z.array(z.object({ path: z.string(), content: z.string() }))
//       }),
//       handler: async ({ files }) => {
//         logToolResult({ toolName: "createOrUpdateFiles", output: files });
//         return { success: true };
//       }
//     });

//     const codeAgent = createAgent<AgentState>({
//       name: "code-agent",
//       system: systemPrompt,
//       model: modelClient,
//       tools: [createFilesTool],
//       lifecycle: {
//         onResponse: async ({ result, network }) => {
//           if (!network) return result;
//           const text = lastAssistantTextMessageContent(result);
//           if (text) {
//             network.state.data.summary = text;
//           }
//           return result;
//         }
//       }
//     });

//     const network = createNetwork<AgentState>({
//       name: "coding-agent-network",
//       agents: [codeAgent],
//       maxIter: 1,
//       router: async ({ network }) => (network.state.data.summary ? undefined : codeAgent)
//     });

//     const result = await network.run((eventData.value as string) ?? "", { state });
//     const finalSummary = result.state.data.summary || "";
//     const validation = validateAgentResponseSummary(finalSummary);

//     if (!validation.isValid) {
//       const errorMessage = `The agent failed to generate valid code. Issues: ${validation.issues.join(", ")}. Raw Output: "${finalSummary}"`;
//       await step.run("save-error-result", async () => {
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
//       return { error: "Agent failed validation.", issues: validation.issues };
//     }

//     const filesFromSummary = parseFilesFromSummary(finalSummary);

//     if (!filesFromSummary || Object.keys(filesFromSummary).length === 0) {
//       const errorMessage = `Agent did not produce any parsable files. Raw Output: "${finalSummary}"`;
//       await step.run("save-error-result-no-files", async () => {
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
//       return { error: "No parsable files found." };
//     }

//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: getModelClient("gpt-4.1-mini")
//     });

//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: getModelClient("gpt-4.1-mini")
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
//       for (const [p, rawContent] of Object.entries(filesFromSummary)) {
//         const unescapedContent = unescapeContent(rawContent);

//         if (p === "app/page.tsx") {
//           try {
//             await sandbox.files.remove("pages/index.tsx");
//           } catch (e) {
//             console.log("remove pages/index.tsx error ->", (e as Error).message);
//           }
//         }
//         await sandbox.files.write(p, unescapedContent);
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
//           model: selectedModel,
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

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: selectedModel
//     };
//   }
// );


// functions.ts (modified parser + main function)
// NOTE: keeps your original orchestration but with a safer parser and unescape logic
// // functions.ts
// // functions.ts
// import { inngest } from "./client";
// import { Sandbox } from "@e2b/code-interpreter";
// import { parseFilesFromSummary } from "@/inngest/parser";
// import {
//   createAgent,
//   openai,
//   gemini,
//   createNetwork,
//   type Message,
//   createState,
//   createTool
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

// interface AgentState {
//   summary?: string;
//   files?: { [path: string]: string };
//   error?: string;
//   iteration?: number;
// }

// /* ----------------- small utilities kept ----------------- */

// /** Basic sanity check: are brackets/backticks balanced? */
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

// /* ----------------- validation (uses imported parser) ----------------- */

// function validateAgentResponse(summary: string): { isValid: boolean; issues: string[] } {
//   const issues: string[] = [];
//   if (!summary || summary.trim() === "") {
//     issues.push("Agent returned an empty or null response.");
//   } else {
//     const parsedFiles = parseFilesFromSummary(summary);
//     if (Object.keys(parsedFiles).length === 0) {
//       issues.push("Agent did not produce any parsable file content.");
//     }
//     if (!/<task_summary>[\s\S]*?<\/task_summary>/i.test(summary)) {
//       issues.push("Response is missing the required <task_summary> tag.");
//     }
//   }
//   return { isValid: issues.length === 0, issues };
// }

// /* ----------------- model routing/constants ----------------- */

// /**
//  * Keep these lists up-to-date with the models you actually use.
//  * If you add more providers, add mapping logic in getModelClient below.
//  */
// const OPENROUTER_MODELS = [
//   "openai/gpt-oss-20b:free",
//   "z-ai/glm-4.5-air:free",
//   "qwen/qwen3-coder:free",
//   "moonshotai/kimi-k2:free",
//   "microsoft/phi-4-mini-instruct"
// ];

// const NVIDIA_MODELS = [
//   "openai/gpt-oss-120b",
//   "mistralai/mistral-nemotron",
//   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
//   "tencent/Hunyuan-1.8B-Instruct"
// ];

// const SAMURAI_MODELS = [
//   "claude-3.5-sonnet(clinesp)",
//   "gpt-4-0314(clinesp)",
//   "deepseek-r1-0528:free(clinesp)",
//   "Free/Openai/Gpt-5-mini",
//   "Free/Openai/gpt-5-nano",
//   "Free/Gemini/gemini-2.5-pro",
//   "Free/Grok-3"
// ];

// const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.5-flash"];

// const EXPERT_MODELS = [
//   "gpt-4.1-mini",
//   "o3",
//   "gpt-4",
//   "o4-mini",
//   "o3-mini",
//   "gpt-4o"
// ];

// /**
//  * Decide which provider to call for a model id.
//  *
//  * IMPORTANT: This function will NOT redirect unknown models to the official OpenAI endpoint.
//  * - OpenRouter models -> OpenRouter base URL + OPENROUTER_API_KEY
//  * - NVIDIA models -> NVIDIA integrate API + NVIDIA_API_KEY
//  * - Samurai models -> Samurai base URL + OPENAI_API_KEY_SAMURAI
//  * - Gemini -> gemini() client
//  * - Known expert/gpt4all -> GPT4All endpoint if configured
//  * - Otherwise -> Hugging Face (uses HUGGING_FACE_BASE_URL + HUGGING_FACE_API_KEY)
//  */
// const getModelClient = (modelId: string) => {
//   // 1) OpenRouter models
//   if (OPENROUTER_MODELS.includes(modelId)) {
//     if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://openrouter.ai/api/v1",
//       apiKey: process.env.OPENROUTER_API_KEY
//     });
//   }

//   // 2) NVIDIA models
//   if (NVIDIA_MODELS.includes(modelId)) {
//     if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://integrate.api.nvidia.com/v1",
//       apiKey: process.env.NVIDIA_API_KEY
//     });
//   }

//   // 3) Samurai / custom models
//   if (SAMURAI_MODELS.includes(modelId)) {
//     if (!process.env.OPENAI_API_KEY_SAMURAI) throw new Error("OPENAI_API_KEY_SAMURAI is not set");
//     return openai({
//       model: modelId,
//       baseUrl: "https://samuraiapi.in/v1",
//       apiKey: process.env.OPENAI_API_KEY_SAMURAI
//     });
//   }

//   // 4) Gemini (Google)
//   if (GEMINI_MODELS.includes(modelId)) {
//     return gemini({ model: modelId });
//   }

//   // 5) GPT4All-style expert models (if you have configured GPT4ALL)
//   if (EXPERT_MODELS.includes(modelId) && process.env.OPENAI_API_KEY_GPT4ALL) {
//     return openai({
//       model: modelId,
//       baseUrl: process.env.OPENAI_BASE_URL_GPT4ALL || "https://api.gpt4-all.xyz/v1",
//       apiKey: process.env.OPENAI_API_KEY_GPT4ALL
//     });
//   }

//   // 6) Heuristic: if model looks like a Hugging Face id (contains '/'), route to Hugging Face
//   const looksLikeHf = modelId.includes("/") || /^meta-|^mistralai|^deepseek|^CohereForAI|^provider/i.test(modelId);
//   if (looksLikeHf) {
//     const hfKey = process.env.HUGGING_FACE_API_KEY;
//     if (!hfKey) throw new Error("HUGGING_FACE_API_KEY is not set (required for Hugging Face models).");
//     const hfBase = process.env.HUGGING_FACE_BASE_URL || "https://api-inference.huggingface.co";
//     return openai({
//       model: modelId,
//       baseUrl: hfBase,
//       apiKey: hfKey
//     });
//   }

//   // 7) Default: route to Hugging Face Router (preferred fallback when you're not using OpenAI)
//   {
//     const hfKey = process.env.HUGGING_FACE_API_KEY;
//     if (!hfKey) throw new Error("HUGGING_FACE_API_KEY is not set (no default provider available).");
//     const hfBase = process.env.HUGGING_FACE_BASE_URL || "https://router.huggingface.co/v1";
//     return openai({
//       model: modelId,
//       baseUrl: hfBase,
//       apiKey: hfKey
//     });
//   }
// };

// /* ----------------- inngest handler ----------------- */

// export const codeAgentFunction = inngest.createFunction(
//   { id: "code-agent", concurrency: 5 },
//   { event: "code-agent/run" },
//   async ({ event, step }) => {
//     const eventData = (event.data as Record<string, unknown>) ?? {};
//     const selectedModel = (eventData.model as string) || "gpt-4.1-mini";
//     const projectId = (eventData.projectId as string) || "";

//     // quick unsupported-model guard
//     if (["Free/Openai/Gpt-5-mini"].includes(selectedModel)) {
//       const errorMessage = `The selected model '${selectedModel}' is currently unsupported due to instability. Please choose a different model.`;
//       await step.run("save-unsupported-model-error", async () => {
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
//       return { error: errorMessage };
//     }

//     const sandboxId = await step.run("get-sandbox-id", async () => {
//       const sandbox = await Sandbox.create("vibe-nextjs-testz");
//       await sandbox.setTimeout(SANDBOX_TIMEOUT15);
//       return sandbox.sandboxId;
//     });

//     const previousMessages = await step.run("get-previous-messages", async () => {
//       const messages = await prisma.message.findMany({
//         where: { projectId },
//         orderBy: { createdAt: "asc" },
//         take: 5
//       });
//       return messages.map((msg) => ({
//         type: "text",
//         role: msg.role === "ASSISTANT" ? "assistant" : "user",
//         content: msg.content
//       } as Message));
//     });

//     const state = createState<AgentState>({ summary: "", files: {} }, { messages: previousMessages });
//     const modelClient = getModelClient(selectedModel);
//     const systemPrompt = EXPERT_MODELS.includes(selectedModel) ? PROMPT : SIMPLE_PROMPT;

//     const createFilesTool = createTool({
//       name: "createOrUpdateFiles",
//       description: "Create or update one or more files with the provided code.",
//       parameters: z.object({
//         files: z.array(z.object({ path: z.string(), content: z.string() }))
//       }),
//       handler: async ({ files }) => {
//         logToolResult({ toolName: "createOrUpdateFiles", output: files });
//         return { success: true };
//       }
//     });

//     const codeAgent = createAgent<AgentState>({
//       name: "code-agent",
//       system: systemPrompt,
//       model: modelClient,
//       tools: [createFilesTool],
//       lifecycle: {
//         onResponse: async ({ result, network }) => {
//           if (!network) return result;
//           const text = lastAssistantTextMessageContent(result);
//           if (text) network.state.data.summary = text;
//           return result;
//         }
//       }
//     });

//     const network = createNetwork<AgentState>({
//       name: "coding-agent-network",
//       agents: [codeAgent],
//       maxIter: 1,
//       router: async ({ network }) => (network.state.data.summary ? undefined : codeAgent)
//     });

//     const result = await network.run((eventData.value as string) ?? "", { state });
//     const finalSummary = result.state.data.summary || "";
//     const validation = validateAgentResponse(finalSummary);

//     if (!validation.isValid) {
//       const errorMessage = `The agent failed to generate valid code. Issues: ${validation.issues.join(", ")}. Raw Output: "${finalSummary}"`;
//       await step.run("save-error-result", async () => {
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
//       return { error: "Agent failed validation.", issues: validation.issues };
//     }

//     const filesFromSummary = parseFilesFromSummary(finalSummary);

//     if (!filesFromSummary || Object.keys(filesFromSummary).length === 0) {
//       const errorMessage = `Agent did not produce any parsable files. Raw Output: "${finalSummary}"`;
//       await step.run("save-error-result-no-files", async () => {
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
//       return { error: "No parsable files found." };
//     }

//     const fragmentTitleGenerator = createAgent({
//       name: "fragment-title-generator",
//       description: "A fragment title generator",
//       system: FRAGMENT_TITLE_PROMPT,
//       model: getModelClient("gpt-4.1-mini")
//     });

//     const responseGenerator = createAgent({
//       name: "response-generator",
//       description: "A response generator",
//       system: RESPONSE_PROMPT,
//       model: getModelClient("gpt-4.1-mini")
//     });

//     const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(finalSummary);
//     const { output: responseOutput } = await responseGenerator.run(finalSummary);

//     const sandboxUrl = await step.run("get-sandbox-url", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       const host = sandbox.getHost(3000);
//       return `https://${host}`;
//     });

//     /* write parsed files to sandbox with a light sanity check */
//     await step.run("write-parsed-files-to-sandbox", async () => {
//       const sandbox = await getSandbox(sandboxId);
//       for (const [p, rawContent] of Object.entries(filesFromSummary)) {
//         const content = rawContent; // parser returns already-unescaped content

//         if (!isLikelyBalanced(content)) {
//           console.warn(`File ${p} looks unbalanced (possible truncation). Writing anyway; consider re-requesting formatted output.`);
//         }

//         if (p === "app/page.tsx") {
//           try {
//             await sandbox.files.remove("pages/index.tsx");
//           } catch (e) {
//             console.log("remove pages/index.tsx error ->", (e as Error).message);
//           }
//         }

//         await sandbox.files.write(p, content);
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
//           model: selectedModel,
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

//     return {
//       url: sandboxUrl,
//       title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
//       files: filesFromSummary,
//       summary: finalSummary,
//       model: selectedModel
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
// import { transformImages } from "@/inngest/utils/transformImage"
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
//   // look for ```json ... ``` first
//   const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (codeFenceMatch) return codeFenceMatch[1].trim();
//   // then look for first top-level {...}
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
//     const selectedModel = (eventData.model as string | undefined) ?? "";
//     const projectId = (eventData.projectId as string) || "";

//     // Validate model selection early
//     if (!selectedModel) {
//       const errMsg = "No model selected. Please provide a 'model' in the event data.";
//       await prisma.message.create({
//         data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" }
//       });
//       return { error: errMsg };
//     }

//     // // Guard against known-unstable models
//     // if (["Free/Openai/Gpt-5-mini"].includes(selectedModel)) {
//     //   const errorMessage = `The selected model '${selectedModel}' is currently unsupported due to instability. Please choose a different model.`;
//     //   await step.run("save-unsupported-model-error", async () => {
//     //     return prisma.message.create({
//     //       data: {
//     //         projectId,
//     //         content: errorMessage,
//     //         role: "ASSISTANT",
//     //         type: "ERROR",
//     //         model: selectedModel
//     //       }
//     //     });
//     //   });
//     //   return { error: errorMessage };
//     // }

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
//       const enforceJsonInstruction = `
// IMPORTANT:
// When you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:

// {
//   "files": [
//     { "path": "app/page.tsx", "content": "FILE CONTENT HERE" }
//   ]
// }

// Wrap the JSON in triple-backticks with "json" for clarity if possible. After the JSON object, include exactly one line with <task_summary>...</task_summary> describing what was created.

// Do NOT output any additional commentary.`;

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
//         try {
//           const parsed = JSON.parse(jsonLike);
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
//         } catch (e) {
//           // JSON parse failed - ignore and fall through to next attempt
//           await step.run("save-json-parse-error", async () => {
//             return prisma.message.create({
//               data: {
//                 projectId,
//                 content: `JSON.parse failed on extracted JSON for ${modelCandidate}: ${(e instanceof Error) ? e.message : String(e)}`,
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
//       const transformedFiles = Object.fromEntries(
//   Object.entries(filesFromSummary).map(([filename, content]) => [
//     filename,
//     transformImages(content),
//   ])
// );

//       // successfulResult = {
//       //   finalSummary,
//       //   filesFromSummary,
//       //   usedModel: modelCandidate,
//       //   modelClient
//       // };
//   successfulResult = {
//   finalSummary,
//   filesFromSummary: transformedFiles, // <-- use transformed version
//   usedModel: modelCandidate,
//   modelClient
// };
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
//   // look for ```json ... ``` first
//   const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (codeFenceMatch) return codeFenceMatch[1].trim();
//   // then look for first top-level {...}
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
//     const selectedModel = (eventData.model as string | undefined) ?? "";
//     const projectId = (eventData.projectId as string) || "";

//     // Validate model selection early
//     if (!selectedModel) {
//       const errMsg = "No model selected. Please provide a 'model' in the event data.";
//       await prisma.message.create({
//         data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" }
//       });
//       return { error: errMsg };
//     }

//     // Guard against known-unstable models
//     if (["Free/Openai/Gpt-5-mini"].includes(selectedModel)) {
//       const errorMessage = `The selected model '${selectedModel}' is currently unsupported due to instability. Please choose a different model.`;
//       await step.run("save-unsupported-model-error", async () => {
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
//       return { error: errorMessage };
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
//       const enforceJsonInstruction = `
// IMPORTANT:
// When you produce the generated files, output a single JSON object (and NOTHING else) that matches this schema exactly:

// {
//   "files": [
//     { "path": "app/page.tsx", "content": "FILE CONTENT HERE" }
//   ]
// }

// Wrap the JSON in triple-backticks with "json" for clarity if possible. After the JSON object, include exactly one line with <task_summary>...</task_summary> describing what was created.

// Do NOT output any additional commentary.`;

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
//         try {
//           const parsed = JSON.parse(jsonLike);
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
//         } catch (e) {
//           // JSON parse failed - ignore and fall through to next attempt
//           await step.run("save-json-parse-error", async () => {
//             return prisma.message.create({
//               data: {
//                 projectId,
//                 content: `JSON.parse failed on extracted JSON for ${modelCandidate}: ${(e instanceof Error) ? e.message : String(e)}`,
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
//     const selectedModel = (eventData.model as string | undefined) ?? "";
//     const projectId = (eventData.projectId as string) || "";

//     // Validate model selection early
//     if (!selectedModel) {
//       const errMsg = "No model selected. Please provide a 'model' in the event data.";
//       await prisma.message.create({
//         data: { projectId, content: errMsg, role: "ASSISTANT", type: "ERROR", model: "none" }
//       });
//       return { error: errMsg };
//     }

//     // Guard against known-unstable models
//     if (["Free/Openai/Gpt-5-mini"].includes(selectedModel)) {
//       const errorMessage = `The selected model '${selectedModel}' is currently unsupported due to instability. Please choose a different model.`;
//       await step.run("save-unsupported-model-error", async () => {
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
//       return { error: errorMessage };
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
