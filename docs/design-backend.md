# バックエンド設計

[docs/concept.md](concept.md) の MVP を実装するための、DB と API の設計案です。決まっていないことは最後の「未決事項」にまとめています。

## 方針

- 1 人が入れるルームは 1 つ。ルームの状態はポーリング (数秒ごとの再取得) で共有する。
- 気球の高さ (忙しさ) と最終更新は、サーバーが計算して返す。フロントは表示だけを受け持つ。
- 合計 100% の制限など、壊れると困る約束はサーバーで守る。フロントのスライダーの上限は補助にすぎない。
- 他人のタスクのタイトルは、同じルームのメンバーが気球の詳細を開いたときだけ返す。

## DB

D1 (SQLite) を Drizzle で扱います。日時はミリ秒の UNIX 時刻で持ち、Better Auth のテーブルとそろえます。

```
user (Better Auth)
 ├─ room_member   1 人 1 行。どのルームにいるか
 │    └─ room     6 桁の ID を持つルーム
 ├─ user_status   1 人 1 行。最終更新の日時
 └─ task          乗っているタスクと、落としたタスクの履歴
```

### room

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | TEXT | 主キー、6 桁の数字 | ルーム ID。`012345` のように先頭が 0 でもよいので文字列で持つ |
| `created_by` | TEXT | `user.id` を参照、NULL 可 | 作った人。ユーザーが消えたら NULL にする |
| `created_at` | INTEGER | NOT NULL | 作成日時 |

### room_member

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `user_id` | TEXT | 主キー、`user.id` を参照 (削除時は一緒に消す) | 1 人 1 ルームなので主キーにする |
| `room_id` | TEXT | NOT NULL、`room.id` を参照 (削除時は一緒に消す) | |
| `joined_at` | INTEGER | NOT NULL | 入室日時。気球の並び順に使う |

インデックス: `(room_id, joined_at)`。ルームのメンバーを入室順に取り出すため。

### user_status

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `user_id` | TEXT | 主キー、`user.id` を参照 (削除時は一緒に消す) | |
| `updated_at` | INTEGER | NOT NULL | 最終更新。気球の遠近に使う |

concept.md の案では `room_member.status_updated_at` に置いていましたが、別のテーブルに分けました。理由は 2 つあります。

- ルームを移ると `room_member` の行が書き換わり、最終更新も消えてしまう。最終更新はルームではなく人に付く情報なので、人ごとのテーブルに置く。
- 最終更新を task の日時から計算する方法もあるが、それだと手が空いている人 (タスクが 0 件) は「まだ暇」と伝える手段がなく、時間とともに薄くなってしまう。空の気球を揺らしたときにも更新できるよう、独立した値として持つ。

`updated_at` は、タスクを乗せたとき、落としたとき (空でも)、乗せ直したときに今の日時にします。行がなければ入室日時を最終更新として扱います。

### task

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | 主キー、自動採番 | |
| `user_id` | TEXT | NOT NULL、`user.id` を参照 (削除時は一緒に消す) | |
| `title` | TEXT | NOT NULL、前後の空白を除いて 1 から 30 文字 | 長さの上限は未決事項。案は 30 文字 |
| `weight` | INTEGER | NOT NULL、1 から 100 | 重さ (%)。0% のタスクは気球が動かず意味がないので 1 からにする |
| `state` | TEXT | NOT NULL、`on` か `dropped` | 乗っているか、落としたか |
| `created_at` | INTEGER | NOT NULL | 乗せた日時。乗せ直したときは上書きする |
| `dropped_at` | INTEGER | `state = dropped` のときだけ値を持つ | 落とした日時。履歴の並び順に使う |

インデックス: `(user_id, state, dropped_at)`。乗っているタスクの合計と、履歴の新しい順の取得に使う。

`state` と `dropped_at` の組み合わせは CHECK 制約で縛ります (`on` なら NULL、`dropped` なら値がある)。

## 計算のしかた

### 忙しさ

その人の `state = on` のタスクの `weight` の合計です。タスクがなければ 0% で、最大 100% です。

### 合計 100% の制限

D1 は、読んでから書くまでを 1 つのトランザクションにまとめる使い方ができません。そこで、判定と追加を 1 つの SQL 文で行います。

```sql
INSERT INTO task (user_id, title, weight, state, created_at)
SELECT :user_id, :title, :weight, 'on', :now
WHERE (SELECT COALESCE(SUM(weight), 0) FROM task WHERE user_id = :user_id AND state = 'on') + :weight <= 100
RETURNING *;
```

