// import { RateLimiterPrisma } from "rate-limiter-flexible";

// import { prisma } from "@/lib/db";
// import { auth } from "@clerk/nextjs/server";

// const FREE_POINTS = 5;
// const PRO_POINTS = 500;
// const DURATION = 30 * 24 * 60 * 60; // 30 days
// const GENERATION_COST = 1;

// export async function getUsageTracker() {
//   const { has } = await auth();
//   const hasProAcess = has({ plan: "pro" });
//   const usageTracker = new RateLimiterPrisma({
//     storeClient: prisma,
//     tableName: "Usage",
//     points: hasProAcess ? PRO_POINTS : FREE_POINTS,
//     duration: DURATION
//   });
//   return usageTracker;
// }

// export async function consumeCredit() {
//   const { userId } = await auth();
//   if (!userId) {
//     throw new Error("User not authenticated");
//   }

//   const usageTracker = await getUsageTracker();
//   const result = await usageTracker.consume(userId, GENERATION_COST);
//   return result;
// }

// export async function getUsageStatus() {
//   const { userId } = await auth();
//   if (!userId) {
//     throw new Error("User not authenticated");
//   }

//   const usageTracker = await getUsageTracker();
//   const result = await usageTracker.get(userId);
//   return result;
// }

// src/lib/usage.ts
import { RateLimiterPrisma } from "rate-limiter-flexible";
import type { RateLimiterRes } from "rate-limiter-flexible";

import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

const FREE_POINTS = 15;
const PRO_POINTS = 700;
const DURATION = 7 * 24 * 60 * 60; // 30 days
const GENERATION_COST = 1;

/**
 * Create a RateLimiterPrisma configured for the given points.
 * This is a pure helper so callers can control the points value.
 */
function makeUsageTracker(points: number) {
  return new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "Usage",
    points,
    duration: DURATION,
  });
}

/**
 * Original behaviour: create a tracker based on the current authenticated user's plan.
 * This uses Clerk's server `auth()` and therefore is only suitable within a request context.
 */
export async function getUsageTracker() {
  const { has } = await auth();
  const hasProAccess = has({ plan: "pro" });
  const points = hasProAccess ? PRO_POINTS : FREE_POINTS;
  return makeUsageTracker(points);
}

/**
 * Consume a credit for the current authenticated user (throws if unauthenticated).
 */
export async function consumeCredit() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  // getUsageTracker uses auth() internally so it will choose the right plan for this user
  const usageTracker = await getUsageTracker();
  const result = await usageTracker.consume(userId, GENERATION_COST);
  return result;
}

/**
 * Get the limiter entry for the current authenticated user (throws if unauthenticated).
 * Returns RateLimiterRes | null (the native return from rate-limiter-flexible)
 */
export async function getUsageStatus(): Promise<RateLimiterRes | null> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.get(userId);
  return result;
}

/**
 * Server helper: get usage for a given userId (caller already resolved auth).
 * - If the current request auth() identifies the same userId, this will use that user's plan.
 * - Otherwise it falls back to FREE_POINTS (change this if you want to look up arbitrary users' plans).
 *
 * Returns normalized shape { remainingPoints, msBeforeNext } with safe defaults.
 */
export async function getUsageForUser(userId: string): Promise<{ remainingPoints: number; msBeforeNext: number }> {
  if (!userId) {
    return { remainingPoints: 0, msBeforeNext: 0 };
  }

  // Default to free bucket. If we can detect the same user via auth(), use their plan.
  let pointsBucket = FREE_POINTS;
  try {
    const currentAuth = await auth();
    if (currentAuth.userId === userId) {
      // we can call has() safely for the same-authenticated user in this request
      const hasPro = currentAuth.has({ plan: "pro" });
      pointsBucket = hasPro ? PRO_POINTS : FREE_POINTS;
    } else {
      // If you want to detect plan for arbitrary userIds (not the request user),
      // you would need to call appropriate admin APIs (Clerk Admin) here.
      // For now we conservatively assume FREE_POINTS for other users.
      pointsBucket = FREE_POINTS;
    }
  } catch {
    // If auth fails for some reason, fall back to FREE_POINTS
    pointsBucket = FREE_POINTS;
  }

  try {
    const tracker = makeUsageTracker(pointsBucket);
    const res: RateLimiterRes | null = await tracker.get(userId);
    if (!res) {
      // no record -> full allotment still available
      return { remainingPoints: pointsBucket, msBeforeNext: 0 };
    }

    const remainingPoints = typeof res.remainingPoints === "number" ? res.remainingPoints : 0;
    const msBeforeNext = typeof res.msBeforeNext === "number" ? res.msBeforeNext : 0;
    return { remainingPoints, msBeforeNext };
  } catch {
    // On any error return safe defaults so callers don't crash
    return { remainingPoints: pointsBucket, msBeforeNext: 0 };
  }
}
