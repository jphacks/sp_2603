import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { BALLOON_ANCHOR_PX, Balloon } from "@/components/balloon";
import type { RoomMember } from "@/hooks/use-placeholder-room";
import { assignBalloonColors } from "@/lib/balloon-colors";
import { balloonDistance } from "@/lib/balloon-distance";
import { ringFromMe } from "@/lib/balloon-ring";
import { cn } from "@/lib/utils";

/** これ以下の人数ならスクロールさせず、自分を中心に固定する。 */
const STATIC_LAYOUT_MAX_MEMBERS = 3;
/** embla の loop はスライドの幅の合計が足りないと効かないので、これより少ないときはリストを 2 回つなげる。 */
const LOOP_MIN_SLIDES = 6;
const TICK_COUNT = 11;

// 名前の行、気球が動く範囲、% の行の高さ。目盛りを気球の範囲にそろえるため、列と目盛りで同じ値を使う。
const NAME_ROW = "h-34";
const PERCENT_ROW = "h-28";
const SKY_TOP = "top-34";
const SKY_BOTTOM = "bottom-28";

type BalloonSkyProps = {
  serverTime: string;
  roomId: string;
  members: RoomMember[];
  onSelectMember: (member: RoomMember) => void;
  onShakeMyBalloon: () => void;
};

export function BalloonSky({
  serverTime,
  roomId,
  members,
  onSelectMember,
  onShakeMyBalloon,
}: BalloonSkyProps) {
  const colors = useMemo(
    () =>
      assignBalloonColors(
        roomId,
        members.map((m) => m.userId),
      ),
    [roomId, members],
  );
  const ring = ringFromMe(members);

  const renderColumn = (member: RoomMember | undefined, key: string) => (
    <SkyColumn
      key={key}
      member={member}
      color={member ? (colors.get(member.userId) ?? "#FFFFFF") : ""}
      serverTime={serverTime}
      onSelect={onSelectMember}
      onShake={onShakeMyBalloon}
    />
  );

  return (
    <div className="relative h-full">
      <ScaleTicks />
      {ring.length <= STATIC_LAYOUT_MAX_MEMBERS ? (
        <div className="grid h-full grid-cols-3">
          {renderColumn(ring.length === 3 ? ring[2] : undefined, "left")}
          {renderColumn(ring[0], "center")}
          {renderColumn(ring[1], "right")}
        </div>
      ) : (
        <LoopingColumns
          slides={ring.length < LOOP_MIN_SLIDES ? [...ring, ...ring] : ring}
          renderColumn={renderColumn}
        />
      )}
    </div>
  );
}

function LoopingColumns({
  slides,
  renderColumn,
}: {
  slides: RoomMember[];
  renderColumn: (member: RoomMember, key: string) => React.ReactNode;
}) {
  const [emblaRef] = useEmblaCarousel({
    loop: true,
    align: "center",
    startIndex: 0,
    // 自分の気球の上で始まったドラッグは揺らす操作なので、スクロールしない。
    watchDrag: (_, event) =>
      !(event.target instanceof Element && event.target.closest("[data-shakeable]")),
  });

  return (
    <div ref={emblaRef} className="h-full overflow-hidden">
      <div className="flex h-full touch-pan-y">
        {slides.map((member, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 人数が少ないと同じ人が 2 回並ぶので、ID だけでは重なる
          <div key={`${member.userId}-${index}`} className="h-full min-w-0 flex-[0_0_33.3333%]">
            {renderColumn(member, member.userId)}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkyColumn({
  member,
  color,
  serverTime,
  onSelect,
  onShake,
}: {
  member: RoomMember | undefined;
  color: string;
  serverTime: string;
  onSelect: (member: RoomMember) => void;
  onShake: () => void;
}) {
  if (!member) return <div />;
  const labelColor = member.isMe ? "text-[#FFD966]" : "text-white";

  return (
    <div className="flex h-full flex-col">
      <div className={cn(NAME_ROW, "flex shrink-0 items-center justify-center px-2")}>
        <span className={cn("truncate text-[15px]", labelColor)}>
          {member.isMe ? "自分" : member.name}
        </span>
      </div>
      <div className="relative flex-1">
        <motion.div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ marginTop: -BALLOON_ANCHOR_PX }}
          initial={false}
          animate={{ top: `${member.busy}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 12 }}
        >
          <Balloon
            name={member.name}
            image={member.image}
            color={color}
            distance={balloonDistance(serverTime, member.statusUpdatedAt)}
            onTap={() => onSelect(member)}
            onShake={member.isMe ? onShake : undefined}
          />
        </motion.div>
      </div>
      <div className={cn(PERCENT_ROW, "flex shrink-0 justify-center pt-10")}>
        <span className={cn("text-[15px]", labelColor)}>{member.busy}%</span>
      </div>
    </div>
  );
}

/** 画面の左右の端に置く、0% から 100% までの目盛り。 */
function ScaleTicks() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 flex flex-col justify-between",
        SKY_TOP,
        SKY_BOTTOM,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: TICK_COUNT }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 目盛りは並び替えない
        <div key={index} className="flex h-px justify-between">
          <span className="w-[22px] bg-[#7FD3FF]/80" />
          <span className="w-[22px] bg-[#7FD3FF]/80" />
        </div>
      ))}
    </div>
  );
}
