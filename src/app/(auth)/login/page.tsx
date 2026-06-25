"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Heart, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { AuthUser } from "@/types/auth";
import type { SetupCheckResult } from "@/lib/setup-check";

const highlights = [
  { icon: Users, label: "Beneficiaries" },
  { icon: Heart, label: "Programs" },
  { icon: Shield, label: "Secure access" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [setupIssues, setSetupIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/login/setup-check", { credentials: "same-origin" })
      .then((res) => res.json() as Promise<SetupCheckResult>)
      .then((result) => {
        if (!result.ok) {
          setSetupIssues(result.issues);
        }
      })
      .catch(() => {
        // Setup check is advisory; login errors still surface on submit.
      });
  }, []);

  async function signIn(loginEmail: string, loginPassword: string) {
    setError("");

    const res = await fetch("/login/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      credentials: "same-origin",
    });

    const data = (await res.json()) as { user?: AuthUser; error?: string };
    if (!res.ok || data.error) {
      throw new Error(data.error ?? "Login failed");
    }

    window.location.assign("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 text-center sm:px-8">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500">Sign in to manage your NGO programs</p>

        <div className="mt-4 flex items-center justify-center gap-6">
          {highlights.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@organization.org"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {setupIssues.length > 0 && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
              role="status"
            >
              <p className="font-medium">Server setup needed</p>
              <ul className="mt-1 list-disc pl-4">
                {setupIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p
              className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Signing in..." : "Sign in to NGO Hub"}
          </Button>
        </form>
      </div>
    </div>
  );
}
