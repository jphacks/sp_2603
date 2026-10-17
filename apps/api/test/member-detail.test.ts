import { describe, expect, it } from "vitest";
import { signInAsNewUser } from "./helpers/auth";
import { request } from "./helpers/request";
import { addTask, createRoom, joinRoom } from "./helpers/room";

describe("気球の詳細", () => {
  it("同じルームの人のタスクのタイトルが見られる", async () => {
    const alice = await signInAsNewUser({ name: "Alice" });
    const bob = await signInAsNewUser();
    const roomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, roomId);
    await addTask(alice.headers, { title: "API の実装", weight: 40 });

    const response = await request(`/api/rooms/${roomId}/members/${alice.user.id}`, {
      headers: bob.headers,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Alice",
      busy: 40,
      tasks: [{ title: "API の実装", weight: 40 }],
    });
  });

  it("タスクを乗せると、同じルームの人から見た忙しさも増える", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const roomId = await createRoom(alice.headers);
    await joinRoom(bob.headers, roomId);

    await addTask(alice.headers, { title: "API の実装", weight: 40 });

    const response = await request(`/api/rooms/${roomId}`, { headers: bob.headers });
    const { members } = (await response.json()) as {
      members: { userId: string; busy: number }[];
    };
    expect(members.find(({ userId }) => userId === alice.user.id)).toMatchObject({ busy: 40 });
  });

  it("ルームの一覧にはタスクのタイトルが含まれない", async () => {
    const { headers } = await signInAsNewUser();
    const roomId = await createRoom(headers);
    await addTask(headers, { title: "API の実装", weight: 40 });

    const response = await request(`/api/rooms/${roomId}`, { headers });

    expect(JSON.stringify(await response.json())).not.toContain("API の実装");
  });

  it("ほかのルームの人の詳細は見られない", async () => {
    const alice = await signInAsNewUser();
    const bob = await signInAsNewUser();
    const aliceRoomId = await createRoom(alice.headers);
    const bobRoomId = await createRoom(bob.headers);

    const asNonMember = await request(`/api/rooms/${aliceRoomId}/members/${alice.user.id}`, {
      headers: bob.headers,
    });
    const viaOwnRoom = await request(`/api/rooms/${bobRoomId}/members/${alice.user.id}`, {
      headers: bob.headers,
    });

    expect(asNonMember.status).toBe(403);
    expect(viaOwnRoom.status).toBe(404);
    expect(await viaOwnRoom.json()).toMatchObject({ code: "MEMBER_NOT_FOUND" });
  });
});
