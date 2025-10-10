
// src/app/api/messages/create/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { consumeCredit } from "@/lib/usage";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "@/inngest/client";

const BodySchema = z.object({
  value: z.string().optional(),
  image: z.string().optional(),
  projectId: z.string().min(1),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // Parse + validate request body
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { value, image, projectId, model } = parsed.data;

    // Get server-side auth via Clerk helper
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership check
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // Validate image URL (simple checks)
    if (image && typeof image === "string") {
      const s = image.trim();
      const isDataUrl = /^data:image\/(png|jpe?g|webp);base64,/i.test(s);
      const isHttpUrl = (() => {
        try {
          const u = new URL(s);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      })();
      if (!isDataUrl && !isHttpUrl) {
        return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
      }
    }

    // Try to consume credit
    try {
      await consumeCredit();
    } catch (creditErr) {
      console.warn("consumeCredit failed", creditErr);
      return NextResponse.json({ error: "Out of credits" }, { status: 429 });
    }

    // Persist message
    const created = await prisma.message.create({
      data: {
        projectId: project.id,
        content: value?.trim() ?? "",
        imageUrl: image ?? null,
        role: "USER",
        type: "RESULT",
        model: model ?? null,
      },
    });

    // Fire-and-forget dispatch (don't let this break the API response)
    void inngest
      .send({
        name: "code-agent/run",
        data: {
          text: value ?? undefined,
          image: image ?? undefined,
          projectId,
          model: model ?? undefined,
        },
      })
      .catch(async (sendErr) => {
        // Log and persist an assistant error message record for observability
        try {
          const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          await prisma.message.create({
            data: {
              projectId: project.id,
              content: `Failed to dispatch code-agent/run: ${errMsg}`,
              role: "ASSISTANT",
              type: "ERROR",
              model: model ?? null,
            },
          });
        } catch {
          // swallow
        }
      });

    return NextResponse.json(created);
  } catch (err) {
    console.error("API /api/messages/create error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

