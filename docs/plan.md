# Shift 商用化計画:iPhoneで使える複数事業所向けシフト管理SaaS

## Context(なぜこの計画か)

現状の `/home/user/Shift` は、2つの独立した単体HTMLファイル(`index.html`:保育園早出シフトメーカー、`shift4.html`:シフト作成アプリV7)だけで構成されたプロトタイプだった。どちらもCDN読み込みのフロントエンドのみで、サーバー・DB・認証・課金・テスト・デプロイ設定が一切なく、ブラウザのlocalStorageにデータを溜めるだけの「一人・一ブラウザ」用ツール。

ユーザーの狙いは「パソコンを使わない店舗・施設の管理者が、iPhoneだけでシフトを組めて、それを複数事業所に月額課金で販売する」こと。Phase 0〜Phase 1a(下記)でNext.js + Supabaseによる実装を完了させ、PR #1として提出済み。その後、**Shift単体の都合ではなく、今後複数の小規模Webアプリを開発・販売していく際の共通インフラ基盤として、Cloudflare Workers + D1へ切り替える方針転換**があった(2026-09-03)。

決定済み事項(ユーザー確認済み):
1. **配布形態**: まずPWA(Safariの「ホーム画面に追加」)で提供。ネイティブiOSアプリは将来検討。
2. **販売モデル**: 複数事業所向けB2B SaaS、月額課金(Stripe)。事業所ごとにデータ完全分離。
3. **機能ベース**: `index.html`のシンプルさ + `shift4.html`の交代申請・給与概算・労基アラートを合わせて再設計。
4. **インフラ(2026-09-03 最終決定)**: **Cloudflare Workers + D1**。詳細な経緯・理由は「インフラ方針の変遷」節を参照。全プロジェクト共通の方針として `~/.claude/CLAUDE.md` にも反映する(「共通指針ドキュメント」節参照)。
5. **認証方式**: メールOTP(6桁コード)入力方式を主導線にする。マジックリンクは補助。理由: iOSでは「ホーム画面に追加したPWA」と「Safari」はCookie/localStorageを共有しないため、メールのリンクをタップするとSafariでログインしてしまい、ホーム画面のPWA本体は未ログインのままになる事故が起きる。非IT管理者の初回体験が壊れるため、PWA内で完結するOTP入力を主導線にする。

## 3C分析:このアプリならではの価値(2026-09-02 追記)

Phase 0(基盤構築)完了・PR #1オープン後、Phase 1a着手前に「他のシフト管理サービスにない価値は何か」を明確化するため実施。

### Customer(顧客の悩み)

- ターゲットは「PCを日常使わない店舗・施設の管理者」。市場調査の結果、**既存のシフト管理SaaSの多くが管理者側の利用を明示的にPC/タブレット前提としている**ことが分かった(例:Airシフトは公式に「管理者はPC・タブレット対応、スマホでの利用は非推奨」と明記)。つまりこの層は既存サービスから正面から取りこぼされている。
- 両プロトタイプ(`legacy/index.html`→`legacy/shift4.html`)の機能進化そのものが、実際に困っていたことの記録になっている:
  1. 制約(固定休・特定シフト不可・必要人数)を守りながら手作業で組む時間とミス
  2. スタッフ間のワークロード公平性への配慮
  3. 急な欠勤・交代調整がLINE/電話任せで記録が残らず、二重登録などのミスが起きる
  4. 給与・残業計算を別のExcelでやり直す二度手間
  5. 連勤・残業などの労務コンプライアンスを目視でチェックしきれない
- 希望シフトの提出締切管理(誰が出してないか)や急な変更対応も一般的な悩みとして裏付けが取れた。

### Competitor(競合)

