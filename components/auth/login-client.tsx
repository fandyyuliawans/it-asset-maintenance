"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

interface LoginClientProps {
  googleClientId: string;
  isGoogleConfigured: boolean;
}

export function LoginClient({
  googleClientId,
  isGoogleConfigured,
}: LoginClientProps) {
  const router = useRouter();
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isGoogleConfigured || !googleClientId) return;

    const scriptId = "google-gsi-client-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initGsi = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) return;
          setLoading(true);
          setErrorMsg(null);
          try {
            const res = await fetch("/api/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                intent: "google_sso",
                idToken: response.credential,
              }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
              setErrorMsg(
                json.error?.message ||
                  "Akses Ditolak: Email Anda tidak terdaftar di tab Users Google Spreadsheet."
              );
            } else {
              router.push("/");
              router.refresh();
            }
          } catch {
            setErrorMsg("Gagal memverifikasi akun Google SSO.");
          } finally {
            setLoading(false);
          }
        },
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 340,
      });
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.body.appendChild(script);
    } else {
      initGsi();
    }
  }, [googleClientId, isGoogleConfigured, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* Left Branding Panel */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-base text-white">
                  IT Asset & Maintenance
                </div>
                <div className="text-xs text-indigo-300">
                  Hotel Operations System
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <h1 className="text-xl font-bold text-white leading-snug">
                Internal IT Asset & Maintenance Portal
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Hanya email Google yang sudah terdaftar dengan status{" "}
                <code>Active</code> di tab <code>Users</code> pada Google
                Spreadsheet yang diizinkan mengakses sistem ini.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Google SSO OAuth 2.0 + Strict Allowlist
            </div>
            <div className="flex items-center gap-1.5 text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Server-Enforced RBAC (`Users` Sheet)
            </div>
            <div>Timezone: Asia/Jakarta (WIB / UTC+7)</div>
          </div>
        </div>

        {/* Right Login Card */}
        <Card className="lg:col-span-3 bg-white text-slate-900 border-slate-200 shadow-xl flex flex-col justify-center">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold">
              Sign In to Your Account
            </CardTitle>
            <CardDescription>
              Gunakan akun Google resmi yang telah didaftarkan oleh
              Administrator IT di tab `Users`
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            {errorMsg && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 font-medium flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Google Single Sign-On (SSO)</span>
                {isGoogleConfigured && (
                  <Badge variant="success">OAuth Connected</Badge>
                )}
              </div>

              <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-slate-200 bg-slate-50">
                <div ref={googleBtnRef} />
                {loading && (
                  <p className="text-xs text-indigo-600 font-medium mt-3">
                    Memverifikasi email di tab Users Google Spreadsheet...
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-3 text-center max-w-xs">
                  Akun Google yang tidak terdaftar di tab <code>Users</code>{" "}
                  akan otomatis ditolak oleh server.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
