// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { generateSlug } from "random-word-slugs";
// import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
// import { z } from "zod";
// import { TRPCError } from "@trpc/server";
// import { consumeCredit } from "@/lib/usage";

// export const projectsRouter = createTRPCRouter({
//   getOne: protectedProcedure
//     .input(
//       z.object({
//         id: z.string().min(1, { message: "Project ID is required" })
//       })
//     )
//     .query(async ({ input, ctx }) => {
//       // --- Start of Debugging Block ---
//       console.log(`[tRPC] Attempting to fetch project with id: ${input.id}`);
//       try {
//         const existingProject = await prisma.project.findUnique({
//           where: { id: input.id, userId: ctx.auth.userId }
//         });

//         if (!existingProject) {
//           console.warn(`[tRPC] Project with id ${input.id} not found.`);
//           throw new TRPCError({
//             code: "NOT_FOUND",
//             message: "Project not found"
//           });
//         }

//         console.log(
//           `[tRPC] Successfully found project: ${existingProject.name}`
//         );
//         return existingProject;
//       } catch (e: unknown) {
//         console.error(
//           `[tRPC] DATABASE ERROR while fetching project id ${input.id}:`,
//           e
//         );
//         // Re-throw to the client
//         if (e instanceof TRPCError) throw e;
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to fetch project from database.",
//           cause: e
//         });
//       }
//       // --- End of Debugging Block ---
//     }),

//   getMany: protectedProcedure.query(async ({ ctx }) => {
//     const projects = await prisma.project.findMany({
//       where: {
//         userId: ctx.auth.userId
//       },
//       orderBy: { updatedAt: "desc" }
//     });
//     return projects;
//   }),

//   create: protectedProcedure
//     .input(
//       z.object({
//         value: z
//           .string()
//           .min(1, { message: "Prompt is required" })
//           .max(10000, { message: "Prompt cannot exceed 10000 characters" })
//       })
//     )
//     .mutation(async ({ input, ctx }) => {
//       try {
//         await consumeCredit();
//       } catch (error) {
//         if (error instanceof Error) {
//           throw new TRPCError({
//             code: "BAD_REQUEST",
//             message: "Something went wrong"
//           });
//         } else {
//           throw new TRPCError({
//             code: "TOO_MANY_REQUESTS",
//             message: "You have run out of credits"
//           });
//         }
//       }

//       const createdProject = await prisma.project.create({
//         data: {
//           userId: ctx.auth.userId,
//           name: generateSlug(2, {
//             format: "kebab"
//           }),
//           messages: {
//             create: {
//               content: input.value,
//               role: "USER",
//               type: "RESULT"
//             }
//           }
//         }
//       });

//       await inngest.send({
//         name: "code-agent/run",
//         data: {
//           value: input.value,
//           projectId: createdProject.id
//         }
//       });

//       return createdProject;
//     })
// });

// // src/modules/messages/server/procedures.ts
// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { consumeCredit } from "@/lib/usage";
// import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
// import { TRPCError } from "@trpc/server";
// import { z } from "zod";

// /**
//  * Helper: quick validation for incoming image field.
//  * - Accepts either a data URL starting with data:image/(png|jpg|jpeg|webp)
//  *   or a valid HTTP(S) URL (e.g., signed S3 URL).
//  * - Rejects extremely large base64 payloads (> ~5MB by default).
//  */
// const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// function approxBytesFromBase64(base64Str: string): number {
//   // Remove data url prefix if present
//   const commaIdx = base64Str.indexOf(",");
//   const payload = commaIdx >= 0 ? base64Str.slice(commaIdx + 1) : base64Str;
//   // Each 4 base64 chars represent 3 bytes
//   return Math.floor((payload.length * 3) / 4);
// }

// function isValidImageInput(value: unknown): value is string {
//   if (!value || typeof value !== "string") return false;

//   const s = value.trim();

//   // Allow data URL images: data:image/png;base64,....
//   const dataUrlMatch = s.match(/^data:image\/(png|jpe?g|webp);base64,/i);
//   if (dataUrlMatch) {
//     const size = approxBytesFromBase64(s);
//     if (size > MAX_IMAGE_BYTES) return false;
//     return true;
//   }

