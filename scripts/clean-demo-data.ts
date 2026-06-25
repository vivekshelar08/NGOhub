import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SAMPLE_SERVICE_NAMES = [
  "Aadhaar Enrollment",
  "PMJJBY Insurance",
  "Digital Literacy Training",
];

async function main() {
  console.log("Cleaning operational demo data…");

  await prisma.deliveryStepProgress.deleteMany();
  await prisma.beneficiaryFollowUp.deleteMany();
  await prisma.serviceDelivery.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.activityRequest.deleteMany();
  await prisma.leaveApplication.deleteMany();
  await prisma.employeeLeaveBalance.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.payrollLine.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.enrollmentInvite.deleteMany();
  await prisma.refreshToken.deleteMany();

  const sampleServices = await prisma.service.findMany({
    where: { name: { in: SAMPLE_SERVICE_NAMES } },
    select: { id: true },
  });
  if (sampleServices.length > 0) {
    await prisma.serviceStep.deleteMany({
      where: { serviceId: { in: sampleServices.map((s) => s.id) } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: sampleServices.map((s) => s.id) } },
    });
  }

  console.log("Removed beneficiaries, deliveries, activity requests, and sample services.");
  console.log(
    "Clear browser localStorage keys: ngo-hub-projects, ngo-hub-activities, ngo-hub-donors (or reload the app after deploy)."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
