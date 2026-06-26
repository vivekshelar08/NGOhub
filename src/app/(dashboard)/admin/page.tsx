import { Activity, Server, ShieldCheck, Users } from "lucide-react";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";

const stats = [
  {
    label: "Active Users",
    value: "—",
    icon: Users,
    accent: "from-brand-blue/20 to-brand-blue/5 text-brand-blue",
  },
  {
    label: "System Status",
    value: "Healthy",
    icon: Server,
    accent: "from-brand-teal/20 to-brand-teal/5 text-brand-teal-light",
  },
  {
    label: "Recent Events",
    value: "—",
    icon: Activity,
    accent: "from-brand-red/20 to-brand-red/5 text-brand-red",
  },
  {
    label: "Security",
    value: "Protected",
    icon: ShieldCheck,
    accent: "from-amber-500/20 to-amber-600/5 text-amber-500",
  },
];

export default function AdminPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Administration"
        title="Command Center"
        description="Monitor platform health, manage users, and configure global settings."
      />

      <div className="relative mb-8 overflow-hidden rounded-2xl border border-brand-teal/20 bg-gradient-to-br from-brand-ink via-brand-ink-light to-brand-teal-dark p-8 shadow-card md:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-red/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-brand-teal/20 blur-3xl" />
        <p className="relative text-lg font-semibold text-white">
          Welcome to SVITECH Foundation Admin
        </p>
        <p className="relative mt-2 max-w-2xl text-sm text-slate-300">
          Education · Technology · Community — manage your NGO platform from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="page-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br p-3 ${stat.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-brand-ink">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="page-card">
          <h2 className="text-base font-bold text-brand-ink">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Common administrative tasks.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {["Invite a new team member", "Review latest system logs", "Update organization settings"].map(
              (item) => (
                <li
                  key={item}
                  className="rounded-xl border border-dashed border-brand-teal/25 bg-brand-mist/50 px-4 py-3 text-slate-600"
                >
                  {item}
                </li>
              )
            )}
          </ul>
        </section>

        <section className="page-card">
          <h2 className="text-base font-bold text-brand-ink">Platform overview</h2>
          <p className="mt-1 text-sm text-slate-500">Real-time metrics coming soon.</p>
          <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-brand-blue/25 bg-brand-blue-light/30 text-sm text-brand-blue">
            Analytics placeholder
          </div>
        </section>
      </div>
    </PageShell>
  );
}
