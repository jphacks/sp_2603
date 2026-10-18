import type { RoomMember } from "@fllooat/api-client";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { useMemo, useRef } from "react";
import { BALLOON_ANCHOR_PX, Balloon } from "@/components/balloon";
import { useColumnCount } from "@/hooks/use-column-count";
import { assignBalloonColors } from "@/lib/balloon-colors";
import { myColumnIndex, placeAroundMe, ringFromMe } from "@/lib/balloon-ring";
import { cn } from "@/lib/utils";

/** 1 列の幅の下限。幅 393px のスマホで 3 列になり、画面が広がると 4 列、5 列と増える。 */
const MIN_COLUMN_WIDTH_PX = 130;
const MIN_COLUMNS = 3;
const TICK_COUNT = 11;

// 名前の行、気球が動く範囲、% の行の高さ。目盛りを気球の範囲にそろえるため、列と目盛りで同じ値を使う。
const NAME_ROW = "h-34";
const PERCENT_ROW = "h-28";
const SKY_TOP = "top-34";
const SKY_BOTTOM = "bottom-28";

type BalloonSkyProps = {
  roomId: string;
  members: RoomMember[];
  onSelectMember: (member: RoomMember) => void;
  onShakeMyBalloon: () => void;
};

export function BalloonSky({ roomId, members, onSelectMember, onShakeMyBalloon }: BalloonSkyProps) {
  const colors = useMemo(
    () =>
      assignBalloonColors(
        roomId,
        members.map((m) => m.userId),
      ),
    [roomId, members],
  );
  const ring = ringFromMe(members);
  const containerRef = useRef<HTMLDivElement>(null);
  const columns = useColumnCount(containerRef, {
    minColumnWidth: MIN_COLUMN_WIDTH_PX,
    minColumns: MIN_COLUMNS,
  });

  const renderColumn = (member: RoomMember | undefined, key: string) => (
    <SkyColumn
      key={key}
      member={member}
      color={member ? (colors.get(member.userId) ?? "#FFFFFF") : ""}
      onSelect={onSelectMember}
      onShake={onShakeMyBalloon}
    />
  );

  return (
    <div ref={containerRef} className="relative h-full">
      <ScaleTicks />
      {/* 全員が 1 画面に収まるならスクロールさせず、自分の位置を固定する。 */}
      {ring.length <= columns ? (
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {placeAroundMe(ring, columns).map((member, index) =>
            renderColumn(member, member?.userId ?? `empty-${index}`),
          )}
        </div>
      ) : (
        <LoopingColumns ring={ring} columns={columns} renderColumn={renderColumn} />
      )}
    </div>
  );
}

function LoopingColumns({
  ring,
  columns,
  renderColumn,
}: {
  ring: RoomMember[];
  columns: number;
  renderColumn: (member: RoomMember, key: string) => React.ReactNode;
}) {
  // embla の loop はスライドの幅の合計が足りないと効かずに端で止まるので、2 画面分になるまでリストを繰り返す。
  const copies = Math.ceil((columns * 2) / ring.length);
  const slides = Array.from({ length: copies }, () => ring).flat();
  // 毎回作り直すと embla が描画のたびに作り直されるので、列の数が変わったときだけ作る。
  const options = useMemo(
    () => ({
      loop: true,
      startIndex: 0,
      // 先頭のスライド (自分) を、固定のときと同じ列に置く。
      align: (_viewSize: number, snapSize: number) => snapSize * myColumnIndex(columns),
      // 自分の気球の上で始まったドラッグは揺らす操作なので、スクロールしない。
      watchDrag: (_: unknown, event: MouseEvent | TouchEvent) =>
        !(event.target instanceof Element && event.target.closest("[data-shakeable]")),
    }),
    [columns],
  );
  const [emblaRef] = useEmblaCarousel(options);

  return (
    <div ref={emblaRef} className="h-full overflow-hidden">
      <div className="flex h-full touch-pan-y">
        {slides.map((member, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 人数が少ないと同じ人が何度も並ぶので、ID だけでは重なる
            key={`${member.userId}-${index}`}
            className="h-full min-w-0 shrink-0 grow-0"
            style={{ flexBasis: `${100 / columns}%` }}
          >
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
  onSelect,
  onShake,
}: {
  member: RoomMember | undefined;
  color: string;
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
            isAway={member.isAway}
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
