---
name: add-page
description: このリポジトリのフロント (apps/web) に画面 (ルート) を追加する手順。TanStack Router のファイルベースルーティング、ログイン必須の画面、生成済み API hooks の使い方を含む。「画面を作って」「ページを追加して」「〜の UI を作って」などの依頼で使う。
---

# 画面 (ルート) の追加

## 手順

1. `apps/web/src/routes/` にファイルを作る。ファイル名が URL になる。
   - `about.tsx` → `/about`
   - `rooms/index.tsx` → `/rooms`
   - `rooms/$roomId.tsx` → `/rooms/:roomId` (`Route.useParams()` で取得)
   - 共通レイアウトは `__root.tsx` にある。
2. 中身は次の形にする。

   ```tsx
   import { createFileRoute } from "@tanstack/react-router";

   export const Route = createFileRoute("/about")({
     component: AboutPage,
   });

   function AboutPage() {
     return <h1 className="text-2xl font-bold">About</h1>;
   }
   ```

3. `pnpm dev` (または `pnpm dev:mock`) が起動していれば `routeTree.gen.ts` は自動で更新される。起動していなければ `pnpm build` で更新される。
4. リンクは `<Link to="/about">` を使う。`to` と `params` は型チェックされる。
5. API のデータは `@sp-2603/api-client` の hooks で取る (`add-api-endpoint` を参照)。読み込み中とエラーの表示も書く。

## ログイン必須の画面

最初のログイン必須画面を作るときに、ガード用のレイアウト `routes/_authed.tsx` を作ります。`_authed/` の下に置いたルートはすべてログイン必須になり、URL に `_authed` は含まれません。

```tsx
// routes/_authed.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/lib/auth-client";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { user: session.user };
  },
});
```

```tsx
// routes/_authed/todos.tsx → /todos
export const Route = createFileRoute("/_authed/todos")({ component: TodosPage });

function TodosPage() {
  const { user } = Route.useRouteContext(); // ログイン中のユーザー
  // ...
}
```

`_authed.tsx` は子ルートがないと `/` と衝突してビルドが失敗するので、子ルートといっしょに作ってください。

ログインしているかどうかで表示を変えるだけなら、`useQuery(sessionQueryOptions)` を使います (`components/user-menu.tsx` が例)。

## UI

- UI ライブラリはまだ決めていない。ユーザーの指示なしに追加せず、Tailwind のユーティリティで書く。

## API がまだない場合

`pnpm dev:mock` で起動すると、生成された MSW モックがランダムなデータを返します (ログイン済みで始まる。未ログインの画面を見るなら `pnpm dev:mock --logout`)。API のスキーマ自体がまだないときは、先に `add-api-endpoint` でスキーマだけ定義して `pnpm gen` すれば、実装より先に画面を作れます (ハンドラの中身は仮でよい)。
