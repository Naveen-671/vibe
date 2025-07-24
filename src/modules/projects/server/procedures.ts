import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db";
import { generateSlug } from "random-word-slugs";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const projectsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Project ID is required" })
      })
    )
    .query(async ({ input, ctx }) => {
      // --- Start of Debugging Block ---
      console.log(`[tRPC] Attempting to fetch project with id: ${input.id}`);
      try {
        const existingProject = await prisma.project.findUnique({
          where: { id: input.id, userId: ctx.auth.userId }
        });

        if (!existingProject) {
          console.warn(`[tRPC] Project with id ${input.id} not found.`);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found"
          });
        }

        console.log(
          `[tRPC] Successfully found project: ${existingProject.name}`
        );
        return existingProject;
      } catch (e: unknown) {
        console.error(
          `[tRPC] DATABASE ERROR while fetching project id ${input.id}:`,
          e
        );
        // Re-throw to the client
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch project from database.",
          cause: e
        });
      }
      // --- End of Debugging Block ---
    }),

  getMany: protectedProcedure.query(async ({ ctx }) => {
    const projects = await prisma.project.findMany({
      where: {
        userId: ctx.auth.userId
      },
      orderBy: { updatedAt: "desc" }
    });
    return projects;
  }),

  create: protectedProcedure
    .input(
      z.object({
        value: z
          .string()
          .min(1, { message: "Prompt is required" })
          .max(10000, { message: "Prompt cannot exceed 10000 characters" })
      })
    )
    .mutation(async ({ input, ctx }) => {
      const createdProject = await prisma.project.create({
        data: {
          userId: ctx.auth.userId,
          name: generateSlug(2, {
            format: "kebab"
          }),
          messages: {
            create: {
              content: input.value,
              role: "USER",
              type: "RESULT"
            }
          }
        }
      });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: createdProject.id
        }
      });

      return createdProject;
    })
});
