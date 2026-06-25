import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { deliveryActionSchema, serviceDeliveryStatusSchema } from "@/lib/validators";
import {
  advanceDeliveryStep,
  approveDelivery,
  clearDeliveryObjection,
  fetchDeliveryWithProgress,
  raiseDeliveryObjection,
  rejectDelivery,
  serializeDelivery,
  setLegacyDeliveryStatus,
} from "@/lib/delivery-actions";
import { assertCanManageDelivery } from "@/lib/delivery-permissions";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await fetchDeliveryWithProgress(id);
  if (!existing) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  if (body.action) {
    const parsed = deliveryActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    try {
      assertCanManageDelivery(user.role, user.id, existing.enteredById);
      let delivery;
      switch (parsed.data.action) {
        case "approve":
          delivery = await approveDelivery(id, user.id);
          break;
        case "advance_step":
          delivery = await advanceDeliveryStep(id, user.id, parsed.data.note);
          break;
        case "objection":
          if (!parsed.data.note?.trim()) {
            return NextResponse.json({ error: "Objection note is required" }, { status: 400 });
          }
          delivery = await raiseDeliveryObjection(id, user.id, parsed.data.note.trim());
          break;
        case "clear_objection":
          delivery = await clearDeliveryObjection(
            id,
            user.id,
            parsed.data.resolutionNote ?? parsed.data.note
          );
          break;
        case "reject":
          delivery = await rejectDelivery(id, user.id, parsed.data.note);
          break;
      }
      return NextResponse.json({ delivery: serializeDelivery(delivery!) });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Action failed" },
        { status: 400 }
      );
    }
  }

  const parsed = serviceDeliveryStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    assertCanManageDelivery(user.role, user.id, existing.enteredById);
    const delivery = await setLegacyDeliveryStatus(
      id,
      user.id,
      parsed.data.status,
      parsed.data.notes
    );
    return NextResponse.json({ delivery: serializeDelivery(delivery) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const delivery = await fetchDeliveryWithProgress(id);

  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  return NextResponse.json({
    delivery: serializeDelivery(delivery),
  });
}
