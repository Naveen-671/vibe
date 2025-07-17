import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    await step.sleep("wait-a-moment", "10s");
    // This function will be triggered by the event "test/hello.world"
    return { message: `Hello ${event.data.email}!` };
  }
);
