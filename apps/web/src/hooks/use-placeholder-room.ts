import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { sessionQueryOptions } from "@/lib/auth-client";

// TODO: バックが API を作って `pnpm gen` したら、このファイルを消して @fllooat/api-client の hooks に差し替える。
// 型は docs/design-backend.md の応答の形に合わせてある。

export type Task = { id: number; title: string; weight: number; createdAt: string };

export type RoomMember = {
  userId: string;
  name: string;
  image: string | null;
  busy: number;
  statusUpdatedAt: string;
  isMe: boolean;
};

export type MemberDetail = Omit<RoomMember, "isMe"> & { serverTime: string; tasks: Task[] };

const MY_USER_ID = "me";
const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

const task = (id: number, title: string, weight: number): Task => ({
  id,
  title,
  weight,
  createdAt: hoursAgo(1),
});

// 入室順に並べる。遠近の見た目を確かめられるよう、最終更新の時刻をばらしてある。
const OTHER_MEMBERS: (Omit<RoomMember, "busy" | "isMe"> & { tasks: Task[] })[] = [
  {
    userId: "u_1",
    name: "Username",
    image: null,
    statusUpdatedAt: hoursAgo(0.5),
    tasks: [task(1, "レポート", 20), task(2, "バイト", 10)],
  },
  {
    userId: "u_2",
    name: "ああああああああああ",
    image: null,
    statusUpdatedAt: hoursAgo(2),
    tasks: [task(3, "買い物", 10)],
  },
  {
    userId: "u_3",
    name: "Bob",
    image: null,
    statusUpdatedAt: hoursAgo(6),
    tasks: [
      task(4, "タスク1", 50),
      task(5, "タスク2", 20),
      task(6, "タスク3", 10),
      task(7, "タスク4", 5),
    ],
  },
  { userId: "u_4", name: "Carol", image: null, statusUpdatedAt: hoursAgo(24), tasks: [] },
  {
    userId: "u_5",
    name: "Dave",
    image: null,
    statusUpdatedAt: hoursAgo(0.1),
    tasks: [task(8, "発表準備", 60)],
  },
];

const sumWeights = (tasks: Task[]) => tasks.reduce((sum, { weight }) => sum + weight, 0);

/** ルームの気球と自分のタスクを、API の代わりに画面の中だけで持つ。 */
export function usePlaceholderRoom() {
  const { data: session } = useQuery(sessionQueryOptions);
  const [myTasks, setMyTasks] = useState<Task[]>([
    task(100, "API の実装", 50),
    task(101, "ゼミ", 30),
  ]);
  const [myUpdatedAt, setMyUpdatedAt] = useState(() => hoursAgo(0));

  const myBusy = sumWeights(myTasks);
  const remaining = 100 - myBusy;

  const me = useMemo(
    () => ({
      userId: MY_USER_ID,
      name: session?.user.name ?? "自分",
      image: session?.user.image ?? null,
      statusUpdatedAt: myUpdatedAt,
      tasks: myTasks,
    }),
    [session, myUpdatedAt, myTasks],
  );

  // 自分は 3 番目に入った人にしておく。
  const membersWithTasks = useMemo(
    () => [...OTHER_MEMBERS.slice(0, 2), me, ...OTHER_MEMBERS.slice(2)],
    [me],
  );

  const room = useMemo(
    () => ({
      serverTime: new Date().toISOString(),
      members: membersWithTasks.map(({ tasks, ...member }) => ({
        ...member,
        busy: sumWeights(tasks),
        isMe: member.userId === MY_USER_ID,
      })),
    }),
    [membersWithTasks],
  );

  const getMemberDetail = useCallback(
    (userId: string): MemberDetail | undefined => {
      const member = membersWithTasks.find((m) => m.userId === userId);
      if (!member) return undefined;
      return {
        ...member,
        busy: sumWeights(member.tasks),
        serverTime: new Date().toISOString(),
        tasks: [...member.tasks].reverse(),
      };
    },
    [membersWithTasks],
  );

  const addTask = useCallback(
    (title: string, weight: number) => {
      if (weight > remaining) return;
      setMyTasks((tasks) => [
        ...tasks,
        { id: Date.now(), title, weight, createdAt: new Date().toISOString() },
      ]);
      setMyUpdatedAt(new Date().toISOString());
    },
    [remaining],
  );

  const dropAllTasks = useCallback(() => {
    setMyTasks([]);
    setMyUpdatedAt(new Date().toISOString());
  }, []);

  return { room, remaining, getMemberDetail, addTask, dropAllTasks };
}
