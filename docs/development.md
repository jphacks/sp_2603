# 開発環境

## 必要なもの

- Node.js 24 以上 (`.node-version` に記載。fnm や mise を使うと自動で切り替わる)
- pnpm 10 (`corepack enable` を一度実行すると、`package.json` の `packageManager` の版が使われる)
- VS Code の推奨拡張機能 (Biome、Tailwind CSS IntelliSense、TypeScript (Native Preview))

TypeScript は 7 (ネイティブ版) を使っています。VS Code では TypeScript (Native Preview) 拡張を入れてください。入れないとエディタ内蔵の古い TypeScript で型チェックされ、`pnpm typecheck` と結果がずれることがあります。

## はじめに

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm --filter @fllooat/api exec auth secret   # 出力された値を .dev.vars の BETTER_AUTH_SECRET に貼る
pnpm db:migrate:local                         # ローカル D1 にテーブルを作る
pnpm dev                                      # http://localhost:5173
```

API のドキュメントは http://localhost:5173/api/docs で見られます。

ログインを試すには、下の「OAuth アプリの登録」で開発用のクライアント ID とシークレットを作り、`.dev.vars` に書きます。登録しなくても、ログイン以外の開発はできます。

## 開発の流れ

1. バックエンド担当が `apps/api/src/routes/` に API のスキーマを書き、`pnpm gen` を実行してコミットする。中身の実装は後回しでよい。
2. フロント担当は `pnpm dev:mock` で起動し、生成された hooks を使って画面を作る。データとログイン状態は MSW のモックが返す。未ログインの画面は `pnpm dev:mock --logout` で確認する。
3. API の実装ができたら `pnpm dev` に切り替えて、実際の API とつなぐ。

ブランチ、コミット、PR、Issue の規則は [AGENTS.md](../AGENTS.md#git-と-github) にあります。AI エージェントもこの規則に従います。

## OAuth アプリの登録

コールバック URL は `<アプリの URL>/api/auth/callback/<google|github>` です。

| 環境 | アプリの URL |
| --- | --- |
| ローカル | `http://localhost:5173` |
| 本番 | `https://fllooat.<アカウントのサブドメイン>.workers.dev` |

- **Google**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) で「OAuth クライアント ID」(種類はウェブアプリケーション) を作る。承認済みのリダイレクト URI に、ローカルと本番の両方のコールバック URL を登録できる。
- **GitHub**: [Developer settings](https://github.com/settings/developers) で OAuth App を作る。コールバック URL は 1 つしか登録できないので、ローカル用と本番用で 2 つ作る。

## デプロイ

Cloudflare Workers Builds で、GitHub の main ブランチに merge されると自動でデプロイされます。PR ごとにプレビュー URL も作られます。

### 初回だけ行う設定

1. D1 データベースを作り、表示された `database_id` を `apps/api/wrangler.jsonc` の `d1_databases` に追記してコミットする。

   ```sh
   pnpm --filter @fllooat/api exec wrangler login
   pnpm --filter @fllooat/api exec wrangler d1 create fllooat-db
   ```

2. Cloudflare のダッシュボードで「Workers & Pages」→「Create」→「Import a repository」からこのリポジトリを選び、ビルド設定を次のようにする。

   | 項目 | 値 |
   | --- | --- |
   | Root directory | (空欄。リポジトリのルート) |
   | Build command | `pnpm build` |
   | Deploy command | `pnpm db:migrate:remote && pnpm --filter @fllooat/api exec wrangler deploy` |
   | Non-production branch deploy command | `pnpm --filter @fllooat/api exec wrangler versions upload` |
   | Build variables | `PNPM_VERSION` = `10.5.2` |

   Node.js のバージョンは `.node-version` から読み込まれます。

3. Worker の「Settings」→「Variables and Secrets」で、本番用のシークレットを登録する。

   | 名前 | 値 |
   | --- | --- |
   | `BETTER_AUTH_SECRET` | `pnpm --filter @fllooat/api exec auth secret` で作った値 (ローカルとは別の値にする) |
   | `BETTER_AUTH_URL` | 本番の URL (`https://fllooat.<サブドメイン>.workers.dev`) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 本番用の OAuth クライアント |
   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 本番用の OAuth App |

### 手動でデプロイする場合

```sh
pnpm db:migrate:remote   # 本番 D1 にマイグレーションを適用
pnpm cf:deploy           # web をビルドして Worker にデプロイ
```

`pnpm deploy` は pnpm の組み込みコマンドと名前が衝突するので、`pnpm cf:deploy` を使います。

## テスト

```sh
pnpm test
```

API のテストは `@cloudflare/vitest-plugin` を使い、実際の Workers ランタイムとテスト用の D1 で動きます。テストは要件ベースで書きます (AGENTS.md の「テスト」を参照)。

## Skills

`.claude/skills/` の外部 skill は [skills CLI](https://github.com/vercel-labs/skills) で導入し、`skills-lock.json` で管理しています。自作の skill (`add-api-endpoint` など) も同じディレクトリにあります。

```sh
npx skills update                                  # 更新
npx skills add <owner/repo> -a claude-code --copy  # 追加
```

`--copy` を付けると symlink ではなく実ファイルとしてリポジトリに入るので、clone しただけで全員が使えます。
