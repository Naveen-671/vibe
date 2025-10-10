// // src/app/api/usage/status/route.ts
// import { NextResponse, NextRequest } from "next/server";
// import { getAuth } from "@clerk/nextjs/server";
// import { getUsageForUser } from "@/lib/usage"; // implement this on the server

// export async function GET(req: Request) {
//   // Cast inline so we don't create an unused local variable.
//   const auth = getAuth(req as unknown as NextRequest);
//   const userId = auth.userId;

//   // If not signed in, return null (your client expects null)
//   if (!userId) {
//     return NextResponse.json(null);
//   }

//   try {
//     const usage = await getUsageForUser(userId);
//     return NextResponse.json(usage);
//   } catch (err) {
//     const msg = err instanceof Error ? err.message : "Unknown server error";
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// src/app/api/usage/status/route.ts
import { NextResponse } from "next/server";
import { getUsageStatus } from "@/lib/usage";

/**
 * Minimal shape we expect from the rate-limiter result.
 * We don't import external types here to avoid coupling; instead we
 * validate the runtime shape and only return the numeric fields the client needs.
 */
type UsageApiResponse = {
  remainingPoints: number;
  msBeforeNext: number;
} | null;

function isUsageShape(obj: unknown): obj is { remainingPoints: number; msBeforeNext: number } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "remainingPoints" in obj &&
    "msBeforeNext" in obj &&
    typeof (obj as Record<string, unknown>).remainingPoints === "number" &&
    typeof (obj as Record<string, unknown>).msBeforeNext === "number"
  );
}

export async function GET() {
  try {
    const status: unknown = await getUsageStatus();

    // unauthenticated or no status
    if (status === null) {
      return NextResponse.json(null);
    }

    // If the shape matches what we expect, map to the API response.
    if (isUsageShape(status)) {
      const response: UsageApiResponse = {
        remainingPoints: status.remainingPoints,
        msBeforeNext: status.msBeforeNext,
      };
      return NextResponse.json(response);
    }

    // If the underlying library returned something different, try to extract numerics safely.
    if (typeof status === "object" && status !== null) {
      const record = status as Record<string, unknown>;
      const remainingPoints =
        typeof record.remainingPoints === "number" ? record.remainingPoints : 0;
      const msBeforeNext = typeof record.msBeforeNext === "number" ? record.msBeforeNext : 0;

      const response: UsageApiResponse = {
        remainingPoints,
        msBeforeNext,
      };
      return NextResponse.json(response);
    }

    // Fallback: unknown shape -> return null so client treats it as no usage info.
    return NextResponse.json(null);
  } catch (err) {
    // If the getUsageStatus() implementation throws because of unauthenticated user,
    // detect that and return null (client treats null as unauthenticated/no-usage).
    if (err instanceof Error) {
      const msg = err.message ?? "";
      if (/not authenticated/i.test(msg) || /user not authenticated/i.test(msg)) {
        return NextResponse.json(null);
      }
    }

    // Log server error and return a JSON error payload (no HTML).
    console.error("API /api/usage/status error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
