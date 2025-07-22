// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { baseProcedure, createTRPCRouter } from "@/trpc/init";
// import { z } from "zod";

// export const messagesRouter = createTRPCRouter({
//   getMany: baseProcedure
//     .input(
//       z.object({
//         projectId: z.string().min(1, { message: "Project ID is required" })
//       })
//     )
//     .query(async ({ input }) => {
//       const messages = await prisma.message.findMany({
//         where: {
//           projectId: input.projectId
//         },
//         include: {
//           fragment: true
//         },
//         orderBy: { updatedAt: "asc" }
//       });
//       return messages;
//     }),
//   create: baseProcedure
//     .input(
//       z.object({
//         value: z
//           .string()
//           .min(1, { message: "Message is required" })
//           .max(10000, { message: "Message cannot exceed 10000 characters" }),
//         projectId: z.string().min(1, { message: "Project ID is required" })
//       })
//     )
//     .mutation(async ({ input }) => {
//       const createdMessage = await prisma.message.create({
//         data: {
//           projectId: input.projectId,
//           content: input.value,
//           role: "USER",
//           type: "RESULT"
//         }
//       });

//       await inngest.send({
//         // name: "messages.create",
//         name: "code-agent/run",
//         data: {
//           value: input.value,
//           projectId: input.projectId
//         }
//       });

//       return createdMessage;
//     })
// });

// import { inngest } from "@/inngest/client";
// import { prisma } from "@/lib/db";
// import { baseProcedure, createTRPCRouter } from "@/trpc/init";
// import { TRPCError } from "@trpc/server";
// import { z } from "zod";

// export const messagesRouter = createTRPCRouter({
//   getMany: baseProcedure
//     .input(
//       z.object({
//         projectId: z.string().min(1, { message: "Project ID is required" })
//       })
//     )
//     .query(async ({ input }) => {
//       // --- Start of Debugging Block ---
//       console.log(
//         `[tRPC] Attempting to fetch messages for projectId: ${input.projectId}`
//       );

//       try {
//         const messages = await prisma.message.findMany({
//           where: {
//             projectId: input.projectId
//           },
//           include: {
//             fragment: true
//           },
//           orderBy: { updatedAt: "asc" }
//         });

//         console.log(`[tRPC] Successfully found ${messages.length} messages.`);
//         return messages;
//       } catch (e: unknown) {
//         // This will log the specific database error to your server console.
//         console.error("[tRPC] DATABASE ERROR while fetching messages:", e);

//         // Re-throw the error so the client knows the request failed.
//         throw new TRPCError({
//           code: "INTERNAL_SERVER_ERROR",
//           message: "Failed to fetch messages from the database.",
//           cause: e
//         });
//       }
//       // --- End of Debugging Block ---
//     }),

//   create: baseProcedure
//     .input(
//       z.object({
//         value: z
//           .string()
//           .min(1, { message: "Message is required" })
//           .max(10000, { message: "Message cannot exceed 10000 characters" }),
//         projectId: z.string().min(1, { message: "Project ID is required" })
//       })
//     )
//     .mutation(async ({ input }) => {
//       const createdMessage = await prisma.message.create({
//         data: {
//           projectId: input.projectId,
//           content: input.value,
//           role: "USER",
//           type: "RESULT"
//         }
//       });

//       await inngest.send({
//         name: "code-agent/run",
//         data: {
//           value: input.value,
//           projectId: input.projectId
//         }
//       });

//       return createdMessage;
//     })
// });

import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db"; // <-- Correct Import
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const messagesRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" })
      })
    )
    .query(async ({ input }) => {
      console.log(
        `[tRPC] Attempting to fetch messages for projectId: ${input.projectId}`
      );
      try {
        const messages = await prisma.message.findMany({
          where: {
            projectId: input.projectId
          },
          include: {
            fragment: true
          },
          orderBy: { updatedAt: "asc" }
        });
        console.log(`[tRPC] Successfully found ${messages.length} messages.`);
        return messages;
      } catch (e: unknown) {
        console.error("[tRPC] DATABASE ERROR while fetching messages:", e);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch messages from the database.",
          cause: e
        });
      }
    }),

  create: baseProcedure
    .input(
      z.object({
        value: z
          .string()
          .min(1, { message: "Message is required" })
          .max(10000, { message: "Message cannot exceed 10000 characters" }),
        projectId: z.string().min(1, { message: "Project ID is required" })
      })
    )
    .mutation(async ({ input }) => {
      const createdMessage = await prisma.message.create({
        data: {
          projectId: input.projectId,
          content: input.value,
          role: "USER",
          type: "RESULT"
        }
      });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: input.projectId
        }
      });

      return createdMessage;
    })
});
