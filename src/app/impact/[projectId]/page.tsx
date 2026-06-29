import { prisma } from "@/lib/prisma";
import { getPublicImpactData } from "@/lib/public-impact";
import { notFound } from "next/navigation";

export default async function PublicImpactPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const data = await getPublicImpactData(prisma, projectId);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm font-medium text-brand-teal">Public impact report</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{data.projectName}</h1>
        {data.summary && <p className="mt-4 text-lg text-slate-600">{data.summary}</p>}

        {data.sdgTags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {data.sdgTags.map((tag) => (
              <span key={tag} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                SDG {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {data.beneficiariesReached != null && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Beneficiaries reached</p>
              <p className="text-2xl font-bold">{data.beneficiariesReached.toLocaleString("en-IN")}</p>
            </div>
          )}
          {data.budget && (
            <>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Budget</p>
                <p className="text-2xl font-bold">
                  {data.budget.total != null ? `₹${data.budget.total.toLocaleString("en-IN")}` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Utilized</p>
                <p className="text-2xl font-bold">₹{data.budget.spent.toLocaleString("en-IN")}</p>
              </div>
            </>
          )}
        </div>

        {data.milestones.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Milestones</h2>
            <ul className="mt-4 space-y-2">
              {data.milestones.map((m) => (
                <li key={m.name} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                  <span>{m.name}</span>
                  <span className="text-sm text-slate-500">{Math.round(m.achievementPct)}% achieved</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-center text-xs text-slate-400">
          Published {data.publishedAt ? new Date(data.publishedAt).toLocaleDateString("en-IN") : ""} · No personal data shown
        </p>
      </div>
    </div>
  );
}
