# フロントエンド設計

[docs/concept.md](concept.md) の MVP を実装するための、フロント (`apps/web`) の設計案です。API は [docs/design-backend.md](design-backend.md) に従います。見た目はデザイナーの案を待っているので、ここでは画面の動きとデータの流れだけを決めます。決まっていないことは最後の「未決事項」にまとめています。

## 方針

- モバイルファーストで作る。PC のレスポンシブ対応は深く作り込まない。
- 気球の高さ、最終更新、合計 100% の制限はサーバーが計算した値を使う。フロントで計算し直さない。
- 揺れが強いかどうかの判定だけはフロントで行う。サーバーは呼ばれたらタスクを落とす。
- API は `@fllooat/api-client` が生成した hooks で呼ぶ。`fetch` を直接書かない。
- デザインが来るまでの見た目は仮置きにして、コードに `TODO: デザインが来たら見た目を差し替える` と書いておく。

## ライブラリ

| 用途 | ライブラリ | メモ |
| --- | --- | --- |
| ルーティング | TanStack Router (ファイルベース) | 雛形から使っている |
| データ取得 | TanStack Query + `@fllooat/api-client` | 雛形から使っている |
| スタイル | Tailwind CSS v4 | |
| UI の部品 | shadcn/ui (Radix ベース、Nova プリセット) | `pnpm --filter @fllooat/web exec shadcn add <名前>` で `src/components/ui/` に追加する |
| アニメーション | `motion` (旧 Framer Motion) | `import { motion } from "motion/react"`。気球の浮き沈み、ふわふわ、ドラッグに使う |
| 横に並べるスクロール | `embla-carousel-react` | 環状のループと、人数が少ないときにスクロールを止める機能を使う。見た目は持たない |
| アイコン | `lucide-react` | shadcn/ui といっしょに入った |

経過時間の表示は `Intl.RelativeTimeFormat` で書き、日付のライブラリは入れません。

## フォント

GenInterfaceJP を使います。フォントファイルは `apps/web/public/fonts/GenInterfaceJP/` に置き、`src/index.css` に `@font-face` を書きます。Tailwind の `font-sans` は `"GenInterfaceJP", system-ui, sans-serif` にしてあるので、ファイルを置く前はシステムのフォントで表示されます。

フォントを置いたら、[docs/third-party-licenses.md](third-party-licenses.md) の手順で `THIRD_PARTY_LICENSES.md` にライセンスを記録します。

## ディレクトリ

```
apps/web/src/
├─ routes/              画面 (ファイル名が URL になる)
├─ components/          気球などの画面の部品
│  └─ ui/               shadcn/ui の部品 (shadcn add で追加する)
├─ hooks/               use-device-shake など
├─ lib/                 揺れの判定など、React に依存しない処理
└─ mocks/               MSW のモック (ログイン状態など手書きのもの)
```

## 画面とルーティング

| パス | ファイル | 画面 |
| --- | --- | --- |
| `/login` | `routes/login.tsx` | Google と GitHub のログイン |
| `/` | `routes/_authed/index.tsx` | 表示はない。`GET /api/me` の `roomId` を見て、`/rooms/$roomId` か `/join` へ移る |
| `/join` | `routes/_authed/join.tsx` | 6 桁のルーム ID の入力と、ルームの新規作成 |
| `/rooms/$roomId` | `routes/_authed/rooms/$roomId.tsx` | 気球の空。ステータス設定と気球の詳細はポップアップで開く |

`_authed` の下はログイン必須で、ログインしていなければ `/login` に送り、ログイン後に元の URL へ戻します。

`/rooms/$roomId` は次の場合に `/join` へ戻します。

- `roomId` が 6 桁の数字でない
- `GET /api/rooms/{roomId}` が 403 (`NOT_ROOM_MEMBER`) か 404 (`ROOM_NOT_FOUND`) を返した。ほかの端末で別のルームに移ったときもこれに当たる

## データの取り方

### 画面と API の対応

| 画面 | 使う API |
| --- | --- |
| `/` | `GET /api/me` |
| `/join` | `POST /api/rooms` (作成)、`POST /api/rooms/{roomId}/members` (入室) |
| 気球の空 | `GET /api/rooms/{roomId}` |
| 気球の詳細 | `GET /api/rooms/{roomId}/members/{userId}` |
| ステータス設定 | `GET /api/me/tasks`、`POST /api/me/tasks`、`GET /api/me/history`、`POST /api/me/history/{taskId}/reload` |
| 揺らして落とす | `POST /api/me/tasks/drop` |

### ポーリングと取り直し

- 気球の空は `GET /api/rooms/{roomId}` を `refetchInterval` で 3 秒ごとに取り直す。画面が裏に回っている間は止まる (TanStack Query の既定の動き)。
- タスクを乗せる、落とす、乗せ直したら、ポーリングを待たずにルームの情報と自分のタスクを取り直す (`invalidateQueries`)。

### エラーの扱い

API はエラーを `{ code, message, details }` の形で返します。フロントは `code` で分岐し、`message` は画面に出しません。

| `code` | フロントの動き |
| --- | --- |
| `UNAUTHORIZED` | `/login` へ送る |
| `NOT_ROOM_MEMBER`、`ROOM_NOT_FOUND` | `/join` へ戻す。入室のときの `ROOM_NOT_FOUND` は「ルームが見つかりません」と出す |
| `MEMBER_NOT_FOUND` | 詳細のポップアップを閉じる (その人がルームを抜けた) |
| `WEIGHT_LIMIT_EXCEEDED` | 「あと N% までしか乗せられません」と出し、スライダーの上限を `details.remaining` に合わせる |
| `VALIDATION_ERROR` | 入力欄の下に出す |
| `ROOM_ID_EXHAUSTED` | 「もう一度試してください」と出す |

