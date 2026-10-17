# AGENTS.md

このリポジトリで作業する AI エージェント (Claude Code, Codex など) 向けの指示です。人間向けのセットアップ手順は [docs/development.md](docs/development.md) にあります。

## 言語

- ユーザーとの会話、計画、報告は日本語で書く。
- ドキュメント、コードコメント、テスト名、PR と Issue の本文は日本語で書く。
- 識別子 (変数名、関数名、ファイル名、ブランチ名) は英語で書く。
- 日本語の文章を書いたら `natural-japanese` と `stop-ai-slop-jp` で整え、`fix-unnatural-line-breaks` で文の途中の改行を除く。
- 文章中の括弧やコロンなどの記号は半角を使う (`（）` ではなく `()`)。`、` `。` `「」` `！` `？` はそのまま使ってよい。

## 構成

pnpm workspaces のモノレポで、Cloudflare Workers にデプロイします。パッケージ名は `@fllooat/<ディレクトリ名>` にします。

| パス | パッケージ | 内容 |
| --- | --- | --- |
| `apps/web` | `@fllooat/web` | Vite + React 19 + TanStack Router (ファイルベース) + TanStack Query + Tailwind CSS v4 |
| `apps/api` | `@fllooat/api` | Hono + `@hono/zod-openapi` + Drizzle ORM + D1 + Better Auth。`/api/*` を処理する Worker |
| `packages/api-client` | `@fllooat/api-client` | Orval が `openapi.json` から生成した TanStack Query の hooks、型、MSW モック |

本番では 1 つの Worker が `/api/*` を Hono で処理し、それ以外は `apps/web/dist` を static assets として返します。同一オリジンなので CORS の設定は不要です。

UI ライブラリはまだ決めていません。ユーザーの指示なしに UI ライブラリ (shadcn/ui, MUI など) を追加しないでください。それまでは Tailwind のユーティリティだけで書きます。

## API の型はスキーマから流れる

API の型の正本は `apps/api/src/routes/*.ts` の zod スキーマです。

```
zod スキーマ (apps/api) → pnpm gen → openapi.json → Orval → hooks + 型 + MSW モック (packages/api-client)
```

- フロントから API を呼ぶときは、`@fllooat/api-client` が生成した `useXxx` hooks を使う。`fetch` を直接書かない。2xx 以外の応答は `ApiError` として投げられ、`isError` になる。
- API のスキーマを変えたら `pnpm gen` を実行し、生成物もいっしょにコミットする。フロント担当は API を起動しなくても `pnpm dev:mock` で開発を続けられる。
- 生成物は手で編集しない: `packages/api-client/src/generated/**`、`packages/api-client/openapi.json`、`apps/web/src/routeTree.gen.ts`、`apps/api/worker-configuration.d.ts`、`apps/api/src/db/auth-schema.ts`、`apps/api/drizzle/**`

## 認証

Better Auth で Google と GitHub のログインを提供します。初回ログイン時にアカウントが作られ、同じメールアドレスなら Google と GitHub のアカウントは同じユーザーにまとめられます。

- サーバー: `apps/api/src/auth.ts`。`/api/auth/*` は Better Auth が処理する。
- ログイン必須の API: `createRoute` に `...authRequired` を展開し、`responses` に `...unauthorizedResponse` を足す (`apps/api/src/lib/openapi.ts`)。ハンドラでは `c.get("user")` でユーザーを取れる。ルーターは `new OpenAPIHono<AuthedEnv>()` で作る。
- クライアント: `apps/web/src/lib/auth-client.ts` の `authClient` と `sessionQueryOptions`。
- ログイン必須の画面の作り方は `add-page` の skill にある。

## コマンド

ルートで実行します。

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | web (5173) と api (8787) を同時に起動する。`/api` は Vite のプロキシで api に転送される |
| `pnpm dev:mock` | web だけを MSW のモックで起動する (ログイン済みで始まる)。`pnpm dev:mock --logout` なら未ログインで始まる |
| `pnpm gen` | OpenAPI の出力と、クライアントおよびモックの生成 |
| `pnpm check` | Biome で format と lint を自動修正する |
| `pnpm lint` | Biome の CI 用チェック (修正はしない) |
| `pnpm typecheck` | 全パッケージの型チェック |
| `pnpm test` | テスト (API) |
| `pnpm build` | web のビルド |
| `pnpm db:generate` | Drizzle のスキーマからマイグレーション SQL を生成する |
| `pnpm db:migrate:local` | ローカル D1 にマイグレーションを適用する |
| `pnpm --filter @fllooat/api cf-typegen` | `wrangler.jsonc` を変えた後に `Env` 型を再生成する |
| `pnpm --filter @fllooat/api auth:generate` | Better Auth の設定を変えた後に認証テーブルのスキーマを再生成する |

API のドキュメントは http://localhost:5173/api/docs で見られます。

作業を終える前に `pnpm check`、`pnpm typecheck`、`pnpm test`、`pnpm build` がすべて通ることを確認します。

## よくある作業

作業前に対応する skill を読んでください。

- API エンドポイントの追加、変更: `add-api-endpoint`
- 画面 (ルート) の追加: `add-page`
- DB のテーブル、カラムの変更: `change-db-schema`
- テストを書く: `write-tests`

## テスト

テストは要件から書きます。実装の中身ではなく、使う人から見た振る舞いを確かめます。

