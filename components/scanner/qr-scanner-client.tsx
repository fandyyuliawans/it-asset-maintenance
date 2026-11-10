"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CameraOff,
  CheckCircle2,
  ImageUp,
  QrCode,
  RefreshCw,
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
import { formatIdr, formatWibDate } from "@/lib/utils";
import type { Asset, MaintenanceTicket } from "@/types/domain";

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (
        source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap
      ) => Promise<Array<{ rawValue: string }>>;
    };
    jsQR?: (
      data: Uint8ClampedArray,
      width: number,
      height: number
    ) => { data: string } | null;
  }
}

interface QrScannerClientProps {
  assets: Asset[];
  tickets: MaintenanceTicket[];
}

/**
 * Extracts an asset code or query from a scanned QR payload URL or raw text.
 * Example: "http://localhost:3000/assets?code=AST-2026-0001" -> "AST-2026-0001"
 */
function extractCodeFromQrPayload(raw: string): string {
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const codeParam = url.searchParams.get("code");
      if (codeParam) return codeParam.trim();
      const parts = url.pathname.split("/").filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.toUpperCase().startsWith("AST-")) {
        return lastPart;
      }
    }
  } catch {
    // Not a URL, use raw string
  }
  return trimmed;
}

export function QrScannerClient({ assets, tickets }: QrScannerClientProps) {
  const [scanInput, setScanInput] = useState(
    () => assets[0]?.asset_code || ""
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedBanner, setLastScannedBanner] = useState<string | null>(
    null
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Load jsQR fallback script once so desktop browsers without BarcodeDetector work 100%
  useEffect(() => {
    const scriptId = "jsqr-decoder-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleDetectedQr = useCallback(
    (rawValue: string) => {
      const extracted = extractCodeFromQrPayload(rawValue);
      if (!extracted) return;
      setScanInput(extracted);
      setLastScannedBanner(`QR Code Terdeteksi: ${extracted}`);
      stopCamera();
    },
    [stopCamera]
  );

  const startCamera = useCallback(
    async (overrideDeviceId?: string, overrideFacing?: "environment" | "user") => {
      setCameraError(null);
      setLastScannedBanner(null);
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          "Browser ini tidak mendukung akses kamera (pastikan membuka via http://localhost:3000 atau HTTPS)."
        );
        return;
      }

      try {
        const targetDeviceId =
          overrideDeviceId !== undefined ? overrideDeviceId : selectedDeviceId;
        const targetFacing = overrideFacing || facingMode;

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: targetDeviceId
            ? { deviceId: { exact: targetDeviceId } }
            : {
                facingMode: { ideal: targetFacing },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setCameraActive(true);

        // Enumerate cameras after permission is granted
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        setVideoDevices(cameras);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector =
          typeof window !== "undefined" && window.BarcodeDetector
            ? new window.BarcodeDetector({ formats: ["qr_code"] })
            : null;

        const scanFrame = async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || !streamRef.current) return;

          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              // 1. Try native BarcodeDetector first
              if (detector) {
                try {
                  const codes = await detector.detect(canvas);
                  if (codes.length > 0 && codes[0].rawValue) {
                    handleDetectedQr(codes[0].rawValue);
                    return;
                  }
                } catch {
                  // Fallback to jsQR below
                }
              }

              // 2. Fallback to jsQR on canvas image data
              if (window.jsQR) {
                const imageData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                const qr = window.jsQR(
                  imageData.data,
                  imageData.width,
                  imageData.height
                );
                if (qr && qr.data) {
                  handleDetectedQr(qr.data);
                  return;
                }
              }
            }
          }

          scanLoopRef.current = requestAnimationFrame(scanFrame);
        };

        scanLoopRef.current = requestAnimationFrame(scanFrame);
      } catch (err) {
        setCameraActive(false);
        setCameraError(
          err instanceof Error
            ? `Gagal membuka kamera: ${err.message}. Pastikan izin kamera (Allow Camera) diaktifkan di browser Anda.`
            : "Gagal mengakses kamera perangkat."
        );
      }
    },
    [facingMode, handleDetectedQr, selectedDeviceId, stopCamera]
  );

  async function handleFlipCamera() {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    setSelectedDeviceId("");
    if (cameraActive) {
      await startCamera("", nextFacing);
    }
  }

  async function handleUploadQrImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    setLastScannedBanner(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        if (window.BarcodeDetector) {
          try {
            const detector = new window.BarcodeDetector({
              formats: ["qr_code"],
            });
            const codes = await detector.detect(canvas);
            if (codes.length > 0 && codes[0].rawValue) {
              handleDetectedQr(codes[0].rawValue);
              return;
            }
          } catch {
            // Continue to jsQR
          }
        }

        if (window.jsQR) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = window.jsQR(
            imageData.data,
            imageData.width,
            imageData.height
          );
          if (qr && qr.data) {
            handleDetectedQr(qr.data);
            return;
          }
        }

        setCameraError(
          "Tidak ditemukan QR Code yang terbaca pada gambar tersebut."
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
        e.target.value = "";
      }
    };
    img.src = objectUrl;
  }

  const matchedAsset = assets.find((a) => {
    const q = scanInput.trim().toLowerCase();
    if (!q) return false;
    return (
      String(a.asset_code).toLowerCase() === q ||
      String(a.serial_number).toLowerCase() === q ||
      String(a.name).toLowerCase().includes(q) ||
      String(a.qr_payload_url).toLowerCase().includes(q)
    );
  });

  const assetTickets = matchedAsset
    ? tickets.filter((t) => t.asset_id === matchedAsset.asset_id)
    : [];

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600" />
            QR Tag Camera Scanner & Instant Asset Lookup
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gunakan kamera HP/Webcam untuk scan stiker QR Code aset hotel secara
            langsung, upload gambar QR, atau ketik kode aset
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!cameraActive ? (
            <Button size="sm" onClick={() => startCamera()}>
              <Camera className="h-4 w-4" />
              Buka Kamera Scan QR
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleFlipCamera}>
                <RefreshCw className="h-3.5 w-3.5" />
                Ganti Kamera
              </Button>
              <Button variant="destructive" size="sm" onClick={stopCamera}>
                <CameraOff className="h-4 w-4" />
                Matikan Kamera
              </Button>
            </>
          )}

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer h-8">
            <ImageUp className="h-3.5 w-3.5 text-indigo-600" />
            <span>Scan dari File Gambar</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadQrImage}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {lastScannedBanner && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {lastScannedBanner}
          </span>
          <button
            onClick={() => setLastScannedBanner(null)}
            className="underline font-medium"
          >
            Tutup
          </button>
        </div>
      )}

      {cameraError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-center justify-between">
          <span>{cameraError}</span>
          <button
            onClick={() => setCameraError(null)}
            className="underline font-medium"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Hidden Canvas for QR frame decoding */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Camera Viewfinder + Manual Lookup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-indigo-600" />
              Kamera Pemindai QR Code
            </CardTitle>
            <CardDescription>
              Arahkan stiker QR aset ke dalam kotak bidik kamera di bawah
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Live Camera Box */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-4/3 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  cameraActive ? "block" : "hidden"
                }`}
              />

              {cameraActive ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-44 h-44 border-2 border-indigo-400 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] relative">
                    <div className="absolute inset-x-2 top-1/2 h-0.5 bg-emerald-400/90 animate-pulse" />
                  </div>
                  <span className="mt-3 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-medium text-emerald-300 border border-slate-700">
                    Memindai QR Code secara otomatis...
                  </span>
                </div>
              ) : (
                <div className="text-center p-5 space-y-3">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white">
                      Kamera Belum Aktif
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Klik tombol di bawah untuk menyalakan kamera HP atau
                      Webcam laptop Anda.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => startCamera()}>
                    <Camera className="h-4 w-4" />
                    Nyalakan Kamera Sekarang
                  </Button>
                </div>
              )}
            </div>

            {/* Optional Camera Device Selector if multiple cameras exist */}
            {videoDevices.length > 1 && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-600">
                  Pilih Perangkat Kamera:
                </span>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedDeviceId(id);
                    if (cameraActive) {
                      startCamera(id);
                    }
                  }}
                  className="flex h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                >
                  <option value="">Default ({facingMode})</option>
                  {videoDevices.map((dev, idx) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label || `Camera #${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Input Search */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Atau Ketik Kode Aset / Serial Number:
              </div>
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Contoh: AST-2026-0001 atau S/N..."
                  className="pl-9 font-mono"
                />
              </div>
            </div>

            {/* Quick-Tap Hotel Asset Tags */}
            <div className="pt-1 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Daftar Aset Terdaftar ({assets.length}):
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {assets.map((asset) => (
                  <button
                    key={asset.asset_id}
                    type="button"
                    onClick={() => setScanInput(asset.asset_code)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      scanInput === asset.asset_code
                        ? "border-indigo-500 bg-indigo-50/70 text-indigo-950"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-mono font-bold text-indigo-700">
                      {asset.asset_code}
                    </div>
                    <div className="truncate font-medium">{asset.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {asset.location_name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right 2 Columns: Scanned Asset Diagnostic Profile */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base">
              Scanned Asset Diagnostic Profile
            </CardTitle>
            <CardDescription>
              Data real-time dari tab `Assets` & `Maintenance` di Google
              Spreadsheet
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {matchedAsset ? (
              <div className="space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                      {matchedAsset.asset_code}
                    </span>
                    <Badge
                      variant={
                        matchedAsset.status === "Operational"
                          ? "success"
                          : matchedAsset.status === "Under Maintenance"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {matchedAsset.status}
                    </Badge>
                    <Badge variant="outline">
                      Condition: {matchedAsset.condition}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/assets?code=${matchedAsset.asset_code}`}>
                        View in Register
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/maintenance">
                        <Wrench className="h-3.5 w-3.5" />
                        Report Issue
                      </Link>
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {matchedAsset.name}
                  </h3>
                  <p className="text-slate-600 mt-0.5">
                    {matchedAsset.brand} • {matchedAsset.model} • Serial:{" "}
                    <span className="font-mono font-semibold">
                      {matchedAsset.serial_number}
                    </span>
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                  <div className="font-semibold text-slate-800">
                    Technical Specifications & QR Payload:
                  </div>
                  <p className="text-slate-700">{matchedAsset.specs_summary}</p>
                  <p className="font-mono text-[11px] text-indigo-600 pt-1">
                    QR URL: {matchedAsset.qr_payload_url}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <span className="text-[11px] text-slate-400 block">
                      Location
                    </span>
                    <span className="font-semibold text-slate-800">
                      {matchedAsset.location_name}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <span className="text-[11px] text-slate-400 block">
                      Department
                    </span>
                    <span className="font-semibold text-slate-800">
                      {matchedAsset.assigned_department}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <span className="text-[11px] text-slate-400 block">
                      Warranty Expiry
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatWibDate(matchedAsset.warranty_expiry)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <span className="text-[11px] text-slate-400 block">
                      Asset Value
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatIdr(matchedAsset.purchase_cost_idr)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="font-semibold text-slate-900">
                    Maintenance History for {matchedAsset.asset_code} (
                    {assetTickets.length})
                  </div>
                  {assetTickets.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 p-3 text-slate-500">
                      Belum ada riwayat tiket maintenance untuk aset ini.
                    </div>
                  ) : (
                    assetTickets.map((t) => (
                      <div
                        key={t.ticket_id}
                        className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {t.ticket_code} — {t.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Technician:{" "}
                            {t.assigned_technician_name || "Unassigned"} •
                            Downtime: {t.downtime_minutes}m
                          </div>
                        </div>
                        <Badge
                          variant={
                            t.status === "Resolved" || t.status === "Closed"
                              ? "success"
                              : "warning"
                          }
                        >
                          {t.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                Tidak ada aset yang cocok dengan kode{" "}
                <code>{scanInput || "(kosong)"}</code>. Nyalakan kamera untuk
                memindai QR atau klik salah satu aset di sebelah kiri.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
