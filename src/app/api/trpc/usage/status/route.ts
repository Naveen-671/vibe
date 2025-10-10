// src/app/api/trpc/usage/status/route.ts
import { NextResponse } from "next/server";
import { appRouter } from "@/trpc/routers/_app";
import { createTRPCContext } from "@/trpc/init";

export async function GET() {
  try {
    const ctx = await createTRPCContext();
    const caller = appRouter.createCaller(ctx);
    const res = await caller.usage.status();
    return NextResponse.json(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
