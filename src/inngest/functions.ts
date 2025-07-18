import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, gemini } from "@inngest/agent-kit";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-testz");
      return sandbox.sandboxId;
    });

    const summarizer = createAgent({
      name: "code-agent",
      system:
        "You are an expert next.js developer. you write readable, maintainable, high quality code. you write simple Next.js & React code. You do not use any libraries or frameworks that are not part of the Next.js ecosystem.",
      // 1. Use `agenticGoogle.gemini` instead of `agenticOpenai`
      model: gemini({ model: "gemini-1.5-flash" })
    });

    const { output } = await summarizer.run(
      `Write the following snippets: ${event.data.value}`
    );

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });
    return { output, sandboxUrl };
  }
);
