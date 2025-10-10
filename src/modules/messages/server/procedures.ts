// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db"; // <-- Correct Import
// import { consumeCredit } from "@/lib/usage";
// import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
// import { TRPCError } from "@trpc/server";
// import { z } from "zod";

// export const messagesRouter = createTRPCRouter({
//   getMany: protectedProcedure
//     .input(
//       z.object({
//         projectId: z.string().min(1, { message: "Project ID is required" }),
//         model: z.string().optional()
//       })
//     )
//     .query(async ({ input, ctx }) => {
//       console.log(
//         `[tRPC] Attempting to fetch messages for projectId: ${input.projectId}`
//       );
//       try {
//         const messages = await prisma.message.findMany({
//           where: {
//             projectId: input.projectId,
//             project: {
//               userId: ctx.auth.userId
//             }
//           },
//           include: {
//             fragment: true
//           },
//           orderBy: { updatedAt: "asc" }
//         });
//         console.log(`[tRPC] Successfully found ${messages.length} messages.`);
//         return messages;
//       } catch (e: unknown) {
//         console.error("[tRPC] DATABASE ERROR while fetching messages:", e);
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to fetch messages from the database.",
//           cause: e
//         });
//       }
//     }),

//   create: protectedProcedure
//     .input(
//   z.object({
//     value: z
//       .string()
//       .min(1, { message: "Message is required" })
//       .max(10000, { message: "Message cannot exceed 10000 characters" }),
//     projectId: z.string().min(1, { message: "Project ID is required" }),
//     model: z.string().optional() // <-- Add this line
//   })
// )
//     .mutation(async ({ input, ctx }) => {
//       const existingProject = await prisma.project.findUnique({
//         where: {
//           id: input.projectId,
//           userId: ctx.auth.userId
//         }
//       });

//       if (!existingProject) {
//         throw new TRPCError({
//           code: "NOT_FOUND",
//           message: "Project not found"
//         });
//       }

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

//       const createdMessage = await prisma.message.create({
//         data: {
//           projectId: existingProject.id,
//           content: input.value,
//           role: "USER",
//           type: "RESULT"
//         }
//       });

//       await inngest.send({
//   name: "code-agent/run",
//   data: {
//     value: input.value,
//     projectId: input.projectId,
//     model: input.model // <-- Use the actual value from input
//   }
// });

//       return createdMessage;
//     })
// });

// // src/modules/messages/server/procedures.ts
// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { consumeCredit } from "@/lib/usage";
// import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
// import { TRPCError } from "@trpc/server";
// import { z } from "zod";

// export const messagesRouter = createTRPCRouter({
//   getMany: protectedProcedure
//     .input(
//       z.object({
//         projectId: z.string().min(1, { message: "Project ID is required" }),
//         model: z.string().optional(),
//       })
//     )
//     .query(async ({ input, ctx }) => {
//       // This procedure is correct and remains unchanged.
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
//     // MODIFICATION [1]: Update the input schema to include the optional image.
//     .input(
//       z.object({
//         value: z
//           .string()
//           .max(10000, { message: "Message cannot exceed 10000 characters" }),
//         image: z.string().optional(), // Added: for the Base64 data URL
//         projectId: z.string().min(1, { message: "Project ID is required" }),
//         model: z.string().optional(),
//       }).refine(data => data.value || data.image, {
//           message: "A prompt or an image is required.",
//       })
//     )
//     .mutation(async ({ input, ctx }) => {
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

//       const createdMessage = await prisma.message.create({
//         data: {
//           projectId: existingProject.id,
//           content: input.value, // We still save the text prompt for history.
//           role: "USER",
//           type: "RESULT",
//         },
//       });

//       // MODIFICATION [2]: Send the updated payload to Inngest.
//       await inngest.send({
//         name: "code-agent/run",
//         data: {
//           text: input.value,      // Renamed 'value' to 'text'
//           image: input.image,     // Pass the new image field
//           projectId: input.projectId,
//           model: input.model,
//         },
//       });

//       return createdMessage;
//     }),
// });

// // src/modules/messages/server/procedures.ts
// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { consumeCredit } from "@/lib/usage";
// import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
// import { TRPCError } from "@trpc/server";
// import { z } from "zod";

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
//           include: { fragment: true },
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
//           value: z.string().max(10000).optional(),
//           image: z.string().url().optional(),
//           projectId: z.string().min(1, { message: "Project ID is required" }),
//           model: z.string().optional(),
//         })
//         .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//           message: "A prompt or an image is required.",
//         })
//     )
//     .mutation(async ({ input, ctx }) => {
//       // Ensure project belongs to user
//       const existingProject = await prisma.project.findFirst({
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

//       try {
//         await consumeCredit();
//       } catch (error) {
//         console.log("error from messages/server/procedures.ts",error)
//         // bubble a useful error code for client
//         throw new TRPCError({
//           code: "TOO_MANY_REQUESTS",
//           message: "You have run out of credits",
//         });
//       }

//       // Save user message — ensure content is always a string and store imageUrl
//       const createdMessage = await prisma.message.create({
//         data: {
//           projectId: existingProject.id,
//           content: input.value ?? "",
//           imageUrl: input.image ?? null,
//           role: "USER",
//           type: "RESULT",
//           model: input.model ?? null,
//         },
//       });

//       // Send event to Inngest: `text` and `image` per your schema
//       await inngest.send({
//         name: "code-agent/run",
//         data: {
//           text: input.value ?? "",
//           image: input.image ?? undefined,
//           projectId: input.projectId,
//           model: input.model ?? undefined,
//         },
//       });

//       return createdMessage;
//     }),
// });


// src/modules/messages/server/procedures.ts
import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db";
import { consumeCredit } from "@/lib/usage";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        model: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const messages = await prisma.message.findMany({
          where: {
            projectId: input.projectId,
            project: {
              userId: ctx.auth.userId,
            },
          },
          include: {
            fragment: true,
          },
          orderBy: { updatedAt: "asc" },
        });
        return messages;
      } catch (e: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch messages from the database.",
          cause: e,
        });
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        value: z
          .string()
          .max(10000, { message: "Message cannot exceed 10000 characters" })
          .optional(),
        image: z.string().optional(), // image URL (UploadThing)
        projectId: z.string().min(1, { message: "Project ID is required" }),
        model: z.string().optional(),
      }).refine(data => (data.value && data.value.trim()) || data.image, {
        message: "A prompt or an image is required.",
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      try {
        await consumeCredit();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Something went wrong",
          });
        } else {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits",
          });
        }
      }

      // Ensure content is always a string in the DB (empty when user provided only an image)
      const contentToSave = (input.value && input.value.trim()) ? input.value.trim() : "";

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: contentToSave,
          imageUrl: input.image ?? null,
          role: "USER",
          type: "RESULT",
          model: input.model ?? undefined,
        },
      });

      // Send event to Inngest with text + image
      await inngest.send({
        name: "code-agent/run",
        data: {
          text: input.value,
          image: input.image,
          projectId: input.projectId,
          model: input.model,
        },
      });

      return createdMessage;
    }),
});
