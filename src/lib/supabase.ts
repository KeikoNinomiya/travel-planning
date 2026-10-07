"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** ブラウザ用の Supabase クライアント（シングルトン） */
export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(url ?? "http://localhost:54321", key ?? "missing-key", {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // メールのリンクを別のブラウザで開いてもログインできるよう implicit を使う
        flowType: "implicit",
      },
    });
  }
  return client;
}

export function errorMessage(e: unknown): string {
  if (!e) return "不明なエラーが発生しました";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "不明なエラーが発生しました";
}
