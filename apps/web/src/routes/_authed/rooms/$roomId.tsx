import { createFileRoute, redirect } from "@tanstack/react-router";
import { UserMenu } from "@/components/user-menu";
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

  return (
    <section className="relative h-full">
      <header className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">ルーム {roomId}</span>
        <UserMenu />
      </header>
    </section>
  );
}
