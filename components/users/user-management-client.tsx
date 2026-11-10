"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LogIn,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { hasPermission, ROLE_METADATA } from "@/lib/permissions/rbac";
import { formatWibDateTime } from "@/lib/utils";
import type {
  SessionUser,
  User,
  UserRole,
  UserStatus,
} from "@/types/domain";

const ROLES: UserRole[] = ["Admin", "IT Manager", "Technician", "Requestor"];
const STATUSES: UserStatus[] = ["Active", "Inactive", "Suspended"];

interface UserManagementClientProps {
  initialUsers: User[];
  sessionUser: SessionUser;
}

export function UserManagementClient({
  initialUsers,
  sessionUser,
}: UserManagementClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canManageUsers = hasPermission(sessionUser.role, "users:manage");

  const filteredUsers = useMemo(() => {
    return initialUsers.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q);
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [initialUsers, search, roleFilter]);

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: String(formData.get("email") || "")
        .trim()
        .toLowerCase(),
      full_name: String(formData.get("full_name") || "").trim(),
      role: String(formData.get("role") || "Requestor"),
      department: String(formData.get("department") || "Front Office").trim(),
      phone_whatsapp: String(formData.get("phone_whatsapp") || "").trim(),
      status: String(formData.get("status") || "Active"),
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Failed to add user.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Added user ${json.data.full_name} (${json.data.email}) with role ${json.data.role}.`,
        });
        setCreateOpen(false);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error while creating user.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    setFeedback(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      user_id: editingUser.user_id,
      role: String(formData.get("role") || editingUser.role),
      department: String(formData.get("department") || editingUser.department),
      status: String(formData.get("status") || editingUser.status),
    };

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Failed to update user.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Updated ${editingUser.email} -> Role: ${payload.role}, Status: ${payload.status}.`,
        });
        setEditingUser(null);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error while updating user.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginAsUser(email: string) {
    setFeedback(null);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "email_login",
        email,
      }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setFeedback({
        type: "success",
        text: `Signed in as ${json.data.full_name} (${json.data.role}).`,
      });
      router.refresh();
    } else {
      setFeedback({
        type: "error",
        text: json.error?.message || "Could not sign in as user.",
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            User Management & Google SSO Access (`Users` Tab)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authorized hotel staff accounts, assign RBAC roles (`Admin`,
            `IT Manager`, `Technician`, `Requestor`), and control Google SSO
            access
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageUsers ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Authorized User
            </Button>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <ShieldAlert className="h-3.5 w-3.5" />
              View-Only for {sessionUser.role} (Switch to Admin to Edit)
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-rose-300 bg-rose-50 text-rose-900"
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            {feedback.text}
          </span>
          <button
            onClick={() => setFeedback(null)}
            className="underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user by name, email (@...), or department..."
                className="pl-9"
              />
            </div>
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="ALL">All Roles ({initialUsers.length})</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r} — {ROLE_METADATA[r].labelId}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">
            Registered Hotel Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            Users registered in Google Spreadsheet `Users` tab. Disabled /
            Suspended users are automatically blocked from logging in.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {filteredUsers.map((user) => {
            const isCurrentSession =
              user.email.toLowerCase() === sessionUser.email.toLowerCase();
            return (
              <div
                key={user.user_id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:border-indigo-200 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900">
                      {user.full_name}
                    </span>
                    {isCurrentSession && (
                      <Badge variant="default">Current Active User</Badge>
                    )}
                    <Badge
                      variant={
                        user.status === "Active"
                          ? "success"
                          : user.status === "Suspended"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {user.status}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        ROLE_METADATA[user.role]?.badgeClass || ""
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {user.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-mono font-medium text-indigo-700">
                      {user.email}
                    </span>{" "}
                    • Department: <strong>{user.department}</strong>
                    {user.phone_whatsapp ? ` • WA: ${user.phone_whatsapp}` : ""}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Last Login:{" "}
                    {user.last_login_at
                      ? formatWibDateTime(user.last_login_at)
                      : "Never signed in yet"}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canManageUsers && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUser(user)}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      Edit Role / Status
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add New User Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Add Authorized User (`Users` Tab)
                </h3>
                <p className="text-xs text-slate-500">
                  Pre-authorize a Google account email and assign its RBAC role
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label>Google / Work Email Address *</Label>
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="e.g. staff.it@gmail.com or @hotel.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Full Name *</Label>
                <Input
                  name="full_name"
                  required
                  placeholder="e.g. Andi Pratama"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Assigned RBAC Role *</Label>
                  <select
                    name="role"
                    defaultValue="Technician"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Account Status *</Label>
                  <select
                    name="status"
                    defaultValue="Active"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Hotel Department *</Label>
                <Input
                  name="department"
                  defaultValue="Information Technology"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp / Extension (Optional)</Label>
                <Input
                  name="phone_whatsapp"
                  placeholder="e.g. +62-812-xxxx-xxxx"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save User to Sheet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Edit User Role & Access
                </h3>
                <p className="text-xs text-slate-500">
                  {editingUser.full_name} ({editingUser.email})
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label>Assigned RBAC Role *</Label>
                <select
                  name="role"
                  defaultValue={editingUser.role}
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r} — {ROLE_METADATA[r].labelId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Hotel Department *</Label>
                <Input
                  name="department"
                  defaultValue={editingUser.department}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Account Status *</Label>
                <select
                  name="status"
                  defaultValue={editingUser.status}
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Updating..." : "Update User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
