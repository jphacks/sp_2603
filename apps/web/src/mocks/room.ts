import type {
  ApiErrorBody,
  DroppedTask,
  History,
  JoinedRoom,
  Me,
  MemberDetail,
  MyStatus,
  NewTask,
  ReloadTask,
  Room,
  Task,
} from "@fllooat/api-client";
import { HttpResponse, http } from "msw";

// 気球の空を作るためのモック。乗せる、落とす、乗せ直すと状態が変わり、ポーリングしても値が揺れない。
// 状態はページを読み込み直すと最初に戻る。

const MY_USER_ID = "mock-user";
const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

type MockMember = {
  userId: string;
  name: string;
  image: string | null;
  statusUpdatedAt: string;
  /** 乗せた日時の新しい順 */
  tasks: Task[];
};

let nextTaskId = 1;
const task = (title: string, weight: number, hours = 1): Task => ({
  id: nextTaskId++,
  title,
  weight,
  createdAt: hoursAgo(hours),
});

let roomId: string | null = "123456";
// 入室順。遠近の見た目を確かめられるよう、最終更新の時刻をばらしてある。自分は 3 番目に入った人。
let members: MockMember[] = [
  {
    userId: "u_1",
    name: "Username",
    image: null,
    statusUpdatedAt: hoursAgo(0.5),
    tasks: [task("バイト", 10), task("レポート", 20)],
  },
  {
    userId: "u_2",
    name: "ああああああああああ",
    image: null,
    statusUpdatedAt: hoursAgo(2),
    tasks: [task("買い物", 10)],
  },
  {
    userId: MY_USER_ID,
    name: "モック ユーザー",
    image: null,
    statusUpdatedAt: hoursAgo(0),
    tasks: [task("ゼミ", 30), task("API の実装", 50)],
  },
  {
    userId: "u_3",
    name: "Bob",
    image: null,
    statusUpdatedAt: hoursAgo(6),
    tasks: [task("タスク4", 5), task("タスク3", 10), task("タスク2", 20), task("タスク1", 50)],
  },
  { userId: "u_4", name: "Carol", image: null, statusUpdatedAt: hoursAgo(24), tasks: [] },
  {
    userId: "u_5",
    name: "Dave",
    image: null,
    statusUpdatedAt: hoursAgo(0.1),
    tasks: [task("発表準備", 60)],
  },
];
/** 落としたタスク。落とした日時の新しい順 */
let history: DroppedTask[] = [];

const me = () => members.find((m) => m.userId === MY_USER_ID) as MockMember;
const busyOf = (member: MockMember) => member.tasks.reduce((sum, t) => sum + t.weight, 0);

const myStatus = (): MyStatus => {
  const busy = busyOf(me());
  return { busy, remaining: 100 - busy, statusUpdatedAt: me().statusUpdatedAt, tasks: me().tasks };
};

const error = (status: number, code: ApiErrorBody["code"], details?: ApiErrorBody["details"]) =>
  HttpResponse.json<ApiErrorBody>({ code, message: code, details }, { status });

const touchMe = () => {
  me().statusUpdatedAt = new Date().toISOString();
};

const enterRoom = (nextRoomId: string) => {
  roomId = nextRoomId;
  // 別のルームに入ったら、ほかのメンバーはいない状態から始める。
  members = [me()];
};

export const roomHandlers = [
  http.get("*/api/me", () =>
    HttpResponse.json<Me>({ user: { id: MY_USER_ID, name: me().name, image: null }, roomId }),
  ),

  http.post("*/api/rooms", () => {
    enterRoom(String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0"));
    return HttpResponse.json<JoinedRoom>({ roomId: roomId as string }, { status: 201 });
  }),

  // 自分の状態は members に残しておき、次にルームに入ったときに使う。
  http.delete("*/api/me/room", () => {
    roomId = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post<{ roomId: string }>("*/api/rooms/:roomId/members", ({ params }) => {
    // 000000 は「見つからないルーム」として扱い、エラーの表示を確かめられるようにする。
    if (params.roomId === "000000") return error(404, "ROOM_NOT_FOUND");
    if (params.roomId !== roomId) enterRoom(params.roomId);
    return HttpResponse.json<JoinedRoom>({ roomId: params.roomId });
  }),

  http.get<{ roomId: string }>("*/api/rooms/:roomId", ({ params }) => {
    if (params.roomId !== roomId) return error(403, "NOT_ROOM_MEMBER");
    return HttpResponse.json<Room>({
      roomId,
      serverTime: new Date().toISOString(),
      members: members.map(({ tasks, ...member }) => ({
        ...member,
        busy: tasks.reduce((sum, t) => sum + t.weight, 0),
        isMe: member.userId === MY_USER_ID,
      })),
    });
  }),

  http.get<{ roomId: string; userId: string }>(
    "*/api/rooms/:roomId/members/:userId",
    ({ params }) => {
      if (params.roomId !== roomId) return error(403, "NOT_ROOM_MEMBER");
      const member = members.find((m) => m.userId === params.userId);
      if (!member) return error(404, "MEMBER_NOT_FOUND");
      return HttpResponse.json<MemberDetail>({
        ...member,
        busy: busyOf(member),
        serverTime: new Date().toISOString(),
      });
    },
  ),

  http.get("*/api/me/tasks", () => HttpResponse.json<MyStatus>(myStatus())),

  http.post<never, NewTask>("*/api/me/tasks", async ({ request }) => {
    const { title, weight } = await request.json();
    const { remaining } = myStatus();
    if (weight > remaining) return error(409, "WEIGHT_LIMIT_EXCEEDED", { remaining });
    me().tasks = [
      { id: nextTaskId++, title, weight, createdAt: new Date().toISOString() },
      ...me().tasks,
    ];
    touchMe();
    return HttpResponse.json<MyStatus>(myStatus(), { status: 201 });
  }),

  http.post("*/api/me/tasks/drop", () => {
    const droppedAt = new Date().toISOString();
    history = [
      ...me().tasks.map(({ id, title, weight }) => ({ id, title, weight, droppedAt })),
      ...history,
    ];
    me().tasks = [];
    touchMe();
    return HttpResponse.json<MyStatus>(myStatus());
  }),

  http.get("*/api/me/history", () => HttpResponse.json<History>({ tasks: history })),

  http.post<{ taskId: string }, ReloadTask>(
    "*/api/me/history/:taskId/reload",
    async ({ params, request }) => {
      const dropped = history.find((t) => t.id === Number(params.taskId));
      if (!dropped) return error(404, "TASK_NOT_FOUND");
      const { weight } = await request.json();
      const { remaining } = myStatus();
      if (weight > remaining) return error(409, "WEIGHT_LIMIT_EXCEEDED", { remaining });
      history = history.filter((t) => t !== dropped);
      me().tasks = [
        { id: dropped.id, title: dropped.title, weight, createdAt: new Date().toISOString() },
        ...me().tasks,
      ];
      touchMe();
      return HttpResponse.json<MyStatus>(myStatus());
    },
  ),
];
