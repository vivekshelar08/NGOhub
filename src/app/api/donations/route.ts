import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { nextReceiptNumber } from "@/lib/donationReceipt";
import { z } from "zod";
import { resolveFinanceProjectId, resolveFundId } from "@/lib/finance-meta";
import { ensureAccountingSetup, postDonationJournal } from "@/lib/accounting";

const createSchema = z.object({
  donorId: z.string().optional(),
  donorName: z.string().min(1),
  donorPan: z.string().optional(),
  amount: z.number().positive(),
  donationDate: z.string(),
  paymentMode: z.string().optional(),
  purpose: z.string().optional(),
  projectId: z.string().optional(),
  fundId: z.string().optional(),
  financeProjectId: z.string().optional(),
  is80GEligible: z.boolean().optional(),
  receiptNumber: z.string().optional(),
});

const donationInclude = {
  recordedBy: { select: { id: true, name: true } },
  fund: { select: { id: true, code: true, name: true } },
  financeProject: { select: { id: true, code: true, name: true } },
  journalEntry: { select: { id: true, voucherNumber: true, status: true } },
} as const;

function serializeDonation(d: {
  id: string;
  donorId: string | null;
  donorName: string;
  donorPan: string | null;
  amount: { toString(): string };
  donationDate: Date;
  receiptNumber: string;
  paymentMode: string | null;
  purpose: string | null;
  projectId: string | null;
  fundId: string | null;
  financeProjectId: string | null;
  is80GEligible: boolean;
  createdAt: Date;
  recordedBy: { id: string; name: string };
  fund: { id: string; code: string; name: string } | null;
  financeProject: { id: string; code: string; name: string } | null;
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
}) {
  return {
    id: d.id,
    donorId: d.donorId,
    donorName: d.donorName,
    donorPan: d.donorPan,
    amount: Number(d.amount),
    donationDate: d.donationDate.toISOString().slice(0, 10),
    receiptNumber: d.receiptNumber,
    paymentMode: d.paymentMode,
    purpose: d.purpose,
    projectId: d.projectId,
    fundId: d.fundId,
    financeProjectId: d.financeProjectId,
    is80GEligible: d.is80GEligible,
    fund: d.fund,
    financeProject: d.financeProject,
    journalEntry: d.journalEntry,
    recordedBy: d.recordedBy,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const donations = await prisma.donation.findMany({
    orderBy: { donationDate: "desc" },
    take: 200,
    include: donationInclude,
  });

  return NextResponse.json({ donations: donations.map(serializeDonation) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.donations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid donation" }, { status: 400 });
  }

  const fundId = await resolveFundId(prisma, { fundId: parsed.data.fundId });
  const financeProjectId = await resolveFinanceProjectId(prisma, {
    financeProjectId: parsed.data.financeProjectId,
    projectId: parsed.data.projectId,
  });

  const receiptNumber = parsed.data.receiptNumber ?? nextReceiptNumber();
  const donation = await prisma.donation.create({
    data: {
      donorId: parsed.data.donorId,
      donorName: parsed.data.donorName,
      donorPan: parsed.data.donorPan,
      amount: parsed.data.amount,
      donationDate: new Date(parsed.data.donationDate),
      paymentMode: parsed.data.paymentMode,
      purpose: parsed.data.purpose,
      projectId: parsed.data.projectId,
      fundId,
      financeProjectId,
      is80GEligible: parsed.data.is80GEligible ?? true,
      receiptNumber,
      recordedById: user.id,
    },
    include: donationInclude,
  });

  let journalWarning: string | undefined;
  try {
    await ensureAccountingSetup(prisma);
    const entry = await postDonationJournal(prisma, donation.id, user.id);
    if (!entry) journalWarning = "Donation saved but journal was not posted.";
  } catch (error) {
    journalWarning =
      error instanceof Error ? `GL posting failed: ${error.message}` : "GL posting failed.";
  }

  const refreshed = await prisma.donation.findUnique({
    where: { id: donation.id },
    include: donationInclude,
  });

  return NextResponse.json({
    donation: serializeDonation(refreshed ?? donation),
    journalWarning,
  });
}
