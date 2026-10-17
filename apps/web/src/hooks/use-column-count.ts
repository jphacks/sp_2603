import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * 要素の幅に何列入るかを返す。幅が変わると数え直す。最初の描画では画面の幅で数える。
 *
 * @example
 * const columns = useColumnCount(containerRef, { minColumnWidth: 130, minColumns: 3 });
 */
export function useColumnCount(
  ref: RefObject<HTMLElement | null>,
  { minColumnWidth, minColumns }: { minColumnWidth: number; minColumns: number },
) {
  const countFor = (width: number) => Math.max(minColumns, Math.floor(width / minColumnWidth));
  const [columns, setColumns] = useState(() => countFor(window.innerWidth));

  // biome-ignore lint/correctness/useExhaustiveDependencies: countFor は引数の数値だけで決まる
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setColumns(countFor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minColumnWidth, minColumns]);

  return columns;
}
