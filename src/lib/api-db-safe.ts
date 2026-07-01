import { Prisma } from "@/generated/prisma/client";

/** True when production DB is behind app schema (missing table/column). */
export function isPrismaSchemaMismatch(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /does not exist|column .* does not exist|Unknown column|FieldVisitLog|isEmergency|requirePunchForFieldTasks/i.test(
    msg
  );
}

export function schemaMismatchMessage(): string {
  return "Database schema update required — run npx prisma db push on the server.";
}
