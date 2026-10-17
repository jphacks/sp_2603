import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/user-menu";
import { isRoomId, ROOM_ID_LENGTH } from "@/lib/room-id";

export const Route = createFileRoute("/_authed/join")({
  component: JoinPage,
});

// TODO: デザインが来たら見た目を差し替える。入室と作成は API (POST /api/rooms/...) ができたらつなぐ。
function JoinPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isRoomId(roomId)) return;
    navigate({ to: "/rooms/$roomId", params: { roomId } });
  };

  return (
    <section className="mx-auto flex h-full max-w-sm flex-col justify-center gap-6 px-4">
      <div className="self-end">
        <UserMenu />
      </div>
      <h1 className="text-2xl font-bold">ルームに入る</h1>
      <form onSubmit={join} className="flex gap-2">
        <Input
          inputMode="numeric"
          autoComplete="off"
          maxLength={ROOM_ID_LENGTH}
          placeholder="6 桁のルーム ID"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value.replace(/\D/g, ""))}
        />
        <Button type="submit" disabled={!isRoomId(roomId)}>
          入る
        </Button>
      </form>
      <Button variant="outline" disabled>
        ルームを新しく作る
      </Button>
    </section>
  );
}
