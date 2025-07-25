import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import {
  createAgent,
  openai,
  createTool,
  createNetwork,
  type Message,
  createState
} from "@inngest/agent-kit";
import {
  getSandbox,
  lastAssistantTextMessageContent,
  logToolResult,
  parseAgentOutput
} from "./utils";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT15 } from "./types";

interface AgentState {
  summary?: string;
  files?: { [path: string]: string };
  error?: string;
  iteration?: number;
}

// FIX: A much more robust parser that can handle the AI's output.
function parseFilesFromSummary(summary: string): { [path: string]: string } {
  const fileBlockRegex =
    /createOrUpdateFiles:\s*({[\s\S]*?})\s*<task_summary>/im;
  const blockMatch = fileBlockRegex.exec(summary);

  if (!blockMatch || !blockMatch[1]) {
    console.log("No valid 'createOrUpdateFiles' block found in summary.");
    return {};
  }

  const contentBlock = blockMatch[1];

  // Using the Function constructor is a safer way to parse the JS-like object literal
  try {
    const parsed = new Function(`return ${contentBlock}`)();
    return parsed;
  } catch (e) {
    console.error(
      "Failed to parse files from summary with Function constructor:",
      e
    );
    return {};
  }
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-testz");

      await sandbox.setTimeout(SANDBOX_TIMEOUT15); // 15min
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const formatedMessages: Message[] = [];

        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId
          },
          orderBy: {
            createdAt: "desc"
            // createdAt: "desc" //TODO: Change to "asc" if AI does not understand what is the latest message
          },
          take: 3 // increases number of previous messages sent to ai
        });

        for (const message of messages) {
          formatedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content
          });
        }

        return formatedMessages.reverse();
      }
    );

    const state = createState<AgentState>(
      {
        summary: "",
        files: {}
      },
      {
        messages: previousMessages
      }
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description:
        "An expert code agent for writing Next.js code in a sandboxed environment",
      system: PROMPT,
      model: openai({
        model: "gpt-4.1-mini", // A powerful model is recommended
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands like 'npm install'.",
          parameters: z.object({ command: z.string() }),
          handler: async (params) => {
            const result = await (async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const exec = await sandbox.commands.run(params.command, {
                  timeoutMs: 120000
                });
                return { stdout: exec.stdout, stderr: exec.stderr };
              } catch (e: unknown) {
                return { error: e instanceof Error ? e.message : String(e) };
              }
            })();
            logToolResult({ toolName: "terminal", output: result });
            return result;
          }
        }),
        createTool({
          name: "deleteFiles",
          description: "Deletes one or more files from the sandbox.",
          parameters: z.object({ paths: z.array(z.string()) }),
          handler: async (params) => {
            const result = await (async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                for (const path of params.paths) {
                  await sandbox.files.remove(path);
                }
                return {
                  success: true,
                  message: `Successfully deleted ${params.paths.length} file(s).`
                };
              } catch (e: unknown) {
                return { error: e instanceof Error ? e.message : String(e) };
              }
            })();
            logToolResult({ toolName: "deleteFiles", output: result });
            return result;
          }
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox.",
          parameters: z.object({
            files: z.array(z.object({ path: z.string(), content: z.string() }))
          }),
          handler: async ({ files }, { network }) => {
            const result = await (async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                }
                return { success: true, writtenFiles: files };
              } catch (e: unknown) {
                return { error: e instanceof Error ? e.message : String(e) };
              }
            })();

            if (network && "success" in result && result.success) {
              const updatedFiles = network.state.data.files || {};
              for (const file of result.writtenFiles) {
                updatedFiles[file.path] = file.content;
              }
              network.state.data.files = updatedFiles;
            } else if (network && "error" in result && result.error) {
              network.state.data.error = result.error as string;
            }

            logToolResult({ toolName: "createOrUpdateFiles", output: result });
            return result;
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox.",
          parameters: z.object({ files: z.array(z.string()) }),
          handler: async (params) => {
            const result = await (async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of params.files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return { files: contents };
              } catch (e: unknown) {
                return { error: e instanceof Error ? e.message : String(e) };
              }
            })();
            logToolResult({ toolName: "readFiles", output: result });
            return result;
          }
        }),
        createTool({
          name: "runBuildCheck",
          description:
            "Runs a check to see if the application compiles successfully. Use this after writing files to detect errors.",
          handler: async () => {
            const result = await (async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const exec = await sandbox.commands.run("npm run build", {
                  timeoutMs: 180000
                });
                if (
                  exec.stderr.includes("Failed to compile") ||
                  exec.stderr.includes("Error:") ||
                  exec.exitCode !== 0
                ) {
                  return {
                    hasBuildErrors: true,
                    errorLog: exec.stderr,
                    stdout: exec.stdout
                  };
                }
                return {
                  hasBuildErrors: false,
                  message: "Application compiled successfully.",
                  stdout: exec.stdout
                };
              } catch (e: unknown) {
                return { error: e instanceof Error ? e.message : String(e) };
              }
            })();
            logToolResult({ toolName: "runBuildCheck", output: result });
            return result;
          }
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          if (!network) return result;
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);
          if (lastAssistantMessageText?.includes("<task_summary>")) {
            network.state.data.summary = lastAssistantMessageText;
          }
          return result;
        }
      }
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 1, // We only need one turn since the AI gives the full plan at once
      defaultState: state,
      router: async ({ network }) => {
        if (network.state.data.summary) {
          return;
        }
        return codeAgent;
      }
    });

    const result = await network.run(event.data.value, { state: state });

    // FIX: Ensure summary is never undefined by providing fallback
    const finalSummary =
      result.state.data.summary || "Task completed without summary.";
    const filesFromSummary = parseFilesFromSummary(finalSummary);

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: "gpt-4.1-mini", // A powerful model is recommended
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL
      })
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({
        model: "gpt-4.1-mini", // A powerful model is recommended
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL
      })
    });

    // FIX: Provide fallback for summary to prevent undefined errors
    const summaryForAgents = finalSummary || "No summary available";

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      summaryForAgents
    );
    const { output: responseOutput } = await responseGenerator.run(
      summaryForAgents
    );

    const isError = !finalSummary.includes("<task_summary>");

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    if (Object.keys(filesFromSummary).length > 0) {
      await step.run("write-parsed-files", async () => {
        const sandbox = await getSandbox(sandboxId);
        for (const [path, content] of Object.entries(filesFromSummary)) {
          if (path === "app/page.tsx") {
            try {
              await sandbox.files.remove("pages/index.tsx");
              console.log("Removed conflicting pages/index.tsx");
            } catch (e) {
              // Ignore error if file doesn't exist
              console.log("error->" + e);
            }
          }
          await sandbox.files.write(path, content);
        }
      });
    }

    await step.run("save-result", async () => {
      if (isError || Object.keys(filesFromSummary).length === 0) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR"
          }
        });
      }

      // Enhanced: Extract clean summary content
      const summaryContentMatch = finalSummary.match(
        /<task_summary>([\s\S]*?)<\/task_summary>/
      );
      const cleanSummary = summaryContentMatch
        ? summaryContentMatch[1].trim()
        : "Task completed successfully.";

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput) || cleanSummary,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: parseAgentOutput(fragmentTitleOutput) || "New Fragment",
              files: filesFromSummary
            }
          }
        }
      });
    });

    return {
      url: sandboxUrl,
      title: parseAgentOutput(fragmentTitleOutput) || "Fragment",
      files: filesFromSummary,
      summary: finalSummary
    };
  }
);