## 気球の空

### 気球の並び

concept.md のとおり、1 画面に気球を 3 個並べ、自分を中心に置きます。

- `GET /api/rooms/{roomId}` の `members` は自分を含めて入室順に並んでいる。`isMe` の人を先頭にして回し、`[自分, 自分の次に入った人, ..., 自分の前に入った人]` の環状のリストを作る。自分の右隣が入室順で自分の次の人、左隣が自分の前の人になる。
- embla の `loop` で左右にスクロールでき、端まで行くと一周して自分に戻る。
- 自分を含めて 3 人以下のときは、スクロールを止めて自分を中心に固定する。2 人のときは、相手を自分の左右どちらかに出す (案は右。未決事項を参照)。

### 気球の高さと目盛り

- 気球の高さは `busy` (0〜100) で決める。0% が一番上、100% が一番下。
- 高さが変わったときは `motion` のばねの動きで移す。止まっている間も、上下に少しふわふわさせる。
- 画面の左右どちらか (または両方) に目盛りを置き、今何 % か読めるようにする。

### 経過時間による遠近

`serverTime - statusUpdatedAt` で経過時間を出します。端末の時計は使いません。

| 最終更新から | 見た目 |
| --- | --- |
| 1 時間以内 | 標準の大きさで、一番濃い |
| 3 時間以内 | 少し小さく、少し薄い |
| 12 時間以内 | さらに小さく、薄い |
| 24 時間以上 | 一番小さく、一番薄い。これ以上は変えない |

経過時間から段階を決める処理は、`lib/` に関数として置きます。

### 気球の詳細

他人の気球も自分の気球も、タップすると詳細のポップアップを開きます。名前、アイコン、忙しさ、乗っているタスクのタイトルと重さ、最終更新からの経過時間 (「3 時間前」) を出します。

## ステータス設定

- ステータス設定ボタンからポップアップで開く。
- タスクのタイトルと重さを入れて乗せる。重さは 1% 刻みのスライダーで、上限は `GET /api/me/tasks` の `remaining`。`remaining` が 0 なら乗せるボタンを押せなくする。
- 落としたタスクの履歴を出す。選ぶと、新規作成と同じスライダーで重さを決めて乗せ直せる。

## 揺らして落とす

### 判定

`lib/shake-detector.ts` の `createShakeDetector` が、左右の動きの値を受け取り、強い動きの向きが短い時間に何度も入れ替わったら揺れとみなします。スマホの振りと、気球のドラッグの両方で同じ判定を使います。

| 入力 | 使う値 | しきい値 | 回数と時間 |
| --- | --- | --- | --- |
| スマホを振る | `devicemotion` の加速度の x (m/s²) | 12 | 1 秒以内に 4 回、向きが入れ替わる |
| 気球をドラッグする | `motion` の `onDrag` の速度の x (px/s) | 600 | 1 秒以内に 4 回、向きが入れ替わる |

しきい値は仮の値です。実機で触って調整します。

### スマホの振り

`hooks/use-device-shake.ts` の `useDeviceShake` を使います。iPhone の Safari は、ボタンを押したときにモーションセンサーの許可を取らないと値が来ないので、`permission` が `prompt` の間は許可を取るボタンを出します。HTTPS でない場合とセンサーがない端末では `unsupported` になり、ドラッグだけで落とします。

### ドラッグとスクロールの取り合い

- 揺らせるのは自分の気球だけにする。ほかの人の気球はタップで詳細を開くだけ。
- 気球本体を押さえてドラッグすると揺れる。背景をドラッグするとスクロールする。気球のドラッグが embla に伝わらないようにする。
- 気球のドラッグは横方向だけにして、離すと元の位置に戻る。

### 揺れたあと

揺れを検出したら `POST /api/me/tasks/drop` を呼びます。乗っているタスクが 0 件でも呼びます (最終更新が新しくなり、「まだ暇」と伝わる)。呼び出し中にもう一度揺れても、二重には呼びません。

## 開発と確認

- API がなくても `pnpm dev:mock` で画面を作れる。ログイン済みで始まるので、`/rooms/123456` を直接開けば気球の空を見られる。
- スマホの実機での確認は、Cloudflare Tunnel で HTTPS の URL を付けて行う。手順は [docs/development.md](development.md#スマホの実機で確かめる) にある。

## 作る順番

1. 土台: ライブラリの導入、全画面のレイアウト、ルーティングの骨組み、揺れの判定 (済み)
2. バックが API のスキーマを `pnpm gen` したら、仮の値を外して hooks につなぐ。`/` の振り分けと `/join` の作成、入室から始める
3. 気球の空: 環状の並び、高さ、ポーリング
4. ステータス設定のポップアップと、揺らして落とす処理を API につなぐ
5. 気球の詳細と遠近
6. デザインの反映とフォントの適用
7. 実機でしきい値を調整し、デモの流れを通して確かめる

## 未決事項

| 項目 | 案 | 理由 |
| --- | --- | --- |
| 揺れのしきい値 | 上の表の値から始める | 実機で触らないと決められない |
| 遠近の具体的な大きさと濃さ | デザイナーと決める | 段階の区切りは concept.md で決まっているが、数値はない |
| 2 人のときに相手を出す側 | 右 | 環状の並びで、自分の次の人が右に来るのとそろう |
| ポップアップの部品 | shadcn/ui の Dialog。スマホでは下から出る Drawer も候補 | デザインの案しだい |
| タイトルの長さの上限 | バックの案の 30 文字に合わせて、入力欄でも 30 文字で止める | concept.md では未決 |
| 読み込み中とエラーの見た目 | デザイナーと決める | |
