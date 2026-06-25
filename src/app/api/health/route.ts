import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSupabaseHealth } from "@/lib/supabase";
import { getDatabaseConnectionHint } from "@/lib/auth-errors";

function getDatabaseUserHint(): string | null {
  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  const userMatch = connectionString.match(/^postgres(ql)?:\/\/([^:]+):/i);
  return userMatch?.[2] ?? null;
}

export async function GET() {
  let database: { ok: boolean; error?: string; user?: string; host?: string } = { ok: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true };
  } catch (error) {
    database = {
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }

  const user = getDatabaseUserHint();
  const host = getDatabaseConnectionHint();
  if (user) database.user = user;
  if (host) database.host = host;

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
