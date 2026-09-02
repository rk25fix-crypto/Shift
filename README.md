# Shift

パソコンが苦手な店舗・施設の管理者でも、iPhoneだけでスタッフのシフトを組める――複数事業所向けのシフト管理SaaSです。

商用化の全体設計・技術選定の理由・フェーズロードマップは [`docs/plan.md`](./docs/plan.md) を参照してください。このREADMEは開発を始めるための最短経路をまとめたものです。

## 技術スタック

- **フロントエンド**: Next.js 16(App Router)+ TypeScript + Tailwind CSS + shadcn/ui、PWA化(`@serwist/next`)
- **バックエンド**: Supabase(Postgres + Auth + Row-Level Security)— マルチテナントのデータ分離をDB層のRLSで強制
- **課金**: Stripe Billing(Checkout / Customer Portal / Webhook)
- **ホスティング**: Vercel(フロント)+ Supabase Cloud(DB)
- **テスト**: Vitest(ユニット)+ Playwright(E2E、iPhone 13ビューポート)

なぜこの構成か(Cloudflareではなく Vercel + Supabase を選んだ理由など)は `docs/plan.md` の「技術スタック」節、特に「採用しなかった選択肢と理由」を参照してください。

## `legacy/` について

`legacy/index.html` と `legacy/shift4.html` は、商用化以前の単体HTMLプロトタイプです。ブラウザのlocalStorageのみで動く一人用ツールで、サーバー・認証・課金は一切ありません。今の実装はゼロから作り直したものですが、両プロトタイプの機能(自動生成・交代申請・給与概算・労基アラート等)は移植・改善の参照元として残しています。機能パリティが確認できるまで([`docs/plan.md`](./docs/plan.md) の Phase 4 参照)は削除しません。

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を埋める(下記参照)
npm run dev
```

http://localhost:3000 で起動します。

### 環境変数

`.env.example` を参照。最低限、以下がないと開発サーバーは起動しますが認証系ページで実際のログインはできません(未設定時は「未認証」扱いにフォールバックします — `lib/supabase/middleware.ts`)。

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseクライアント(ブラウザ・サーバー共通) |
| `SUPABASE_SERVICE_ROLE_KEY` | RLSを完全にバイパスするサービスロールキー。Stripe Webhook (`app/api/stripe/webhook/route.ts`) と `lib/admin/**` 以外からの import は `eslint.config.mjs` の `no-restricted-imports` で禁止 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe連携 |
| `RESEND_API_KEY` | トランザクションメール(将来、Supabase Authのカスタムメール送信にも使用) |

### Supabaseのローカル環境(スキーマ・RLS)

```bash
npx supabase start          # Docker が必要
npx supabase db reset       # supabase/migrations/ を適用
```

スキーマとRLSポリシーは [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) にあります。事業所ごとのデータ分離は共有スキーマ + Row-Level Securityで実現しています(設計意図は `docs/plan.md` の「マルチテナント・認証モデル」参照)。

## テスト

```bash
npm run lint              # ESLint(service_role importの制限ルールも含む)
npm run typecheck         # アプリ本体
npm run typecheck:worker  # app/sw.ts(Service Worker、dom libと衝突するため別tsconfig)
npm run test              # Vitest(ユニットテスト)
npm run e2e                # Playwright(iPhone 13ビューポートでのE2E)
```

`lib/labor-rules.ts`(勤務ルール警告の判定)と `lib/shift-generator/`(自動生成アルゴリズム)は特にテストを厚くしています。バグが給与ミスや不当な警告に直結する箇所のため([`docs/plan.md`](./docs/plan.md) 検証方法節参照)。

CIは `.github/workflows/ci.yml` で lint / typecheck / test / e2e を毎PR実行します。

## ディレクトリ構成

```
app/(marketing)/    … ランディング・料金ページ
app/(auth)/         … login/signup(メールOTP主導線)
app/(app)/          … 認証必須エリア(今日/スタッフ/週表示/交代/設定/課金)
app/print/          … 印刷専用ビュー
app/api/stripe/     … Stripe Webhook
lib/shift-generator/ … シフト自動生成(下書きを作るだけ。確定は手動)
lib/labor-rules.ts   … 勤務ルール警告の判定ロジック
lib/supabase/        … browser/server/service の3クライアントを分離(service_roleは用途限定)
supabase/migrations/ … スキーマ + RLSポリシー
docs/plan.md          … 商用化計画の全文
docs/legal/            … 特定商取引法表記・利用規約等(Phase 2で整備)
e2e/                    … Playwright
```

## 今どのフェーズか

現在は **Phase 0(基盤構築)** です。認証・課金・スケジュール画面はまだ骨組みのみで、実際の機能実装は Phase 1a から順に進めます。詳細は `docs/plan.md` の「フェーズロードマップ」を参照してください。
