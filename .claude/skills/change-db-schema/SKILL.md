---
name: change-db-schema
description: このリポジトリの D1 データベースのテーブルやカラムを追加・変更する手順 (Drizzle ORM + wrangler d1 migrations)。「テーブルを追加して」「カラムを足して」「DB を変えて」などの依頼で使う。
---

# DB スキーマの変更

DB は Cloudflare D1 (SQLite) で、スキーマは Drizzle で書きます。マイグレーション SQL は drizzle-kit で生成し、適用は wrangler で行います。

## 手順

1. `apps/api/src/db/schema.ts` にテーブルを書く。ユーザーに紐づくデータは `user.id` を参照する。

   ```ts
   import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
   import { user } from "./auth-schema";

   export * from "./auth-schema";

   export const todos = sqliteTable("todos", {
     id: integer("id").primaryKey({ autoIncrement: true }),
     userId: text("user_id")
       .notNull()
       .references(() => user.id, { onDelete: "cascade" }),
     title: text("title").notNull(),
     done: integer("done", { mode: "boolean" }).notNull().default(false),
     createdAt: integer("created_at", { mode: "timestamp" })
       .notNull()
       .$defaultFn(() => new Date()),
   });
   ```

   - 真偽値は `integer("x", { mode: "boolean" })`、日時は `integer("x", { mode: "timestamp" })` を使う (SQLite には専用の型がない)。
   - カラム名は snake_case、TypeScript 側のプロパティ名は camelCase にする。
   - 認証のテーブル (`auth-schema.ts`) は手で編集しない。Better Auth の設定を変えたら `pnpm --filter @sp-2603/api auth:generate` で再生成する。
2. ルートで `pnpm db:generate` を実行する。`apps/api/drizzle/` に SQL が生成される。意図しない `DROP` がないか SQL を読んで確認する。
3. `pnpm db:migrate:local` でローカル D1 に適用する。テストは同じマイグレーションを自動で適用する。
4. API のレスポンスに出すなら `add-api-endpoint` の skill に従う。
5. 生成された SQL と `drizzle/meta/` もコミットする。

## 注意

- 一度コミットしたマイグレーション SQL は編集しない。直したいときは新しいマイグレーションを追加する。
- ローカルの DB を作り直したいときは `apps/api/.wrangler/state` を削除してから `pnpm db:migrate:local` を実行する。
- 本番への適用 (`pnpm db:migrate:remote`) は、ユーザーの指示があるときだけ実行する。
