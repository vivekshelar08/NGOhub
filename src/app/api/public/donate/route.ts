import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const donateSchema = z.object({
  donorName: z.string().min(1),
  donorEmail: z.string().email().optional(),
  donorPan: z.string().optional(),
  amount: z.number().positive(),
  purpose: z.string().optional(),
});

/** Public donation intent — records pending donation; payment gateway hooks via org Razorpay keys. */
export async function POST(request: Request) {
  const parsed = donateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const org = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  if (!adminUser) {
    return NextResponse.json({ error: "Organization not ready for donations" }, { status: 503 });
  }

  const year = new Date().getFullYear();
  const receiptNumber = `PUB-${year}-${Math.floor(Math.random() * 90000) + 10000}`;

  const donation = await prisma.donation.create({
    data: {
      donorName: parsed.data.donorName,
      donorPan: parsed.data.donorPan,
      amount: parsed.data.amount,
      donationDate: new Date(),
      receiptNumber,
      purpose: parsed.data.purpose ?? "General donation",
      paymentMode: org?.razorpayKeyId ? "ONLINE_PENDING" : "INTENT",
      recordedById: adminUser.id,
      is80GEligible: true,
    },
  });

  return NextResponse.json({
    message: "Thank you! Your donation intent has been recorded. Our team will contact you to complete payment.",
    receiptNumber: donation.receiptNumber,
    razorpayEnabled: !!org?.razorpayKeyId,
  });
}

export async function GET() {
  const org = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    orgName: org?.orgName ?? "SVITECH Foundation",
    orgAddress: org?.orgAddress,
    org80G: org?.org80G,
    razorpayEnabled: !!org?.razorpayKeyId,
  });
}
