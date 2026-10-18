import { afterEach, describe, expect, it, vi } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";
import {
  addAndLoadTask,
  addTask,
  createRoom,
  deleteTask,
  dropTasks,
  loadTask,
} from "./helpers/room";

type MyStatus = {
  busy: number;
  remaining: number;
  tasks: { id: number; title: string; weight: number; loadedAt: string }[];
  pool: { id: number; title: string; weight: number; createdAt: string }[];
};

const getMyStatus = async (headers: Headers) =>
  (await (await request("/api/me/tasks", { headers })).json()) as MyStatus;

/** プールにタスクを作り、その ID を返す。 */
const addPoolTask = async (headers: Headers, task: { title: string; weight: number }) => {
  const { pool } = (await (await addTask(headers, task)).json()) as MyStatus;
  return pool[0]?.id ?? 0;
};

/** 同じミリ秒に作ったり乗せたりすると並び順が日時で決まらないので、時計を 1 秒進める。 */
const tickClock = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 1000);
};

afterEach(() => {
  vi.useRealTimers();
});

describe("タスク", () => {
  it("作ったタスクはプールに入り、忙しさは変わらない", async () => {
    const { headers } = await signInAsNewUser();
    await createRoom(headers);

    const response = await addTask(headers, { title: "スライド作成", weight: 40 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      busy: 0,
      remaining: 100,
      tasks: [],
      pool: [{ title: "スライド作成", weight: 40 }],
    });
  });

  it("プールのタスクは作った日時の新しい順に並ぶ", async () => {
    const { headers } = await signInAsNewUser();
    await addTask(headers, { title: "スライド作成", weight: 40 });
    tickClock();
    await addTask(headers, { title: "デモ動画の撮影", weight: 20 });

    const { pool } = await getMyStatus(headers);

    expect(pool.map(({ title }) => title)).toEqual(["デモ動画の撮影", "スライド作成"]);
  });

  it("重さの合計が 100% を超えても、プールにはタスクを作れる", async () => {
    const { headers } = await signInAsNewUser();
    await addAndLoadTask(headers, { title: "API の実装", weight: 80 });

    const response = await addTask(headers, { title: "スライド作成", weight: 50 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      busy: 80,
      pool: [{ title: "スライド作成", weight: 50 }],
    });
  });

  it("タイトルの前後の空白は取り除かれる", async () => {
    const { headers } = await signInAsNewUser();

    const response = await addTask(headers, { title: "  API の実装  ", weight: 10 });

    expect(await response.json()).toMatchObject({ pool: [{ title: "API の実装" }] });
  });

  it("31 文字のタイトルではタスクを作れない", async () => {
    const { headers } = await signInAsNewUser();

    const response = await addTask(headers, { title: "あ".repeat(31), weight: 10 });

    expect(response.status).toBe(400);
  });

  it("プールのタスクを乗せると忙しさが増え、プールから消える", async () => {
    const { headers } = await signInAsNewUser();
    const taskId = await addPoolTask(headers, { title: "API の実装", weight: 40 });

    const response = await loadTask(headers, taskId);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      busy: 40,
      remaining: 60,
      tasks: [{ id: taskId, title: "API の実装", weight: 40 }],
      pool: [],
    });
  });

  it("乗っているタスクは乗せた日時の新しい順に並ぶ", async () => {
    const { headers } = await signInAsNewUser();
    const first = await addPoolTask(headers, { title: "API の実装", weight: 40 });
    const second = await addPoolTask(headers, { title: "スライド作成", weight: 20 });
    await loadTask(headers, second);
    tickClock();

    await loadTask(headers, first);

    const { tasks } = await getMyStatus(headers);
    expect(tasks.map(({ id }) => id)).toEqual([first, second]);
  });

  it("合計が 100% を超えるタスクは乗せられず、プールに残る", async () => {
    const { headers } = await signInAsNewUser();
    await addAndLoadTask(headers, { title: "API の実装", weight: 70 });
    const taskId = await addPoolTask(headers, { title: "デザインの確認", weight: 40 });

    const response = await loadTask(headers, taskId);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "WEIGHT_LIMIT_EXCEEDED",
      details: { remaining: 30 },
    });
    expect(await getMyStatus(headers)).toMatchObject({
      busy: 70,
      pool: [{ id: taskId, title: "デザインの確認" }],
    });
  });

  it("合計がちょうど 100% になるまでは乗せられる", async () => {
    const { headers } = await signInAsNewUser();
    await addAndLoadTask(headers, { title: "API の実装", weight: 70 });

    const response = await addAndLoadTask(headers, { title: "デザインの確認", weight: 30 });

    expect(await response.json()).toMatchObject({ busy: 100, remaining: 0 });
  });

  it("乗っているタスクはもう一度乗せられない", async () => {
    const { headers } = await signInAsNewUser();
    const taskId = await addPoolTask(headers, { title: "API の実装", weight: 40 });
    await loadTask(headers, taskId);

    const response = await loadTask(headers, taskId);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "TASK_NOT_FOUND" });
  });

  it("他人のプールのタスクは乗せられない", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const taskId = await addPoolTask(alice.headers, { title: "API の実装", weight: 40 });

    const response = await loadTask(bob.headers, taskId);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "TASK_NOT_FOUND" });
    expect(await getMyStatus(alice.headers)).toMatchObject({ busy: 0, pool: [{ id: taskId }] });
  });

  it("振り落としたタスクは気球からもプールからも消える", async () => {
    const { headers } = await signInAsNewUser();
    await addAndLoadTask(headers, { title: "API の実装", weight: 40 });
    await addAndLoadTask(headers, { title: "デザインの確認", weight: 20 });

    const response = await dropTasks(headers);

    expect(await response.json()).toMatchObject({ busy: 0, remaining: 100, tasks: [], pool: [] });
  });

  it("振り落としても、プールのタスクはそのまま残る", async () => {
    const { headers } = await signInAsNewUser();
    await addAndLoadTask(headers, { title: "API の実装", weight: 40 });
    await addTask(headers, { title: "スライド作成", weight: 20 });

    const response = await dropTasks(headers);

    expect(await response.json()).toMatchObject({
      tasks: [],
      pool: [{ title: "スライド作成" }],
    });
  });

  it("乗っているタスクがなくても、振り落としは成功する", async () => {
    const { headers } = await signInAsNewUser();

    const response = await dropTasks(headers);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ busy: 0, tasks: [] });
  });

  it("プールのタスクは消せる", async () => {
    const { headers } = await signInAsNewUser();
    const taskId = await addPoolTask(headers, { title: "スライド作成", weight: 20 });

    const response = await deleteTask(headers, taskId);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pool: [] });
  });

  it("乗っているタスクを 1 つ消すと、そのタスクだけが消えて忙しさが減る", async () => {
    const { headers } = await signInAsNewUser();
    const { tasks } = (await (
      await addAndLoadTask(headers, { title: "API の実装", weight: 40 })
    ).json()) as MyStatus;
    await addAndLoadTask(headers, { title: "デザインの確認", weight: 20 });

    const response = await deleteTask(headers, tasks[0]?.id ?? 0);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      busy: 20,
      remaining: 80,
      tasks: [{ title: "デザインの確認", weight: 20 }],
    });
  });

  it("他人のタスクは消せない", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const taskId = await addPoolTask(alice.headers, { title: "スライド作成", weight: 20 });

    const response = await deleteTask(bob.headers, taskId);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "TASK_NOT_FOUND" });
    expect(await getMyStatus(alice.headers)).toMatchObject({ pool: [{ id: taskId }] });
  });

  it("ない ID のタスクは消せない", async () => {
    const { headers } = await signInAsNewUser();

    const response = await deleteTask(headers, 999_999);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "TASK_NOT_FOUND" });
  });

  it("ログインしていない人はタスクを乗せることも消すこともできない", async () => {
    const { headers } = await signInAsNewUser();
    const taskId = await addPoolTask(headers, { title: "スライド作成", weight: 20 });

    const load = await loadTask(new Headers(), taskId);
    const remove = await deleteTask(new Headers(), taskId);

    expect(load.status).toBe(401);
    expect(remove.status).toBe(401);
  });
});
