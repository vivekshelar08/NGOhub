import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { updateContributionCollectionStatus } from "@/lib/community-contribution";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  collectionStatus: z.enum(["COLLECTED", "PENDING"]),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const entry = await updateContributionCollectionStatus(id, parsed.data.collectionStatus);
    return NextResponse.json({
      entry: {
        id: entry.id,
        collectionStatus: entry.collectionStatus,
        collectedAt: entry.collectedAt?.toISOString() ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Contribution entry not found" }, { status: 404 });
  }
}
