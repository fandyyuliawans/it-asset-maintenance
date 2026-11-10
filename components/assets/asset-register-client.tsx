"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  CheckCircle2,
  Plus,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
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
import { formatIdr, formatWibDate } from "@/lib/utils";
import type {
  Asset,
  AssetCategory,
  AssetStatus,
  HotelLocation,
  SessionUser,
} from "@/types/domain";

const CATEGORIES: AssetCategory[] = [
  "Network & Wi-Fi",
  "POS & Front Office",
  "Server & Storage",
  "Guest Room Tech",
  "CCTV & Security",
  "Workstation & Laptop",
  "Printer & Peripheral",
  "AV & Banquet",
];

const STATUSES: AssetStatus[] = [
  "Operational",
  "Under Maintenance",
  "Degraded",
  "Spare / In Stock",
  "Retired",
];

interface AssetRegisterClientProps {
  initialAssets: Asset[];
  locations: HotelLocation[];
  sessionUser: SessionUser;
  initialCodeFilter?: string;
}

export function AssetRegisterClient({
  initialAssets,
  locations,
  sessionUser,
  initialCodeFilter = "",
}: AssetRegisterClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialCodeFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // QR Modal state
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Create Asset Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const canCreateAsset = hasPermission(sessionUser.role, "assets:create");

  const filteredAssets = useMemo(() => {
    return initialAssets.filter((asset) => {
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        asset.asset_code.toLowerCase().includes(q) ||
        asset.name.toLowerCase().includes(q) ||
        asset.serial_number.toLowerCase().includes(q) ||
        asset.brand.toLowerCase().includes(q) ||
        asset.location_name.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "ALL" || asset.category === categoryFilter;
      const matchesStatus =
        statusFilter === "ALL" || asset.status === statusFilter;

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [initialAssets, search, categoryFilter, statusFilter]);

  async function handleOpenQr(asset: Asset) {
    setQrAsset(asset);
    try {
      const url = await QRCode.toDataURL(asset.qr_payload_url, {
        width: 240,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl("");
    }
  }

  async function handleCreateAsset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      category: String(formData.get("category") || "Network & Wi-Fi"),
      brand: String(formData.get("brand") || ""),
      model: String(formData.get("model") || ""),
      serial_number: String(formData.get("serial_number") || ""),
      location_id: String(formData.get("location_id") || ""),
      assigned_department: String(
        formData.get("assigned_department") || "Information Technology"
      ),
      status: "Operational",
      condition: "Excellent",
      purchase_date: String(formData.get("purchase_date") || "2026-01-15"),
      warranty_expiry: String(formData.get("warranty_expiry") || "2029-01-15"),
      vendor_name: String(formData.get("vendor_name") || ""),
      purchase_cost_idr: Number(formData.get("purchase_cost_idr") || 0),
      specs_summary: String(formData.get("specs_summary") || ""),
      notes: String(formData.get("notes") || ""),
    };

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFormError(
          json.error?.message || "Failed to register asset. Check fields."
        );
      } else {
        setFormSuccess(
          `Registered ${json.data.asset_code} (${json.data.name})`
        );
        setCreateOpen(false);
        router.refresh();
      }
    } catch {
      setFormError("Network error while saving asset.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Hotel IT Asset Register (`Assets` Tab)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Normalized inventory with UUID primary keys, warranty tracking, and
            printable QR code asset stickers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateAsset ? (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              Register New Asset
            </Button>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <ShieldAlert className="h-3.5 w-3.5" />
              Read-Only for {sessionUser.role}
            </div>
          )}
        </div>
      </div>

      {formSuccess && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {formSuccess}
          </span>
          <button
            onClick={() => setFormSuccess(null)}
            className="text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Asset Code (AST-2026-...), Name, Serial Number, or Location..."
                className="pl-9"
              />
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="ALL">All Categories ({CATEGORIES.length})</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAssets.map((asset) => (
          <Card key={asset.asset_id} className="flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {asset.asset_code}
                    </span>
                    <Badge variant="outline">{asset.category}</Badge>
                    <Badge
                      variant={
                        asset.status === "Operational"
                          ? "success"
                          : asset.status === "Under Maintenance"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {asset.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{asset.name}</CardTitle>
                  <CardDescription className="mt-0.5">
                    {asset.brand} • {asset.model} (S/N:{" "}
                    <span className="font-mono text-slate-700">
                      {asset.serial_number}
                    </span>
                    )
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenQr(asset)}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  QR Label
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/80 text-slate-700">
                <div className="font-medium text-slate-900 mb-0.5">
                  Hardware & Network Specifications:
                </div>
                {asset.specs_summary}
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Hotel Location
                  </span>
                  <span className="font-medium text-slate-800">
                    {asset.location_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Department Custodian
                  </span>
                  <span className="font-medium text-slate-800">
                    {asset.assigned_department}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Acquisition Cost
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatIdr(asset.purchase_cost_idr)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Warranty Expiry
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatWibDate(asset.warranty_expiry)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Printable QR Code Sticker Modal */}
      {qrAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Printable Hotel IT Asset QR Tag
                </h3>
                <p className="text-xs text-slate-500">
                  Standard 50mm x 30mm thermal label or A4 sticker sheet
                </p>
              </div>
              <button
                onClick={() => setQrAsset(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center text-center bg-slate-50">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                PROPERTY OF QUEST HOTEL DARMO SURABAYA
              </div>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={qrAsset.asset_code}
                  className="w-44 h-44 my-2 rounded-lg border border-slate-200 bg-white p-1"
                />
              )}
              <div className="font-mono font-bold text-base text-slate-900">
                {qrAsset.asset_code}
              </div>
              <div className="text-xs font-medium text-slate-700">
                {qrAsset.name}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                S/N: {qrAsset.serial_number} • {qrAsset.location_name}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrAsset(null)}
              >
                Close
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print Sticker
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Register New Asset Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Register New Hotel IT Asset
                </h3>
                <p className="text-xs text-slate-500">
                  Appends to Google Sheets `Assets` tab and writes audit entry
                  to `ActivityLogs`
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAsset} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Asset Name *</Label>
                  <Input
                    name="name"
                    required
                    placeholder="e.g. Executive Lounge POS Terminal #1"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Category *</Label>
                  <select
                    name="category"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Brand *</Label>
                  <Input name="brand" required placeholder="e.g. HP / Cisco" />
                </div>
                <div className="space-y-1">
                  <Label>Model *</Label>
                  <Input
                    name="model"
                    required
                    placeholder="e.g. EliteDesk 800 G9"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Serial Number *</Label>
                  <Input
                    name="serial_number"
                    required
                    placeholder="e.g. SGH-99201A"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Hotel Location *</Label>
                  <select
                    name="location_id"
                    required
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    {locations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.location_code} — {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Assigned Department *</Label>
                  <Input
                    name="assigned_department"
                    defaultValue="Front Office"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Vendor / Supplier *</Label>
                  <Input
                    name="vendor_name"
                    defaultValue="PT Metrodata Electronics Tbk"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Purchase Date *</Label>
                  <Input
                    type="date"
                    name="purchase_date"
                    defaultValue="2026-01-15"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Warranty Expiry *</Label>
                  <Input
                    type="date"
                    name="warranty_expiry"
                    defaultValue="2029-01-15"
                    required
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Purchase Cost (IDR) *</Label>
                  <Input
                    type="number"
                    name="purchase_cost_idr"
                    defaultValue="14500000"
                    required
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Technical Specifications Summary *</Label>
                  <Input
                    name="specs_summary"
                    placeholder="e.g. Intel Core i5, 16GB RAM, Dual Gigabit NIC, VLAN 20"
                    required
                  />
                </div>
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
                  {submitting ? "Saving..." : "Register Asset"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