- **汎用シフト管理SaaS**(ジョブカン、Airシフト、シフオプ等): 従量課金(1人月100〜300円)or 店舗課金(月2,000〜5,000円)。機能は豊富だが管理者側はPC/タブレット前提で、非IT管理者には操作・設定が重い。
- **保育・教育業界特化の総合園務システム**(コドモン、ルクミー、キッズナコネクト等): シフトだけでなく登降園管理・請求・指導案など20以上の機能を統合、月額数万円〜(施設単位契約)。管理画面はPC想定。小規模園には過大なコスト・学習負荷。
- **無料の紙/スプレッドシート運用**: コストゼロだが自動割当・労務チェック・交代管理が一切なく、属人化したまま。

### Company(自社の勝ち筋)

- 「iPhoneでの管理者操作だけで完結」を唯一の前提にした設計 ― 既存SaaSがPC/iPad前提であることの逆を張る。これは既に確定しているPWA・メールOTP・ボトムシートUIの設計方針そのものと直結している。
- 両プロトタイプで培った「制約を守った自動割当」「交代申請ワークフロー」「給与概算」「労務ルール警告」を、総合園務システムのように広く浅くではなく、**シフト作成という1点に絞って深く・安く**提供する。
- 価格は市場相場(1人月100〜300円、または施設課金月2,000円〜)よりシンプルで分かりやすい固定月額を検討(詳細はPhase 2で確定)。

