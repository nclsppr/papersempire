import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const FIXED_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  if (Math.abs(value) < 1000) {
    return FIXED_FORMATTER.format(Math.round(value * 10) / 10);
  }
  return COMPACT_FORMATTER.format(value);
}

export function formatRate(value: number): string {
  return `${formatNumber(value)}/s`;
}
