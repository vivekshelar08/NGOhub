import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { nextReceiptNumber } from "@/lib/donationReceipt";
import { z } from "zod";

const createSchema = z.object({
  donorId: z.string().optional(),
  donorName: z.string().min(1),
  donorPan: z.string().optional(),
  amount: z.number().positive(),
  donationDate: z.string(),
  paymentMode: z.string().optional(),
  purpose: z.string().optional(),
  projectId: z.string().optional(),
  is80GEligible: z.boolean().optional(),
  receiptNumber: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const donations = await prisma.donation.findMany({
    orderBy: { donationDate: "desc" },
    take: 200,
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    donations: donations.map((d) => ({
      ...d,
      amount: Number(d.amount),
      donationDate: d.donationDate.toISOString().slice(0, 10),
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid donation" }, { status: 400 });
  }

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
      is80GEligible: parsed.data.is80GEligible ?? true,
      receiptNumber,
      recordedById: user.id,
    },
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  const { ensureAccountingSetup, postDonationJournal } = await import("@/lib/accounting");
  try {
    await ensureAccountingSetup(prisma);
    await postDonationJournal(prisma, donation.id, user.id);
  } catch (error) {
    console.error("Donation journal posting failed:", error);
  }

  return NextResponse.json({
    donation: {
      ...donation,
      amount: Number(donation.amount),
      donationDate: donation.donationDate.toISOString().slice(0, 10),
      createdAt: donation.createdAt.toISOString(),
    },
  });
}
