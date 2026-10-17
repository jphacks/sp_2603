import { XIcon } from "lucide-react";
import { GlassDialogContent } from "@/components/glass-dialog";
import { Dialog, DialogClose, DialogTitle } from "@/components/ui/dialog";
import type { MemberDetail } from "@/hooks/use-placeholder-room";

type MemberDetailDialogProps = {
  /** 開いている気球の持ち主。undefined なら閉じる。 */
  member: MemberDetail | undefined;
  isMe: boolean;
  onClose: () => void;
};

export function MemberDetailDialog({ member, isMe, onClose }: MemberDetailDialogProps) {
  return (
    <Dialog open={member !== undefined} onOpenChange={(open) => !open && onClose()}>
      <GlassDialogContent className="gap-3">
        <div className="flex items-center justify-between">
          <DialogTitle className="truncate text-sm font-normal">
            {isMe ? "自分" : member?.name}
          </DialogTitle>
          <DialogClose aria-label="閉じる" className="-m-1 p-1">
            <XIcon className="size-6" strokeWidth={2.5} />
          </DialogClose>
        </div>
        {member && member.tasks.length > 0 ? (
          <ul className="grid gap-2">
            {member.tasks.map((task) => (
              <li
                key={task.id}
                className="flex h-9 items-center justify-between gap-3 rounded-md bg-[#0A84FF] px-3 text-sm text-white"
              >
                <span className="truncate">{task.title}</span>
                <span className="shrink-0">{task.weight}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">のっているタスクはありません</p>
        )}
      </GlassDialogContent>
    </Dialog>
  );
}
