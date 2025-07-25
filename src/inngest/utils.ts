import { Sandbox } from "@e2b/code-interpreter";
import { AgentResult, Message, TextMessage } from "@inngest/agent-kit";
import { SANDBOX_TIMEOUT15 } from "./types";

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  await sandbox.setTimeout(SANDBOX_TIMEOUT15);
  return sandbox;
}

export function lastAssistantTextMessageContent(
  result: AgentResult
): string | undefined {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role === "assistant"
  );

  const message = result.output[lastAssistantTextMessageIndex] as
    | TextMessage
    | undefined;

  if (!message?.content) {
    return undefined;
  }

  return typeof message.content === "string"
    ? message.content
    : message.content.map((c) => c.text).join("");
}

// This is a type guard function to safely check for the 'error' property.
const isErrorObject = (
  output: unknown
): output is { error: string | unknown } => {
  return typeof output === "object" && output !== null && "error" in output;
};

export function logToolResult(result: { toolName: string; output: unknown }) {
  console.log(`[AGENT] Ran tool: ${result.toolName}`);

  // Use the type guard instead of casting to 'any'.
  if (isErrorObject(result.output)) {
    console.error(`[AGENT] Tool Error: ${String(result.output.error)}`);
  } else {
    const outputStr = JSON.stringify(result.output);
    const truncatedOutput =
      outputStr.length > 300 ? `${outputStr.slice(0, 300)}...` : outputStr;
    console.log(`[AGENT] Tool Result: ${truncatedOutput}`);
  }
}

export const parseAgentOutput = (value: Message[]) => {
  const output = value[0];
  if (output.type !== "text") {
    return "Fragment";
  }

  if (Array.isArray(output.content)) {
    return output.content.map((txt) => txt).join("");
  } else {
    return output.content;
  }
};
