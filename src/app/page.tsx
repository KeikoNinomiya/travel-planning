"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb, supabaseConfigured, errorMessage } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

function nextPath(): string {
  if (typeof window === "undefined") return "/trips";
  const n = new URLSearchParams(window.location.search).get("next");
  // 自サイト内のパスだけ許可
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/trips";
}

export default function LoginPage() {
  const session = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (session) router.replace(nextPath());
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSending(true);
    const { error } = await sb().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/?next=" + encodeURIComponent(nextPath()) },
    });
    setSending(false);
    if (error) setErr(errorMessage(error));
    else setSent(true);
  }

  return (
    <main className="page narrow">
      <section className="hero">
        <div>
          <div className="eyebrow">旅行プランナー</div>
          <h1 className="h1">たびしおり</h1>
          <p className="lead">
            日ごとの行程、地図、予算をひとつにまとめて、一緒に行く人と同時に編集できます。
          </p>
        </div>

        {!supabaseConfigured && (
          <div className="card pad err">
            Supabase の接続設定がありません。README の手順に沿って <code>.env.local</code> を作成してください。
          </div>
        )}

        <div className="card pad stack">
          {sent ? (
            <>
              <h2 className="h2">メールを確認してください</h2>
              <p className="muted" style={{ margin: 0 }}>
                {email} 宛てにログイン用のリンクを送りました。メール内のリンクを開くとログインできます。
              </p>
              <button className="btn" type="button" onClick={() => setSent(false)}>
                別のメールアドレスを使う
              </button>
            </>
          ) : (
            <form className="stack" onSubmit={submit}>
              <h2 className="h2">ログイン / 新規登録</h2>
              <div className="field">
                <label htmlFor="email">メールアドレス</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {err && <div className="err">{err}</div>}
              <button className="btn primary" type="submit" disabled={sending || !supabaseConfigured}>
                {sending ? "送信中…" : "ログイン用リンクを送る"}
              </button>
              <p className="muted small" style={{ margin: 0 }}>
                パスワードは不要です。初めての方もこのまま登録されます。
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