合計が超えるなら 1 行も追加されないので、409 を返します。2 つの端末から同時に追加しても、100% を超えることはありません。乗せ直し (UPDATE) も同じ形で条件を付けます。

### ルーム ID の発行

`crypto.getRandomValues` で 0 から 999999 の数を作り、6 桁にゼロ埋めします。`INSERT ... ON CONFLICT DO NOTHING` で入れてみて、すでに使われていたら作り直します。5 回続けて衝突したら 503 を返します。100 万通りあるので、ハッカソンの規模で衝突が続くことはまずありません。

### 入室と退室

入室は次の 1 文で行います。すでに別のルームにいれば、そのまま移ります (前のルームからは自動で抜ける)。同じルームに入り直したときは `joined_at` を変えず、並び順が変わらないようにします。

```sql
INSERT INTO room_member (user_id, room_id, joined_at) VALUES (:user_id, :room_id, :now)
ON CONFLICT (user_id) DO UPDATE SET room_id = excluded.room_id, joined_at = excluded.joined_at
WHERE room_member.room_id <> excluded.room_id;
```

ルームの作成は、`room` の追加と上の入室を D1 の batch でまとめて実行します。batch は全体が 1 つのトランザクションになるので、ルームだけができて入室できない、という中途半端な状態は残りません。

誰もいなくなったルームは消さずに残します (未決事項を参照)。

## API

すべて `/api` の下にあり、`/api/healthz` と `/api/auth/*` 以外はログインが必要です。日時は ISO 8601 の文字列で返します。

