"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type Category, type Stop, type StopInput } from "@/lib/types";
import { searchPlaces, type PlaceResult } from "@/lib/places";
import { errorMessage } from "@/lib/supabase";

export interface EditorDraft {
  name: string;
  day_index: number;
  time: string;
  category: Category;
  cost: string;
  note: string;
  lat: number | null;
  lng: number | null;
}

export function draftFrom(stop: Stop | null, dayIndex: number): EditorDraft {
  return stop
    ? {
        name: stop.name,
        day_index: stop.day_index,
        time: stop.time ?? "",
        category: stop.category,
        cost: stop.cost ? String(stop.cost) : "",
        note: stop.note ?? "",
        lat: stop.lat,
        lng: stop.lng,
      }
    : { name: "", day_index: dayIndex, time: "", category: "観光", cost: "", note: "", lat: null, lng: null };
}

export function inputFrom(d: EditorDraft): StopInput {
  return {
    name: d.name.trim(),
    day_index: d.day_index,
    time: d.time || null,
    category: d.category,
    cost: Math.max(0, Math.round(Number(d.cost) || 0)),
    note: d.note.trim(),
    lat: d.lat,
    lng: d.lng,
  };
}

interface Props {
  isNew: boolean;
  draft: EditorDraft;
  setDraft: (d: EditorDraft) => void;
  dayLabels: string[];
  near?: { lat: number; lng: number };
  onPickOnMap: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

export default function StopEditor({ isNew, draft, setDraft, dayLabels, near, onPickOnMap, onCancel, onSave, saving }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchErr, setSearchErr] = useState("");
  const [err, setErr] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // 入力が止まってから検索（Photon への負荷を抑える）
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, near, ac.signal)
        .then((r) => {
          setResults(r);
          setSearchErr(r.length ? "" : "見つかりませんでした。別の言い方で試すか、地図で指定してください。");
        })
        .catch((e) => {
          if ((e as Error).name !== "AbortError") setSearchErr(errorMessage(e));
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, near]);

  function choose(p: PlaceResult) {
    setDraft({ ...draft, name: draft.name.trim() ? draft.name : p.name, lat: p.lat, lng: p.lng });
    setQuery("");
    setResults([]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setErr("スポット名を入力してください。");
      return;
    }
    onSave();
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="sheet" onSubmit={submit} autoComplete="off">
        <h2 className="h2">{isNew ? "スポットを追加" : "スポットを編集"}</h2>

        <div className="field">
          <label htmlFor="se-search">場所を検索（OpenStreetMap）</label>
          <input id="se-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：銀閣寺、京都タワー" />
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => choose(r)}>
                    {r.name}
                    <span className="d">{r.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchErr && query.trim().length >= 2 && <span className="muted small">{searchErr}</span>}
        </div>

        <div className="field">
          <label htmlFor="se-name">スポット名</label>
          <input id="se-name" ref={nameRef} value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="se-day">日程</label>
            <select id="se-day" value={draft.day_index} onChange={(e) => setDraft({ ...draft, day_index: Number(e.target.value) })}>
              {dayLabels.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="se-time">時刻</label>
            <input id="se-time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="se-cat">種類</label>
            <select id="se-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="se-cost">費用（1人・円）</label>
            <input id="se-cost" type="number" min={0} step={10} inputMode="numeric" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="se-note">メモ</label>
          <textarea id="se-note" rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>

        <div className="field">
          <label>位置</label>
          <div className="row">
            <button type="button" className="btn" onClick={onPickOnMap}>
              地図で位置を指定
            </button>
            <span className="mono small muted">
              {draft.lat == null || draft.lng == null ? "未設定" : `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
            </span>
            {draft.lat != null && (
              <button type="button" className="btn ghost" onClick={() => setDraft({ ...draft, lat: null, lng: null })}>
                位置を消す
              </button>
            )}
          </div>
        </div>

        {err && <div className="err">{err}</div>}
        <div className="btns">
          <button type="button" className="btn" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
