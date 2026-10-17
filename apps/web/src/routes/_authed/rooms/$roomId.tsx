import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Balloon } from "@/components/balloon";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { useDeviceShake } from "@/hooks/use-device-shake";
import { isRoomId } from "@/lib/room-id";

export const Route = createFileRoute("/_authed/rooms/$roomId")({
  // TODO: GET /api/rooms/{roomId} が 403 (NOT_ROOM_MEMBER) を返したときも /join に戻す。
  beforeLoad: ({ params }) => {
    if (!isRoomId(params.roomId)) throw redirect({ to: "/join" });
  },
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  // TODO: POST /api/me/tasks/drop ができたら、回数を数える代わりにタスクを落とす。
  const [dropCount, setDropCount] = useState(0);
  const dropAllTasks = useCallback(() => setDropCount((count) => count + 1), []);
  const { permission, requestPermission } = useDeviceShake(dropAllTasks);

  return (
    <section className="relative flex h-full flex-col">
      <header className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">ルーム {roomId}</span>
        <UserMenu />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Balloon onShake={dropAllTasks} />
        <p className="text-sm text-muted-foreground">揺らして落とした回数: {dropCount}</p>
        {permission === "prompt" && (
          <Button variant="outline" onClick={requestPermission}>
            スマホを振って落とせるようにする
          </Button>
        )}
        {permission === "denied" && (
          <p className="text-sm text-muted-foreground">
            センサーが許可されていません。気球をドラッグして揺らしてください。
          </p>
        )}
      </div>
    </section>
  );
}