//   // Allow http(s) URLs (presigned S3 or public): do a simple check
//   try {
//     const u = new URL(s);
//     if (u.protocol !== "http:" && u.protocol !== "https:") return false;
//     // Optionally limit length
//     if (s.length > 2000) return false;
//     return true;
//   } catch {
//     return false;
//   }
// }

// export const messagesRouter = createTRPCRouter({
//   getMany: protectedProcedure
//     .input(
//       z.object({
//         projectId: z.string().min(1, { message: "Project ID is required" }),
//         model: z.string().optional(),
//       })
//     )
//     .query(async ({ input, ctx }) => {
//       try {
//         const messages = await prisma.message.findMany({
//           where: {
//             projectId: input.projectId,
//             project: {
//               userId: ctx.auth.userId,
//             },
//           },
//           include: {
//             fragment: true,
//           },
//           orderBy: { updatedAt: "asc" },
//         });
//         return messages;
//       } catch (e: unknown) {
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to fetch messages from the database.",
//           cause: e,
//         });
//       }
//     }),

//   create: protectedProcedure
//     .input(
//       z
//         .object({
//           // keep `value` for backwards compatibility with your client code
//           value: z.string().optional(),
//           image: z.string().optional(), // Base64 data URL OR a URL (presigned/public)
//           projectId: z.string().min(1, { message: "Project ID is required" }),
//           model: z.string().optional(),
//         })
//         .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//           message: "A prompt or an image is required.",
//           path: ["value"],
//         })
//     )
//     .mutation(async ({ input, ctx }) => {
//       // Verify ownership of the project
//       const existingProject = await prisma.project.findUnique({
//         where: {
//           id: input.projectId,
//           userId: ctx.auth.userId,
//         },
//       });

//       if (!existingProject) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Project not found",
//         });
//       }

//       // Validate image if present
//       if (input.image) {
//         if (!isValidImageInput(input.image)) {
//           throw new TRPCError({
//             code: "BAD_REQUEST",
//             message:
//               "Invalid image. Provide a data URL (png/jpg/webp) under 5MB or a valid HTTP(S) image URL.",
//           });
//         }
//       }

//       // Consume user credit / usage. Keep same semantics as before.
//       try {
//         await consumeCredit();
//       } catch (error) {
//         // Keep same error semantics as you had previously.
//         if (error instanceof Error) {
//           throw new TRPCError({
//             code: "BAD_REQUEST",
//             message: "Something went wrong",
//           });
//         } else {
//           throw new TRPCError({
//             code: "TOO_MANY_REQUESTS",
//             message: "You have run out of credits",
//           });
//         }
//       }

//       // Persist message in DB. store image reference in `imageUrl` (optional).
//       // Note: ensure your Prisma Message model has `imageUrl String?` added if you want to store this.
//       let createdMessage;
//       try {
//         createdMessage = await prisma.message.create({
//     data: {
//     projectId: existingProject.id,
//     // Keep content as a non-null string. Use empty string for image-only messages.
//     content: input.value?.trim() ?? "",
//     imageUrl: input.image ?? null,
//     role: "USER",
//     type: "RESULT",
//     model: input.model ?? null,
//   },
// });
//       } catch (e: unknown) {
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to create message in database.",
//           cause: e,
//         });
//       }

//       // Fire off the Inngest event asynchronously. If Inngest send fails, log and continue.
//       // The code-agent expects fields matching your schema (text, image, projectId, model, ...).
//       try {
//         await inngest.send({
//           name: "code-agent/run",
//           data: {
//             text: input.value ?? undefined,
//             image: input.image ?? undefined,
//             projectId: input.projectId,
//             model: input.model ?? undefined,
//             // pass additional optional params if needed:
//             // selfFixRetries: input.selfFixRetries,
//             // enforceLanding: input.enforceLanding,
//           },
//         });
//       } catch (err) {
//         // Don't fail the mutation if event dispatch fails; record an error message to DB for observability.
//         try {
//           const errMsg = err instanceof Error ? err.message : String(err);
//           await prisma.message.create({
//             data: {
//               projectId: existingProject.id,
//               content: `Failed to dispatch code-agent/run: ${errMsg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: input.model ?? null,
//             },
//           });
//         } catch {
//           // swallow any errors here intentionally
//         }
//       }

