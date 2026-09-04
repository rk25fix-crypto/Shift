# デプロイ手順(Cloudflare Workers Builds)

Shiftは Next.js(App Router)+ [`vinext`](https://github.com/cloudflare/vinext) で Cloudflare Workers 向けにビルドします。デプロイは GitHub Actions ではなく、**Cloudflare Workers Builds**(Cloudflareが `main` への push を直接検知して自動ビルド・デプロイする、Git連携の仕組み)を使います。otayori-makerの Cloudflare Pages Git連携と同じ考え方の、Workers版です。

## セットアップ状況

- [x] Cloudflare D1データベース作成済み(`shift-db` / `shift-db-preview`)、マイグレーション適用済み
- [x] ローカルでの `npm run build`(vinextビルド)、`npm run start`(`wrangler dev` でビルド済みWorkerを起動)は動作確認済み
- [ ] Workers Builds でのGit連携設定
- [ ] 本番用シークレットの設定
- [ ] 実際のデプロイ動作確認

## 1. Workers Builds プロジェクトの作成

1. https://dash.cloudflare.com/ → 左メニュー「Workers & Pages」→「作成」
2. 「Import a repository」(または「Connect to Git」)を選択し、GitHubアカウントを連携
   - Cloudflareの GitHub App にリポジトリへのアクセス権を付与する画面が出る。`rk25fix-crypto/shift` を選択(全リポジトリへのアクセスを許可してもよい)
3. リポジトリ `rk25fix-crypto/shift` を選択
4. ビルド設定:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Deploy command**: `npm run deploy`(`wrangler deploy` を直接指定しないこと — Shiftの `deploy` スクリプトは `vinext build` が生成する `dist/server/wrangler.json` を指す設定になっているため)
   - **Root directory**: 空欄のまま(リポジトリ直下)
5. 「保存してデプロイ」

これで `main` への push のたびに自動でビルド・デプロイされます。プレビュー環境(PRごとのデプロイ)が必要になったらプロジェクト設定の「Preview deployments」で有効化してください。

### つまずきポイント(想定)

- otayori-makerの時と違い、Cloudflareの「Create an app」画面はデフォルトで **Workers用**のセットアップに直結しているはず(Pagesへの誘導リンクを探す必要はない)。今回はそれでOK。
- Workers Builds は「プロジェクト作成後にpushされたコミット」からデプロイを開始する。プロジェクト作成前に存在していたブランチへの過去のpushはWebhookが発火しないため、作成後に新しくpushするか、ダッシュボードから手動で最初のデプロイを走らせる必要がある。

## 2. 本番用シークレットの設定

Workers Builds プロジェクトの「設定」→「変数とシークレット」で以下を追加(Workerの実行時に読まれる、ビルド時の環境変数とは別枠):

| 変数名 | 用途 | 種別 | 必須 |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | Better Authのセッション署名鍵(ランダムな長い文字列。`openssl rand -base64 32` などで生成) | シークレット | 必須(無いとログインが機能しない) |
| `BETTER_AUTH_URL` | 本番のベースURL(例: `https://shift.<account>.workers.dev`、デプロイ後に確定) | 通常 | 必須 |
| `RESEND_API_KEY` | メールOTPコードの送信(https://resend.com/api-keys) | シークレット | 必須(無いとOTPメールが送信できない) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe課金連携 | シークレット | Phase 2まで不要(billing機能はまだUI未実装) |

D1データベース(`DB`バインディング)は `wrangler.jsonc` に既に定義済みで、シークレットではなくバインディングとして自動的に渡されるため、ここでの設定は不要です。

## 3. 動作確認

1. Workers Buildsのデプロイ完了後に発行されるURL(`https://<worker-name>.<account>.workers.dev`)を開く
2. マーケティングページ・`/login`・`/signup` が表示されること、メールアドレス入力→OTPコードがメールで届くことを確認
3. サインアップ後、事業所作成→スタッフ登録→今日ビューでのシフト割当が一通り動くことを確認

## ローカル開発・デプロイ確認

```bash
npm install
cp .env.example .env.local   # BETTER_AUTH_SECRET 等を埋める
npm run dev                  # Cloudflare Workersランタイムで起動(D1バインディング込み)

# ビルド済みWorkerをローカルでwranglerとして動かす場合(本番と同じ経路の確認)
npm run build
npm run start
```

`npm run dev`(`vinext dev`)はライブリロード付きのローカル開発用です。CI(`.github/workflows/ci.yml`)のE2Eテストは `npm run build && npm run start`(`wrangler dev` でビルド済みWorkerを動かす方式)を使っています — `vinext dev` はCIランナー上で起動が固まる問題が確認されているためです(詳細はgitログの該当コミット参照)。
