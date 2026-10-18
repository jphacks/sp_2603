import type {
  ApiErrorBody,
  JoinedRoom,
  Me,
  MemberDetail,
  MyStatus,
  NewTask,
  PoolTask,
  Room,
  Task,
} from "@fllooat/api-client";
import { HttpResponse, http } from "msw";

// 気球の空を作るためのモック。作る、乗せる、消す、落とすと状態が変わり、ポーリングしても値が揺れない。
// 状態はページを読み込み直すと最初に戻る。

const MY_USER_ID = "mock-user";
const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

type MockMember = {
  userId: string;
  name: string;
  image: string | null;
  isAway: boolean;
  /** 乗せた日時の新しい順 */
  tasks: Task[];
};

let nextTaskId = 1;
const task = (title: string, weight: number, hours = 1): Task => ({
  id: nextTaskId++,
  title,
  weight,
  loadedAt: hoursAgo(hours),
});

let roomId: string | null = "123456";
// 入室順。離れている人の見た目を確かめられるよう、Bob と Carol を離れている扱いにしてある。自分は 3 番目に入った人。
let members: MockMember[] = [
  {
    userId: "u_1",
    name: "Username",
    image: null,
    isAway: false,
    tasks: [task("バイト", 10), task("レポート", 20)],
  },
  {
    userId: "u_2",
    name: "ああああああああああ",
    image: null,
    isAway: false,
    tasks: [task("買い物", 10)],
  },
  {
    userId: MY_USER_ID,
    name: "モック ユーザー",
    image: null,
    isAway: false,
    tasks: [task("ゼミ", 30), task("API の実装", 50)],
  },
  {
    userId: "u_3",
    name: "Bob",
    image: null,
    isAway: true,
    tasks: [task("タスク4", 5), task("タスク3", 10), task("タスク2", 20), task("タスク1", 50)],
  },
  { userId: "u_4", name: "Carol", image: null, isAway: true, tasks: [] },
  {
    userId: "u_5",
    name: "Dave",
    image: null,
    isAway: false,
    tasks: [task("発表準備", 60)],
  },
];
/** 自分のプール。作った日時の新しい順 */
let pool: PoolTask[] = [
  { id: nextTaskId++, title: "スライド作成", weight: 20, createdAt: hoursAgo(3) },
];

const me = () => members.find((m) => m.userId === MY_USER_ID) as MockMember;
const busyOf = (member: MockMember) => member.tasks.reduce((sum, t) => sum + t.weight, 0);

const myStatus = (): MyStatus => {
  const busy = busyOf(me());
  return { busy, remaining: 100 - busy, tasks: me().tasks, pool };
};

const error = (status: number, code: ApiErrorBody["code"], details?: ApiErrorBody["details"]) =>
  HttpResponse.json<ApiErrorBody>({ code, message: code, details }, { status });

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
      });
    },
  ),

  http.get("*/api/me/tasks", () => HttpResponse.json<MyStatus>(myStatus())),

  http.post<never, NewTask>("*/api/me/tasks", async ({ request }) => {
    const { title, weight } = await request.json();
    pool = [{ id: nextTaskId++, title, weight, createdAt: new Date().toISOString() }, ...pool];
    return HttpResponse.json<MyStatus>(myStatus(), { status: 201 });
  }),

  http.post<{ taskId: string }>("*/api/me/tasks/:taskId/load", ({ params }) => {
    const poolTask = pool.find((t) => t.id === Number(params.taskId));
    if (!poolTask) return error(404, "TASK_NOT_FOUND");
    const { remaining } = myStatus();
    if (poolTask.weight > remaining) return error(409, "WEIGHT_LIMIT_EXCEEDED", { remaining });
    const { createdAt: _, ...fields } = poolTask;
    pool = pool.filter((t) => t !== poolTask);
    me().tasks = [{ ...fields, loadedAt: new Date().toISOString() }, ...me().tasks];
    return HttpResponse.json<MyStatus>(myStatus());
  }),

  http.delete<{ taskId: string }>("*/api/me/tasks/:taskId", ({ params }) => {
    const taskId = Number(params.taskId);
    if (![...pool, ...me().tasks].some((t) => t.id === taskId)) {
      return error(404, "TASK_NOT_FOUND");
    }
    pool = pool.filter((t) => t.id !== taskId);
    me().tasks = me().tasks.filter((t) => t.id !== taskId);
    return HttpResponse.json<MyStatus>(myStatus());
  }),

  http.post("*/api/me/tasks/drop", () => {
    me().tasks = [];
    return HttpResponse.json<MyStatus>(myStatus());
  }),
];
