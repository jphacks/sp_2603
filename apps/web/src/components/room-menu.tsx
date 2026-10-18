import { LogOutIcon, RefreshCwIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import settingsGear from "@/assets/settings-gear.svg";
import { cn } from "@/lib/utils";

/** 真ん中のボタン。空の画面では編集、自分の編集画面ではタスク追加、他人の気球を見ているときは閉じる。 */
export type RoomMenuCenterAction = "edit" | "addTask" | "close";

type RoomMenuProps = {
  centerAction: RoomMenuCenterAction;
  isPending: boolean;
  onSignOut: () => void;
  onCenterClick: () => void;
  onSwitchRoom: () => void;
  className?: string;
};

const CENTER_BUTTONS: Record<RoomMenuCenterAction, { icon: ReactNode; label: string }> = {
  edit: {
    icon: <img src={settingsGear} alt="" className="h-[41.5px] w-[37.4px]" />,
    label: "編集",
  },
  addTask: { icon: <CrossBars />, label: "タスク追加" },
  close: { icon: <CrossBars className="rotate-45" />, label: "とじる" },
};

/** ルームの画面の下に置く、ログアウト、真ん中のボタン、ルーム切替のメニュー。 */
export function RoomMenu({
  centerAction,
  isPending,
  onSignOut,
  onCenterClick,
  onSwitchRoom,
  className,
}: RoomMenuProps) {
  const center = CENTER_BUTTONS[centerAction];

  return (
    <nav
      className={cn(
        "grid h-[calc(114px+env(safe-area-inset-bottom))] shrink-0 grid-cols-3 items-end rounded-t-[50%_46px] bg-[#0055DD] px-4 pb-[calc(env(safe-area-inset-bottom)+22px)] text-[#E6E6E6]",
        className,
      )}
    >
      <MenuButton
        icon={<LogOutIcon className="size-[22px]" absoluteStrokeWidth />}
        label="ログアウト"
        disabled={isPending}
        onClick={onSignOut}
      />
      <MenuButton
        icon={center.icon}
        label={center.label}
        className="text-base tracking-[-0.04em]"
        onClick={onCenterClick}
      />
      <MenuButton
        icon={<RefreshCwIcon className="size-[22px]" absoluteStrokeWidth />}
        label="ルーム切替"
        disabled={isPending}
        onClick={onSwitchRoom}
      />
    </nav>
  );
}

/** 角の丸い棒を 2 本重ねたプラス。回すとバツになる。 */
function CrossBars({ className }: { className?: string }) {
  return (
    <span className={cn("relative block size-10 transition-transform", className)}>
      <span className="absolute inset-x-0 top-1/2 h-[5.16px] -translate-y-1/2 rounded-[10px] bg-current" />
      <span className="absolute inset-y-0 left-1/2 w-[5.16px] -translate-x-1/2 rounded-[10px] bg-current" />
    </span>
  );
}

function MenuButton({
  icon,
  label,
  className,
  ...props
}: { icon: ReactNode; label: string } & Omit<ComponentProps<"button">, "type">) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center gap-3 text-[13px] font-bold tracking-[-0.04em] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