//       return createdMessage;
//     }),
// });

// src/modules/messages/server/procedures.ts
// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { consumeCredit } from "@/lib/usage";
// import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
// import { TRPCError } from "@trpc/server";
// import { z } from "zod";

// const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// function approxBytesFromBase64(base64Str: string): number {
//   const commaIdx = base64Str.indexOf(",");
//   const payload = commaIdx >= 0 ? base64Str.slice(commaIdx + 1) : base64Str;
//   return Math.floor((payload.length * 3) / 4);
// }

// /**
//  * Validate image input:
//  * - Accepts data URLs (data:image/png;base64,...) up to MAX_IMAGE_BYTES
//  * - Accepts http(s) URLs (UploadThing returns ufsUrl / url)
//  */
// function isValidImageInput(value: unknown): value is string {
//   if (!value || typeof value !== "string") return false;
//   const s = value.trim();

//   // data URL
//   const dataUrlMatch = s.match(/^data:image\/(png|jpe?g|webp);base64,/i);
//   if (dataUrlMatch) {
//     const size = approxBytesFromBase64(s);
//     if (size > MAX_IMAGE_BYTES) return false;
//     return true;
//   }

//   // http(s) URL (UploadThing ufsUrl or url etc.)
//   try {
//     const u = new URL(s);
//     if (u.protocol !== "http:" && u.protocol !== "https:") return false;
//     // avoid extremely long inputs
//     if (s.length > 4096) return false;
//     return true;
//   } catch {
//     return false;
//   }
// }

// export const messagesRouter = createTRPCRouter({
//   getMany: protectedProcedure
//     .input(
//       z.object({
//         projectId: z.string().min(1, { message: "Project ID is required" }),
//         model: z.string().optional(),
//       })
//     )
//     .query(async ({ input, ctx }) => {
//       try {
//         const messages = await prisma.message.findMany({
//           where: {
//             projectId: input.projectId,
//             project: {
//               userId: ctx.auth.userId,
//             },
//           },
//           include: {
//             fragment: true,
//           },
//           orderBy: { updatedAt: "asc" },
//         });
//         return messages;
//       } catch (e: unknown) {
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to fetch messages from the database.",
//           cause: e,
//         });
//       }
//     }),

//   create: protectedProcedure
//     .input(
//       z
//         .object({
//           // `value` kept for backwards compatibility; may be empty when image-only
//           value: z.string().optional(),
//           // client should pass the UploadThing returned URL (ufsUrl / url) or a data URL
//           image: z.string().optional(),
//           projectId: z.string().min(1, { message: "Project ID is required" }),
//           model: z.string().optional(),
//         })
//         .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//           message: "A prompt or an image is required.",
//           path: ["value"],
//         })
//     )
//     .mutation(async ({ input, ctx }) => {
//       // Verify ownership of the project
//       const existingProject = await prisma.project.findUnique({
//         where: {
//           id: input.projectId,
//           userId: ctx.auth.userId,
//         },
//       });

//       if (!existingProject) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Project not found",
//         });
//       }

//       // Validate image if present
//       if (input.image) {
//         if (!isValidImageInput(input.image)) {
//           throw new TRPCError({
//             code: "BAD_REQUEST",
//             message:
//               "Invalid image. Provide a data URL (png/jpg/webp) under 5MB or a valid HTTP(S) image URL (e.g. UploadThing ufsUrl).",
//           });
//         }
//       }

//       // Consume user credit / usage.
//       try {
//         await consumeCredit();
//       } catch (error) {
//         if (error instanceof Error) {
//           throw new TRPCError({
//             code: "BAD_REQUEST",
//             message: "Something went wrong",
//           });
//         } else {
//           throw new TRPCError({
//             code: "TOO_MANY_REQUESTS",
//             message: "You have run out of credits",
//           });
//         }
//       }

