import { NextResponse } from "next/server";

/** Liveness probe — always 200 so Hostinger does not kill the app when DB is slow. */
export async function GET() {
  return NextResponse.json({ status: "alive" });
}
