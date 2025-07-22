// import { Sandbox } from "@e2b/code-interpreter";
// import { AgentResult, TextMessage } from "@inngest/agent-kit";

// export async function getSandbox(sandboxId: string) {
//   const sandbox = await Sandbox.connect(sandboxId);
//   return sandbox;
// }

// export function lastAssistantTextMessageContent(result: AgentResult) {
//   const lastAssistantTextMessageIndex = result.output.findLastIndex(
//     (message) => message.role === "assistant"
//   );

//   const message = result.output[lastAssistantTextMessageIndex] as
//     | TextMessage
//     | undefined;

//   return message?.content
//     ? typeof message.content === "string"
//       ? message.content
//       : message.content.map((c) => c.text).join("")
//     : undefined;
// }

// import { Sandbox } from "@e2b/code-interpreter";
// import { AgentResult, TextMessage } from "@inngest/agent-kit";

// export async function getSandbox(sandboxId: string) {
//   const sandbox = await Sandbox.connect(sandboxId);
//   return sandbox;
// }

// export function lastAssistantTextMessageContent(
//   result: AgentResult
// ): string | undefined {
//   const lastAssistantTextMessageIndex = result.output.findLastIndex(
//     (message) => message.role === "assistant"
//   );

//   const message = result.output[lastAssistantTextMessageIndex] as
//     | TextMessage
//     | undefined;

//   if (!message?.content) {
//     return undefined;
//   }

//   return typeof message.content === "string"
//     ? message.content
//     : message.content.map((c) => c.text).join("");
// }

// // This is a type guard function to safely check for the 'error' property.
// const isErrorObject = (
//   output: unknown
// ): output is { error: string | unknown } => {
//   return typeof output === "object" && output !== null && "error" in output;
// };

// export function logToolResult(result: { toolName: string; output: unknown }) {
//   console.log(`[AGENT] Ran tool: ${result.toolName}`);

//   // FIX: Use the type guard instead of casting to 'any'.
//   if (isErrorObject(result.output)) {
//     console.error(`[AGENT] Tool Error: ${String(result.output.error)}`);
//   } else {
//     const outputStr = JSON.stringify(result.output);
//     const truncatedOutput =
//       outputStr.length > 300 ? `${outputStr.slice(0, 300)}...` : outputStr;
//     console.log(`[AGENT] Tool Result: ${truncatedOutput}`);
//   }
// }

import { Sandbox } from "@e2b/code-interpreter";
import { AgentResult, TextMessage } from "@inngest/agent-kit";

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
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
