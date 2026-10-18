-- デモ用のルーム 123456 に、忙しさと最後に画面を開いていた時刻がばらばらなダミーメンバーを入れる。
-- 流すたびに作り直すので、何度流してもよい。ダミーの人は OAuth の account を持たないのでログインはできない。
-- 自分でログインして ID 123456 で入ると、ダミーの後ろに並ぶ。
-- D1 では一時テーブルを作れないので、ダミーの一覧は文ごとに WITH で書く。

-- user を消すと、room_member、user_status、task も一緒に消える。
DELETE FROM user WHERE id LIKE 'demo-%';

INSERT INTO room (id, created_by, created_at)
VALUES ('123456', NULL, cast(unixepoch('subsec') * 1000 as integer))
ON CONFLICT (id) DO NOTHING;

INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at)
WITH demo_member (id, name) AS (
  VALUES ('demo-hana', 'Hana'), ('demo-ren', 'Ren'), ('demo-yui', 'Yui'), ('demo-sora', 'Sora'), ('demo-kai', 'Kai')
)
SELECT id, name, id || '@example.com', 0, NULL,
  cast(unixepoch('subsec') * 1000 as integer) - 2 * 86400000,
  cast(unixepoch('subsec') * 1000 as integer) - 2 * 86400000
FROM demo_member;

-- 入室は 1 日前から 1 分ずつずらす。あとから入った本物のユーザーは一番後ろに並ぶ。
INSERT INTO room_member (user_id, room_id, joined_at)
WITH demo_member (id, joined_order) AS (
  VALUES ('demo-hana', 1), ('demo-ren', 2), ('demo-yui', 3), ('demo-sora', 4), ('demo-kai', 5)
)
SELECT id, '123456', cast(unixepoch('subsec') * 1000 as integer) - 86400000 + joined_order * 60000
FROM demo_member;

-- 最後に画面を開いていたのは何分前か。しきい値 (wrangler.jsonc の AWAY_THRESHOLD_MINUTES、今は 30 分) を変えたら合わせて直す。
-- 今の値では Yui と Sora が離れている扱いになる。
INSERT INTO user_status (user_id, last_seen_at)
WITH demo_member (id, seen_ago) AS (
  VALUES ('demo-hana', 3), ('demo-ren', 12), ('demo-yui', 300), ('demo-sora', 1080), ('demo-kai', 20)
)
SELECT id, cast(unixepoch('subsec') * 1000 as integer) - seen_ago * 60000
FROM demo_member;

-- 忙しさは Hana 80%、Ren 45%、Yui 100%、Sora 20%、Kai 0%。Ren と Kai はプールにもタスクを置いている。
INSERT INTO task (user_id, title, weight, state, created_at, loaded_at)
WITH demo_task (user_id, title, weight, state) AS (
  VALUES
    ('demo-hana', 'スライドの作成', 50, 'on'),
    ('demo-hana', 'デモ動画の撮影', 30, 'on'),
    ('demo-ren', 'API の実装', 45, 'on'),
    ('demo-ren', 'README の更新', 20, 'pool'),
    ('demo-yui', 'デザインの修正', 60, 'on'),
    ('demo-yui', 'アイコンの作成', 40, 'on'),
    ('demo-sora', 'レビュー', 20, 'on'),
    ('demo-kai', '環境構築', 30, 'pool')
)
SELECT t.user_id, t.title, t.weight, t.state,
  s.last_seen_at - 60 * 60000,
  CASE WHEN t.state = 'on' THEN s.last_seen_at - 30 * 60000 END
FROM demo_task AS t
JOIN user_status AS s ON s.user_id = t.user_id;
