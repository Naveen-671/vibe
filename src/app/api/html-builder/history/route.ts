
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { code, prompt } = body;

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        // 1. Find or Create the "HTML Builder Workspace" project for this user
        let project = await prisma.project.findFirst({
            where: {
                userId: userId,
                name: "HTML Builder Workspace",
            },
        });

        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: "HTML Builder Workspace",
                    userId: userId,
                },
            });
        }

        // 2. Create a Message (Assistant role) to represent this generation
        const message = await prisma.message.create({
            data: {
                projectId: project.id,
                role: "ASSISTANT",
                type: "RESULT",
                content: prompt || "Generated HTML Component", // Store prompt as content context
                model: "html-builder-v1",
            },
        });

        // 3. Create the Fragment to store the actual file
        const fragment = await prisma.fragment.create({
            data: {
                messageId: message.id,
                title: prompt ? prompt.substring(0, 50) : "Untitled Component",
                sandboxUrl: "html-builder", // generic marker
                files: {
                    "index.html": code
                },
            },
        });

        return NextResponse.json({ success: true, fragmentId: fragment.id });

    } catch (error: any) {
        console.error("[HTML History POST] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Find the project
        const project = await prisma.project.findFirst({
            where: {
                userId: userId,
                name: "HTML Builder Workspace",
            },
        });

        if (!project) {
            return NextResponse.json({ history: [] });
        }

        // 2. Get all fragments for this project, properly joined via Message
        const fragments = await prisma.fragment.findMany({
            where: {
                message: {
                    projectId: project.id
                }
            },
            include: {
                message: {
                    select: {
                        content: true, // This holds the prompt
                        createdAt: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50 // Limit history size
        });

        // 3. Format for frontend
        const history = fragments.map(f => ({
            id: f.id,
            title: f.title,
            prompt: f.message.content,
            code: (f.files as Record<string, string>)["index.html"] || "",
            createdAt: f.createdAt
        }));

        return NextResponse.json({ history });

    } catch (error: any) {
        console.error("[HTML History GET] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
