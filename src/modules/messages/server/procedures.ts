import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db"; // <-- Correct Import
import { consumeCredit } from "@/lib/usage";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        model: z.string().optional()
      })
    )
    .query(async ({ input, ctx }) => {
      console.log(
        `[tRPC] Attempting to fetch messages for projectId: ${input.projectId}`
      );
      try {
        const messages = await prisma.message.findMany({
          where: {
            projectId: input.projectId,
            project: {
              userId: ctx.auth.userId
            }
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

  create: protectedProcedure
    .input(
  z.object({
    value: z
      .string()
      .min(1, { message: "Message is required" })
      .max(10000, { message: "Message cannot exceed 10000 characters" }),
    projectId: z.string().min(1, { message: "Project ID is required" }),
    model: z.string().optional() // <-- Add this line
  })
)
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId
        }
      });

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found"
        });
      }

      try {
        await consumeCredit();
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Something went wrong"
          });
        } else {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits"
          });
        }
      }

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT"
        }
      });

      await inngest.send({
  name: "code-agent/run",
  data: {
    value: input.value,
    projectId: input.projectId,
    model: input.model // <-- Use the actual value from input
  }
});

      return createdMessage;
    })
});
