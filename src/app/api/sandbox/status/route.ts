import { NextResponse } from "next/server";

/**
 * HEAD /api/sandbox/status
 * Returns 200 if sandbox active, 503 if not.
 */
export async function HEAD() {
  const isActive = true; // TODO: replace with real sandbox logic
  return isActive
    ? new NextResponse(null, { status: 200 })
    : new NextResponse(null, { status: 503 });
}

/**
 * GET /api/sandbox/status
 * Optional: for debugging, returns JSON.
 */
export async function GET() {
  const isActive = true; // TODO: same logic as above
  return NextResponse.json({ active: isActive });
}
