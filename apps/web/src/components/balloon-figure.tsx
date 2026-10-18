import { motion } from "motion/react";
import { basketSize } from "@/lib/basket-size";

// デザインの気球 (直径 96) の寸法を、直径に対する比にしたもの。
const RING_RATIO = 1 / 16;
const STRING_TOP_Y_RATIO = 0.75;
const STRING_TOP_X_RATIO = 0.2;
const BASKET_TOP_RATIO = 1.15;
/** ひもを籠のどこに結ぶか。籠の幅に対する、端からの距離の比。 */
const STRING_BOTTOM_INSET_RATIO = 0.17;

const SPRING = { type: "spring", stiffness: 120, damping: 16 } as const;

type BalloonFigureProps = {
  /** 風船 (アイコンの丸) の直径 (px)。 */
  size: number;
  image: string | null;
  color: string;
  /** 忙しさ (0〜100)。籠の大きさが変わる。 */
  busy: number;
};

/** アイコンの風船、ひも、籠を描いた気球の絵。籠は忙しいほど大きくなる。 */
export function BalloonFigure({ size, image, color, busy }: BalloonFigureProps) {
  const basket = basketSize(busy, size);
  const basketTop = size * BASKET_TOP_RATIO;
  const basketLeft = (size - basket.width) / 2;
  const stringTopY = size * STRING_TOP_Y_RATIO;
  const stringBottomX = basketLeft + basket.width * STRING_BOTTOM_INSET_RATIO;

  return (
    <span
      className="relative block"
      style={{ width: size, height: basketTop + basketSize(100, size).height }}
    >
      <svg
        className="absolute top-0 left-0 overflow-visible"
        width={size}
        height={basketTop}
        aria-hidden="true"
      >
        <g stroke="#E6E6E6" strokeWidth={size / 48} strokeLinecap="round">
          <motion.line
            x1={size * STRING_TOP_X_RATIO}
            y1={stringTopY}
            y2={basketTop}
            initial={false}
            animate={{ x2: stringBottomX }}
            transition={SPRING}
          />
          <motion.line
            x1={size * (1 - STRING_TOP_X_RATIO)}
            y1={stringTopY}
            y2={basketTop}
            initial={false}
            animate={{ x2: size - stringBottomX }}
            transition={SPRING}
          />
        </g>
      </svg>
      <span
        className="absolute top-0 left-0 block overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          borderWidth: size * RING_RATIO,
          borderColor: color,
          backgroundColor: color,
        }}
      >
        {image && <img src={image} alt="" className="size-full object-cover" draggable={false} />}
      </span>
      <motion.span
        className="absolute left-1/2 block -translate-x-1/2 bg-[#7C2D12]"
        style={{ top: basketTop }}
        initial={false}
        animate={{
          width: basket.width,
          height: basket.height,
          borderRadius: basket.height * 0.3,
        }}
        transition={SPRING}
      />
    </span>
  );
}