- テスト名は要件を表す日本語の文にする。例: `it("ログインしていない人は Todo を作れない")`
- Issue の「完了条件」があれば、1 つの条件を 1 つ以上のテストにする。
- 公開されている入口 (API なら HTTP リクエスト) から呼び、内部の関数やクエリの呼ばれ方は確かめない。
- DB はモックせず、テスト用の D1 をそのまま使う。
- テストが落ちたときにテストを書き換えてよいのは、要件が変わったときだけ。

詳しくは `write-tests` の skill を参照してください。

## Git と GitHub

### ブランチ

- main に直接コミット、push しない。作業ごとに main からブランチを切る。
- ブランチ名は `<type>/<内容>` にする。内容は英語の kebab-case で短く書く。例: `feat/todo-delete`、`fix/login-redirect`
- type はコミットの prefix と同じものを使う。

### コミット

- メッセージは `<type>: <日本語の要約>` にする。例: `feat: Todo の削除 API を追加`
- type: `feat` (機能)、`fix` (バグ修正)、`docs` (ドキュメント)、`refactor` (振る舞いを変えない整理)、`test` (テスト)、`style` (見た目だけの整形)、`perf` (性能)、`build` (依存やビルド)、`ci` (CI)、`chore` (その他)
- 変更が 1 か所に収まるときは scope を付ける。複数の場所にまたがる変更やルートの設定には付けない。

  | 変更する場所 | scope | 例 |
  | --- | --- | --- |
  | `apps/web` | `web` | `feat(web): ログイン画面を追加` |
  | `apps/api` | `api` | `fix(api): セッション切れで 500 になる問題を修正` |
  | `packages/<name>` | パッケージのディレクトリ名 | `feat(api-client): エラー型を export` |
  | `.claude/` (skill、設定) | `claude` | `docs(claude): add-page の skill を更新` |
  | 複数の場所、ルートの設定 | なし | `chore: Biome の設定を変更` |
- 1 コミットには 1 つの論理的な変更だけを入れ、細かい粒度で積む。生成物は、それを生んだ変更と同じコミットに入れる。
- 理由が要約から読み取れないときだけ、本文に「なぜ」を書く。

### Pull Request

人間が短時間で読めることを優先します。テンプレートは [.github/pull_request_template.md](.github/pull_request_template.md) です。

- タイトルはコミットと同じ形式にする。
- 本文は「何を、なぜ」を 1 から 3 行で書き、変更点は 3 から 5 個の箇条書きにまとめる。経緯や試行錯誤は書かない。
- 確認した方法 (実行したコマンド、見た画面) を書く。UI の変更にはスクリーンショットを付ける。
- 関連する Issue は `Closes #12` で紐づける。
- ユーザーの許可なしにマージしない (auto-merge も有効にしない)。

### Issue

テンプレートは [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/) にあります。

- タイトルは「何をしたいか」を 1 行で書く。例: `Todo を削除できるようにする`
- 本文は「背景」「やること」「完了条件」の 3 つに絞る。完了条件はテストにそのまま書き写せる形 (誰が、何をすると、どうなる) で書く。

## デプロイ

Cloudflare Workers Builds で、main への merge 時に自動でデプロイされます。設定手順は [docs/development.md](docs/development.md#デプロイ) にあります。

- 手動のデプロイ (`pnpm cf:deploy`) と本番 D1 への操作 (`pnpm db:migrate:remote`) は、ユーザーの指示があるときだけ実行する。
- 秘密情報は `.dev.vars` (ローカル) と Cloudflare のダッシュボードまたは `wrangler secret put` (本番) で扱い、コミットしない。

## Cloudflare の CLI

開発、ビルド、デプロイ、D1 のマイグレーションは Wrangler (`apps/api/wrangler.jsonc`) で行います。cf CLI はベータ版で、テスト (`@cloudflare/vitest-plugin`) や `wrangler types` が `cloudflare.config.ts` を読めないため、まだ移行しません。

- `cf dev`、`cf build`、`cf deploy`、`cf migrate` は実行しない。
- DNS やゾーンなど、アカウントのリソースを調べたり操作したりするときは cf CLI を使ってよい (`cf-cli` の skill を参照)。

## 個人のメモ (.private/)

`.private/` は gitignore されていて、各自のローカルにだけ存在します。チームで共有する必要はないが、作業者やエージェントが覚えておくべきことを置きます。

- 作業を始める前に、`.private/` があれば直下のファイルを読む。そこに書かれた取り決めや注意は、このファイルの指示に反しない範囲で従う。
- ユーザーとの取り決め、以前の作業のメモ、チャットの引き継ぎなどは `.private/` に書く。チーム全体に関わることは、このファイルや docs に書く。
- `.private/` の内容をコミット、PR、Issue に書き写さない。

## サードパーティの素材とコード

フォント、画像やアイコンなどの素材、他のプロジェクトや記事から引用したコードを取り込むときは、[docs/third-party-licenses.md](docs/third-party-licenses.md) の手順に従い、[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) に記録します。

- ライセンスの記載がないもの、GPL など派生物にも同じライセンスを求めるものは使わない。
- 引用したコードには、引用箇所の直前に出典 (URL とライセンス) をコメントで書く。
- npm パッケージと `.claude/skills/` の skill は対象外。

## その他の注意

- import には `@/` エイリアス (`apps/web/src`) を使う。
- Worker のコードでは Node 専用 API (`fs` など) を使わない。バインディングは `Env` 型から取る。
- TypeScript は 7 (ネイティブ版) を使う。TypeScript の Compiler API に依存するツール (typescript-eslint, ts-morph, ts-node など) は動かないので追加しない。
