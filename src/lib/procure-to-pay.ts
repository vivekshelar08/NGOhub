import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  VendorBillStatus,
} from "@/generated/prisma/enums";
import { checkBudgetEncumbrance } from "@/lib/finance-meta";

type Db = PrismaClient | Prisma.TransactionClient;

export interface CreatePurchaseRequestInput {
  financeProjectId?: string;
  milestoneBudgetId?: string;
  vendorId?: string;
  budgetHead?: string;
  description: string;
  amount: number;
  userId: string;
}

export async function createPurchaseRequest(prisma: Db, input: CreatePurchaseRequestInput) {
  const requestNumber = `PR-${Date.now().toString(36).toUpperCase()}`;
  return prisma.purchaseRequest.create({
    data: {
      requestNumber,
      financeProjectId: input.financeProjectId,
      milestoneBudgetId: input.milestoneBudgetId,
      vendorId: input.vendorId,
      budgetHead: input.budgetHead,
      description: input.description,
      amount: input.amount,
      status: PurchaseRequestStatus.PENDING,
      requestedById: input.userId,
    },
  });
}

export async function approvePurchaseRequest(prisma: Db, requestId: string, notes?: string) {
  const req = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("Purchase request not found");
  if (req.status !== PurchaseRequestStatus.PENDING) {
    throw new Error("Request is not pending approval");
  }

  if (req.financeProjectId) {
    const check = await checkBudgetEncumbrance(prisma as PrismaClient, {
      financeProjectId: req.financeProjectId,
      budgetHead: req.budgetHead ?? undefined,
      amount: Number(req.amount),
    });
    if (!check.ok) throw new Error(check.message ?? "Budget exceeded");
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: {
      status: PurchaseRequestStatus.APPROVED,
      approvedAt: new Date(),
      reviewNotes: notes,
    },
  });

  if (req.financeProjectId) {
    await prisma.budgetEncumbrance.create({
      data: {
        financeProjectId: req.financeProjectId,
        purchaseRequestId: requestId,
        budgetHead: req.budgetHead,
        amount: req.amount,
      },
    });
  }

  return updated;
}

export async function issuePurchaseOrder(
  prisma: Db,
  requestId: string,
  vendorId: string,
  userId: string
) {
  const req = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error("Purchase request not found");
  if (req.status !== PurchaseRequestStatus.APPROVED) {
    throw new Error("Request must be approved before issuing PO");
  }

  const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      requestId,
      vendorId,
      financeProjectId: req.financeProjectId,
      amount: req.amount,
      status: PurchaseOrderStatus.ISSUED,
      issuedAt: new Date(),
      createdById: userId,
    },
  });

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: PurchaseRequestStatus.PO_ISSUED },
  });

  return po;
}

export async function createVendorBillFromPo(
  prisma: Db,
  poId: string,
  billNumber: string,
  billDate: Date,
  userId: string,
  gstAmount = 0,
  tdsAmount = 0
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { request: true },
  });
  if (!po) throw new Error("Purchase order not found");

  const bill = await prisma.vendorBill.create({
    data: {
      vendorId: po.vendorId,
      billNumber,
      billDate,
      amount: po.amount,
      gstAmount,
      tdsAmount,
      description: po.request.description,
      status: VendorBillStatus.DRAFT,
      financeProjectId: po.financeProjectId,
      purchaseOrderId: poId,
      createdById: userId,
    },
  });

  const enc = await prisma.budgetEncumbrance.findUnique({
    where: { purchaseRequestId: po.requestId },
  });
  if (enc && !enc.released) {
    await prisma.budgetEncumbrance.update({
      where: { id: enc.id },
      data: { released: true, releasedAt: new Date() },
    });
  }

  return bill;
}

export async function createAssetFromPo(
  prisma: Db,
  poId: string,
  name: string,
  category: string,
  value: number,
  projectId?: string
) {
  return prisma.assetItem.create({
    data: {
      name,
      category,
      value,
      projectId,
      purchaseOrderId: poId,
      status: "ACTIVE",
    },
  });
}

export async function listPurchaseRequests(prisma: Db, status?: PurchaseRequestStatus) {
  return prisma.purchaseRequest.findMany({
    where: status ? { status } : undefined,
    include: {
      vendor: { select: { id: true, name: true } },
      financeProject: { select: { id: true, code: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, poNumber: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
