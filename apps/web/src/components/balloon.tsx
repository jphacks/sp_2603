import { motion } from "motion/react";
import { useMemo } from "react";
import { BalloonFigure, balloonFigureHeight } from "@/components/balloon-figure";
import { createShakeDetector, DRAG_SHAKE } from "@/lib/shake-detector";

/** 空の画面での風船の直径。 */
const ENVELOPE_SIZE_PX = 48;
/** 気球の上端からアイコンの中心までの距離。高さの目盛りにアイコンの中心を合わせるのに使う。 */
export const BALLOON_ANCHOR_PX = ENVELOPE_SIZE_PX / 2;
/** アイコンの中心から、一番大きい籠の下端までの距離。 */
export const BALLOON_BELOW_ANCHOR_PX = balloonFigureHeight(ENVELOPE_SIZE_PX) - BALLOON_ANCHOR_PX;

type BalloonProps = {
  name: string;
  image: string | null;
  color: string;
  /** 忙しさ (0〜100)。籠の大きさに使う。 */
  busy: number;
  /** 離れている人の気球とアイコンはグレースケールにする。大きさと濃さは変えない。 */
  isAway: boolean;
  onTap: () => void;
  /** 渡すと、気球をドラッグして強く揺らしたときに呼ばれる。自分の気球にだけ渡す。 */
  onShake?: () => void;
};

export function Balloon({ name, image, color, busy, isAway, onTap, onShake }: BalloonProps) {
  const feed = useMemo(() => onShake && createShakeDetector(DRAG_SHAKE, onShake), [onShake]);

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ transformOrigin: `50% ${BALLOON_ANCHOR_PX}px` }}
      initial={false}
      animate={{ filter: isAway ? "grayscale(1)" : "grayscale(0)" }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <motion.button
          type="button"
          aria-label={`${name}の気球`}
          // embla はこの属性がある要素の上で始まったドラッグではスクロールしない。
          data-shakeable={feed ? "" : undefined}
          className="block outline-none"
          style={feed && { touchAction: "none" }}
          drag={feed ? "x" : false}
          dragSnapToOrigin
          dragElastic={0.6}
          onDrag={(_, info) => feed?.(info.velocity.x)}
          onTap={onTap}
        >
          <BalloonFigure size={ENVELOPE_SIZE_PX} image={image} color={color} busy={busy} />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
