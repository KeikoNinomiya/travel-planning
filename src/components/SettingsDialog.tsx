"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sb, errorMessage } from "@/lib/supabase";
import type { Stop, Trip } from "@/lib/types";
import { dayDate, fmtDate } from "@/lib/trip-utils";

interface Props {
  trip: Trip;
  stops: Stop[];
  userId: string;
  onSave: (patch: Partial<Trip>) => Promise<boolean>;
  onClose: () => void;
}

export default function SettingsDialog({ trip, stops, userId, onSave, onClose }: Props) {
  const router = useRouter();
  const [start, setStart] = useState(trip.start_date);
  const [numDays, setNumDays] = useState(trip.num_days);
  const [titles, setTitles] = useState<string[]>(() => Array.from({ length: 30 }, (_, i) => trip.day_titles[i] ?? ""));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastUsedDay = stops.reduce((m, s) => Math.max(m, s.day_index), -1);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (numDays < lastUsedDay + 1) {
      setErr(`${lastUsedDay + 1}日目にスポットがあるため、${numDays}日には減らせません。先にスポットを移動または削除してください。`);
      return;
    }
    setBusy(true);
    const ok = await onSave({ start_date: start, num_days: numDays, day_titles: titles.slice(0, numDays).map((t) => t.trim()) });
    setBusy(false);
    if (ok) onClose();
  }

  async function del() {
    setBusy(true);
    const { error } = await sb().from("trips").delete().eq("id", trip.id);
    setBusy(false);
    if (error) setErr(errorMessage(error));
    else router.replace("/trips");
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={save}>
        <h2 className="h2">日程の設定</h2>
        <div className="grid2">
          <div className="field">
            <label htmlFor="st-start">出発日</label>
            <input id="st-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-days">日数</label>
            <input id="st-days" type="number" min={1} max={30} value={numDays} onChange={(e) => setNumDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {Array.from({ length: numDays }, (_, i) => (
            <div className="field" key={i}>
              <label htmlFor={`st-t${i}`}>
                {i + 1}日目 {fmtDate(dayDate(start || trip.start_date, i))} のタイトル
              </label>
              <input
                id={`st-t${i}`}
                value={titles[i]}
                maxLength={40}
                placeholder="例：京都 東山"
                onChange={(e) => setTitles(titles.map((t, k) => (k === i ? e.target.value : t)))}
              />
            </div>
          ))}
        </div>
        {err && <div className="err">{err}</div>}
        <div className="btns">
          {trip.owner_id === userId &&
            (confirmDelete ? (
              <>
                <span className="small err" style={{ alignSelf: "center" }}>
                  プランと全スポットを削除します
                </span>
                <button className="btn danger" type="button" onClick={del} disabled={busy}>
                  削除する
                </button>
                <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                  やめる
                </button>
              </>
            ) : (
              <button className="btn ghost danger" type="button" onClick={() => setConfirmDelete(true)}>
                プランを削除
              </button>
            ))}
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn primary" type="submit" disabled={busy}>
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
