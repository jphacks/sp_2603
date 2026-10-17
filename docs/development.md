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

## OAuth アプリ

ログイン用の OAuth アプリは作成済みです。本番のシークレットを開発者の手元に置かないよう、開発用と本番用を分けています。開発用のクライアント ID とシークレットはチームの管理者からもらい、`apps/api/.dev.vars` に書きます。Git、Issue、チャットには貼りません。

| | 開発用 | 本番用 |
| --- | --- | --- |
| アプリの URL | `http://localhost:5173` | `https://fllooat.mfmf.moe` |
| Google | Google Cloud プロジェクト `fllooat` のクライアント「Fllooat (dev)」 | 同じプロジェクトのクライアント「Fllooat」 |
| GitHub | org mofumofupop の OAuth App「Fllooat (dev)」 | org mofumofupop の OAuth App「Fllooat」 |

コールバック URL は `<アプリの URL>/api/auth/callback/<google|github>` です。

Google の OAuth 同意画面は「テスト中」の状態です。テストユーザーに登録した Google アカウントしかログインできないので、ログインできないときは Google Cloud の「Google Auth Platform → 対象 → テストユーザー」に追加してもらってください。デモの前に、プライバシーポリシーのページを用意して公開ステータスを「本番環境」に切り替えます。

## Cloudflare アカウント

本番は Cloudflare アカウント mofumofupop で動かします。`apps/api/wrangler.jsonc` の `account_id` で指定しているので、wrangler が複数のアカウントにログインしていても、ほかのアカウントにはデプロイされません。

メンバーを追加するときは、ダッシュボードの「Manage account → Members → Invite」で招待します。ロールは「Super Administrator - All Privileges」にします。招待できるのは Super Administrator だけです。

wrangler で `Authentication error [code: 10000]` が出るときは、ログインしたあとに追加されたアカウントへの権限がトークンにありません。`pnpm --filter @fllooat/api exec wrangler login` でログインし直してください。

## ドメイン

本番の URL は `https://fllooat.mfmf.moe` です。mfmf.moe は Cloudflare に「保留中」として追加済みで、ネームサーバーを Cloudflare に切り替えると有効になります。

mfmf.moe はメール (Lark) にも使っているので、ネームサーバーを切り替える前に次を確認します。

1. 今の DNS (エックスドメイン) のレコードと、Cloudflare の「DNS → Records」を見比べ、足りないレコードを足す。MX と SPF は読み込まれているが、DKIM (`*._domainkey`)、DMARC (`_dmarc`)、サブドメインの A / CNAME は読み込まれないことがある。
2. エックスドメインでネームサーバーを Cloudflare が指定するもの (ダッシュボードの「Overview」に表示される 2 つ) に変える。
3. Cloudflare が「有効」になったら、`apps/api/wrangler.jsonc` に `fllooat.mfmf.moe` をカスタムドメインとして設定する。

## デプロイ

Cloudflare Workers Builds で、GitHub の main ブランチに merge されると自動でデプロイされます。PR ごとにプレビュー URL も作られます。

Workers Builds をつなぐには、Cloudflare の GitHub アプリをリポジトリの持ち主 (jphacks org) に入れる必要があり、org の admin の許可が要ります。許可が得られるまでは、下の「手動でデプロイする場合」の手順でデプロイします。

### 初回だけ行う設定

1. D1 データベースを作り、表示された `database_id` を `apps/api/wrangler.jsonc` の `d1_databases` に追記してコミットする (作成済みなら不要)。

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
   | `BETTER_AUTH_URL` | `https://fllooat.mfmf.moe` |
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
