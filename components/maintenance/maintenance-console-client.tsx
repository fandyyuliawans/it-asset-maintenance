"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Image as ImageIcon,
  Plus,
  Trash2,
  Wrench,
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
import { hasPermission } from "@/lib/permissions/rbac";
import { formatIdr, formatWibDateTime } from "@/lib/utils";
import type {
  Asset,
  MaintenancePhoto,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTicket,
  MaintenanceType,
  SessionUser,
  User,
  WorkLog,
} from "@/types/domain";

const PRIORITIES: MaintenancePriority[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

const TYPES: MaintenanceType[] = [
  "Corrective / Breakdown",
  "Preventive",
  "Inspection",
  "Installation / Upgrade",
];

const STATUSES: MaintenanceStatus[] = [
  "Submitted",
  "Assigned",
  "In Progress",
  "Waiting Parts",
  "Resolved",
  "Closed",
  "Cancelled",
];

interface SelectedPhotoState {
  base64: string;
  name: string;
  mime: string;
  previewUrl: string;
}

/**
 * Compresses and resizes an image file (max 1280px) so uploading to Google Drive
 * via Google Apps Script is fast and reliable.
 */
async function compressImageToBase64(file: File): Promise<SelectedPhotoState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak valid."));
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Gagal memproses gambar."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({
          base64: dataUrl,
          name: file.name,
          mime: "image/jpeg",
          previewUrl: dataUrl,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface MaintenanceConsoleClientProps {
  tickets: MaintenanceTicket[];
  workLogs: WorkLog[];
  photos: MaintenancePhoto[];
  assets: Asset[];
  users: User[];
  sessionUser: SessionUser;
}

export function MaintenanceConsoleClient({
  tickets,
  workLogs,
  photos,
  assets,
  users,
  sessionUser,
}: MaintenanceConsoleClientProps) {
  const router = useRouter();
  const [filterTab, setFilterTab] = useState<"ALL" | "OPEN" | "RESOLVED">(
    "ALL"
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<MaintenanceTicket | null>(
    null
  );
  const [beforePhoto, setBeforePhoto] = useState<SelectedPhotoState | null>(
    null
  );
  const [afterPhoto, setAfterPhoto] = useState<SelectedPhotoState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canWorklog = hasPermission(sessionUser.role, "maintenance:worklog");
  const canClose = hasPermission(sessionUser.role, "maintenance:close");

  const technicians = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "Technician" ||
          u.role === "IT Manager" ||
          u.role === "Admin"
      ),
    [users]
  );

  const visibleTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filterTab === "OPEN") {
        return (
          t.status !== "Resolved" &&
          t.status !== "Closed" &&
          t.status !== "Cancelled"
        );
      }
      if (filterTab === "RESOLVED") {
        return t.status === "Resolved" || t.status === "Closed";
      }
      return true;
    });
  }, [tickets, filterTab]);

  async function handleSelectPhoto(
    e: React.ChangeEvent<HTMLInputElement>,
    stage: "Before" | "After"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await compressImageToBase64(file);
      if (stage === "Before") {
        setBeforePhoto(processed);
      } else {
        setAfterPhoto(processed);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memproses foto.",
      });
    } finally {
      e.target.value = "";
    }
  }

  async function handleCreateTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      asset_id: String(formData.get("asset_id") || ""),
      type: String(formData.get("type") || "Corrective / Breakdown"),
      priority: String(formData.get("priority") || "High"),
      title: String(formData.get("title") || ""),
      issue_description: String(formData.get("issue_description") || ""),
      assigned_technician_id:
        String(formData.get("assigned_technician_id") || "") || undefined,
      photo_base64: beforePhoto?.base64,
      photo_name: beforePhoto?.name,
      photo_mime: beforePhoto?.mime,
    };

    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Failed to submit ticket.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Tiket ${json.data.ticket_code} berhasil disimpan ke Spreadsheet${
            beforePhoto ? " beserta foto bukti ke Google Drive" : ""
          }.`,
        });
        setBeforePhoto(null);
        setCreateOpen(false);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error submitting maintenance ticket.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeTicket) return;
    setSubmitting(true);
    setFeedback(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      ticket_id: activeTicket.ticket_id,
      new_status: String(formData.get("new_status") || activeTicket.status),
      assigned_technician_id:
        String(formData.get("assigned_technician_id") || "") || undefined,
      action_taken: String(formData.get("action_taken") || ""),
      parts_replaced: String(formData.get("parts_replaced") || ""),
      time_spent_minutes: Number(formData.get("time_spent_minutes") || 30),
      downtime_minutes: Number(
        formData.get("downtime_minutes") || activeTicket.downtime_minutes || 0
      ),
      cost_idr: Number(
        formData.get("cost_idr") || activeTicket.cost_idr || 0
      ),
      root_cause: String(formData.get("root_cause") || ""),
      resolution_summary: String(formData.get("resolution_summary") || ""),
      photo_base64: afterPhoto?.base64,
      photo_name: afterPhoto?.name,
      photo_mime: afterPhoto?.mime,
    };

    try {
      const res = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Failed to update ticket status.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Status tiket ${json.data.ticket_code} diperbarui menjadi ${
            json.data.status
          }${afterPhoto ? " & foto hasil di-upload ke Google Drive" : ""}.`,
        });
        setAfterPhoto(null);
        setActiveTicket(null);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error updating ticket status.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Maintenance & Work Order Console (`Maintenance`, `WorkLogs` &
            `MaintenancePhotos`)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola tiket perbaikan, log kerja teknisi, dan upload foto
            Before/After langsung ke Google Drive & Spreadsheet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setBeforePhoto(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Maintenance Request
          </Button>
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { id: "ALL", label: `All Work Orders (${tickets.length})` },
            {
              id: "OPEN",
              label: `Active Queue (${
                tickets.filter(
                  (t) =>
                    t.status !== "Resolved" &&
                    t.status !== "Closed" &&
                    t.status !== "Cancelled"
                ).length
              })`,
            },
            {
              id: "RESOLVED",
              label: `Resolved / Closed (${
                tickets.filter(
                  (t) => t.status === "Resolved" || t.status === "Closed"
                ).length
              })`,
            },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            variant={filterTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {visibleTickets.map((ticket) => {
          const ticketLogs = workLogs.filter(
            (w) => w.ticket_id === ticket.ticket_id
          );
          const ticketPhotos = photos.filter(
            (p) => p.ticket_id === ticket.ticket_id
          );

          return (
            <Card key={ticket.ticket_id}>
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                        {ticket.ticket_code}
                      </span>
                      <Badge
                        variant={
                          ticket.priority === "Critical"
                            ? "destructive"
                            : ticket.priority === "High"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {ticket.priority} Priority
                      </Badge>
                      <Badge
                        variant={
                          ticket.status === "Resolved" ||
                          ticket.status === "Closed"
                            ? "success"
                            : "default"
                        }
                      >
                        {ticket.status}
                      </Badge>
                      <Badge variant="outline">{ticket.type}</Badge>
                    </div>
                    <CardTitle className="text-base pt-1">
                      {ticket.title}
                    </CardTitle>
                    <CardDescription>
                      Asset:{" "}
                      <strong className="text-slate-800">
                        {ticket.asset_code} — {ticket.asset_name}
                      </strong>{" "}
                      • Location: {ticket.location_name}
                    </CardDescription>
                  </div>

                  {canWorklog && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAfterPhoto(null);
                        setActiveTicket(ticket);
                      }}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Log Work / Update Status
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3 text-xs">
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {ticket.issue_description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200/70">
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Reported By
                    </span>
                    <span className="font-medium text-slate-800">
                      {ticket.reported_by_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Assigned Technician
                    </span>
                    <span className="font-medium text-slate-800">
                      {ticket.assigned_technician_name || "Unassigned"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Downtime / Repair Cost
                    </span>
                    <span className="font-medium text-slate-800">
                      {ticket.downtime_minutes}m • {formatIdr(ticket.cost_idr)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      Last Updated (WIB)
                    </span>
                    <span className="font-medium text-slate-800">
                      {formatWibDateTime(ticket.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Attached Google Drive Photos (`MaintenancePhotos` tab) */}
                {ticketPhotos.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
                      Dokumentasi Foto Google Drive ({ticketPhotos.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ticketPhotos.map((photo) => {
                        const driveHref =
                          photo.caption && photo.caption.startsWith("http")
                            ? photo.caption
                            : `https://drive.google.com/file/d/${photo.drive_file_id}/view`;
                        return (
                          <a
                            key={photo.photo_id}
                            href={driveHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 transition-colors"
                          >
                            <Badge
                              variant={
                                photo.stage === "After" ? "success" : "warning"
                              }
                            >
                              {photo.stage}
                            </Badge>
                            <span className="truncate max-w-48">
                              {photo.file_name}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Technician WorkLogs Section */}
                {ticketLogs.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
                      Technician Work Logs ({ticketLogs.length})
                    </div>
                    <div className="space-y-1.5">
                      {ticketLogs.map((wl) => (
                        <div
                          key={wl.worklog_id}
                          className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                            <span className="font-semibold text-indigo-900">
                              {wl.technician_name} ({wl.time_spent_minutes} mins)
                            </span>
                            <span>{formatWibDateTime(wl.created_at)}</span>
                          </div>
                          <div className="text-slate-800 whitespace-pre-line">
                            {wl.action_taken}
                          </div>
                          {wl.parts_replaced && (
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Parts Replaced: <strong>{wl.parts_replaced}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Maintenance Ticket Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Submit Hotel IT Maintenance Ticket
                </h3>
                <p className="text-xs text-slate-500">
                  Appends to `Maintenance`, `MaintenancePhotos` &
                  `StatusHistory` tabs
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label>Affected Hotel IT Asset *</Label>
                <select
                  name="asset_id"
                  required
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  {assets.map((a) => (
                    <option key={a.asset_id} value={a.asset_id}>
                      {a.asset_code} — {a.name} ({a.location_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Maintenance Type *</Label>
                  <select
                    name="type"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Operational Priority *</Label>
                  <select
                    name="priority"
                    defaultValue="High"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Issue Summary Title *</Label>
                <Input
                  name="title"
                  required
                  placeholder="e.g. Executive Floor 8 Wi-Fi AP Offline"
                />
              </div>

              <div className="space-y-1">
                <Label>Detailed Symptoms / Error Description *</Label>
                <textarea
                  name="issue_description"
                  required
                  rows={3}
                  placeholder="Describe the guest impact, error codes, or location details..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <Label>Assign Technician (Optional)</Label>
                <select
                  name="assigned_technician_id"
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">— Leave Unassigned (Triage Queue) —</option>
                  {technicians.map((tech) => (
                    <option key={tech.user_id} value={tech.user_id}>
                      {tech.full_name} ({tech.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Upload (Before / Evidence) */}
              <div className="space-y-1.5 pt-1">
                <Label>
                  Upload Foto Bukti Kerusakan / Kondisi Awal (Google Drive)
                </Label>
                {beforePhoto ? (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={beforePhoto.previewUrl}
                        alt="Preview Before"
                        className="h-14 w-14 rounded-lg object-cover border border-slate-200 bg-white"
                      />
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 truncate">
                          {beforePhoto.name}
                        </div>
                        <div className="text-[11px] text-indigo-700">
                          Siap di-upload ke Google Drive (`Before` Stage)
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBeforePhoto(null)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/80 p-3.5 cursor-pointer transition-colors">
                    <Camera className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-slate-700">
                      Ambil Foto Kamera / Pilih Gambar (JPG, PNG, WebP)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleSelectPhoto(e, "Before")}
                      className="hidden"
                    />
                  </label>
                )}
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
                  {submitting
                    ? "Uploading & Saving..."
                    : "Submit Ticket"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Work & Update Ticket Status Modal */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Update {activeTicket.ticket_code} & Log Work
                </h3>
                <p className="text-xs text-slate-500">
                  {activeTicket.asset_code} — {activeTicket.asset_name}
                </p>
              </div>
              <button
                onClick={() => setActiveTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>New Ticket Status *</Label>
                  <select
                    name="new_status"
                    defaultValue={activeTicket.status}
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {STATUSES.map((st) => (
                      <option
                        key={st}
                        value={st}
                        disabled={st === "Closed" && !canClose}
                      >
                        {st}{" "}
                        {st === "Closed" && !canClose
                          ? "(Requires IT Manager / Admin)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Assigned Technician</Label>
                  <select
                    name="assigned_technician_id"
                    defaultValue={activeTicket.assigned_technician_id || ""}
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="">— Unassigned —</option>
                    {technicians.map((tech) => (
                      <option key={tech.user_id} value={tech.user_id}>
                        {tech.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Technician Action Taken / WorkLog Entry *</Label>
                <textarea
                  name="action_taken"
                  required
                  rows={3}
                  placeholder="Describe diagnostic steps, configuration changes, or repairs performed..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Time Spent (mins)</Label>
                  <Input
                    type="number"
                    name="time_spent_minutes"
                    defaultValue="30"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Total Downtime (m)</Label>
                  <Input
                    type="number"
                    name="downtime_minutes"
                    defaultValue={activeTicket.downtime_minutes}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Parts Cost (IDR)</Label>
                  <Input
                    type="number"
                    name="cost_idr"
                    defaultValue={activeTicket.cost_idr}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Spare Parts Replaced (Optional)</Label>
                <Input
                  name="parts_replaced"
                  placeholder="e.g. 1x Cat6A Patch Cord / Thermal Printhead"
                />
              </div>

              {/* Photo Upload (After / Completion) */}
              <div className="space-y-1.5 pt-1">
                <Label>
                  Upload Foto Hasil Perbaikan / Selesai (Google Drive)
                </Label>
                {afterPhoto ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={afterPhoto.previewUrl}
                        alt="Preview After"
                        className="h-14 w-14 rounded-lg object-cover border border-slate-200 bg-white"
                      />
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 truncate">
                          {afterPhoto.name}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          Siap di-upload ke Google Drive (`After` Stage)
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAfterPhoto(null)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/80 p-3.5 cursor-pointer transition-colors">
                    <Camera className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-slate-700">
                      Ambil Foto Kamera / Pilih Gambar Selesai (JPG, PNG, WebP)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleSelectPhoto(e, "After")}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTicket(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Uploading & Saving..."
                    : "Save WorkLog & Status"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
