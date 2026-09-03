# Shift

パソコンが苦手な店舗・施設の管理者でも、iPhoneだけでスタッフのシフトを組める――複数事業所向けのシフト管理SaaSです。

商用化の全体設計・技術選定の理由・フェーズロードマップは [`docs/plan.md`](./docs/plan.md) を参照してください。このREADMEは開発を始めるための最短経路をまとめたものです。

## 技術スタック

- **フロントエンド**: Next.js 16(App Router)+ TypeScript + Tailwind CSS、PWA化。Cloudflare Workers上で[`vinext`](https://github.com/cloudflare/vinext)(ベータ)により動作
- **バックエンド**: Cloudflare D1(SQLite、Shift専用の1 Database)+ [Drizzle ORM](https://orm.drizzle.team/)
- **認証**: [Better Auth](https://better-auth.com/)(`email-otp`プラグインでメールOTPログイン)
- **課金**: Stripe Billing(Checkout / Customer Portal / Webhook)
- **ホスティング**: Cloudflare Workers
- **テスト**: Vitest(ユニット)+ Playwright(E2E、iPhone 13ビューポート)

なぜこの構成か(Vercel + Supabaseから移行した経緯、D1にRow-Level Securityが無いことへの対策など)は `docs/plan.md` の「インフラ方針の変遷」「テナント分離モデル(D1版)」を参照してください。全プロジェクト共通のCloudflare Workers + D1方針は `~/.claude/CLAUDE.md` にまとめています。

## `legacy/` について

`legacy/index.html` と `legacy/shift4.html` は、商用化以前の単体HTMLプロトタイプです。ブラウザのlocalStorageのみで動く一人用ツールで、サーバー・認証・課金は一切ありません。今の実装はゼロから作り直したものですが、両プロトタイプの機能(自動生成・交代申請・給与概算・労基アラート等)は移植・改善の参照元として残しています。機能パリティが確認できるまで([`docs/plan.md`](./docs/plan.md) の Phase 4 参照)は削除しません。

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を埋める(下記参照)
npm run dev:vinext           # Cloudflare Workersランタイムで起動(D1バインディング込み)
```

http://localhost:3000 で起動します。`npm run dev`(素のNext.js)も動きますが、D1バインディングやWorkers固有の挙動は再現されないため、実装確認は `dev:vinext` を使ってください。

### 環境変数

`.env.example` を参照。D1データベースそのものは `wrangler.jsonc` のバインディング(`DB`)経由でアクセスするため環境変数ではありません。

| 変数 | 用途 |
|---|---|
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Authのセッション署名鍵とベースURL |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe連携 |
| `RESEND_API_KEY` | メールOTPコードの送信(Better Authの`sendVerificationOTP`フックから使用) |

### D1データベースのマイグレーション

```bash
npx drizzle-kit generate                              # drizzle/schema.ts からSQLマイグレーションを生成
npx wrangler d1 migrations apply shift-db --local      # ローカルD1レプリカへ適用
npx wrangler d1 migrations apply shift-db --remote     # 本番D1へ適用(要デプロイ権限)
```

スキーマは [`drizzle/schema.ts`](./drizzle/schema.ts)(アプリ本体)と [`drizzle/auth-schema.ts`](./drizzle/auth-schema.ts)(Better Auth、手書き)にあります。事業所ごとのデータ分離はD1にRow-Level Securityが無いため、`lib/db/scopedClient.ts` 経由のアクセスのみを許可する構成(ESLintで強制)+ クロステナント分離テストで担保しています(設計意図は `docs/plan.md` の「テナント分離モデル(D1版)」参照)。

## テスト

```bash
npm run lint              # ESLint(生のD1クライアントimportの制限ルールも含む)
npm run typecheck         # アプリ本体
npm run typecheck:worker  # app/sw.ts(Service Worker、dom libと衝突するため別tsconfig)
npm run test              # Vitest(ユニットテスト)
npm run e2e                # Playwright(iPhone 13ビューポートでのE2E)
```

`lib/labor-rules.ts`(勤務ルール警告の判定)と `lib/shift-generator/`(自動生成アルゴリズム)は特にテストを厚くしています。バグが給与ミスや不当な警告に直結する箇所のため([`docs/plan.md`](./docs/plan.md) 検証方法節参照)。`lib/db/scopedClient.isolation.test.ts` はテナント分離の自動テストで、マルチテナントSaaSとして最重要の正しさを担保します。

CIは `.github/workflows/ci.yml` で lint / typecheck / test / e2e を毎PR実行します。

## ディレクトリ構成

```
app/(marketing)/    … ランディング・料金ページ
app/(auth)/         … login/signup(メールOTP主導線)
app/(app)/          … 認証必須エリア(今日/スタッフ/週表示/交代/設定/課金)
app/print/          … 印刷専用ビュー
app/api/auth/       … Better Authのルートハンドラー
app/api/stripe/     … Stripe Webhook
lib/shift-generator/ … シフト自動生成(下書きを作るだけ。確定は手動)
lib/labor-rules.ts   … 勤務ルール警告の判定ロジック
lib/db/               … raw.ts(D1バインディング直アクセス、import制限対象)/ scopedClient.ts(org_idスコープ付きアクセス)
lib/auth/             … Better Auth設定・サーバーアクション
drizzle/               … スキーマ定義 + マイグレーション
docs/plan.md          … 商用化計画の全文
docs/legal/            … 特定商取引法表記・利用規約等(Phase 2で整備)
e2e/                    … Playwright
wrangler.jsonc          … Cloudflare Workers設定(D1バインディング等)
```

## 今どのフェーズか

現在は **Phase 1a.5(Supabase版からCloudflare D1版へのインフラ移行)** です。スタッフ管理・シフト種別設定・今日ビューでの手動割当・印刷ビューはPhase 1aで実装済みで、その基盤をCloudflare Workers + D1 + Better Authへ差し替えています。詳細は `docs/plan.md` の「フェーズロードマップ」「既存実装の移行計画」を参照してください。
