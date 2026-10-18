# バックエンド設計

[new-concept.md](new-concept.md) に合わせた DB と API の設計です。MVP ([concept.md](concept.md)) の実装からの変更点には **(変更)** を付けました。決まっていないことは最後の「未決事項」にまとめています。

## 方針

- 1 人が入れるルームは 1 つ。ルームの状態はポーリング (3 秒ごとの再取得) で共有する。
- 忙しさ (重さの合計) と離れているかどうかは、サーバーが計算して返す。籠の大きさはフロントが忙しさから決めるので、API は変えない。
- 合計 100% の制限など、壊れると困る約束はサーバーで守る。
- 自分のタスクを変える API は、変えた後の自分の状態 (`MyStatus`) を返す。フロントはこれで空の画面とタスク編集画面の両方を更新し、どの画面でも気球の状態をそろえる。
- 他人のタスクのタイトルは、同じルームのメンバーが気球の詳細を開いたときだけ返す。

## 今の実装から変えること

| 何を | どう変える |
| --- | --- |
| タスクの状態 | `on` / `dropped` から `pool` / `on` にする。落としたタスクの履歴はなくす |
| 新しいタスク | 気球ではなくプールに作る。100% の判定は、プールから気球に乗せるときに行う |
| プールのタスク | 消す API を足す。編集は MVP では作らない |
| 振り落とし | 落としたタスクは履歴に残さず消す |
| 履歴の API | `GET /api/me/history` と `POST /api/me/history/{taskId}/reload` を消す |
| 最終更新 | 「経過時間による遠近」をやめ、最後に画面を開いていた時刻 (`last_seen_at`) に置き換える |
| ルームの応答 | `statusUpdatedAt` と `serverTime` を消し、`isAway` を足す |

## DB

D1 (SQLite) を Drizzle で扱います。日時はミリ秒の UNIX 時刻で持ちます。

```
user (Better Auth)
 ├─ room_member   1 人 1 行。どのルームにいるか
 │    └─ room     6 桁の ID のルーム
 ├─ user_status   1 人 1 行。最後に画面を開いていた時刻
 └─ task          プールにあるタスクと、気球に乗っているタスク
```

`room` と `room_member` は変えません。

### user_status (変更)

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `user_id` | TEXT | 主キー、`user.id` を参照 (削除時は一緒に消す) | |
| `last_seen_at` | INTEGER | NOT NULL | 最後に画面を開いていた時刻。`updated_at` から名前を変える |

- 行は初めて入室したときに作る (今と同じ)。
- `GET /api/rooms/{roomId}` が呼ばれるたびに、呼んだ人の `last_seen_at` を今にする。タスクを乗せる、落とすといった操作では更新しない。
- D1 の書き込み量に注意する。3 秒ごとに毎回書くと 1 人で 1 日約 2.9 万行になり、数人で無料枠 (1 日 10 万行) を超える。そこで、前回から 1 分以上たっているときだけ書く。

  ```sql
  UPDATE user_status SET last_seen_at = :now
  WHERE user_id = :user_id AND last_seen_at < :now - 60000;
  ```

  条件に合わなければ 0 行で、書き込みとして数えられない。しきい値は時間単位なので、1 分の遅れは問題にならない。

### task (変更)

| 列 | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | 主キー、自動採番 | |
| `user_id` | TEXT | NOT NULL、`user.id` を参照 (削除時は一緒に消す) | |
| `title` | TEXT | NOT NULL、空白だけは不可 | 上限 (30 文字) は API の zod で確かめる |
| `weight` | INTEGER | NOT NULL、1 から 100 | 重さ (%)。プールに作るときに決める |
| `state` | TEXT | NOT NULL、`pool` か `on` | プールにあるか、気球に乗っているか |
| `created_at` | INTEGER | NOT NULL | 作った日時。プールの並び順に使う |
| `loaded_at` | INTEGER | `state = on` のときだけ値を持つ | 乗せた日時。気球の中の並び順に使う |

- `dropped_at` と、`state` と `dropped_at` の CHECK 制約は消す。代わりに「`on` なら `loaded_at` がある、`pool` なら NULL」を CHECK で縛る。
- インデックスは `(user_id, state)` にする。
- マイグレーションでは、`dropped` の行を消してから作り直す。SQLite で CHECK 制約を変えるとテーブルの作り直しになるが、`pnpm db:generate` がその SQL を作る。

## 計算のしかた

### 忙しさ

その人の `state = on` のタスクの `weight` の合計です (0 から 100%)。今と同じです。

### 気球に乗せる (合計 100% の制限)

D1 は読んでから書くまでを 1 つのトランザクションにできないので、判定と書き込みを 1 つの SQL で行います。

```sql
UPDATE task SET state = 'on', loaded_at = :now
WHERE id = :task_id AND user_id = :user_id AND state = 'pool'
  AND (SELECT COALESCE(SUM(weight), 0) FROM task WHERE user_id = :user_id AND state = 'on') + weight <= 100
RETURNING *;
```

0 行だったときは、そのタスクが自分のプールにあるかを確かめます。なければ 404、あれば残りの % を数えて 409 を返します。

### 振り落とす

乗っているタスクをすべて消します (`DELETE FROM task WHERE user_id = :user_id AND state = 'on'`)。プールには戻しません。

### 離れているかどうか

`isAway = now - last_seen_at >= しきい値` をサーバーで計算します。サーバーの時計で比べるので、端末の時計がずれていても結果は変わりません。

しきい値は Workers の環境変数 `AWAY_THRESHOLD_MINUTES` で変えられるようにし、初期値は `180` (3 時間) にします。`wrangler.jsonc` の `vars` に置き、変えたら `pnpm --filter @fllooat/api cf-typegen` を実行します。

