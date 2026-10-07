"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb, errorMessage } from "@/lib/supabase";
import type { Member, Trip } from "@/lib/types";

interface Props {
  trip: Trip;
  userId: string;
  members: Member[];
  onChanged: () => void;
  onClose: () => void;
}

export default function ShareDialog({ trip, userId, members, onChanged, onClose }: Props) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isOwner = trip.owner_id === userId;

  useEffect(() => setCopied(false), [link]);

  async function createLink() {
    setBusy(true);
    setErr("");
    const { data, error } = await sb().from("trip_invites").insert({ trip_id: trip.id }).select("token").single();
    setBusy(false);
    if (error) setErr(errorMessage(error));
    else setLink(`${window.location.origin}/invite/${data.token}`);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      (document.getElementById("share-link") as HTMLInputElement | null)?.select();
    }
  }

  async function remove(m: Member) {
    setErr("");
    const { error } = await sb().from("trip_members").delete().eq("trip_id", trip.id).eq("user_id", m.user_id);
    if (error) setErr(errorMessage(error));
    else if (m.user_id === userId) router.replace("/trips");
    else onChanged();
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <h2 className="h2">共有と共同編集</h2>
        <p className="muted small" style={{ margin: 0 }}>
          招待リンクを開いてログインした人は、このプランを一緒に編集できます。リンクの有効期限は14日です。
        </p>

        {link ? (
          <div className="copybox">
            <input id="share-link" className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn primary" type="button" onClick={copy}>
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
        ) : (
          <button className="btn primary" type="button" onClick={createLink} disabled={busy}>
            招待リンクを作成
          </button>
        )}

        <div className="stack" style={{ gap: 6 }}>
          <h3 className="small muted" style={{ margin: 0, fontWeight: 500 }}>
            メンバー（{members.length}人）
          </h3>
          <ul className="members">
            {members.map((m) => (
              <li key={m.user_id}>
                <span style={{ overflowWrap: "anywhere" }}>{m.email ?? "（メール不明）"}</span>
                {m.role === "owner" && <span className="chip">作成者</span>}
                {m.user_id === userId && <span className="chip">あなた</span>}
                <span className="spacer" />
                {isOwner && m.role !== "owner" && (
                  <button className="btn ghost danger" type="button" onClick={() => remove(m)}>
                    外す
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {!isOwner &&
          (confirmLeave ? (
            <div className="row">
              <span className="small">このプランから抜けますか？</span>
              <button className="btn danger" type="button" onClick={() => remove(members.find((m) => m.user_id === userId)!)}>
                抜ける
              </button>
              <button className="btn" type="button" onClick={() => setConfirmLeave(false)}>
                やめる
              </button>
            </div>
          ) : (
            <button className="btn ghost danger" type="button" onClick={() => setConfirmLeave(true)} style={{ alignSelf: "flex-start" }}>
              このプランから抜ける
            </button>
          ))}

        {err && <div className="err">{err}</div>}
        <div className="btns">
          <button className="btn" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
