import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCTION_SCHEMA_PATCH_SQL } from "@/lib/production-schema-patch-sql";

function isAuthorized(request: Request, userRole?: string): boolean {
  if (userRole === "ADMIN") return true;
  const key = request.headers.get("x-schema-patch-key");
  const secret = process.env.SCHEMA_PATCH_KEY ?? process.env.JWT_ACCESS_SECRET;
  return Boolean(key && secret && key === secret);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!isAuthorized(request, user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const connectionString =
    process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
  });

  try {
    await pool.query(PRODUCTION_SCHEMA_PATCH_SQL);
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Beneficiary' AND column_name = 'cohorts'`
    );
    if (check.rows.length === 0) {
      return NextResponse.json(
        { error: "Patch ran but Beneficiary.cohorts column is still missing" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      message: "Production schema patch applied. Beneficiary.cohorts is ready.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schema patch failed";
    console.error("[POST /api/admin/schema-patch]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
