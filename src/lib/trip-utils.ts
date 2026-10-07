import type { Stop } from "./types";

/** 日ごとの色（地図のルート線にも使うため実際の色値で持つ） */
export const DAY_COLORS = ["#b9502d", "#2c7556", "#3a57a3", "#86569a", "#9a7a1e", "#2a7f8f", "#a8456b"];
export const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function dayDate(startDate: string, i: number): Date {
  const d = new Date(`${startDate}T00:00:00`);
  d.setDate(d.getDate() + i);
  return d;
}

export function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function fmtLongDate(d: Date): string {
  return `${d.getFullYear()}年${fmtDate(d)}`;
}

export const yen = (n: number) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");

type LatLng = { lat: number | null; lng: number | null };

export function km(a: LatLng, b: LatLng): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const r = (x: number) => (x * Math.PI) / 180;
  const dLa = r(b.lat - a.lat);
  const dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 直線距離からのおおよその移動時間 */
export function legText(a: LatLng, b: LatLng): string | null {
  const d = km(a, b);
  if (d == null) return null;
  if (d < 1.5) return `徒歩 約${Math.max(1, Math.round((d / 4.8) * 60))}分`;
  return `電車・バス 約${Math.round((d / 22) * 60 + 8)}分`;
}

export function sortStops(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.day_index - b.day_index || a.position - b.position);
}

export function stopsOfDay(stops: Stop[], day: number): Stop[] {
  return sortStops(stops.filter((s) => s.day_index === day));
}

export const sumCost = (stops: Stop[]) => stops.reduce((t, s) => t + (Number(s.cost) || 0), 0);

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
