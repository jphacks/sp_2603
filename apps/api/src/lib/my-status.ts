import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { task } from "../db/schema";

type Db = ReturnType<typeof createDb>;

export const MAX_TOTAL_WEIGHT = 100;

// 合計の判定を書き込みと同じ SQL 文に入れるために使う。D1 は読んでから書くまでを 1 つのトランザクションにできない。
const onBoardWeightOf = (userId: string): SQL =>
  sql`(select coalesce(sum(weight), 0) from task where user_id = ${userId} and state = 'on')`;

export const selectOnBoardTasks = async (db: Db, userId: string) => {
  const rows = await db
    .select({ id: task.id, title: task.title, weight: task.weight, loadedAt: task.loadedAt })
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.state, "on")))
    .orderBy(desc(task.loadedAt), desc(task.id));
  // state = 'on' の行は CHECK 制約で loaded_at を必ず持つ。
  return rows.map(({ loadedAt, ...row }) => ({
    ...row,
    loadedAt: (loadedAt as Date).toISOString(),
  }));
};

const selectPoolTasks = async (db: Db, userId: string) => {
  const rows = await db
    .select({ id: task.id, title: task.title, weight: task.weight, createdAt: task.createdAt })
    .from(task)
    .where(and(eq(task.userId, userId), eq(task.state, "pool")))
    .orderBy(desc(task.createdAt), desc(task.id));
  return rows.map(({ createdAt, ...row }) => ({ ...row, createdAt: createdAt.toISOString() }));
};

/** 自分の状態 (`MyStatus`) を作る。 */
export const getMyStatus = async (db: Db, userId: string) => {
  const [tasks, pool] = await Promise.all([
    selectOnBoardTasks(db, userId),
    selectPoolTasks(db, userId),
  ]);
  const busy = tasks.reduce((sum, { weight }) => sum + weight, 0);
  return { busy, remaining: MAX_TOTAL_WEIGHT - busy, tasks, pool };
};

export const insertPoolTask = (
  db: Db,
  { userId, title, weight, now }: { userId: string; title: string; weight: number; now: Date },
) => db.insert(task).values({ userId, title, weight, state: "pool", createdAt: now });

/** プールのタスクを、合計が 100% を超えないときだけ気球に乗せる。乗せられたら true。 */
export const loadTaskWithinLimit = async (
  db: Db,
  { userId, taskId, now }: { userId: string; taskId: number; now: Date },
) => {
  const result = await db.run(sql`
    update task set state = 'on', loaded_at = ${now.getTime()}
    where id = ${taskId} and user_id = ${userId} and state = 'pool'
      and ${onBoardWeightOf(userId)} + weight <= ${MAX_TOTAL_WEIGHT}
  `);
  return result.meta.changes > 0;
};

export const isInPool = async (db: Db, userId: string, taskId: number) => {
  const row = await db
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.userId, userId), eq(task.state, "pool")))
    .get();
  return row !== undefined;
};

/** 自分のタスクを 1 つ消す。プールにあっても乗っていても消せる。消せたら true。 */
export const deleteTask = async (db: Db, userId: string, taskId: number) => {
  const result = await db.delete(task).where(and(eq(task.id, taskId), eq(task.userId, userId)));
  return result.meta.changes > 0;
};

/** 乗っているタスクをすべて消す。プールには戻さない。 */
export const dropAllTasks = (db: Db, userId: string) =>
  db.delete(task).where(and(eq(task.userId, userId), eq(task.state, "on")));