### 一覧

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/me` | 自分の情報と、今いるルーム |
| POST | `/api/rooms` | ルームを作って入る |
| POST | `/api/rooms/{roomId}/members` | ID を指定してルームに入る |
| GET | `/api/rooms/{roomId}` | ルームのメンバーと気球の状態 (ポーリング用) |
| GET | `/api/rooms/{roomId}/members/{userId}` | 気球の詳細 |
| GET | `/api/me/tasks` | 自分の乗っているタスク |
| POST | `/api/me/tasks` | タスクを乗せる |
| POST | `/api/me/tasks/drop` | タスクを全部落とす |
| GET | `/api/me/history` | 落としたタスクの履歴 |
| POST | `/api/me/history/{taskId}/reload` | 履歴から乗せ直す |

自分に関するものは `/api/me` の下、ルームに関するものは `/api/rooms/{roomId}` の下に置きました。ルームの API は URL のルーム ID とログイン中の人のルームを照らし合わせ、メンバーでなければ 403 を返します。フロントはこれを見て `/join` に戻します。

### エラーの形

```json
{ "code": "WEIGHT_LIMIT_EXCEEDED", "message": "...", "details": { "remaining": 20 } }
```

フロントは `code` で分岐します。`message` は開発者向けで、画面にそのまま出すものではありません。

| HTTP | `code` | いつ |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 入力の形が正しくない (`details` に項目ごとの内容) |
| 401 | `UNAUTHORIZED` | ログインしていない |
| 403 | `NOT_ROOM_MEMBER` | そのルームのメンバーではない |
| 404 | `ROOM_NOT_FOUND` | ルームがない |
| 404 | `MEMBER_NOT_FOUND` | その人は同じルームにいない |
| 404 | `TASK_NOT_FOUND` | 自分の履歴にそのタスクがない |
| 409 | `WEIGHT_LIMIT_EXCEEDED` | 合計が 100% を超える (`details.remaining` に残りの %) |
| 503 | `ROOM_ID_EXHAUSTED` | ルーム ID の発行で衝突が続いた |

今のバリデーションエラーは zod のエラーがそのまま返る形なので、上の形にそろえる作業も最初に行います。

### GET /api/me

```json
{
  "user": { "id": "u_abc", "name": "Alice", "image": "https://..." },
  "roomId": "012345"
}
```

ルームに入っていなければ `roomId` は `null` です。フロントの `/` はこれを見て `/rooms/$roomId` か `/join` へ移ります。

### POST /api/rooms

本文はありません。201 で `{ "roomId": "012345" }` を返します。前のルームにいれば抜けます。

### POST /api/rooms/{roomId}/members

本文はありません。`roomId` が 6 桁の数字でなければ 400、ルームがなければ 404、入れたら 200 で `{ "roomId": "012345" }` を返します。

### GET /api/rooms/{roomId}

ポーリングで数秒ごとに呼ばれます。タスクのタイトルは含めません。

```json
{
  "roomId": "012345",
  "serverTime": "2026-10-18T10:00:00.000Z",
  "members": [
    {
      "userId": "u_abc",
      "name": "Alice",
      "image": "https://...",
      "busy": 60,
      "statusUpdatedAt": "2026-10-18T09:12:00.000Z",
      "isMe": true
    }
  ]
}
```

- `members` は入室順 (`joined_at` の古い順) に並べ、自分も含めます。環状の並びはフロントが `isMe` の位置を起点に作ります。
- `serverTime` は、経過時間をサーバーの時計で計算するためのものです。端末の時計がずれていても、遠近の段階が狂わないようにします。

### GET /api/rooms/{roomId}/members/{userId}

気球をタップしたときに呼びます。

```json
{
  "userId": "u_abc",
  "name": "Alice",
  "image": "https://...",
  "busy": 60,
  "statusUpdatedAt": "2026-10-18T09:12:00.000Z",
  "serverTime": "2026-10-18T10:00:00.000Z",
  "tasks": [{ "id": 12, "title": "API の実装", "weight": 40, "createdAt": "2026-10-18T09:12:00.000Z" }]
}
```

`tasks` は乗っているタスクだけを `created_at` の新しい順で返します。自分が同じルームにいなければ 403、その人が同じルームにいなければ 404 です。

### GET /api/me/tasks

```json
{
  "busy": 60,
  "remaining": 40,
  "tasks": [{ "id": 12, "title": "API の実装", "weight": 40, "createdAt": "2026-10-18T09:12:00.000Z" }]
}
```

`remaining` はステータス設定画面のスライダーの上限に使います。

### POST /api/me/tasks

```json
{ "title": "API の実装", "weight": 40 }
```

`title` は前後の空白を除いて 1 から 30 文字、`weight` は 1 から 100 の整数です。201 で作ったタスクを返します。合計が 100% を超えるなら 409 です。

### POST /api/me/tasks/drop

本文はありません。乗っているタスクをすべて落とし、200 で `{ "droppedCount": 2 }` を返します。乗っているタスクが 0 件でも成功にして、最終更新だけを今にします (空の気球を揺らすと「まだ暇」と伝わる)。

揺れが強いかどうかの判定はフロントで行います。サーバーは呼ばれたら落とすだけです。

### GET /api/me/history

```json
{
  "tasks": [{ "id": 9, "title": "デザインの確認", "weight": 30, "droppedAt": "2026-10-18T08:00:00.000Z" }]
}
```

`dropped_at` の新しい順に、最新 50 件まで返します。同じタイトルのタスクもまとめずにそのまま返します (未決事項を参照)。

### POST /api/me/history/{taskId}/reload

```json
{ "weight": 30 }
```

履歴のタスクを乗せ直します。`state` を `on` に、`weight` を受け取った値に、`created_at` を今にして、`dropped_at` を消します。200 で乗せ直したタスクを返します。自分の履歴にないタスクなら 404、合計が超えるなら 409 です。

## ポーリング

- フロントは TanStack Query の `refetchInterval` で `GET /api/rooms/{roomId}` を 3 秒ごとに呼ぶ。画面が裏に回っている間は止める (TanStack Query の既定の動き)。
- 自分のタスクを変えたら、ポーリングを待たずにルームの情報を取り直す (`invalidateQueries`)。
- サーバー側は、メンバー、忙しさ、最終更新を 1 回のクエリで返す (`room_member` に `user` と `user_status` を結合し、task の合計をまとめて取る)。インデックスがあるので、ルームの人数が数十人でも軽い。

## テスト

[write-tests](../.claude/skills/write-tests/SKILL.md) の skill に従い、要件ごとにテストを書きます。最初に用意するものの例です。

- ルーム
  - ルームを作るとそのルームに入った状態になる
  - 6 桁の ID を入れると同じルームに入れる
  - ない ID のルームには入れない
  - 別のルームに入ると、前のルームのメンバー一覧から消える
  - 同じルームに入り直しても並び順は変わらない
  - メンバーでないルームの情報は見られない
- タスク
  - タスクを乗せると忙しさが増える
  - 合計が 100% を超えるタスクは乗せられない
  - タスクを落とすと忙しさが 0% になり、履歴に入る
  - 乗っているタスクがなくても揺らすと最終更新が新しくなる
  - 履歴から乗せ直すと、重さと乗せた日時が新しくなる
  - 他人の履歴のタスクは乗せ直せない
- 気球の詳細
  - 同じルームの人のタスクのタイトルが見られる
  - ルームの一覧にはタスクのタイトルが含まれない
  - ほかのルームの人の詳細は見られない

## 作る順番

1. **API のスキーマだけを先に書いて `pnpm gen` する**。ハンドラは仮の値を返すだけでよい。これでフロントは MSW のモックで画面を作り始められる。
2. エラーの形をそろえる (`VALIDATION_ERROR` などを共通の形で返す)。
3. DB のスキーマとマイグレーション。
4. `GET /api/me`、ルームの作成と入室。
5. タスクを乗せる、落とす、履歴、乗せ直し。
6. ルームの状態と気球の詳細。
7. デモ用のシードデータ。1 つのルームに、忙しさと最終更新がばらばらなダミーメンバーを数人入れ、環状の並びと遠近を 1 人でも見せられるようにする。
8. 本番へのデプロイ。

## 未決事項

| 項目 | 案 | 理由 |
| --- | --- | --- |
| タイトルの長さの上限 | 30 文字 | スマホの詳細ポップアップで 1、2 行に収まる |
| 履歴の件数と、同じタイトルの扱い | 最新 50 件。まとめない | まとめると「どの重さで乗せ直すか」が曖昧になる。必要ならフロントで表示をまとめる |
| ルームから抜けるだけの操作 | 作らない | concept.md にない。別のルームに入れば抜けられる |
| 誰もいなくなったルーム | 残す | ID は 100 万通りあり、ハッカソンの規模では枯渇しない |
| 空の気球を揺らしたときの扱い | 最終更新だけを新しくする | 手が空いている人が「まだ暇」と伝えられるようにするため |
| ポーリングの間隔 | 3 秒 | デモで動きがすぐ伝わり、D1 の読み取りも無料枠に収まる |

## フロントからの相談と依頼

フロントの設計 ([docs/design-frontend.md](design-frontend.md)) を進める中で出てきたものです。1 と 4 はスキーマとマイグレーションに関わるので、書き始める前に決めたいです。

### 1. エラーの形を OpenAPI に載せてほしい (依頼)

今の `packages/api-client/src/fetcher.ts` では、2xx 以外の応答の本文は `ApiError.body: unknown` として届きます。このままだと、フロントは `code` で分岐するたびに本文の形を自分で確かめる必要があります。

エラーの形 `{ code, message, details }` を、`code` を enum にした zod スキーマとして各ルートの `responses` に載せてもらえると、Orval が型を生成します。`code` の打ち間違いも型チェックで見つかるようになります。

### 2. モックで使う値の例を付けてほしい (相談)

Orval が生成する MSW のモックは faker のランダムな値を返すので、`pnpm dev:mock` では次のようになります。

- `GET /api/rooms/{roomId}` の `members` で、`isMe: true` の人が 0 人や 2 人になる。環状の並びが作れない
- `roomId` が 6 桁の数字にならない
- ポーリングのたびに全員の `busy` が変わり、気球が上下し続ける

`GET /api/me` と `GET /api/rooms/{roomId}` のモックは、フロントが `apps/web/src/mocks/` に手書きで用意します。ほかの API は、zod に `.openapi({ example })` を付けてもらえると、モックの値が現実的になって助かります。必須ではありません。

### 3. 更新系の API で、更新後の状態を返してほしい (相談)

`POST /api/me/tasks/drop` は `{ "droppedCount": 2 }` だけを返します。揺らした直後に気球が浮き上がるのがデモの見せ場ですが、このままだと応答を受けてから取り直すまで、気球が浮くのが一拍遅れます。

次の 3 つが、`GET /api/me/tasks` と同じ形 (`busy`、`remaining`、`tasks`) に `statusUpdatedAt` を足したものを返すと、フロントは取り直さずにその場で画面を更新できます。

- `POST /api/me/tasks`
- `POST /api/me/tasks/drop`
- `POST /api/me/history/{taskId}/reload`

フロントは応答を待たずに先に気球を動かし、失敗したら戻す作りにするので、この変更がなくても MVP は作れます。

### 4. タイトルの長さの上限を DB の CHECK 制約に入れないでほしい (依頼)

タイトルの上限は concept.md で未決のままです。SQLite では CHECK 制約をあとから変えるのにテーブルを作り直すマイグレーションが要るので、上限は API の zod だけで確かめ、DB の `title` には「空でない」ことだけを制約として付けてもらえると、後から変えやすくなります。フロントの入力欄も、上限は API に合わせます (今の案は 30 文字)。
