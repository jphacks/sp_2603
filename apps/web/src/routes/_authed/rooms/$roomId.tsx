import { createFileRoute, redirect } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { BalloonSky } from "@/components/balloon-sky";
import { MemberDetailDialog } from "@/components/member-detail-dialog";
import { useDeviceShake } from "@/hooks/use-device-shake";
import { type RoomMember, usePlaceholderRoom } from "@/hooks/use-placeholder-room";
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
  const { room, remaining, getMemberDetail, addTask, dropAllTasks } = usePlaceholderRoom();
  const { permission, requestPermission } = useDeviceShake(dropAllTasks);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RoomMember>();

  return (
    <section className="flex h-full flex-col bg-linear-to-b from-[#0050DC] via-[#2B95EE] to-[#B4E1F7]">
      <div className="min-h-0 flex-1">
        <BalloonSky
          roomId={roomId}
          serverTime={room.serverTime}
          members={room.members}
          onSelectMember={setSelectedMember}
          onShakeMyBalloon={dropAllTasks}
        />
      </div>
      {permission === "prompt" && (
        <button
          type="button"
          onClick={requestPermission}
          className="mx-auto mb-3 rounded-full bg-white/30 px-4 py-1.5 text-xs text-white backdrop-blur"
        >
          スマホを振ってタスクを落とせるようにする
        </button>
      )}
      <button
        type="button"
        onClick={() => setIsAddTaskOpen(true)}
        className="flex h-[125px] shrink-0 flex-col items-center justify-center gap-2 rounded-t-[50%_48px] bg-[#0057E0] pt-4 pb-[env(safe-area-inset-bottom)] text-white"
      >
        <PlusIcon className="size-11" strokeWidth={2.5} />
        <span className="text-sm font-bold">タスクをのせる</span>
      </button>
      <AddTaskDialog
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        remaining={remaining}
        onAdd={(title, weight) => {
          addTask(title, weight);
          setIsAddTaskOpen(false);
        }}
      />
      <MemberDetailDialog
        member={selectedMember && getMemberDetail(selectedMember.userId)}
        isMe={selectedMember?.isMe ?? false}
        onClose={() => setSelectedMember(undefined)}
      />
    </section>
  );
}
