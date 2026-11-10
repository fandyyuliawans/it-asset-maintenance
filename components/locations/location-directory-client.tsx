"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
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
import type {
  Asset,
  HotelLocation,
  LocationAreaType,
  SessionUser,
} from "@/types/domain";

const AREA_TYPES: LocationAreaType[] = [
  "Front Office & Lobby",
  "Guest Floor",
  "Back Office",
  "F&B Outlet / Kitchen",
  "Server / MDF / IDF Room",
  "Banquet & Meeting Room",
  "Engineering & Basement",
  "Outdoor / Security Post",
];

interface LocationDirectoryClientProps {
  initialLocations: HotelLocation[];
  assets: Asset[];
  sessionUser: SessionUser;
}

export function LocationDirectoryClient({
  initialLocations,
  assets,
  sessionUser,
}: LocationDirectoryClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("ALL");

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<HotelLocation | null>(null);
  const [deletingLoc, setDeletingLoc] = useState<HotelLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canManage = hasPermission(sessionUser.role, "locations:manage");

  const filteredLocations = useMemo(() => {
    return initialLocations.filter((loc) => {
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        String(loc.location_code).toLowerCase().includes(q) ||
        String(loc.name).toLowerCase().includes(q) ||
        String(loc.building_wing).toLowerCase().includes(q) ||
        String(loc.floor).toLowerCase().includes(q) ||
        String(loc.pic_department).toLowerCase().includes(q);
      const matchesArea =
        areaFilter === "ALL" || loc.area_type === areaFilter;
      return matchesQuery && matchesArea;
    });
  }, [initialLocations, search, areaFilter]);

  async function handleCreateLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      location_code: String(formData.get("location_code") || "")
        .trim()
        .toUpperCase(),
      name: String(formData.get("name") || "").trim(),
      building_wing: String(formData.get("building_wing") || "").trim(),
      floor: String(formData.get("floor") || "").trim(),
      area_type: String(formData.get("area_type") || "Front Office & Lobby"),
      pic_department: String(formData.get("pic_department") || "").trim(),
      is_active: String(formData.get("is_active") || "true") === "true",
    };

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Gagal menambahkan lokasi.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Berhasil menambahkan lokasi ${json.data.location_code} — ${json.data.name}.`,
        });
        setCreateOpen(false);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Terjadi kesalahan jaringan saat menyimpan lokasi.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingLoc) return;
    setSubmitting(true);
    setFeedback(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      location_id: editingLoc.location_id,
      location_code: String(formData.get("location_code") || "")
        .trim()
        .toUpperCase(),
      name: String(formData.get("name") || "").trim(),
      building_wing: String(formData.get("building_wing") || "").trim(),
      floor: String(formData.get("floor") || "").trim(),
      area_type: String(formData.get("area_type") || editingLoc.area_type),
      pic_department: String(formData.get("pic_department") || "").trim(),
      is_active: String(formData.get("is_active") || "true") === "true",
    };

    try {
      const res = await fetch("/api/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Gagal memperbarui lokasi.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Berhasil memperbarui lokasi ${payload.location_code} — ${payload.name}.`,
        });
        setEditingLoc(null);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Terjadi kesalahan jaringan saat memperbarui lokasi.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingLoc) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: deletingLoc.location_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({
          type: "error",
          text: json.error?.message || "Gagal menghapus lokasi.",
        });
      } else {
        setFeedback({
          type: "success",
          text: `Lokasi ${deletingLoc.location_code} (${deletingLoc.name}) berhasil dihapus dari Google Spreadsheet.`,
        });
        setDeletingLoc(null);
        router.refresh();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Terjadi kesalahan jaringan saat menghapus lokasi.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            Hotel Locations Directory (`Locations` Tab)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola daftar lokasi gedung/wing, lantai, ruang server MDF/IDF,
            resepsionis, outlet F&B, dan ballroom
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Tambah Lokasi Baru
            </Button>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <ShieldAlert className="h-3.5 w-3.5" />
              Read-Only ({sessionUser.role})
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
                placeholder="Cari kode lokasi (LOC-...), nama ruangan, wing/tower, lantai, atau departemen..."
                className="pl-9"
              />
            </div>
            <div>
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="ALL">
                  Semua Tipe Area ({initialLocations.length})
                </option>
                {AREA_TYPES.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations Grid / Table */}
      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">
            Daftar Lokasi Hotel ({filteredLocations.length})
          </CardTitle>
          <CardDescription>
            Tersinkronisasi langsung dengan tab `Locations` di Google
            Spreadsheet Anda
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {filteredLocations.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Belum ada lokasi yang sesuai pencarian. Klik tombol{" "}
              <strong>Tambah Lokasi Baru</strong> di kanan atas untuk menambah.
            </div>
          ) : (
            filteredLocations.map((loc) => {
              const assetCount = assets.filter(
                (a) =>
                  a.location_id === loc.location_id ||
                  a.location_name === loc.name
              ).length;

              return (
                <div
                  key={loc.location_id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:border-indigo-200 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                        {loc.location_code}
                      </span>
                      <span className="font-semibold text-sm text-slate-900">
                        {loc.name}
                      </span>
                      <Badge variant="outline">{loc.area_type}</Badge>
                      <Badge
                        variant={
                          String(loc.is_active) !== "false"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {String(loc.is_active) !== "false"
                          ? "Active"
                          : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600">
                      Gedung / Wing:{" "}
                      <strong className="text-slate-800">
                        {loc.building_wing}
                      </strong>{" "}
                      • Lantai:{" "}
                      <strong className="text-slate-800">{loc.floor}</strong> •
                      PIC Dept:{" "}
                      <strong className="text-slate-800">
                        {loc.pic_department}
                      </strong>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ID: <span className="font-mono">{loc.location_id}</span> •{" "}
                      {assetCount} Aset IT ditempatkan di lokasi ini
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingLoc(loc)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-indigo-600" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingLoc(loc)}
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Add Location Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Tambah Lokasi Hotel Baru
                </h3>
                <p className="text-xs text-slate-500">
                  Menambahkan baris lokasi baru ke tab `Locations` di Google
                  Spreadsheet
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Kode Lokasi *</Label>
                  <Input
                    name="location_code"
                    required
                    placeholder="e.g. LOC-FO-02"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Lantai (Floor) *</Label>
                  <Input
                    name="floor"
                    required
                    placeholder="e.g. GF / L1 / B1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Nama Lokasi / Ruangan *</Label>
                <Input
                  name="name"
                  required
                  placeholder="e.g. Concierge & Bell Desk Lobby"
                />
              </div>

              <div className="space-y-1">
                <Label>Gedung / Wing *</Label>
                <Input
                  name="building_wing"
                  required
                  defaultValue="Main Tower"
                  placeholder="e.g. Main Tower / Convention Wing"
                />
              </div>

              <div className="space-y-1">
                <Label>Tipe Area Hotel *</Label>
                <select
                  name="area_type"
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  {AREA_TYPES.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Departemen PIC *</Label>
                  <Input
                    name="pic_department"
                    required
                    defaultValue="Front Office"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status Lokasi</Label>
                  <select
                    name="is_active"
                    defaultValue="true"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Lokasi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {editingLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Edit Lokasi Hotel ({editingLoc.location_code})
                </h3>
                <p className="text-xs text-slate-500">
                  Perbarui data lokasi pada tab `Locations` di Google
                  Spreadsheet
                </p>
              </div>
              <button
                onClick={() => setEditingLoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateLocation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Kode Lokasi *</Label>
                  <Input
                    name="location_code"
                    required
                    defaultValue={editingLoc.location_code}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Lantai (Floor) *</Label>
                  <Input
                    name="floor"
                    required
                    defaultValue={editingLoc.floor}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Nama Lokasi / Ruangan *</Label>
                <Input name="name" required defaultValue={editingLoc.name} />
              </div>

              <div className="space-y-1">
                <Label>Gedung / Wing *</Label>
                <Input
                  name="building_wing"
                  required
                  defaultValue={editingLoc.building_wing}
                />
              </div>

              <div className="space-y-1">
                <Label>Tipe Area Hotel *</Label>
                <select
                  name="area_type"
                  defaultValue={editingLoc.area_type}
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  {AREA_TYPES.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Departemen PIC *</Label>
                  <Input
                    name="pic_department"
                    required
                    defaultValue={editingLoc.pic_department}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status Lokasi</Label>
                  <select
                    name="is_active"
                    defaultValue={
                      String(editingLoc.is_active) !== "false"
                        ? "true"
                        : "false"
                    }
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingLoc(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-rose-700">
                Konfirmasi Hapus Lokasi
              </h3>
              <button
                onClick={() => setDeletingLoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-slate-700 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus lokasi berikut dari tab{" "}
                <code>Locations</code> di Google Spreadsheet?
              </p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 font-medium text-slate-900">
                <span className="font-mono text-indigo-700">
                  {deletingLoc.location_code}
                </span>{" "}
                — {deletingLoc.name} ({deletingLoc.building_wing}, Floor{" "}
                {deletingLoc.floor})
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingLoc(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={submitting}
                onClick={handleConfirmDelete}
              >
                {submitting ? "Menghapus..." : "Ya, Hapus Lokasi"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
