"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb, errorMessage } from "@/lib/supabase";
import { useRequireSession } from "@/lib/useSession";
import { createSampleTrip } from "@/lib/sample";
import type { Trip } from "@/lib/types";
import { dayDate, fmtLongDate, fmtDate, todayISO } from "@/lib/trip-utils";

export default function TripsPage() {
  const session = useRequireSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(todayISO());
  const [days, setDays] = useState(3);

  const load = useCallback(async () => {
    const { data, error } = await sb().from("trips").select("*").order("start_date", { ascending: true });
    if (error) setErr(errorMessage(error));
    else setTrips(data as Trip[]);
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setErr("");
    const { data, error } = await sb()
      .from("trips")
      .insert({
        title: title.trim() || "新しい旅行",
        start_date: start,
        num_days: days,
        day_titles: Array.from({ length: days }, () => ""),
        owner_id: session.user.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) setErr(errorMessage(error));
    else router.push(`/trips/${data.id}`);
  }

  async function createSample() {
    if (!session) return;
    setBusy(true);
    setErr("");
    try {
      const id = await createSampleTrip(sb(), session.user.id);
      router.push(`/trips/${id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  if (!session) return <div className="center">読み込み中…</div>;

  return (
    <main className="page">
      <header className="top">
        <div>
          <div className="eyebrow">たびしおり</div>
          <h1 className="h1">旅行の一覧</h1>
          <div className="meta">
            <span>{session.user.email}</span>
          </div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={createSample} disabled={busy}>
            サンプル（大阪→京都）を作成
          </button>
          <button className="btn primary" type="button" onClick={() => setShowNew(true)} disabled={busy}>
            ＋ 新しい旅行
          </button>
          <button className="btn ghost" type="button" onClick={() => sb().auth.signOut()}>
            ログアウト
          </button>
        </div>
      </header>

      {err && <div className="err">{err}</div>}

      {trips === null ? (
        <div className="center">読み込み中…</div>
      ) : trips.length === 0 ? (
        <div className="card pad stack">
          <h2 className="h2">まだ旅行がありません</h2>
          <p className="muted" style={{ margin: 0 }}>
            「＋ 新しい旅行」から作成するか、サンプルの大阪→京都 2泊3日で使い方を試してみてください。
          </p>
        </div>
      ) : (
        <div className="trip-list">
          {trips.map((t) => {
            const a = dayDate(t.start_date, 0);
            const b = dayDate(t.start_date, t.num_days - 1);
            return (
              <Link key={t.id} href={`/trips/${t.id}`} className="card trip-card">
                <span className="title">{t.title}</span>
                <span className="muted small">
                  {fmtLongDate(a)} 〜 {fmtDate(b)}・{t.num_days > 1 ? `${t.num_days - 1}泊` : "日帰り"}
                  {t.num_days}日
                </span>
                {t.owner_id !== session.user.id && <span className="chip" style={{ alignSelf: "flex-start" }}>共有されたプラン</span>}
              </Link>
            );
          })}
        </div>
      )}

      {showNew && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setShowNew(false)}>
          <form className="sheet" onSubmit={createTrip}>
            <h2 className="h2">新しい旅行</h2>
            <div className="field">
              <label htmlFor="nt-title">旅行名</label>
              <input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：北海道 3泊4日" maxLength={100} />
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="nt-start">出発日</label>
                <input id="nt-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="nt-days">日数</label>
                <input id="nt-days" type="number" min={1} max={30} required value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
            </div>
            <div className="btns">
              <button className="btn" type="button" onClick={() => setShowNew(false)}>
                キャンセル
              </button>
              <button className="btn primary" type="submit" disabled={busy}>
                作成する
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
