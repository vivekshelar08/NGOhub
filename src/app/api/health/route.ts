import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSupabaseHealth } from "@/lib/supabase";

export async function GET() {
  let database: { ok: boolean; error?: string } = { ok: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true };
  } catch (error) {
    database = {
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }

  const supabase = await checkSupabaseHealth();

  const healthy = database.ok && (!supabase.configured || supabase.ok);

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      supabase,
    },
    { status: healthy ? 200 : 503 }
  );
}
