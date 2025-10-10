// // // src/inngest/schema.ts
// // import { z } from "zod";

// // /**
// //  * Defines the strict schema for the 'code-agent/run' event.
// //  * This ensures type safety from the client all the way to the Inngest function,
// //  * leveraging Zod v3.25.76.
// //  */
// // export const codeAgentRunSchema = z.object({
// //   // The text prompt is optional, but must be a string if provided.
// //   text: z.string().optional(),

// //   // The image is a Base64 data URL and is also optional.
// //   image: z.string().optional(),

// //   // Model and projectId are required.
// //   model: z.string(),
// //   projectId: z.string(),

// //   // We'll keep your existing optional parameters for full compatibility.
// //   selfFixRetries: z.number().optional(),
// //   enforceLanding: z.boolean().optional(),
// // });

// // // We can infer the TypeScript type directly from the schema for use in our frontend.
// // export type CodeAgentRunEventData = z.infer<typeof codeAgentRunSchema>;

// // src/inngest/schema.ts
// import { z } from "zod";

// /**
//  * Defines the strict schema for the 'code-agent/run' event.
//  * This is the single source of truth for the data sent from the tRPC mutation
//  * to the Inngest function.
//  */
// export const codeAgentRunSchema = z.object({
//   text: z.string().optional(),
//   image: z.string().optional(), // Base64 data URL
//   model: z.string(),
//   projectId: z.string(),
//   selfFixRetries: z.number().optional(),
//   enforceLanding: z.boolean().optional(),
// });

// export type CodeAgentRunEventData = z.infer<typeof codeAgentRunSchema>;

// src/inngest/schema.ts
import { z } from "zod";

/**
 * Strict schema for the 'code-agent/run' event.
 * model is optional because callers sometimes don't send one.
 */
export const codeAgentRunSchema = z.object({
  text: z.string().optional(),
  image: z.string().optional(),
  model: z.string().optional(), // <-- optional now
  projectId: z.string(),
  selfFixRetries: z.number().optional(),
  enforceLanding: z.boolean().optional(),
});

export type CodeAgentRunEventData = z.infer<typeof codeAgentRunSchema>;
