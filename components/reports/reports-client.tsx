"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Printer,
  RotateCcw,
  Search,
  Wrench,
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
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/permissions/rbac";
import { formatIdr, formatWibDateTime } from "@/lib/utils";
import type {
  Asset,
  MaintenancePhoto,
  MaintenanceTicket,
  SessionUser,
  WorkLog,
} from "@/types/domain";

interface ReportsClientProps {
  assets: Asset[];
  tickets: MaintenanceTicket[];
  workLogs: WorkLog[];
  photos: MaintenancePhoto[];
  sessionUser: SessionUser;
}

function toYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getThisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: toYmdLocal(firstDay),
    to: toYmdLocal(lastDay),
  };
}

function isWithinDateRange(
  isoString: string | undefined,
  dateFrom: string,
  dateTo: string
): boolean {
  if (!isoString) return false;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return false;

  const itemYmd = toYmdLocal(parsed);
  if (dateFrom && itemYmd < dateFrom) return false;
  if (dateTo && itemYmd > dateTo) return false;
  return true;
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "")
    .replace(/\r?\n/g, " | ")
    .trim();
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadCsvFile(filename: string, headers: string[], rows: string[][]) {
  const csvLines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.map(escapeCsvCell).join(",")),
  ];
  // Add UTF-8 BOM so Microsoft Excel opens Indonesian characters & columns cleanly
  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({
  assets,
  tickets,
  workLogs,
  photos,
  sessionUser,
}: ReportsClientProps) {
  const canExport = hasPermission(sessionUser.role, "reports:export");

  const defaultMonth = useMemo(() => getThisMonthRange(), []);
  const [dateFrom, setDateFrom] = useState<string>(defaultMonth.from);
  const [dateTo, setDateTo] = useState<string>(defaultMonth.to);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"maintenance" | "workorders" | "assets">(
    "maintenance"
  );

  // Map ticket_id -> ticket for fast lookup in WorkLog report
  const ticketById = useMemo(() => {
    const map = new Map<string, MaintenanceTicket>();
    for (const t of tickets) {
      map.set(t.ticket_id, t);
    }
    return map;
  }, [tickets]);

  // Map ticket_id -> workLogs[]
  const workLogsByTicketId = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    for (const wl of workLogs) {
      const list = map.get(wl.ticket_id) || [];
      list.push(wl);
      map.set(wl.ticket_id, list);
    }
    return map;
  }, [workLogs]);

  // Map ticket_id -> photos[]
  const photosByTicketId = useMemo(() => {
    const map = new Map<string, MaintenancePhoto[]>();
    for (const p of photos) {
      if (!p.ticket_id) continue;
      const list = map.get(p.ticket_id) || [];
      list.push(p);
      map.set(p.ticket_id, list);
    }
    return map;
  }, [photos]);

  // Filtered Maintenance Tickets by date range, status, type, and search query
  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      // Check created_at or updated_at within date range
      const matchesDate =
        isWithinDateRange(t.created_at, dateFrom, dateTo) ||
        isWithinDateRange(t.updated_at, dateFrom, dateTo);
      if (!matchesDate) return false;

      if (statusFilter === "OPEN") {
        if (
          t.status === "Resolved" ||
          t.status === "Closed" ||
          t.status === "Cancelled"
        ) {
          return false;
        }
      } else if (statusFilter === "RESOLVED_CLOSED") {
        if (t.status !== "Resolved" && t.status !== "Closed") {
          return false;
        }
      } else if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "ALL" && t.type !== typeFilter) {
        return false;
      }

      if (q) {
        const haystack = [
          t.ticket_code,
          t.asset_code,
          t.asset_name,
          t.location_name,
          t.title,
          t.issue_description,
          t.assigned_technician_name,
          t.reported_by_name,
          t.resolution_summary,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [tickets, dateFrom, dateTo, statusFilter, typeFilter, searchQuery]);

  // Filtered Work Order Logs by date range and search query
  const filteredWorkLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workLogs.filter((wl) => {
      if (!isWithinDateRange(wl.created_at, dateFrom, dateTo)) {
        return false;
      }
      const parentTicket = ticketById.get(wl.ticket_id);

      if (statusFilter === "OPEN" && parentTicket) {
        if (
          parentTicket.status === "Resolved" ||
          parentTicket.status === "Closed" ||
          parentTicket.status === "Cancelled"
        ) {
          return false;
        }
      } else if (statusFilter === "RESOLVED_CLOSED" && parentTicket) {
        if (
          parentTicket.status !== "Resolved" &&
          parentTicket.status !== "Closed"
        ) {
          return false;
        }
      } else if (
        statusFilter !== "ALL" &&
        parentTicket &&
        parentTicket.status !== statusFilter
      ) {
        return false;
      }

      if (typeFilter !== "ALL" && parentTicket && parentTicket.type !== typeFilter) {
        return false;
      }

      if (q) {
        const haystack = [
          wl.technician_name,
          wl.action_taken,
          wl.parts_replaced,
          parentTicket?.ticket_code,
          parentTicket?.asset_code,
          parentTicket?.asset_name,
          parentTicket?.location_name,
          parentTicket?.title,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [workLogs, ticketById, dateFrom, dateTo, statusFilter, typeFilter, searchQuery]);

  // Date preset helpers
  function applyPresetThisMonth() {
    const r = getThisMonthRange();
    setDateFrom(r.from);
    setDateTo(r.to);
  }

  function applyPresetLastMonth() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    setDateFrom(toYmdLocal(firstDay));
    setDateTo(toYmdLocal(lastDay));
  }

  function applyPresetLast7Days() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    setDateFrom(toYmdLocal(sevenDaysAgo));
    setDateTo(toYmdLocal(now));
  }

  function applyPresetThisYear() {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-01-01`);
    setDateTo(`${now.getFullYear()}-12-31`);
  }

  function applyPresetAllDates() {
    setDateFrom("");
    setDateTo("");
  }

  // KPI calculations for filtered period
  const periodTicketCount = filteredTickets.length;
  const periodResolvedCount = filteredTickets.filter(
    (t) => t.status === "Resolved" || t.status === "Closed"
  ).length;
  const periodOpenCount = periodTicketCount - periodResolvedCount;

  const periodMaintOpEx = filteredTickets.reduce(
    (sum, t) => sum + Number(t.cost_idr || 0),
    0
  );
  const periodDowntimeMinutes = filteredTickets.reduce(
    (sum, t) => sum + Number(t.downtime_minutes || 0),
    0
  );
  const periodWorkLogMinutes = filteredWorkLogs.reduce(
    (sum, wl) => sum + Number(wl.time_spent_minutes || 0),
    0
  );

  const totalAssetCapEx = assets.reduce(
    (sum, a) => sum + Number(a.purchase_cost_idr || 0),
    0
  );

  // Breakdown by category for assets
  const categoryBreakdown = Object.entries(
    assets.reduce<Record<string, { count: number; valueIdr: number }>>(
      (acc, asset) => {
        if (!acc[asset.category]) {
          acc[asset.category] = { count: 0, valueIdr: 0 };
        }
        acc[asset.category].count += 1;
        acc[asset.category].valueIdr += Number(asset.purchase_cost_idr || 0);
        return acc;
      },
      {}
    )
  );

  // 1. Export CSV: Maintenance & Work Orders (Filtered Period)
  function handleExportMaintenanceCsv() {
    const headers = [
      "Tanggal Lapor (WIB)",
      "Update Terakhir (WIB)",
      "Kode Tiket",
      "Status",
      "Tipe Maintenance",
      "Prioritas",
      "Kode Aset",
      "Nama Aset",
      "Lokasi Hotel",
      "Judul Masalah",
      "Deskripsi Gejala / Masalah",
      "Dilaporkan Oleh",
      "Email Pelapor",
      "Teknisi Ditugaskan",
      "Ringkasan Penyelesaian (Resolution)",
      "Riwayat Tindakan Work Order (WorkLogs)",
      "Sparepart Diganti",
      "Total Waktu Kerja Teknisi (Menit)",
      "Total Downtime (Menit)",
      "Biaya Maintenance (IDR)",
      "Link Foto Before",
      "Link Foto After",
    ];

    const rows = filteredTickets.map((t) => {
      const tLogs = workLogsByTicketId.get(t.ticket_id) || [];
      const tPhotos = photosByTicketId.get(t.ticket_id) || [];

      const workActions = tLogs
        .map(
          (l) =>
            `[${formatWibDateTime(l.created_at)} - ${l.technician_name} (${l.time_spent_minutes}m)]: ${l.action_taken}`
        )
        .join(" ; ");

      const partsReplaced = tLogs
        .map((l) => l.parts_replaced)
        .filter(Boolean)
        .join(" ; ");

      const totalWorkMins = tLogs.reduce(
        (sum, l) => sum + Number(l.time_spent_minutes || 0),
        0
      );

      const beforeLinks = tPhotos
        .filter((p) => p.stage === "Before")
        .map((p) => p.caption)
        .filter(Boolean)
        .join(" ; ");

      const afterLinks = tPhotos
        .filter((p) => p.stage === "After")
        .map((p) => p.caption)
        .filter(Boolean)
        .join(" ; ");

      return [
        formatWibDateTime(t.created_at),
        formatWibDateTime(t.updated_at),
        t.ticket_code,
        t.status,
        t.type,
        t.priority,
        t.asset_code,
        t.asset_name,
        t.location_name,
        t.title,
        t.issue_description,
        t.reported_by_name,
        t.reported_by_email,
        t.assigned_technician_name || "Unassigned",
        t.resolution_summary || "-",
        workActions || "-",
        partsReplaced || "-",
        String(totalWorkMins),
        String(t.downtime_minutes || 0),
        String(t.cost_idr || 0),
        beforeLinks || "-",
        afterLinks || "-",
      ];
    });

    const periodLabel =
      dateFrom || dateTo
        ? `${dateFrom || "awal"}-sd-${dateTo || "akhir"}`
        : "semua-periode";
    downloadCsvFile(
      `laporan-maintenance-workorder-${periodLabel}.csv`,
      headers,
      rows
    );
  }

  // 2. Export CSV: Detailed Work Order Logs (Filtered Period)
  function handleExportWorkOrdersCsv() {
    const headers = [
      "Tanggal Pengerjaan (WIB)",
      "ID WorkLog",
      "Kode Tiket",
      "Status Tiket Saat Ini",
      "Tipe Maintenance",
      "Prioritas",
      "Kode Aset",
      "Nama Aset",
      "Lokasi Hotel",
      "Judul Tiket",
      "Nama Teknisi",
      "Tindakan Pengerjaan (Action Taken)",
      "Sparepart Diganti",
      "Durasi Pengerjaan (Menit)",
      "Biaya Tiket (IDR)",
    ];

    const rows = filteredWorkLogs.map((wl) => {
      const parent = ticketById.get(wl.ticket_id);
      return [
        formatWibDateTime(wl.created_at),
        wl.worklog_id,
        parent?.ticket_code || wl.ticket_id,
        parent?.status || "-",
        parent?.type || "-",
        parent?.priority || "-",
        parent?.asset_code || "-",
        parent?.asset_name || "-",
        parent?.location_name || "-",
        parent?.title || "-",
        wl.technician_name,
        wl.action_taken,
        wl.parts_replaced || "-",
        String(wl.time_spent_minutes || 0),
        String(parent?.cost_idr || 0),
      ];
    });

    const periodLabel =
      dateFrom || dateTo
        ? `${dateFrom || "awal"}-sd-${dateTo || "akhir"}`
        : "semua-periode";
    downloadCsvFile(`laporan-work-orders-${periodLabel}.csv`, headers, rows);
  }

  // 3. Export CSV: Assets Inventory
  function handleExportAssetsCsv() {
    const headers = [
      "Kode Aset",
      "Nama Aset",
      "Kategori",
      "Brand",
      "Model",
      "Serial Number",
      "Lokasi Hotel",
      "Departemen",
      "Status",
      "Kondisi",
      "Tanggal Beli",
      "Garansi Berakhir",
      "Vendor",
      "Harga Beli (IDR)",
      "Spesifikasi",
    ];
    const rows = assets.map((a) => [
      a.asset_code,
      a.name,
      a.category,
      a.brand,
      a.model,
      a.serial_number,
      a.location_name,
      a.assigned_department,
      a.status,
      a.condition,
      a.purchase_date,
      a.warranty_expiry,
      a.vendor_name,
      String(a.purchase_cost_idr || 0),
      a.specs_summary,
    ]);
    downloadCsvFile(
      `hotel-it-assets-export-${toYmdLocal(new Date())}.csv`,
      headers,
      rows
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Laporan Maintenance, Work Order & Analitik Aset IT
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter laporan berdasarkan rentang tanggal (Date-to-Date) untuk melihat
            rekap maintenance & work order bulanan serta ekspor ke CSV / Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
          {canExport && (
            <>
              <Button
                size="sm"
                onClick={handleExportMaintenanceCsv}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV Maintenance ({filteredTickets.length})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportWorkOrdersCsv}
              >
                <Download className="h-4 w-4" />
                Export CSV Work Order ({filteredWorkLogs.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAssetsCsv}
              >
                <Download className="h-4 w-4" />
                Export CSV Aset ({assets.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Date-to-Date Filter Bar */}
      <Card className="border-indigo-100 bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-bold text-slate-900">
                Filter Periode Laporan (Date-to-Date) & Kriteria
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={applyPresetThisMonth}
              >
                Bulan Ini
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={applyPresetLastMonth}
              >
                Bulan Lalu
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={applyPresetLast7Days}
              >
                7 Hari Terakhir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={applyPresetThisYear}
              >
                Tahun Ini
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2.5 text-slate-600"
                onClick={applyPresetAllDates}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Semua Tanggal
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Dari Tanggal (Start Date)
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Sampai Tanggal (End Date)
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Status Tiket
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="OPEN">Masih Aktif (Open / In Progress)</option>
                <option value="RESOLVED_CLOSED">
                  Selesai (Resolved / Closed)
                </option>
                <option value="Submitted">Submitted</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting Parts">Waiting Parts</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tipe Maintenance
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Semua Tipe Maintenance</option>
                <option value="Corrective / Breakdown">
                  Corrective / Breakdown
                </option>
                <option value="Preventive">Preventive</option>
                <option value="Upgrade / Installation">
                  Upgrade / Installation
                </option>
                <option value="Inspection">Inspection</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cari Aset / Tiket / Teknisi
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Ketik kode, aset, lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Periode Aktif:{" "}
                <strong className="text-slate-900">
                  {dateFrom || "Awal"} s/d {dateTo || "Sekarang"}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span>
                Tiket Ditemukan:{" "}
                <strong className="text-indigo-700">
                  {filteredTickets.length} tiket
                </strong>
              </span>
              <span>•</span>
              <span>
                Log Work Order:{" "}
                <strong className="text-indigo-700">
                  {filteredWorkLogs.length} aktivitas
                </strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Maintenance (Periode Ini)</CardDescription>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <span>{periodTicketCount} Tiket</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 flex items-center gap-2">
            <Badge variant="success">{periodResolvedCount} Selesai</Badge>
            <Badge variant="warning">{periodOpenCount} Aktif</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Work Order & Jam Kerja Teknisi</CardDescription>
            <CardTitle className="text-xl font-bold">
              {filteredWorkLogs.length} WorkLog ({periodWorkLogMinutes} mnt)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Total durasi pengerjaan teknisi pada periode terpilih
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Biaya Maintenance (Periode Ini)</CardDescription>
            <CardTitle className="text-xl font-bold text-indigo-700">
              {formatIdr(periodMaintOpEx)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Total biaya suku cadang & perbaikan pada periode terpilih
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Downtime (Periode Ini)</CardDescription>
            <CardTitle className="text-xl font-bold">
              {periodDowntimeMinutes} menit
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Total nilai aset terdaftar: {formatIdr(totalAssetCapEx)}
          </CardContent>
        </Card>
      </div>

      {/* Tab Selector for Report Tables */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <Button
          type="button"
          size="sm"
          variant={activeTab === "maintenance" ? "default" : "outline"}
          onClick={() => setActiveTab("maintenance")}
        >
          <Wrench className="h-4 w-4" />
          1. Tabel Laporan Tiket Maintenance ({filteredTickets.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === "workorders" ? "default" : "outline"}
          onClick={() => setActiveTab("workorders")}
        >
          <Clock className="h-4 w-4" />
          2. Tabel Riwayat Work Order Teknisi ({filteredWorkLogs.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === "assets" ? "default" : "outline"}
          onClick={() => setActiveTab("assets")}
        >
          <CheckCircle2 className="h-4 w-4" />
          3. Valuasi Kategori Aset ({assets.length})
        </Button>
      </div>

      {/* TAB 1: Maintenance Tickets Table */}
      {activeTab === "maintenance" && (
        <Card>
          <CardHeader className="border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Daftar Tiket Maintenance ({dateFrom || "Awal"} s/d{" "}
                {dateTo || "Sekarang"})
              </CardTitle>
              <CardDescription>
                Menampilkan rincian masalah, tindakan penyelesaian teknisi, waktu
                pengerjaan, biaya, dan bukti foto
              </CardDescription>
            </div>
            {canExport && (
              <Button size="sm" onClick={handleExportMaintenanceCsv}>
                <Download className="h-4 w-4" />
                Download CSV Maintenance Ini
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Tidak ada tiket maintenance pada rentang tanggal{" "}
                <strong>
                  {dateFrom || "Awal"} s/d {dateTo || "Sekarang"}
                </strong>
                . Klik tombol <strong>Semua Tanggal</strong> atau ubah rentang
                tanggal di atas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                      <th className="py-3 px-4">Tanggal (WIB)</th>
                      <th className="py-3 px-4">Tiket & Status</th>
                      <th className="py-3 px-4">Aset & Lokasi</th>
                      <th className="py-3 px-4">Masalah & Penyelesaian</th>
                      <th className="py-3 px-4">Teknisi & WorkLog</th>
                      <th className="py-3 px-4 text-right">Downtime & Biaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTickets.map((t) => {
                      const tLogs = workLogsByTicketId.get(t.ticket_id) || [];
                      const tPhotos = photosByTicketId.get(t.ticket_id) || [];
                      const workMins = tLogs.reduce(
                        (s, l) => s + Number(l.time_spent_minutes || 0),
                        0
                      );

                      return (
                        <tr
                          key={t.ticket_id}
                          className="hover:bg-slate-50/80 align-top"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            <div className="font-medium text-slate-900">
                              {formatWibDateTime(t.created_at)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Update: {formatWibDateTime(t.updated_at)}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-indigo-700">
                              {t.ticket_code}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge
                                variant={
                                  t.status === "Resolved" ||
                                  t.status === "Closed"
                                    ? "success"
                                    : t.status === "In Progress"
                                    ? "warning"
                                    : "secondary"
                                }
                              >
                                {t.status}
                              </Badge>
                              <Badge
                                variant={
                                  t.priority === "Critical" ||
                                  t.priority === "High"
                                    ? "destructive"
                                    : "outline"
                                }
                              >
                                {t.priority}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {t.type}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {t.asset_code} — {t.asset_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Lokasi: {t.location_name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Pelapor: {t.reported_by_name}
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-md">
                            <div className="font-semibold text-slate-900">
                              {t.title}
                            </div>
                            <div className="text-slate-600 mt-0.5 whitespace-pre-line">
                              {t.issue_description}
                            </div>
                            {t.resolution_summary && (
                              <div className="mt-1.5 p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                                <strong>Penyelesaian:</strong>{" "}
                                {t.resolution_summary}
                              </div>
                            )}
                            {tPhotos.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {tPhotos.map((p) => (
                                  <a
                                    key={p.photo_id}
                                    href={p.caption}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-medium border border-indigo-200"
                                  >
                                    Foto {p.stage}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">
                              {t.assigned_technician_name || "Unassigned"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {tLogs.length} WorkLog ({workMins} mnt kerja)
                            </div>
                            {tLogs.length > 0 && (
                              <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                                {tLogs.map((l) => (
                                  <li
                                    key={l.worklog_id}
                                    className="border-l-2 border-indigo-300 pl-2"
                                  >
                                    <span className="font-medium">
                                      {l.technician_name}:
                                    </span>{" "}
                                    {l.action_taken}
                                    {l.parts_replaced
                                      ? ` (Part: ${l.parts_replaced})`
                                      : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-mono font-semibold text-slate-900">
                              {formatIdr(t.cost_idr || 0)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Downtime: {t.downtime_minutes || 0} mnt
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Work Orders / Technician Logs Table */}
      {activeTab === "workorders" && (
        <Card>
          <CardHeader className="border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Laporan Work Order / Aktivitas Pengerjaan Teknisi ({dateFrom || "Awal"}{" "}
                s/d {dateTo || "Sekarang"})
              </CardTitle>
              <CardDescription>
                Catatan detail setiap tindakan teknisi, suku cadang yang diganti,
                dan durasi pengerjaan
              </CardDescription>
            </div>
            {canExport && (
              <Button size="sm" onClick={handleExportWorkOrdersCsv}>
                <Download className="h-4 w-4" />
                Download CSV Work Order Ini
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {filteredWorkLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada riwayat Work Order teknisi pada rentang tanggal{" "}
                <strong>
                  {dateFrom || "Awal"} s/d {dateTo || "Sekarang"}
                </strong>
                .
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                      <th className="py-3 px-4">Waktu Pengerjaan (WIB)</th>
                      <th className="py-3 px-4">Tiket & Aset</th>
                      <th className="py-3 px-4">Nama Teknisi</th>
                      <th className="py-3 px-4">Tindakan Pengerjaan (Work Order)</th>
                      <th className="py-3 px-4">Sparepart Diganti</th>
                      <th className="py-3 px-4 text-right">Durasi Kerja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredWorkLogs.map((wl) => {
                      const parent = ticketById.get(wl.ticket_id);
                      return (
                        <tr
                          key={wl.worklog_id}
                          className="hover:bg-slate-50/80 align-top"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                            {formatWibDateTime(wl.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-indigo-700">
                              {parent?.ticket_code || wl.ticket_id}
                            </div>
                            {parent && (
                              <>
                                <div className="font-medium text-slate-900">
                                  {parent.asset_code} — {parent.asset_name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {parent.location_name} • Status:{" "}
                                  <strong>{parent.status}</strong>
                                </div>
                              </>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-900">
                            {wl.technician_name}
                          </td>
                          <td className="py-3 px-4 max-w-md whitespace-pre-line text-slate-700">
                            {wl.action_taken}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {wl.parts_replaced || "-"}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-semibold text-slate-900">
                            {wl.time_spent_minutes} menit
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: Asset Valuation Breakdown */}
      {activeTab === "assets" && (
        <Card>
          <CardHeader className="border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Asset Valuation Breakdown by Category
              </CardTitle>
              <CardDescription>
                Distribusi nilai investasi perangkat IT berdasarkan kategori
              </CardDescription>
            </div>
            {canExport && (
              <Button variant="outline" size="sm" onClick={handleExportAssetsCsv}>
                <Download className="h-4 w-4" />
                Export CSV Semua Aset
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {categoryBreakdown.map(([cat, stats]) => {
              const pct =
                totalAssetCapEx > 0
                  ? Math.round((stats.valueIdr / totalAssetCapEx) * 100)
                  : 0;
              return (
                <div key={cat} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {cat}{" "}
                      <Badge variant="secondary" className="ml-1">
                        {stats.count} units
                      </Badge>
                    </span>
                    <span className="font-mono font-medium text-slate-700">
                      {formatIdr(stats.valueIdr)} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
