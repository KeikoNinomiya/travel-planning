"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb, errorMessage } from "@/lib/supabase";
import { CATEGORIES, type Member, type Stop, type StopInput, type Trip } from "@/lib/types";
import { dayColor, dayDate, fmtDate, fmtLongDate, km, legText, stopsOfDay, sumCost, yen } from "@/lib/trip-utils";
import StopEditor, { draftFrom, inputFrom, type EditorDraft } from "./StopEditor";
import ShareDialog from "./ShareDialog";
import SettingsDialog from "./SettingsDialog";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="center">地図を読み込み中…</div> });

type Active = "all" | number;

export default function Planner({ tripId, userId }: { tripId: string; userId: string }) {
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [stops, setStops] = useState<Stop[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState<Active>("all");
  const [view, setView] = useState<"list" | "budget">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ stopId: string | null; draft: EditorDraft } | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<"share" | "settings" | null>(null);
  const [toast, setToast] = useState("");
  const [live, setLive] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const stopsRef = useRef<Stop[]>([]);
  stopsRef.current = stops;
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const notify = useCallback((msg: string) => setToast(msg), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- 読み込み ---------- */
  const load = useCallback(async () => {
    const c = sb();
    const [t, s, m] = await Promise.all([
      c.from("trips").select("*").eq("id", tripId).maybeSingle(),
      c.from("stops").select("*").eq("trip_id", tripId).order("day_index").order("position"),
      c.from("trip_members").select("trip_id,user_id,role,email").eq("trip_id", tripId),
    ]);
    if (t.error || s.error || m.error) {
      notify(errorMessage(t.error ?? s.error ?? m.error));
      if (t.error) setTrip(null);
      return;
    }
    setTrip((t.data as Trip | null) ?? null);
    setStops((s.data as Stop[]) ?? []);
    setMembers((m.data as Member[]) ?? []);
  }, [tripId, notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (trip) setTitleDraft(trip.title);
  }, [trip?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- リアルタイム（他の人の編集を反映） ---------- */
  useEffect(() => {
    const c = sb();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    const ch = c
      .channel(`trip-${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stops", filter: `trip_id=eq.${tripId}` }, refetch)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "stops" }, (p) => {
        const oldId = (p.old as { id?: string } | null)?.id;
        if (oldId && stopsRef.current.some((s) => s.id === oldId)) refetch();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` }, refetch)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    // メンバーの増減は頻度が低いので、画面に戻ったときに読み直す
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      c.removeChannel(ch);
    };
  }, [tripId, load]);

  /* ---------- 派生データ ---------- */
  const numDays = trip?.num_days ?? 0;
  useEffect(() => {
    if (active !== "all" && active >= numDays) setActive("all");
  }, [active, numDays]);

  const shownDays = useMemo(() => (active === "all" ? Array.from({ length: numDays }, (_, i) => i) : [active]), [active, numDays]);
  const byDay = useMemo(() => shownDays.map((d) => ({ dayIndex: d, stops: stopsOfDay(stops, d) })), [shownDays, stops]);
  const dayLabels = useMemo(
    () => Array.from({ length: numDays }, (_, i) => `${i + 1}日目${trip?.day_titles[i] ? " " + trip.day_titles[i] : ""}`),
    [numDays, trip?.day_titles],
  );
  const near = useMemo(() => {
    const pts = byDay.flatMap((d) => d.stops).filter((s) => s.lat != null && s.lng != null);
    if (!pts.length) return undefined;
    return { lat: pts.reduce((t, s) => t + (s.lat as number), 0) / pts.length, lng: pts.reduce((t, s) => t + (s.lng as number), 0) / pts.length };
  }, [byDay]);

  /* ---------- 書き込み ---------- */
  async function updateTrip(patch: Partial<Trip>): Promise<boolean> {
    if (!trip) return false;
    const prev = trip;
    setTrip({ ...trip, ...patch });
    const { error } = await sb().from("trips").update(patch).eq("id", trip.id);
    if (error) {
      setTrip(prev);
      notify(errorMessage(error));
      return false;
    }
    return true;
  }

  async function patchStops(changes: { id: string; patch: Partial<Stop> }[]) {
    setStops((cur) => cur.map((s) => {
      const ch = changes.find((c) => c.id === s.id);
      return ch ? { ...s, ...ch.patch } : s;
    }));
    const results = await Promise.all(changes.map((c) => sb().from("stops").update(c.patch).eq("id", c.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      notify(errorMessage(failed.error));
      load();
    }
  }

  const nextPosition = (day: number, excludeId?: string) => {
    const list = stops.filter((s) => s.day_index === day && s.id !== excludeId);
    return list.length ? Math.max(...list.map((s) => s.position)) + 1 : 0;
  };

  async function saveEditor() {
    if (!editor) return;
    const input: StopInput = inputFrom(editor.draft);
    setSaving(true);
    if (editor.stopId === null) {
      const { data, error } = await sb()
        .from("stops")
        .insert({ ...input, trip_id: tripId, position: nextPosition(input.day_index) })
        .select("*")
        .single();
      setSaving(false);
      if (error) return notify(errorMessage(error));
      setStops((cur) => [...cur, data as Stop]);
      setSelectedId((data as Stop).id);
    } else {
      const old = stops.find((s) => s.id === editor.stopId);
      const patch: Partial<Stop> = { ...input };
      if (old && old.day_index !== input.day_index) patch.position = nextPosition(input.day_index, old.id);
      await patchStops([{ id: editor.stopId, patch }]);
      setSaving(false);
      setSelectedId(editor.stopId);
    }
    if (active !== "all" && active !== input.day_index) setActive(input.day_index);
    setEditor(null);
  }

  async function deleteStop(s: Stop) {
    setStops((cur) => cur.filter((x) => x.id !== s.id));
    const { error } = await sb().from("stops").delete().eq("id", s.id);
    if (error) {
      notify(errorMessage(error));
      load();
    } else notify(`「${s.name}」を削除しました`);
  }

  function move(s: Stop, dir: -1 | 1) {
    const list = stopsOfDay(stops, s.day_index);
    const i = list.findIndex((x) => x.id === s.id);
    const other = list[i + dir];
    if (!other) return;
    // 同じ position の場合でも確実に入れ替わるよう、並び全体を振り直す
    const reordered = [...list];
    [reordered[i], reordered[i + dir]] = [reordered[i + dir], reordered[i]];
    const changes = reordered
      .map((x, k) => ({ id: x.id, patch: { position: k } as Partial<Stop>, was: x.position }))
      .filter((c) => c.was !== c.patch.position)
      .map(({ id, patch }) => ({ id, patch }));
    patchStops(changes);
  }

  function dropOn(target: Stop) {
    const id = dragId.current;
    dragId.current = null;
    setDragOver(null);
    if (!id || id === target.id) return;
    const list = stopsOfDay(stops.filter((s) => s.id !== id), target.day_index);
    const idx = list.findIndex((s) => s.id === target.id);
    const prevPos = idx > 0 ? list[idx - 1].position : target.position - 1;
    patchStops([{ id, patch: { day_index: target.day_index, position: (prevPos + target.position) / 2 } }]);
  }

  function select(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
    setView("list");
    requestAnimationFrame(() => document.getElementById(`stop-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  /* ---------- 表示 ---------- */
  if (trip === undefined) return <div className="center">読み込み中…</div>;
  if (trip === null)
    return (
      <main className="page narrow">
        <div className="card pad stack" style={{ marginTop: "8vh" }}>
          <h1 className="h2">プランを開けません</h1>
          <p className="muted" style={{ margin: 0 }}>
            このプランは削除されたか、あなたにアクセス権がありません。招待リンクから参加してください。
          </p>
          <Link href="/trips">旅行の一覧へ</Link>
        </div>
      </main>
    );

  const first = dayDate(trip.start_date, 0);
  const last = dayDate(trip.start_date, trip.num_days - 1);
  const shownStops = byDay.flatMap((d) => d.stops);

  return (
    <main className="page">
      <header className="top">
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div className="eyebrow">
            <Link href="/trips" style={{ color: "inherit" }}>
              たびしおり
            </Link>{" "}
            ・ 旅行プラン
          </div>
          <input
            className="title-input"
            aria-label="旅行名"
            value={titleDraft}
            maxLength={100}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim();
              if (!t) setTitleDraft(trip.title);
              else if (t !== trip.title) updateTrip({ title: t });
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <div className="meta">
            <span>
              <b>
                {fmtLongDate(first)} 〜 {fmtDate(last)}
              </b>
            </span>
            <span>{trip.num_days > 1 ? `${trip.num_days - 1}泊${trip.num_days}日` : "日帰り"}</span>
            <span>スポット {stops.length}件</span>
            <span>
              予算 <b>{yen(sumCost(stops))}</b> / 1人
            </span>
            <span className={`live ${live ? "on" : ""}`} title={live ? "他のメンバーの編集が自動で反映されます" : "接続中…"}>
              <i />
              {members.length}人で編集{live ? "中" : ""}
            </span>
          </div>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => setDialog("settings")}>
            日程の設定
          </button>
          <button className="btn primary" type="button" onClick={() => setDialog("share")}>
            共有
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="表示する日">
        <button className="tab" role="tab" aria-selected={active === "all"} onClick={() => setActive("all")} type="button">
          <span className="dot" />
          全日程
        </button>
        {dayLabels.map((label, i) => (
          <button
            key={i}
            className="tab"
            role="tab"
            type="button"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            style={{ "--c": dayColor(i) } as React.CSSProperties}
          >
            <span className="dot" />
            {label} <small>{fmtDate(dayDate(trip.start_date, i))}</small>
          </button>
        ))}
      </nav>

      <div className="layout">
        <section className="card" style={{ minWidth: 0 }}>
          <div className="panel-head">
            <div className="seg" role="group" aria-label="表示切替">
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                行程
              </button>
              <button type="button" aria-pressed={view === "budget"} onClick={() => setView("budget")}>
                予算
              </button>
            </div>
            <button
              className="btn primary"
              type="button"
              onClick={() => setEditor({ stopId: null, draft: draftFrom(null, active === "all" ? 0 : active) })}
            >
              ＋ スポット追加
            </button>
          </div>

          {view === "list" ? (
            <div className="list">
              {byDay.map(({ dayIndex, stops: ds }) => (
                <div key={dayIndex} style={{ "--c": dayColor(dayIndex) } as React.CSSProperties}>
                  <div className="dayhead">
                    <h2 className="h2">{dayLabels[dayIndex]}</h2>
                    <span className="muted small">{fmtDate(dayDate(trip.start_date, dayIndex))}</span>
                    <span className="sum">{yen(sumCost(ds))}</span>
                  </div>
                  {ds.length === 0 && <div className="empty">まだスポットがありません。下のボタンから追加できます。</div>}
                  {ds.map((s, i) => {
                    const prev = ds[i - 1];
                    const lt = prev ? legText(prev, s) : null;
                    const dist = prev ? km(prev, s) : null;
                    return (
                      <div key={s.id}>
                        {prev && (
                          <div className="leg">
                            {lt ? (
                              <>
                                <span>{lt}</span>
                                <span className="mono">{dist?.toFixed(1)} km</span>
                              </>
                            ) : (
                              <span>距離不明（位置未設定）</span>
                            )}
                          </div>
                        )}
                        <div
                          id={`stop-${s.id}`}
                          className={`stop ${s.id === selectedId ? "sel" : ""} ${dragOver === s.id ? "drag-over" : ""}`}
                          draggable
                          onDragStart={(e) => {
                            dragId.current = s.id;
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", s.id);
                          }}
                          onDragOver={(e) => {
                            if (!dragId.current) return;
                            e.preventDefault();
                            setDragOver(s.id);
                          }}
                          onDragLeave={() => setDragOver((cur) => (cur === s.id ? null : cur))}
                          onDrop={(e) => {
                            e.preventDefault();
                            dropOn(s);
                          }}
                          onDragEnd={() => {
                            dragId.current = null;
                            setDragOver(null);
                          }}
                        >
                          <div className="num" title="ドラッグで並べ替え">
                            {i + 1}
                          </div>
                          <button type="button" className="body" onClick={() => select(s.id)}>
                            <div className="line1">
                              <span className="time">{s.time || "--:--"}</span>
                              <span className="name">{s.name}</span>
                              <span className="chip">{s.category}</span>
                            </div>
                            {s.note && <div className="note">{s.note}</div>}
                            {s.cost > 0 && <div className="cost">{yen(s.cost)}</div>}
                            {(s.lat == null || s.lng == null) && <div className="nopos">位置未設定（地図に表示されません）</div>}
                          </button>
                          <div className="acts">
                            <button className="icon" type="button" aria-label="上へ" disabled={i === 0} onClick={() => move(s, -1)}>
                              ↑
                            </button>
                            <button className="icon" type="button" aria-label="下へ" disabled={i === ds.length - 1} onClick={() => move(s, 1)}>
                              ↓
                            </button>
                            <button className="icon" type="button" aria-label="編集" onClick={() => setEditor({ stopId: s.id, draft: draftFrom(s, s.day_index) })}>
                              ✎
                            </button>
                            <button className="icon del" type="button" aria-label="削除" onClick={() => deleteStop(s)}>
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button className="addbtn" type="button" onClick={() => setEditor({ stopId: null, draft: draftFrom(null, dayIndex) })}>
                    ＋ {dayIndex + 1}日目にスポットを追加
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Budget stops={shownStops} days={shownDays} all={active === "all"} />
          )}
        </section>

        <section className="mapcol">
          <div className="mapbox">
            <MapView
              days={byDay}
              selectedId={selectedId}
              onSelect={select}
              picking={picking}
              onPick={(lat, lng) => {
                setEditor((cur) => (cur ? { ...cur, draft: { ...cur.draft, lat, lng } } : cur));
                setPicking(false);
              }}
              fitKey={`${active}|${trip.id}`}
            />
            {picking && (
              <div className="pickbar">
                <span>地図をクリックして位置を指定</span>
                <button type="button" onClick={() => setPicking(false)}>
                  キャンセル
                </button>
              </div>
            )}
          </div>
          <div className="mapnote">
            <span>{shownStops.filter((s) => s.lat != null).length}地点を表示</span>
            <span>移動時間は直線距離からの目安です</span>
          </div>
        </section>
      </div>

      {editor && !picking && (
        <StopEditor
          isNew={editor.stopId === null}
          draft={editor.draft}
          setDraft={(d) => setEditor({ ...editor, draft: d })}
          dayLabels={dayLabels}
          near={near}
          saving={saving}
          onCancel={() => setEditor(null)}
          onSave={saveEditor}
          onPickOnMap={() => {
            setPicking(true);
            if (active !== "all" && active !== editor.draft.day_index) setActive(editor.draft.day_index);
          }}
        />
      )}

      {dialog === "share" && <ShareDialog trip={trip} userId={userId} members={members} onChanged={load} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SettingsDialog trip={trip} stops={stops} userId={userId} onSave={updateTrip} onClose={() => setDialog(null)} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function Budget({ stops, days, all }: { stops: Stop[]; days: number[]; all: boolean }) {
  const total = sumCost(stops);
  const byCat = CATEGORIES.map((c) => [c, sumCost(stops.filter((s) => s.category === c))] as const);
  const maxC = Math.max(1, ...byCat.map((x) => x[1]));
  const byDay = days.map((d) => [d, sumCost(stops.filter((s) => s.day_index === d))] as const);
  const maxD = Math.max(1, ...byDay.map((x) => x[1]));
  return (
    <div className="budget">
      <div className="total">
        <span className="big">{yen(total)}</span>
        <span className="muted small">{all ? "旅行全体" : `${days[0] + 1}日目`}・1人あたり</span>
      </div>
      <div className="bsec">
        <h3>種類別</h3>
        {byCat.map(([c, v]) => (
          <div className="brow" key={c}>
            <span>{c}</span>
            <div className="bar">
              <i style={{ width: `${(v / maxC) * 100}%` }} />
            </div>
            <span className="val">{yen(v)}</span>
          </div>
        ))}
      </div>
      <div className="bsec">
        <h3>日別</h3>
        {byDay.map(([d, v]) => (
          <div className="brow" key={d} style={{ "--c": dayColor(d) } as React.CSSProperties}>
            <span>{d + 1}日目</span>
            <div className="bar">
              <i style={{ width: `${(v / maxD) * 100}%` }} />
            </div>
            <span className="val">{yen(v)}</span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        各スポットの「費用」を合計しています。金額はスポットの編集（✎）から変更できます。
      </p>
    </div>
  );
}