### ルーム ID、入室、回数の制限

今と同じです。ID は 6 桁の乱数で、衝突したら 5 回まで作り直します。入室は 1 人 1 分 10 回までです。誰もいなくなったルームは残します。

## API

すべて `/api` の下にあり、`/api/healthz` と `/api/auth/*` 以外はログインが必要です。

| メソッド | パス | 用途 | |
| --- | --- | --- | --- |
| GET | `/api/me` | 自分の情報と今いるルーム | |
| POST | `/api/rooms` | ルームを作って入る | |
| POST | `/api/rooms/{roomId}/members` | ID を指定してルームに入る | |
| GET | `/api/rooms/{roomId}` | メンバーと気球の状態 (ポーリング用) | 変更 |
| GET | `/api/rooms/{roomId}/members/{userId}` | 気球の詳細 | 変更 |
| GET | `/api/me/tasks` | 自分の状態 (`MyStatus`) | 変更 |
| POST | `/api/me/tasks` | プールにタスクを作る | 変更 |
| POST | `/api/me/tasks/{taskId}/load` | プールのタスクを気球に乗せる | 追加 |
| DELETE | `/api/me/tasks/{taskId}` | プールのタスクを消す | 追加 |
| POST | `/api/me/tasks/drop` | 乗っているタスクを全部落とす | |
| GET | `/api/me/history` | | 削除 |
| POST | `/api/me/history/{taskId}/reload` | | 削除 |

### MyStatus (変更)

```json
{
  "busy": 60,
  "remaining": 40,
  "tasks": [{ "id": 12, "title": "API の実装", "weight": 40, "loadedAt": "2026-10-18T09:12:00.000Z" }],
  "pool": [{ "id": 15, "title": "スライド作成", "weight": 20, "createdAt": "2026-10-18T10:00:00.000Z" }]
}
```

- `tasks` は乗っているタスクを `loaded_at` の新しい順、`pool` は `created_at` の新しい順で並べる。
- `statusUpdatedAt` は消す。

### 変わる API

- `POST /api/me/tasks`: 本文は今と同じ `{ "title", "weight" }`。プールに作るので 100% の判定はせず、201 で `MyStatus` を返す。
- `POST /api/me/tasks/{taskId}/load`: 本文なし。200 で `MyStatus` を返す。自分のプールにないタスクなら 404 (`TASK_NOT_FOUND`)、合計が 100% を超えるなら 409 (`WEIGHT_LIMIT_EXCEEDED`、`details.remaining` 付き)。
- `DELETE /api/me/tasks/{taskId}`: プールのタスクを消し、200 で `MyStatus` を返す。自分のプールにないタスク (乗っているタスクや他人のタスク) なら 404 (`TASK_NOT_FOUND`)。乗っているタスクは振り落としでだけ消える。
- `POST /api/me/tasks/drop`: 0 件でも成功にする点は今と同じ。最終更新はもう持たないので、何も書き込まずに `MyStatus` を返す。
- `GET /api/rooms/{roomId}`: 各メンバーの `statusUpdatedAt` を `isAway` (boolean) に置き換え、`serverTime` を消す。呼んだ人の `last_seen_at` を更新する。
- `GET /api/rooms/{roomId}/members/{userId}`: `statusUpdatedAt` と `serverTime` を `isAway` に置き換える。`tasks` は `loaded_at` の新しい順。

エラーの形 (`{ code, message, details? }`) と `code` の一覧は今と同じです。`TASK_NOT_FOUND` は「自分のプールにない」という意味に変わります。

## テスト

[write-tests](../.claude/skills/write-tests/SKILL.md) に従います。履歴と乗せ直しのテストは消し、次を足します。

- 作ったタスクはプールに入り、忙しさは変わらない
- プールのタスクを乗せると忙しさが増える
- 合計が 100% を超えるタスクは乗せられず、プールに残る
- 乗っているタスクや他人のタスクは乗せられない
- 振り落としたタスクは気球からもプールからも消える
- プールのタスクは消せる
- 乗っているタスクや他人のタスクは、消す API では消せない
- ルームの情報を取ると、自分は離れていない扱いになる
- しきい値より長く開いていない人は、離れている扱いになる

## 作る順番

1. API のスキーマを変えて `pnpm gen` する。`statusUpdatedAt` と `serverTime` を消すとフロントの遠近の表示が型エラーになるので、フロントの差し替えと同じ PR にするか、フロントが移るまでフィールドを残す。
2. DB のスキーマとマイグレーション。ローカルは `pnpm db:migrate:local`、本番は main へのマージ後のデプロイで当たる。
3. ハンドラとテスト。
4. シードデータ (`apps/api/seed/demo.sql`) を直す。`dropped` のタスクを消してプールのタスクを足し、`last_seen_at` をばらして、離れている人を 1 人以上入れる。

## 未決事項

| 項目 | 案 | 決まるまでの扱い |
| --- | --- | --- |
| 乗せたタスクを、振らずにプールへ戻す操作 | 作らない | API を作らない。作るなら `POST /api/me/tasks/{taskId}/unload` を足す |
| 重さと籠の大きさの対応 | フロントで決める | API に影響しない |
| 離れていると見なすしきい値 | 3 時間 | `AWAY_THRESHOLD_MINUTES` で変える |

合計が 100% を超えるドロップは起きにくい想定です。ただし重さの合計が 60% のときに 50% のブロックを乗せる、といったことはできてしまうので、サーバーは 409 で断ります。画面での見せ方は、起きたときに決めます。
