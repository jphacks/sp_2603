import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";
import { addTask, createRoom, dropTasks } from "./helpers/room";

type MyStatus = {
  busy: number;
  remaining: number;
  statusUpdatedAt: string;
  tasks: { id: number; title: string; weight: number; createdAt: string }[];
};
type History = { tasks: { id: number; title: string; weight: number; droppedAt: string }[] };

const getHistory = async (headers: Headers) =>
  (await (await request("/api/me/history", { headers })).json()) as History;

const reload = (headers: Headers, taskId: number, weight: number) =>
  request(`/api/me/history/${taskId}/reload`, { method: "POST", headers, body: { weight } });

describe("タスク", () => {
  it("タスクを乗せると忙しさが増え、残りが減る", async () => {
    const { headers } = await signInAsNewUser();
    await createRoom(headers);

    const response = await addTask(headers, { title: "API の実装", weight: 40 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      busy: 40,
      remaining: 60,
      tasks: [{ title: "API の実装", weight: 40 }],
    });
  });

  it("タイトルの前後の空白は取り除かれる", async () => {
    const { headers } = await signInAsNewUser();

    const response = await addTask(headers, { title: "  API の実装  ", weight: 10 });

    expect(await response.json()).toMatchObject({ tasks: [{ title: "API の実装" }] });
  });

  it("31 文字のタイトルでは乗せられない", async () => {
    const { headers } = await signInAsNewUser();

    const response = await addTask(headers, { title: "あ".repeat(31), weight: 10 });

    expect(response.status).toBe(400);
  });

  it("合計が 100% を超えるタスクは乗せられず、残りの % が返る", async () => {
    const { headers } = await signInAsNewUser();
    await addTask(headers, { title: "API の実装", weight: 70 });

    const response = await addTask(headers, { title: "デザインの確認", weight: 40 });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "WEIGHT_LIMIT_EXCEEDED",
      details: { remaining: 30 },
    });
    const status = await request("/api/me/tasks", { headers });
    expect(await status.json()).toMatchObject({ busy: 70 });
  });

  it("合計がちょうど 100% になるまでは乗せられる", async () => {
    const { headers } = await signInAsNewUser();
    await addTask(headers, { title: "API の実装", weight: 70 });

    const response = await addTask(headers, { title: "デザインの確認", weight: 30 });

    expect(await response.json()).toMatchObject({ busy: 100, remaining: 0 });
  });

  it("タスクを落とすと忙しさが 0% になり、履歴に入る", async () => {
    const { headers } = await signInAsNewUser();
    await addTask(headers, { title: "API の実装", weight: 40 });
    await addTask(headers, { title: "デザインの確認", weight: 20 });

    const response = await dropTasks(headers);

    expect(await response.json()).toMatchObject({ busy: 0, remaining: 100, tasks: [] });
    const history = await getHistory(headers);
    expect(history.tasks.map(({ title }) => title).sort()).toEqual([
      "API の実装",
      "デザインの確認",
    ]);
  });

  it("乗っているタスクがなくても揺らすと最終更新が新しくなる", async () => {
    const { headers } = await signInAsNewUser();
    await createRoom(headers);
    const before = (await (await request("/api/me/tasks", { headers })).json()) as MyStatus;

    const response = await dropTasks(headers);

    const after = (await response.json()) as MyStatus;
    expect(Date.parse(after.statusUpdatedAt)).toBeGreaterThan(Date.parse(before.statusUpdatedAt));
  });

  it("履歴から乗せ直すと、重さと乗せた日時が新しくなり、履歴から消える", async () => {
    const { headers } = await signInAsNewUser();
    const added = (await (
      await addTask(headers, { title: "API の実装", weight: 40 })
    ).json()) as MyStatus;
    await dropTasks(headers);
    const [dropped] = (await getHistory(headers)).tasks;

    const response = await reload(headers, dropped?.id ?? 0, 25);

    expect(response.status).toBe(200);
    const status = (await response.json()) as MyStatus;
    expect(status).toMatchObject({ busy: 25, tasks: [{ title: "API の実装", weight: 25 }] });
    expect(Date.parse(status.tasks[0]?.createdAt ?? "")).toBeGreaterThan(
      Date.parse(added.tasks[0]?.createdAt ?? ""),
    );
    expect((await getHistory(headers)).tasks).toEqual([]);
  });

  it("乗せ直しでも合計が 100% を超えるなら断られる", async () => {
    const { headers } = await signInAsNewUser();
    await addTask(headers, { title: "API の実装", weight: 40 });
    await dropTasks(headers);
    const [dropped] = (await getHistory(headers)).tasks;
    await addTask(headers, { title: "デザインの確認", weight: 80 });

    const response = await reload(headers, dropped?.id ?? 0, 30);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "WEIGHT_LIMIT_EXCEEDED",
      details: { remaining: 20 },
    });
  });

  it("乗っているタスクは乗せ直せない", async () => {
    const { headers } = await signInAsNewUser();
    const added = (await (
      await addTask(headers, { title: "API の実装", weight: 40 })
    ).json()) as MyStatus;

    const response = await reload(headers, added.tasks[0]?.id ?? 0, 10);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "TASK_NOT_FOUND" });
  });

  it("他人の履歴のタスクは乗せ直せない", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    await addTask(alice.headers, { title: "API の実装", weight: 40 });
    await dropTasks(alice.headers);
    const [dropped] = (await getHistory(alice.headers)).tasks;

    const response = await reload(bob.headers, dropped?.id ?? 0, 10);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "TASK_NOT_FOUND" });
  });
});
