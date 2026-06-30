import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { syncCatalogContributionRules } from "@/lib/community-contribution";
import { z } from "zod";

const syncCatalogSchema = z.object({
  projectId: z.string().min(1),
  catalog: z.array(
    z.object({
      linkedServiceId: z.string().uuid().optional(),
      communityContributionAmount: z.number().positive().optional(),
      communityContributionRecipientType: z.enum(["NGO", "PARTNER"]).optional(),
      communityContributionPartnerName: z.string().max(200).optional(),
    })
  ),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = syncCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { projectId, catalog } = parsed.data;
  const items = catalog
    .filter((c) => c.linkedServiceId && c.communityContributionAmount)
    .map((c) => ({
      id: "",
      name: "",
      description: "",
      totalActivityCount: 0,
      totalBeneficiaries: 0,
      linkedServiceId: c.linkedServiceId,
      communityContributionAmount: c.communityContributionAmount,
      communityContributionRecipientType: c.communityContributionRecipientType,
      communityContributionPartnerName: c.communityContributionPartnerName,
    }));

  await syncCatalogContributionRules(projectId, items);
  return NextResponse.json({ synced: items.length });
}
