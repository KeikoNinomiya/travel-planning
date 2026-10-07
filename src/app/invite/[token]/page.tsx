"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sb, errorMessage } from "@/lib/supabase";
import { useRequireSession } from "@/lib/useSession";
import { dayDate, fmtDate, fmtLongDate } from "@/lib/trip-utils";

interface InviteInfo {
  trip_id: string;
  title: string;
  start_date: string;
  num_days: number;
  already_member: boolean;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const session = useRequireSession();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    sb()
      .rpc("invite_info", { p_token: token })
      .then(({ data, error }) => {
        if (error) setErr(errorMessage(error));
        const row = (data as InviteInfo[] | null)?.[0] ?? null;
        setInfo(row);
      });
  }, [session, token]);

  async function join() {
    setBusy(true);
    const { data, error } = await sb().rpc("accept_invite", { p_token: token });
    if (error) {
      setErr(errorMessage(error));
      setBusy(false);
      return;
    }
    router.replace(`/trips/${data as string}`);
  }

  if (!session || info === undefined) return <div className="center">読み込み中…</div>;

  return (
    <main className="page narrow">
      <div className="card pad stack" style={{ marginTop: "8vh" }}>
        <div className="eyebrow">たびしおり ・ 招待</div>
        {info ? (
          <>
            <h1 className="h1">{info.title}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {fmtLongDate(dayDate(info.start_date, 0))} 〜 {fmtDate(dayDate(info.start_date, info.num_days - 1))}
            </p>
            {info.already_member ? (
              <Link className="btn primary" href={`/trips/${info.trip_id}`}>
                プランを開く（参加済み）
              </Link>
            ) : (
              <button className="btn primary" type="button" onClick={join} disabled={busy}>
                このプランに参加して一緒に編集する
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="h2">招待リンクが無効です</h1>
            <p className="muted" style={{ margin: 0 }}>
              リンクの有効期限（14日）が切れているか、取り消された可能性があります。招待した人に新しいリンクを依頼してください。
            </p>
          </>
        )}
        {err && <div className="err">{err}</div>}
        <Link href="/trips" className="small">
          旅行の一覧へ
        </Link>
      </div>
    </main>
  );
}
