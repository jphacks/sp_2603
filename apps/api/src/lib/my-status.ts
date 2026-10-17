import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { task, userStatus } from "../db/schema";

type Db = ReturnType<typeof createDb>;

export const MAX_TOTAL_WEIGHT = 100;

// 合計の判定を書き込みと同じ SQL 文に入れるために使う。D1 は読んでから書くまでを 1 つのトランザクションにできない。
const onBoardWeightOf = (userId: string): SQL =>
  sql`(select coalesce(sum(weight), 0) from task where user_id = ${userId} and state = 'on')`;

export const selectOnBoardTasks = (db: Db, userId: string) =>
  db
    .select({ id: task.id, title: task.title, weight: task.weight, createdAt: task.createdAt })
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.state, "on")))
    .orderBy(desc(task.createdAt), desc(task.id));

export const toTaskResponse = (row: {
  id: number;
  title: string;
  weight: number;
  createdAt: Date;
}) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** 自分の状態 (`MyStatus`) を作る。最終更新の行がなければ、ユーザーを作った日時を使う。 */
export const getMyStatus = async (db: Db, user: { id: string; createdAt: Date }) => {
  const [tasks, status] = await Promise.all([
    selectOnBoardTasks(db, user.id),
    db.select().from(userStatus).where(eq(userStatus.userId, user.id)).get(),
  ]);
  const busy = tasks.reduce((sum, { weight }) => sum + weight, 0);
  return {
    busy,
    remaining: MAX_TOTAL_WEIGHT - busy,
    statusUpdatedAt: (status?.updatedAt ?? user.createdAt).toISOString(),
    tasks: tasks.map(toTaskResponse),
  };
};

export const touchStatus = (db: Db, userId: string, now: Date) =>
  db
    .insert(userStatus)
    .values({ userId, updatedAt: now })
    .onConflictDoUpdate({ target: userStatus.userId, set: { updatedAt: now } });

/** 合計が 100% を超えないときだけタスクを乗せる。乗せられたら true。 */
export const insertTaskWithinLimit = async (
  db: Db,
  { userId, title, weight, now }: { userId: string; title: string; weight: number; now: Date },
) => {
  const result = await db.run(sql`
    insert into task (user_id, title, weight, state, created_at)
    select ${userId}, ${title}, ${weight}, 'on', ${now.getTime()}
    where ${onBoardWeightOf(userId)} + ${weight} <= ${MAX_TOTAL_WEIGHT}
  `);
  return result.meta.changes > 0;
};

/** 履歴のタスクを、合計が 100% を超えないときだけ乗せ直す。乗せ直せたら true。 */
export const reloadTaskWithinLimit = async (
  db: Db,
  { userId, taskId, weight, now }: { userId: string; taskId: number; weight: number; now: Date },
) => {
  // state = 'dropped' がないと、乗っているタスクの重さを書き換えられてしまう。
  const result = await db.run(sql`
    update task set state = 'on', weight = ${weight}, created_at = ${now.getTime()}, dropped_at = null
    where id = ${taskId} and user_id = ${userId} and state = 'dropped'
      and ${onBoardWeightOf(userId)} + ${weight} <= ${MAX_TOTAL_WEIGHT}
  `);
  return result.meta.changes > 0;
};

export const isInHistory = async (db: Db, userId: string, taskId: number) => {
  const row = await db
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.userId, userId), eq(task.state, "dropped")))
    .get();
  return row !== undefined;
};

export const dropAllTasks = (db: Db, userId: string, now: Date) =>
  db.batch([
    db
      .update(task)
      .set({ state: "dropped", droppedAt: now })
      .where(and(eq(task.userId, userId), eq(task.state, "on"))),
    touchStatus(db, userId, now),
  ]);

export const HISTORY_LIMIT = 50;

export const selectHistory = (db: Db, userId: string) =>
  db
    .select({ id: task.id, title: task.title, weight: task.weight, droppedAt: task.droppedAt })
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.state, "dropped")))
    .orderBy(desc(task.droppedAt), desc(task.id))
    .limit(HISTORY_LIMIT);
