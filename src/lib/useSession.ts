"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabase";

/** undefined = 読み込み中, null = 未ログイン */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const c = sb();
    let alive = true;
    c.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data } = c.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return session;
}

/** ログインが必要なページ用。未ログインならログイン画面へ送る */
export function useRequireSession(): Session | null | undefined {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session === null) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/?next=${encodeURIComponent(next)}`);
    }
  }, [session, router]);
  return session;
}
