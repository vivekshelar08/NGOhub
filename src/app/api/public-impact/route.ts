import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listPublishedImpactPages, upsertPublicProjectPage } from "@/lib/public-impact";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

export async function GET() {
  const pages = await listPublishedImpactPages(prisma);
  return NextResponse.json({
    pages: pages.map((p) => ({
      legacyProjectId: p.legacyProjectId ?? p.financeProject.legacyProjectId,
      projectName: p.financeProject.name,
      summary: p.summary,
      sdgTags: p.sdgTags,
      publishedAt: p.publishedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = z
    .object({
      financeProjectId: z.string(),
      legacyProjectId: z.string().optional(),
      isPublished: z.boolean().optional(),
      summary: z.string().optional(),
      sdgTags: z.array(z.string()).optional(),
      showBudget: z.boolean().optional(),
      showBeneficiaries: z.boolean().optional(),
    })
    .safeParse(await request.json());

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const page = await upsertPublicProjectPage(prisma, parsed.data.financeProjectId, parsed.data);
  return NextResponse.json({ page: { id: page.id, isPublished: page.isPublished } });
}
