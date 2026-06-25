import { NextResponse } from "next/server";
import { runSetupCheck } from "@/lib/setup-check";

export async function GET() {
  const result = await runSetupCheck();
  return NextResponse.json(result);
}
