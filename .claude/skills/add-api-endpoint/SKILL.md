---
name: add-api-endpoint
description: このリポジトリの Hono API (apps/api) にエンドポイントを追加・変更し、フロント用の hooks と MSW モックを再生成する手順。「API を追加して」「エンドポイントを作って」「レスポンスにフィールドを足して」などの依頼で使う。
---

# API エンドポイントの追加・変更

API の型の正本は `apps/api/src/routes/*.ts` の zod スキーマです。スキーマを変えると `pnpm gen` で `packages/api-client` の hooks と MSW モックが更新されます。

## 手順

1. `apps/api/src/routes/<リソース名>.ts` を作る。ログイン必須の API なら次の形にする。

   ```ts
   import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
   import { desc, eq } from "drizzle-orm";
   import { createDb } from "../db/client";
   import { todos } from "../db/schema";
   import { authRequired, unauthorizedResponse } from "../lib/openapi";
   import type { AuthedEnv } from "../types";

   const TodoSchema = z
     .object({ id: z.number().int(), title: z.string(), createdAt: z.iso.datetime() })
     .openapi("Todo");

   const listTodos = createRoute({
     method: "get",
     path: "/todos",
     tags: ["todos"],
     operationId: "listTodos",
     ...authRequired,
     responses: {
       200: {
         description: "The signed-in user's todos",
         content: { "application/json": { schema: z.array(TodoSchema) } },
       },
       ...unauthorizedResponse,
     },
   });

   export const todoRoutes = new OpenAPIHono<AuthedEnv>().openapi(listTodos, async (c) => {
     const rows = await createDb(c.env.DB)
       .select()
       .from(todos)
       .where(eq(todos.userId, c.get("user").id))
       .orderBy(desc(todos.id));
     return c.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), 200);
   });
   ```

   - ログイン不要の API なら `...authRequired` と `...unauthorizedResponse` を外し、`OpenAPIHono<AppEnv>` にする (`routes/healthz.ts` が例)。
   - `operationId` は生成される hook の名前になる (`listTodos` → `useListTodos`)。`tags` は生成ファイルの分割単位になる。
   - 再利用するスキーマには `.openapi("Name")` で名前を付ける。名前を付けると型が `@fllooat/api-client` から export される。
   - 返すステータスコードはすべて `responses` に書く。書いていないコードは型エラーになる。
   - DB の行はそのまま返さず、`Date` を ISO 文字列にするなどレスポンス用に変換する。
2. `apps/api/src/app.ts` で `app.route("/", todoRoutes)` を追加する。
3. ルートで `pnpm gen` を実行する。`packages/api-client/openapi.json` と `src/generated/**` が更新される。
4. 要件をテストにする (`write-tests` の skill)。
5. DB の変更が必要なら `change-db-schema` の skill に従う。
6. `pnpm check`、`pnpm typecheck`、`pnpm test` を通す。生成物も含めてコミットする。

## フロントからの使い方

```tsx
import { getListTodosQueryKey, useCreateTodo, useListTodos } from "@fllooat/api-client";

const todos = useListTodos(); // 成功時のデータは todos.data?.data
const createTodo = useCreateTodo({
  mutation: {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTodosQueryKey() }),
  },
});
createTodo.mutate({ data: { title } });
```

2xx 以外の応答は `ApiError` (status と body を持つ) として投げられ、`isError` と `error` で扱えます。

## モックについて

`pnpm gen` で MSW のハンドラも生成され、`pnpm dev:mock` で自動的に使われます。値はランダムなので、デモ用に固定したい場合は `apps/web/src/mocks/handlers.ts` に `getListTodosMockHandler([...])` のように固定値を渡したハンドラを足します。こちらが生成ハンドラより優先されます。

## 確認

`pnpm dev` を起動し、http://localhost:5173/api/docs で追加したエンドポイントを確認します。
