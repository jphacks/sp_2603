# Fllooat

[![IMAGE ALT TEXT HERE](https://jphacks.com/wp-content/uploads/2026/07/IMG_5316.png)](https://www.youtube.com/watch?v=piaNsc6ilBI)



Readme · MD
## 製品概要
### 背景(製品開発のきっかけ、課題等）
仲間内での位置情報共有や、チーム開発における進捗共有など、コミュニケーションやプロジェクト進行を円滑にするために各々の生活を共有することは有効な手段である。
チームメンバーが過去に経験した、チームプロジェクトにおいてタスクを抱えたメンバーに連絡するタイミングが見計らいづらいという課題を踏まえ、各々が今どの程度暇なのかを共有するサービスを開発することにした。
 
### 製品説明（具体的な製品の説明）
今回私たちのチームは、仲間内でのチームプロジェクト進行を円滑にするための、リアルタイムの「暇さ」を共有するためのサービス「Fllooat」を開発した。
 
暇さを共有するユーザー同士で一つのルームを作成し、同じルーム内のユーザーの暇さがそれぞれに対応する気球の高さで可視化される。暇であるほど気球は高く浮かび、忙しいほど低く沈む。気球が浮かぶ範囲は一画面の中で完結しており、一画面には最大3名まで表示される。ルームの人数が4名以上の場合は、横にスクロールすることで別のページに切り替えて他のメンバーを表示する。人数が増えるほど右側にページが追加されていき、最後のページからさらにスクロールすると一周して最初のページに戻るため、どのメンバーの状況も続けて確認できる。
 
自分の抱えているタスクは、名前と重さを設定して気球に積み込んでいく。荷物が増えるほど気球は沈み、忙しさを表す。タスクが完了した時、あるいはタスクを中断するなどして暇になる時は、スマホを振ることで抱えたタスクを一度全て振り落とす。軽くなった気球は再び浮き上がり、暇な状態であることを表す。
 
また、ルーム内の他のメンバーの気球に触れると、その人が抱えているタスクと、それらが全体の重さのうちどのくらいの割合を占めているのかを確認できる。「忙しい」という事実だけでなく、「何で忙しいのか」まで把握できるため、連絡や相談のタイミングを見計らいやすくなる。
 
### 特長
#### 1. 「暇」を可視化・共有する
位置情報共有サービスや、写真、動画をリアルタイムで共有するサービスはすでに存在し広く普及しているが、「暇さ」を可視化し、共有するサービスは斬新と言える。
気球の高さという直感的な表現を用いることで、一画面に表示される最大3名の暇さをひと目で比べることができる。
 
#### 2. スマホを振ってタスクを振り落とすインタラクション
タスクを終わらせて、あるいは区切りをつけて、タスクから解放される時には気球からタスクを振り落とすインタラクションを設けることで、より強い開放感や斬新な体験を提供する。
 
#### 3. 気球に触れて、タスクの中身と重さの内訳までわかる
他のメンバーの気球に触れると、その人が抱えているタスクの名前と、全体の重さに対して各タスクが占める割合を確認できる。
単に「忙しそう」で終わらせず、何にどのくらい手を取られているのかまで共有できるため、相手の状況に配慮したコミュニケーションが可能になる。
 
### 解決出来ること
* 「今、連絡しても大丈夫かな？」というタイミングの見計らいづらさを解消し、チームメンバーへの連絡や相談のハードルを下げる。
* タスクを抱え込んでいるメンバーに早めに気付くことができ、タスクの分担や手助けのきっかけになる。
* 忙しさを言葉にして伝えるのが苦手な人でも、気球の高さとタスクの内訳で、負担なく自分の状況を共有できる。
* タスクを振り落とす操作を通じて、区切りをつける・気持ちを切り替えるといった体験を提供する。
### 今後の展望
* 暇さの推移を履歴として残し、メンバーが暇になりやすい時間帯の可視化などに活用する。
* 暇になったタイミングや、重いタスクを抱えたタイミングでの通知機能を追加する。
* 仲間内でのチームプロジェクトだけでなく、ゼミ・サークル・職場など、さまざまなコミュニティでの活用を目指す。
### 注力したこと（こだわり等）
* 気球の高さ、サイドの目盛り、メンバーごとのアイコンの縁取りカラーなど、誰が今どのくらい暇なのかをひと目で把握できる画面設計。
* 一画面に最大3名を表示し、横スクロールでページを切り替えられる仕組み。最後のページから最初のページへループするため、人数が増えても迷わず全員を確認できる。
* スマホを振ってタスクを振り落とす、タスクが増えると気球が沈むなど、「暇さ」を感覚的に体験できるインタラクション。
* Google・GitHubアカウントでワンタップでログインでき、すぐに使い始められる手軽さ。
* ルームの切り替えに対応し、複数のコミュニティでの暇さの共有を可能にした点。
 


## 開発技術
### 活用した技術
#### API・データ
* Cloudflare Workers (API と画面の配信を 1 つの Worker で行う)
* Cloudflare D1 (ルーム、メンバー、タスクを保存するデータベース)
* Google OAuth、GitHub OAuth (ログイン)
* DeviceMotion API (スマホを振る動きの検知)
* Web App Manifest (ホーム画面に追加してアプリのように使う)

#### フレームワーク・ライブラリ・モジュール
* フロントエンド: React 19、Vite、TanStack Router、TanStack Query、Tailwind CSS v4、shadcn/ui (Radix UI)、Motion、Embla Carousel
* バックエンド: Hono、@hono/zod-openapi、Zod、Drizzle ORM、Better Auth
* API クライアントの生成とモック: Orval、MSW、Faker
* 開発環境: TypeScript 7、pnpm workspaces、Biome、Vitest (@cloudflare/vitest-plugin)、Wrangler、GitHub Actions

#### デバイス
ブラウザーが使えるデバイス全対応

### 独自技術
#### ハッカソンで開発した独自機能・技術
* 独自で開発したものの内容をこちらに記載してください
* 特に力を入れた部分をファイルリンク、またはcommit_idを記載してください。

##### フロントエンド

* スマホを振る動きと、指で気球を左右に揺らす動きを、同じ仕組みで「振った」と判定する処理。強い動きの向きが 1 秒以内に 4 回入れ替わったら振ったとみなすので、軽く触れたりスクロールしかけたりしただけではタスクが落ちない。センサーのない PC でも、気球をドラッグして揺らせば同じ操作ができる。([shake-detector.ts](https://github.com/jphacks/sp_2603/blob/main/apps/web/src/lib/shake-detector.ts)、[use-device-shake.ts](https://github.com/jphacks/sp_2603/blob/main/apps/web/src/hooks/use-device-shake.ts)、[4119ea6](https://github.com/jphacks/sp_2603/commit/4119ea6eb660df67fe3dfa3649be7ebd9cb9983b))
* 自分を真ん中に置き、右に次に入った人、左に前に入った人を並べて、端まで行くと最初に戻る気球の並び。画面の幅に合わせて列の数が増え、人数が少なくても途切れずにループする。([balloon-ring.ts](https://github.com/jphacks/sp_2603/blob/main/apps/web/src/lib/balloon-ring.ts)、[balloon-sky.tsx](https://github.com/jphacks/sp_2603/blob/main/apps/web/src/components/balloon-sky.tsx)、[d2b7ef4](https://github.com/jphacks/sp_2603/commit/d2b7ef4fe60aeb8ef6b12c39faf34fed846b20d6))
* メンバーごとの気球の色を、ルームとユーザーから決める処理。どの端末で見ても同じ色になり、隣どうしは同じ系統の色にならない。後から人が入っても、先にいた人の色はほとんど変わらない。([balloon-colors.ts](https://github.com/jphacks/sp_2603/blob/main/apps/web/src/lib/balloon-colors.ts)、[399dae8](https://github.com/jphacks/sp_2603/commit/399dae87a37fe25ed5383dfd54a748cab486c5a0))

##### バックエンド

* 気球に乗せるタスクの重さの合計を 100% までに抑える処理。D1 では読んでから書くまでを 1 つのトランザクションにできないので、合計の判定と書き込みを 1 つの SQL 文にまとめた。2 台の端末から同時に乗せても、合計が 100% を超えることはない。([my-status.ts](https://github.com/jphacks/sp_2603/blob/main/apps/api/src/lib/my-status.ts)、[6574871](https://github.com/jphacks/sp_2603/commit/6574871c4dffc416bd0d5eddba607054b2a7fdc8))
* しばらく画面を開いていない人を見分け、気球をグレーにするための処理。画面は 3 秒ごとにルームの情報を取り直すので、そのたびに最後に開いた時刻を書くと、数人で D1 の無料枠 (1 日 10 万行の書き込み) を超えてしまう。前回から 1 分以上たったときだけ書くようにして、書き込みを 20 分の 1 に減らした。何分で離れたとみなすかは Cloudflare のダッシュボードで変えられるので、コードを変えずに調整できる。([rooms.ts](https://github.com/jphacks/sp_2603/blob/main/apps/api/src/lib/rooms.ts)、[6574871](https://github.com/jphacks/sp_2603/commit/6574871c4dffc416bd0d5eddba607054b2a7fdc8)、[870eb64](https://github.com/jphacks/sp_2603/commit/870eb64895f71fd0f4bdb511bc4eb1dc61d8c6a2))
* 6 桁の ID で入れるルームの管理。ID は乱数で作り、使われている ID と重なったら作り直す。他人のルームの ID を総当たりで探されないよう、入室は 1 人 1 分に 10 回までにした。全員が抜けたルームは消して、その ID をほかのルームで使えるようにしている。([rooms.ts](https://github.com/jphacks/sp_2603/blob/main/apps/api/src/lib/rooms.ts)、[a128054](https://github.com/jphacks/sp_2603/commit/a128054b1a14f7dee5db057b748c7eeaaa8360ae)、[f93c14b](https://github.com/jphacks/sp_2603/commit/f93c14b3d07c022174736b72812973fcc18d920f))

##### その他

* API の型を zod のスキーマ 1 か所にまとめ、`pnpm gen` で OpenAPI の定義、TanStack Query の hooks、型、MSW のモックまで生成する仕組み。フロントエンド班は API の完成を待たずに、モックを相手に画面を作り進められる。生成し忘れたまま push しても、CI で気付ける。([gen-openapi.ts](https://github.com/jphacks/sp_2603/blob/main/apps/api/scripts/gen-openapi.ts)、[orval.config.ts](https://github.com/jphacks/sp_2603/blob/main/packages/api-client/orval.config.ts)、[ea2bf38](https://github.com/jphacks/sp_2603/commit/ea2bf38a056784f2b9ef9b7af6e2c7cb2dd926c5))
* GitHub Actions による CI と自動デプロイ。PR ごとに lint、型チェック、ビルド、テスト、生成物の差分を確認し、main にマージすると Cloudflare Workers へのデプロイと本番のデータベースの更新まで自動で行う。ドキュメントだけを変えた PR では CI を省く。([ci.yml](https://github.com/jphacks/sp_2603/blob/main/.github/workflows/ci.yml)、[deploy.yml](https://github.com/jphacks/sp_2603/blob/main/.github/workflows/deploy.yml))
* 本番と同じ Workers の実行環境と D1 の上で動かすテスト。データベースをモックせず、HTTP リクエストを送って API の振る舞いを確かめる。テスト名は「ログインしていない人はルームから抜けられない」のように、要件をそのまま文にした。([apps/api/test](https://github.com/jphacks/sp_2603/tree/main/apps/api/test))
* AI エージェントにもメンバーと同じルールで開発させる仕組み。ブランチ、コミット、テストの決まりを AGENTS.md に書き、API や画面の追加といったよくある作業の手順を Agent Skills にまとめた。Claude Code や Codex に任せても、メンバーが書くのと同じ形のコードとコミットになる。([AGENTS.md](https://github.com/jphacks/sp_2603/blob/main/AGENTS.md)、[.claude/skills](https://github.com/jphacks/sp_2603/tree/main/.claude/skills)、[skills-lock.json](https://github.com/jphacks/sp_2603/blob/main/skills-lock.json))

