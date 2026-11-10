import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format ISO date/time string into Asia/Jakarta (WIB) readable representation
 */
export function formatWibDateTime(
  isoString?: string | null,
  options?: { includeSeconds?: boolean }
): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const formatted = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: options?.includeSeconds ? "2-digit" : undefined,
      hour12: false,
    }).format(date);
    return `${formatted} WIB`;
  } catch {
    return isoString;
  }
}

export function formatWibDate(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return "—";
  try {
    const date = new Date(isoOrDateString);
    if (Number.isNaN(date.getTime())) return isoOrDateString;
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return isoOrDateString;
  }
}

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function generateEntityCode(
  prefix: "AST" | "MNT" | "LOC",
  sequence: number
): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}
