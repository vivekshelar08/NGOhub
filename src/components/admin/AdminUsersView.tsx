"use client";

import { useState } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import { Role, UserStatus } from "@/generated/prisma/enums";
import { ALL_ROLES } from "@/lib/role-features";
import { formatRole } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { PageHeader, PageShell } from "@/components/ui/PageHeader";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  department: string | null;
  lastLoginAt: string | null;
}

interface AdminUsersViewProps {
  initialUsers: AdminUserRow[];
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "STAFF" as Role,
  department: "",
  phone: "",
};

export function AdminUsersView({ initialUsers }: AdminUsersViewProps) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          department: form.department.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create user");
        return;
      }

      const created = data.user as AdminUserRow & { createdAt: string };
      setUsers((prev) => [
        {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          status: created.status,
          department: created.department,
          lastLoginAt: null,
        },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess(`${created.name} was created successfully.`);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Administration"
          title="User Management"
          description="Create staff accounts and manage platform access."
        />
        <Button
          type="button"
          className="shrink-0 gap-2"
          onClick={() => {
            setShowForm((v) => !v);
            setError("");
            setSuccess("");
          }}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add user"}
        </Button>
      </div>

      {success && (
        <p className="mb-4 rounded-lg border border-brand-teal/25 bg-brand-mist px-4 py-3 text-sm text-brand-teal-dark">
          {success}
        </p>
      )}

      {showForm && (
        <Card className="mb-6 border-brand-teal/20 bg-white p-6 shadow-card">
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-brand-ink">Create user</h2>
              <p className="text-sm text-slate-500">
                New users can sign in immediately with the password you set.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                minLength={2}
                placeholder="Priya Sharma"
              />
            </div>
            <div>
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                autoComplete="off"
                placeholder="priya@organization.org"
              />
            </div>
            <div>
              <Label htmlFor="user-role">Role</Label>
              <Select
                id="user-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              >
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="user-department">Department</Label>
              <Input
                id="user-department"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Field Operations"
              />
            </div>
            <div>
              <Label htmlFor="user-phone">Phone (optional)</Label>
              <Input
                id="user-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="9876543210"
              />
            </div>
            <div />
            <div>
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <Label htmlFor="user-confirm">Confirm password</Label>
              <Input
                id="user-confirm"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="sm:col-span-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create user"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden border-slate-200 bg-white p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No users yet. Create the first account above.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-brand-ink">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge role={u.role} />
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {u.status.toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.department ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  );
}