Sources: [BOXIL Magazine 保育業界向け勤怠管理](https://boxil.jp/mag/a7980/), [Airシフト公式](https://airregi.jp/shift/), [起業LOG SaaS Airシフト解説](https://kigyolog.com/tool.php?id=766), [CoDMON シフト管理](https://www.codmon.com/service/shift/), [BOXIL Magazine シフト管理費用相場](https://boxil.jp/mag/a8368/), [TRYETING シフト作成が面倒](https://www.tryeting.jp/column/1489/)

## インフラ方針の変遷(経緯の記録)

このプロジェクトのインフラ選定は3段階で変化した。将来「なぜ今の構成なのか」を追えるよう経緯を残す。

1. **当初(Phase 0時点)**: Vercel + Supabase(Postgres + Auth + RLS)を採用。理由は「事業所間データ漏洩」という最大リスクをDB層のRow-Level Securityで構造的に防げること。Cloudflare D1はRLS相当の機能がなく、テナント分離をアプリコードの規律だけに委ねることになるため不採用と判断した。
2. **1回目の再検討(Phase 1a完了後)**: 「使われていない間の運用コストを避けたい」という要望を受け、Cloudflare一本化を再検討。調査の結果、D1のRLS非対応は変わらず、DBはSupabase維持と判断。ただし「Vercel Hobbyは商用利用禁止だがCloudflare Workers Freeにはその縛りがない」という非対称性が判明し、**ホスティングのみCloudflareへ**という折衷案を検討していた。
3. **最終決定(2026-09-03)**: ユーザーから、Shift単体ではなく**今後複数の小規模Webアプリを開発・販売していく事業戦略全体の共通基盤**として「Cloudflare Workers + D1」を採用する方針が示された。狙いは、多数の小さなアプリを低固定費で市場投入し、当たったアプリにリソースを集中する戦略(詳細は「共通指針ドキュメント」節、および `~/.claude/CLAUDE.md` 参照)。D1にRLSが無いという弱点は変わらないが、**「1アプリ=1 D1」+「アプリ内はorg_idで分離、必須の分離テストを整備」**という設計で構造的リスクを許容範囲まで下げる方針。Shiftはこの方針を最初に適用する実証プロジェクトとなる。

## 共通指針ドキュメント(全プロジェクト共通)

ユーザーから提示された「アプリ公開基盤の方針:Cloudflare Workers + D1」は、Shiftに限らない全プロジェクト共通の設計指針のため、`~/.claude/CLAUDE.md`(ユーザーレベルのグローバル指示ファイル)に書き込む。内容の骨子:

- 今後の小規模Webアプリは原則 **Cloudflare Workers + D1** を共通基盤とする。
- **1アプリ = 1 D1 Database**。アプリ間のデータ漏洩をDBレベルで物理的に防ぐ。
- アプリ内部は `org_id` で顧客(テナント)を分離する。D1にRLSが無いため、org_idの付け忘れによる顧客間データ漏洩対策(共通設計・テスト方法)を実装前に必ず決める。
- より高い分離が必要な顧客(大企業向け等)が出てきた場合は、**顧客ごとD1**(Database-per-tenant)へ個別に昇格する。ただしWorkerあたりのD1 Binding数には上限があるため、数千〜数万顧客規模になったら別アーキテクチャ(Workers for Platforms等)を再検討する。最初から大規模想定の複雑設計はしない。
- D1のPaidプランにはTime Travel(過去30日の任意時点復元)が含まれ、誤操作からの復旧手段になる。将来的にはR2へのSQL Export定期保存も検討。
- Next.jsをCloudflare Workers上で動かす場合はCloudflare推奨の `vinext`(現時点でベータ)を使う。Vercel専用API・Node.js専用APIへの依存を避け、`npx vinext check` 等で互換性を確認する運用ルールを徹底する。

**注意(このセッション固有)**: 今回の作業はリモートの使い捨てコンテナ上で行っており、`~/.claude/CLAUDE.md` がこのセッション/環境をまたいで永続化される保証はない(コンテナ自体が非アクティブ後に破棄される)。ユーザーが他のプロジェクトのセッションでも確実にこの方針を参照したい場合は、後日ローカル環境の `~/.claude/CLAUDE.md` に同内容を反映するか、専用の「開発標準」リポジトリを作ってそこにコミットし、各プロジェクトのCLAUDE.mdから参照する形を推奨する。この点はユーザーへの実装完了報告時に明示的に伝える。

## 技術スタック(2026-09-03 更新: Cloudflare版)

| レイヤー | 選定 | 理由 |
|---|---|---|
| フロントエンド | Next.js 16系(App Router)+ TypeScript、PWA化。Cloudflare Workers上で `vinext`(ベータ)により動作 | ルーティング・SSR・API RouteをNext.js一本でまかない、iPhone Safariでの初期表示を速くする。Tailwindは現プロトタイプから継続利用しやすい |
| UI | Tailwind CSS + shadcn/ui | ボトムシート・モーダルなどアクセシブルな部品を軽量に導入(Phase 1aでは軽量な自作コンポーネントのみ使用、実際の導入はまだ) |
| 状態管理 | TanStack Query + Zustand | サーバー状態のキャッシュ・楽観的更新(タップでシフト割当など) |
| バックエンド/DB | **Cloudflare D1**(SQLite、Shift専用の1 Database)+ **Drizzle ORM** | 「1アプリ=1 D1」の共通方針に従う。Drizzleは型安全なクエリビルダで、Better AuthのD1連携にも必須(直接のd1Adapterは提供終了、Drizzle/Kysely経由が前提) |
| 認証 | **Better Auth**(`drizzleAdapter(db, { provider: "sqlite" })`)+ `email-otp` プラグイン | Supabase Authが使えなくなるため自前運用に切り替え。email-otpプラグインで6桁コードのメールログインを維持でき、UI(`components/auth/OtpForm.tsx`等)はほぼそのまま流用できる見込み |
| ホスティング | Cloudflare Workers(Paid、最低$5/月〜、10,000,000リクエスト・30,000,000 CPU ms込み) | 無料プランに商用利用禁止の縛りがなく、低トラフィックの間は実質無料に近い。従量課金なので「アプリを増やしても固定費が比例して増えない」戦略に合う |
| 課金 | Stripe Billing(Checkout + Customer Portal + Webhook) | PCI対応を自前でやらずに済み、解約もセルフサーブにできる。WebhookはWorkers環境向けに `constructEventAsync` + SubtleCryptoProviderを使う(Node crypto依存の同期版`constructEvent`はWorkersで動かない) |
| メール送信 | Resend | Better Authのemail-otpプラグインからメール送信フック経由で呼び出す |
| PWA | `@serwist/next`(Workbox後継) | オフラインキャッシュ・インストール導線。Cloudflare Workers上でのService Worker配信も問題なく機能する想定(移行時に要確認) |
| 監視 | Sentry(Cloudflare Workers向けSDK)+ 外形監視(UptimeRobot等) | 非IT顧客からの「動かない」という問い合わせより先に不具合に気づく仕組み |
| バックアップ | D1 Time Travel(Paidで過去30日の任意時点復元) | 誤DELETE・誤UPDATE・マイグレーション失敗からの復旧手段。将来的にR2へのSQL Export定期保存も検討 |
| 定期処理 | Cloudflare Cron Triggers | トライアル催促メールなど(旧: Supabase pg_cron) |
| テスト | Vitest(ユニット)+ Playwright(E2E、iPhone 13ビューポート) | モバイルUIの崩れをCIで検知。ただしWebKitエミュレーションはsafe-area・standalone判定・Cookie分離など実際のiOS挙動までは再現しないため、実機UATと役割分担する |

### この構成を選んだ理由の要点

- **D1のRLS非対応は変わらない事実**として認識した上で、「1アプリ=1 D1」+「org_idによるアプリ内分離」+「分離を強制するデータアクセス層と自動テスト」で構造的リスクを許容範囲に抑える(詳細は「テナント分離モデル(D1版)」節)。
- Vercel+Supabaseは技術的には優れているが、月$45という固定費が「複数の小規模アプリを低コストで市場投入し、当たったものにリソースを集中する」という事業戦略とは相性が悪いと判断。
- Phase 0実装時点から「移植可能性の原則」(`@vercel/*`不使用・Node専用API不使用・DBアクセスを抽象化)を守っていたため、この移行は白紙からの再実装ではなく、データアクセス層と認証層の差し替えで済む見込み(詳細は「既存実装の移行計画」節)。

## テナント分離モデル(D1版)

RLSが無い前提で、org_idの付け忘れによる事業所間データ漏洩を防ぐための構造的な仕組み:

1. **生のD1バインディング/Drizzleクライアントを直接importさせない**。全データアクセスは `lib/db/scopedClient.ts` の `getScopedDb(organizationId)` のようなヘルパー経由に限定し、`eslint.config.mjs` の `no-restricted-imports` で `lib/db/raw.ts`(生クライアント)への直接importを禁止する(Supabase版で `service_role` キーを制限していたのと同じパターンを踏襲)。
2. **スコープ付きクライアントは、テナント紐付けテーブルへの操作時に必ずorganization_idをWHERE句に含める**よう関数シグネチャで強制する(例: `getScopedDb(organizationId).staff.list()` のように、呼び出し側がorganization_idを渡さないと使えない設計にする。生のSQL文字列を書かせず、Drizzleのクエリビルダで組み立てる)。
3. **クロステナント分離の自動テストを必須にする**(Supabase版の「RLS分離テスト」をアプリ層に移した形): 2事業所分のテストデータを用意し、事業所Aのスコープ付きクライアントが事業所Bの`staff`/`shift_assignments`/`subscriptions`を一切取得・更新できないことをVitestで担保する。CIで毎回実行し、新しいテーブル・クエリを追加するたびにこのテストスイートも拡張する運用ルールとする。
4. **時給などの機密列は引き続きテーブル分離**(`staff` と `staff_compensation` を分ける方針は維持)。owner以外がowner専用データにアクセスできないことも同じテストスイートで確認する。
5. **より高い分離が必要になった場合**(将来的に大企業顧客が入る等)は、当該顧客だけDatabase-per-tenant(専用D1)へ昇格する。Shiftの現在のターゲット(小規模店舗・保育園)ではorg_id分離で妥当と判断し、最初から全顧客を個別D1にはしない。

### 認証モデル

- Better Auth(`drizzleAdapter` + `email-otp`プラグイン)でメールOTP(6桁コード)ログインを実装。UI(`components/auth/OtpForm.tsx`、`SignupForm.tsx`)は現状のフローを維持し、内部の呼び出し先だけSupabase Auth APIからBetter Auth APIに差し替える。
- ロールは `owner`(契約・全権限)/ `staff`(自分のシフト閲覧・休み希望・交代申請)から開始。`admin`は後回し(Supabase版の設計を踏襲)。
- サインアップ時にorganizations/memberships/14日間トライアルのsubscriptionsを1トランザクションで作成する処理は、Better AuthのDBフック(`databaseHooks`)またはサーバーアクション内で明示的に実装する(Supabase版では1つのPostgres関数で担保していたが、D1では複数INSERTを明示的なトランザクションでまとめる)。
- 1ユーザーが複数事業所を持つケースは `memberships` で表現可能。UI上の事業所スイッチャーはPhase 3で追加(変更なし)。

## データモデル(D1/SQLite版)

Postgres版からの主な変更点(SQLiteの制約に合わせる):

- 配列型(`fixed_days_off smallint[]`、`unavailable_shift_type_ids uuid[]` 等)→ **JSON文字列を格納するTEXTカラム**に変更し、アプリ側でJSON.parse/JSON.stringify。
- UUID主キー(`gen_random_uuid()`)→ **TEXTカラム + `crypto.randomUUID()`**(Workers環境で標準利用可能)をアプリ側のデフォルト値として使用。
- `timestamptz` → **Unixエポック秒のINTEGERカラム**(Drizzleの `mode: 'timestamp'` で自動変換)。
- `check (...)` 制約はSQLiteでも利用可能なため、ロール・ステータスのenum的な制約はそのまま踏襲できる。
- 外部キー制約はD1で `PRAGMA foreign_keys = ON` を有効化した上で利用する。

テーブル構成そのもの(`organizations` / `memberships` / `staff` / `staff_compensation` / `shift_types` / `shift_assignments` / `time_off_requests` / `swap_requests` / `subscriptions` / `audit_log`)はSupabase版から変更しない。理由・設計意図(時給の列分離、shift_assignmentsの一意制約、draft/confirmedフロー等)もそのまま引き継ぐ。RLSポリシー相当の記述はスキーマから削除し、「テナント分離モデル(D1版)」節のスコープ付きクライアント+テストで代替する。

## iPhone向けUIの核心方針(最大のUXリスク)

*(インフラ変更の影響を受けないため変更なし)*

両プロトタイプは「スタッフ×日付」の横に長いテーブルで、375px幅のiPhone画面では実質使えない。**1つのグリッドで全画面サイズに対応しようとせず、用途別に画面を分ける**:

1. **今日ビュー(デフォルト画面)**: 1日分をスタッフの縦リストで表示、シフトはタップ可能なチップ。タップでボトムシートが開いてシフト種別を選択。日付は左右スワイプ/矢印で移動。(Phase 1aで実装済み)
2. **スタッフビュー**: 1人分の月間シフトを縦スクロールで確認、**「勤務ルール警告」**(連勤上限・週/月上限時間・休憩不足、事業所ごとに設定可能)をここに表示。「労基法違反」という表現はUI上使わず、「法令判断を代替するものではない」旨を利用規約とUIに明記する。
3. **週グリッド**: 7日分のみの横スクロールテーブル(月間フルグリッドは印刷/PDF専用に格下げ)。
4. **印刷ビュー**: `/print/[orgId]/[month]` を別ルートとして用意。(Phase 1aで実装済み)
5. **下部タブナビゲーション**(iOS標準の親指到達性): 今日/スタッフ/週表示/交代/設定。(Phase 1aで実装済み)
6. 入力は「タップでチップ選択」中心、`<select>` プルダウンやテーブル内インライン入力は極力避け、タップ領域44px以上を確保。

Playwrightの `devices['iPhone 13']` エミュレーションをCIに入れて「気づいたら横長テーブルに戻っていた」regressionを防ぐ(Phase 0で導入済み)。WebKitエミュレーションの限界(safe-area・standalone判定・Cookie分離)は実機UATで補う。

## PWA固有の対応

*(インフラ変更の影響を受けないため変更なし、Phase 0で実装済み)*

- `public/manifest.json` + `apple-touch-icon` / `apple-mobile-web-app-capable` メタタグ。
- サービスワーカーはAPI通信を network-first、静的資産は cache-first。
- iOS Safariには`beforeinstallprompt`が無いため、「共有ボタン→ホーム画面に追加」を教える自作オンボーディング画面を初回ログイン時に表示。
- Web Pushは iOS 16.4+ でホーム画面インストール済みPWAのみ対応。配信サーバー(VAPID+`web-push`)が別途必要な点はPhase 3の見積もりに含める。

## 課金フロー(Stripe)

サインアップ時はカード情報なしで14日間トライアル開始 → トライアル終了時点で未契約なら閲覧のみに制限 → トライアル残り5日を切ったらアプリ内バナー表示 → `/billing` からStripe Checkoutへ(月額・年額の2プランを用意)→ Webhookで `subscriptions` テーブルを更新(イベントIDで冪等化)→ 解約・カード変更はStripe Customer Portalへ誘導 → 支払い失敗/解約後もデータは読み取り専用で保持し、保持期間(例:90日)を利用規約に明記した上で削除する。

**Workers環境でのWebhook実装の注意**: `stripe.webhooks.constructEvent`(同期版)はNode.js cryptoに依存するためCloudflare Workersでは動作しない。`constructEventAsync` + `Stripe.createSubtleCryptoProvider()` を使う。

**インフラコストと収益の対応関係**: Cloudflare Workers Paid($5/月〜、従量課金)は「アプリ数ではなく実際の利用量に応じて増える」構造のため、Phase 1a〜1.5の低トラフィック期は実質無料に近い。事業所1件あたりの月額を明確な黒字ラインに設定できれば、少数の契約でインフラコストを回収できる計算になる(具体的な価格は市場調査の結果を踏まえてPhase 2で確定)。

日本でのB2B SaaS販売に向けた法務・商習慣対応もPhase 2に含める: 特定商取引法に基づく表記・利用規約・プライバシーポリシーの整備、Stripeの請求書/領収書に適格請求書(インボイス)登録番号を載せる設定、小規模事業所向けに銀行振込(請求書払い)をカード決済の代替として検討。トライアル催促などの定期処理はCloudflare Cron Triggersで実装する。

## リポジトリ再構成(D1版)

```
app/(marketing)/    … ランディング・料金ページ
app/(auth)/         … login/signup(メールOTP主導線、マジックリンクは補助)
app/(app)/today/    … 今日ビュー(モバイル既定画面)         [Phase 1a実装済み]
app/(app)/staff/    … スタッフ管理                          [Phase 1a実装済み]
app/(app)/settings/shift-types/ … シフト種別設定            [Phase 1a実装済み]
app/(app)/week/     … 週グリッド
app/(app)/swaps/    … 交代申請
app/(app)/billing/  … Stripeポータル導線
app/print/[orgId]/[month]/ … 印刷専用ビュー                 [Phase 1a実装済み]
lib/shift-generator/  … 自動割当ロジック(純関数、変更なし)
lib/labor-rules.ts    … 勤務ルール判定ロジック(純関数、変更なし)
lib/db/                … D1 + Drizzleクライアント。scopedClient.ts(スコープ付きアクセス)とraw.ts(生クライアント、import制限対象)を分離
lib/auth/               … Better Auth設定・セッションヘルパー(旧 lib/supabase/*)
drizzle/                … スキーマ定義 + D1マイグレーション(旧 supabase/migrations/)
docs/legal/            … 特定商取引法に基づく表記・利用規約・プライバシーポリシーの草稿
e2e/                    … Playwright(iPhoneビューポート)
wrangler.jsonc          … Cloudflare Workers設定(D1バインディング等)
```

## 既存実装(Phase 0〜1a)の移行計画

Phase 0〜1aはSupabase版としてPR #1で実装済み(CI green)。以下のマッピングでCloudflare D1版へ移行する。UIコンポーネント・server actionsの外側のシグネチャ(引数・戻り値)はほぼ変更せず、データアクセス部分の中身だけ差し替える設計とし、作り直しの範囲を最小化する。

| 旧(Supabase版) | 新(D1版) | 備考 |
|---|---|---|
| `supabase/migrations/0001_init.sql` | `drizzle/schema.ts` + `wrangler d1 migrations` | 配列→JSON TEXT、UUID→TEXT+crypto.randomUUID()、timestamptz→Unixエポック秒に変換 |
| `supabase/config.toml`, `supabase/templates/` | 削除 | Supabaseプロジェクト自体を使わないため |
| `lib/supabase/client.ts` / `server.ts` / `service.ts` / `middleware.ts` / `types.ts` | `lib/auth/*`(Better Auth)+ `lib/db/*`(Drizzle) | service_role相当の「生クライアント制限」はlib/db/raw.tsへのimport制限として引き継ぐ |
| `lib/org/current.ts`(`getCurrentMembership()`) | 同名・同シグネチャで維持、内部実装のみBetter Authのセッション取得に差し替え | 呼び出し側(各ページ・アクション)は変更不要 |
| `lib/staff/*`, `lib/shift-types/*`, `lib/shifts/*`(actions/queries) | 同名・同シグネチャで維持、内部のSupabaseクエリをDrizzleクエリに差し替え | |
| `eslint.config.mjs` の `service_role` import制限 | `lib/db/raw.ts` への直接import制限に置き換え | 考え方は同じ、対象パスのみ変更 |
| `proxy.ts`(セッションリフレッシュmiddleware) | Better Authのセッションmiddlewareに置き換え | |
| `app/api/stripe/webhook/route.ts` | `constructEventAsync` + SubtleCryptoProviderに変更 | |
| `next.config.ts` | vinext向けビルド設定を追加、`wrangler.jsonc` 新設(D1バインディング定義) | |

この移行はPhase 1aの機能(スタッフ管理・シフト種別設定・今日ビュー・印刷ビュー)を作り直すものではなく、土台の差し替えとして扱う。**Phase 1.5のパイロット運用を始める前に完了させる**(Supabase版は一度も実プロジェクトに接続していないため、二重移行を避けられる)。

**D1データベースの作成について**: このセッションにはCloudflare Developer Platform向けのMCPツールが利用可能で、D1データベースの作成・一覧取得等をエージェントから直接実行できる(Supabaseではプロジェクト作成をユーザーに依頼する必要があったのと対照的)。「1アプリ=1 D1」の命名規則に従い、`shift-db`(本番)・`shift-db-preview`(開発/プレビュー用)としてユーザーの既存Cloudflareアカウント上に新規作成する(ユーザーの既存の `sync-db` / `sync-db-preview` とは別アプリのため独立させる)。

## フェーズロードマップ

- **Phase 0 基盤**: ✅ 完了(Supabase版として実装、PR #1オープン、CI green)。
- **Phase 1a コアMVP(手動割当)**: ✅ 完了(Supabase版として実装、PR #1に統合済み)。今日ビュー・スタッフCRUD・シフト種別設定・印刷ビュー・PWA基本。
- **Phase 1a.5 インフラ移行(Cloudflare D1 + Better Auth)**: 🔜 次のステップ。上記「既存実装の移行計画」に従い、Supabase依存をCloudflare D1 + Drizzle + Better Authへ全面差し替え。D1データベース作成、スキーマ移行、認証差し替え、テナント分離テストの新規実装、Cloudflare Workersへのデプロイ確認までを含む。
- **Phase 1.5 パイロット**: Phase 1a.5完了後、知り合いの1〜2事業所に無料で使ってもらい、今日ビューの操作感・印刷物を実運用で検証する。「お金を払ってでも使いたい」という反応が出てから次に進む。
- **Phase 1b コアMVP(自動化)**: 週グリッド、休み希望、自動生成(下書き→確定)、未充足シフト警告、勤務ルール警告(連勤・週/月上限時間)。
- **Phase 2 課金・オンボーディング**: Stripe Checkout/Webhook(冪等化)/Customer Portal、トライアル期限管理・催促メール(Cloudflare Cron Triggers)、ランディング/料金ページ、特定商取引法表記・利用規約・プライバシーポリシー、インボイス登録番号設定。
- **Phase 3 磨き込み**: 交代申請ワークフロー、給与概算(深夜・時間外・法定休日の割増対応)・グラフ、Web Push通知(配信サーバー含む)、スタッフ本人ログイン(必要ならLINEログインも検討)、事業所スイッチャー、変更履歴。
- **Phase 4 実顧客ベータ**: Phase 1.5のパイロット事業所を有料化する形で本格運用、フィードバック収集の仕組み、実データで見つかった穴を修正、`legacy/*.html`の整理。
- **Phase 5 ネイティブ検討**: Capacitorでのラップ vs React Native再構築を、ベータの手応え次第で検討。

## 検証方法

- ユニットテスト最優先箇所: `lib/shift-generator`と `lib/labor-rules`(連勤・週/月上限時間の判定、月をまたぐ連勤の検出、翌日跨ぎシフトの労働時間計算)、給与計算 — ここのバグは非IT管理者には気づけない実害(給与ミス)に直結するため。(Phase 0〜1aで実装・テスト済み、インフラ変更の影響を受けない)
- **テナント分離テストは必須**(RLS分離テストのD1版): 2事業所分のテストデータを作り、事業所Aのスコープ付きクライアントが事業所Bの`staff`/`shift_assignments`/`subscriptions`を一切読み書きできないことを自動テストで担保する。加えて、**`lib/db/raw.ts`(生クライアント)を使わない通常のスコープ付きクライアントで実行すること**、および**staffロールのユーザーが他人の時給(`staff_compensation`)を読めないこと**(列レベルの分離、アプリ側のアクセス制御で担保)も同じテストスイートで確認する。
- E2E(Playwright、`devices['iPhone 13']`)で「サインアップ→事業所作成→スタッフ登録→今日ビューでシフト割当→自動生成→確定→印刷」の一連をCIで毎PR実行し、横長テーブルへの先祖返りを機械的に防ぐ。
- Stripeはテストモード+CLI(`stripe listen`)でCheckout→Webhook→`subscriptions`更新を通しで確認してから本番切り替え。加えて同一Webhookイベントの重複送信テスト(`subscriptions`が二重更新されないこと)を行う。
- **Cloudflare Workersへの実デプロイ確認**: `vinext`がベータのため、ローカルビルドが通るだけでなく実際に`wrangler deploy`(またはプレビュー環境)でデプロイし、主要画面(ログイン・今日ビュー・印刷)が動作することを確認する。
- 各フェーズの最後に実機iPhoneでの手動UATチェックリスト(`docs/uat-checklist.md`)を回し、自動テストでは拾えないタップ感覚・スワイプの使い勝手、および**ホーム画面に追加した状態(standalone)でのメールOTPログインが正しく完結するか**を確認する。
- Phase 4は実顧客の利用そのものが最大の検証。どの画面が実際に使われているか軽量なアクセス記録を仕込み、Phase 3以降の優先度判断に使う。
