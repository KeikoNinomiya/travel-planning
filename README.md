# たびしおり

日ごとの行程・地図・予算をまとめて、一緒に行く人と同時に編集できる旅行プランナーです。

- **行程**：日ごとのタブ、スポットの追加・編集・削除、ドラッグや ↑↓ での並べ替え、別の日への移動
- **地図**：OpenStreetMap（OpenFreeMap のタイル）に番号付きピンと日ごとのルートを表示。地図クリックで位置指定
- **スポット検索**：OpenStreetMap のデータを使う Photon API（APIキー不要）
- **予算**：1人あたりの費用を種類別・日別に集計
- **共同編集**：メールのリンクでログイン、招待リンクでメンバーを追加。他の人の編集は自動で反映
- **サンプル**：大阪→京都 2泊3日のプランをワンクリックで作成

## 技術構成

| 役割 | 使っているもの | 料金 |
| --- | --- | --- |
| 画面 | Next.js 16 / React 19 / TypeScript | 無料 |
| ログイン・データベース・リアルタイム | Supabase | 無料枠あり |
| 地図 | MapLibre GL JS + OpenFreeMap（OpenStreetMap データ） | 無料・キー不要 |
| スポット検索 | Photon（komoot） | 無料・キー不要 |
| 公開 | Vercel | 無料枠あり |

## セットアップ

### 1. Supabase プロジェクトを作る

1. https://supabase.com でプロジェクトを作成します（リージョンは Tokyo がおすすめ）。
2. 左メニュー **SQL Editor** を開き、[`supabase/schema.sql`](supabase/schema.sql) の中身を貼り付けて **Run** を押します。
3. **Project Settings → API** から次の2つを控えます。
   - Project URL
   - Publishable key（`sb_publishable_...`）。旧形式の anon key でも動きます。

### 2. 手元で動かす

```bash
npm install
cp .env.example .env.local   # 控えた URL とキーを書き込む
npm run dev                  # http://localhost:3000
```

### 3. ログイン用リンクの戻り先を登録する

Supabase の **Authentication → URL Configuration** で次を設定します。

- **Site URL**：本番の URL（例 `https://tabi-shiori.vercel.app`）。手元だけなら `http://localhost:3000`
- **Redirect URLs**：`http://localhost:3000/**` と `https://<本番のドメイン>/**`

### 4. Vercel で公開する

1. https://vercel.com で **Add New → Project** を選び、この GitHub リポジトリを読み込みます。
2. **Environment Variables** に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を登録して **Deploy** を押します。
3. 発行された URL を、手順3の Site URL と Redirect URLs に追加します。

以降は GitHub に push するたびに自動で反映されます。

## 使い方

1. メールアドレスを入力し、届いたリンクを開いてログインします。
2. 「サンプル（大阪→京都）を作成」か「＋ 新しい旅行」でプランを作ります。
3. 「共有」から招待リンクを作り、一緒に行く人に送ります。相手はリンクを開いてログインすると編集に参加できます。

## フォルダ構成

```
src/
  app/
    page.tsx              ログイン
    trips/page.tsx        旅行の一覧・作成
    trips/[id]/page.tsx   プラン編集
    invite/[token]/       招待リンクからの参加
  components/
    Planner.tsx           行程・予算・リアルタイム反映
    MapView.tsx           地図（MapLibre）
    StopEditor.tsx        スポット追加・編集（場所検索つき）
    ShareDialog.tsx       招待リンク・メンバー管理
    SettingsDialog.tsx    出発日・日数・各日のタイトル
  lib/                    Supabase 接続、型、計算、サンプルデータ
supabase/schema.sql       テーブル・権限・招待用関数
```

## データと権限

- `trips`（旅行）、`trip_members`（メンバー）、`stops`（スポット）、`trip_invites`（招待リンク）の4テーブルです。
- 行レベルセキュリティにより、メンバーだけが旅行とスポットを読み書きできます。旅行の削除とメンバーを外す操作は作成者だけが行えます。
- 招待リンクの有効期限は14日です。

## 注意点

- 移動時間は直線距離からの目安です（徒歩は1.5km未満、それ以上は電車・バスとして計算）。
- OpenFreeMap と Photon は無料の公開サービスです。利用者が大きく増えたら、有料のタイル配信や自前の検索サーバーへの切り替えを検討してください。
- 地図の右下に表示される OpenStreetMap のクレジット表記は、利用条件により消さずに残してください。

## 今後の拡張案

- ルート検索（実際の電車・徒歩の所要時間）
- 予約メールの取り込み、持ち物リスト
- スマホのホーム画面に追加できる PWA 化
- Google Maps への切り替え（スポットの写真・口コミ）
