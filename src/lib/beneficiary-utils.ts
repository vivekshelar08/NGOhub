import { prisma } from "@/lib/prisma";

export async function generateBeneficiaryCode(): Promise<string> {
  const count = await prisma.beneficiary.count();
  const nextNum = count + 1;
  return `BNF-${String(nextNum).padStart(6, "0")}`;
}

export function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  return Number(value);
}