//       // Persist message in DB. store image reference in `imageUrl` (optional).
//       let createdMessage;
//       try {
//         createdMessage = await prisma.message.create({
//           data: {
//             projectId: existingProject.id,
//             // Keep content as non-nullable in DB; use empty string for image-only messages.
//             content: input.value?.trim() ?? "",
//             imageUrl: input.image ?? null,
//             role: "USER",
//             type: "RESULT",
//             model: input.model ?? undefined,
//           },
//         });
//       } catch (e: unknown) {
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to create message in database.",
//           cause: e,
//         });
//       }

//       // Dispatch the Inngest event (fire-and-forget semantics; log DB record if dispatch fails).
//       try {
//         await inngest.send({
//           name: "code-agent/run",
//           data: {
//             text: input.value ?? undefined,
//             image: input.image ?? undefined,
//             projectId: input.projectId,
//             model: input.model ?? undefined,
//           },
//         });
//       } catch (err) {
//         // record an error message for observability, but do not fail the request
//         try {
//           const errMsg = err instanceof Error ? err.message : String(err);
//           await prisma.message.create({
//             data: {
//               projectId: existingProject.id,
//               content: `Failed to dispatch code-agent/run: ${errMsg}`,
//               role: "ASSISTANT",
//               type: "ERROR",
//               model: input.model ?? undefined,
//             },
//           });
//         } catch {
//           /* swallow any errors here intentionally */
//         }
//       }

//       return createdMessage;
//     }),
// });

// src/modules/projects/server/procedures.ts
import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db";
import { generateSlug } from "random-word-slugs";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { consumeCredit } from "@/lib/usage";

/**
 * Projects router
 *
 * - getOne(id) -> returns the project (owned by authenticated user)
 * - getMany() -> list of projects for the current user
 * - create({ value }) -> creates project, seeds initial user message, triggers code-agent/run
 */

export const projectsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Project ID is required" }),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const existingProject = await prisma.project.findUnique({
          where: { id: input.id, userId: ctx.auth.userId },
        });

        if (!existingProject) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        return existingProject;
      } catch (e: unknown) {
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch project from database.",
          cause: e,
        });
      }
    }),

  getMany: protectedProcedure.query(async ({ ctx }) => {
    try {
      const projects = await prisma.project.findMany({
        where: {
          userId: ctx.auth.userId,
        },
        orderBy: { updatedAt: "desc" },
      });
      return projects;
    } catch (e: unknown) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch projects.",
        cause: e,
      });
    }
  }),

  create: protectedProcedure
    .input(
      z.object({
        value: z
          .string()
          .min(1, { message: "Prompt is required" })
          .max(10000, { message: "Prompt cannot exceed 10000 characters" }),
        // optional extra settings could be added here in future
      })
    )
    .mutation(async ({ input, ctx }) => {
      // consume a credit for creating a project
      try {
        await consumeCredit();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Something went wrong",
            cause: error,
          });
        } else {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits",
          });
        }
      }

      // Create the project and an initial message (user prompt)
      try {
        const projectName = generateSlug(2, { format: "kebab" });

        const createdProject = await prisma.project.create({
          data: {
            userId: ctx.auth.userId,
            name: projectName,
            messages: {
              create: {
                content: input.value,
                role: "USER",
                type: "RESULT",
              },
            },
          },
        });

        // Fire the Inngest event to run the code agent for this project.
        // We intentionally don't fail the mutation if Inngest dispatch fails;
        // we log an error message into the DB for observability.
        try {
          await inngest.send({
            name: "code-agent/run",
            data: {
              text: input.value,
              projectId: createdProject.id,
            },
          });
        } catch (err) {
          try {
            const errMsg = err instanceof Error ? err.message : String(err);
            await prisma.message.create({
              data: {
                projectId: createdProject.id,
                content: `Failed to dispatch code-agent/run: ${errMsg}`,
                role: "ASSISTANT",
                type: "ERROR",
              },
            });
          } catch {
            // swallow
          }
        }

        return createdProject;
      } catch (e: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
          cause: e,
        });
      }
    }),
});
