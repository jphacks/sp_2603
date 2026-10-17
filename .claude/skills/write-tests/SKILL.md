---
name: write-tests
description: このリポジトリで API のテストを要件ベースで書く手順 (Vitest + @cloudflare/vitest-plugin、実際の Workers と D1 で実行)。「テストを書いて」「テストを追加して」や、API を追加・変更したときに使う。
---

# 要件ベースのテスト

テストは「何ができるべきか」を確かめるために書きます。実装の手順をなぞるテストは、リファクタのたびに壊れて役に立たないので書きません。

## 要件からテストを起こす

1. 要件を「誰が、何をすると、どうなる」の文にする。Issue に完了条件があればそれを使う。
2. 1 つの文を 1 つの `it` にする。テスト名はその文をそのまま日本語で書く。
3. 正常な場合だけでなく、断られる場合 (未ログイン、他人のデータ、不正な入力) も要件として書き出す。

例: 「Todo を削除できるようにする」

| 要件 | テスト名 |
| --- | --- |
| 自分の Todo を削除すると一覧から消える | `自分の Todo を削除すると一覧から消える` |
| 他人の Todo は削除できない | `他人の Todo は削除できない` |
| ログインしていない人は削除できない | `ログインしていない人は Todo を削除できない` |

## 書き方

- テストは `apps/api/test/<機能>.test.ts` に置く。`describe` には機能名を書く。
- HTTP リクエストで API を呼び、レスポンス (ステータスと本文) だけを確かめる。内部の関数を直接呼んだり、DB の中身を覗いたりしない。
- 準備、実行、確認を空行で分ける。
- DB はモックしない。テストごとにストレージは分離されるので、他のテストのデータは見えない。

```ts
import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";

describe("Todo", () => {
  it("他人の Todo は一覧に表示されない", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser({ name: "Bob" });
    await request("/api/todos", { method: "POST", headers: alice.headers, body: { title: "買い物" } });

    const response = await request("/api/todos", { headers: bob.headers });

    expect(await response.json()).toEqual([]);
  });
});
```

- `request(path, { method, headers, body })`: Worker に HTTP リクエストを送る。`body` は JSON として送られる。
- `signInAsNewUser({ name, email })`: ユーザーを作ってログインし、`{ user, headers }` を返す。`headers` を渡すとそのユーザーとしてリクエストできる。

## 実行

```sh
pnpm test                                   # 全テスト
pnpm --filter @fllooat/api test:watch       # 変更を監視して再実行
```

## テストが落ちたとき

- まず実装を疑う。テストを書き換えてよいのは、要件そのものが変わったときだけ。
- 要件が変わったときは、テスト名 (要件の文) から直す。
