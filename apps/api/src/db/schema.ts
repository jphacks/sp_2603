// アプリのテーブルはこのファイルに追加する。auth-schema.ts は `pnpm --filter @fllooat/api auth:generate` の生成物。
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const room = sqliteTable("room", {
  // 6 桁の数字。先頭が 0 の ID もあるので文字列で持つ。
  id: text("id").primaryKey(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// 1 人が入れるルームは 1 つなので、user_id を主キーにする。
export const roomMember = sqliteTable(
  "room_member",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: text("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("room_member_room_id_joined_at_idx").on(table.roomId, table.joinedAt)],
);

// 最終更新はルームではなく人に付くので、room_member とは分けて持つ。
export const userStatus = sqliteTable("user_status", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const task = sqliteTable(
  "task",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 長さの上限は後から変えやすいように API の zod で確かめる。DB は空でないことだけを縛る。
    title: text("title").notNull(),
    weight: integer("weight").notNull(),
    state: text("state", { enum: ["on", "dropped"] }).notNull(),
    // 乗せた日時。履歴から乗せ直したときは上書きする。
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    droppedAt: integer("dropped_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("task_user_id_state_dropped_at_idx").on(table.userId, table.state, table.droppedAt),
    check("task_title_not_blank", sql`length(trim(title)) > 0`),
    check("task_weight_range", sql`weight between 1 and 100`),
    check(
      "task_state_dropped_at",
      sql`(state = 'on' and dropped_at is null) or (state = 'dropped' and dropped_at is not null)`,
    ),
  ],
);
