import { inngest } from "./client";
import { createAgent, gemini } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event }) => {
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
    console.log(output);

    return { output };
  }
);
