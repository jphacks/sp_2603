import { request } from "./request";

/** ルームを作ってその ID を返す。作った人はそのルームに入った状態になる。 */
export const createRoom = async (headers: Headers) => {
  const response = await request("/api/rooms", { method: "POST", headers });
  const { roomId } = (await response.json()) as { roomId: string };
  return roomId;
};

export const joinRoom = (headers: Headers, roomId: string) =>
  request(`/api/rooms/${roomId}/members`, { method: "POST", headers });

export const addTask = (headers: Headers, task: { title: string; weight: number }) =>
  request("/api/me/tasks", { method: "POST", headers, body: task });

export const dropTasks = (headers: Headers) =>
  request("/api/me/tasks/drop", { method: "POST", headers });
