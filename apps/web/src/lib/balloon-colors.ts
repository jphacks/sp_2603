/** デザイナーが決めた気球の色。8 つの色相を 3 段の明るさで並べている (行は明るい順)。 */
const BALLOON_PALETTE = [
  ["#FF6666", "#FFA666", "#FFD966", "#66FF66", "#66E5FF", "#668CFF", "#B266FF", "#FF66E6"],
  ["#FF3333", "#FF8833", "#FFCC33", "#33FF33", "#33DDFF", "#3366FF", "#9933FF", "#FF33DD"],
  ["#CC2929", "#CC6D29", "#CCA329", "#29CC29", "#29B1CC", "#2952CC", "#7A29CC", "#CC29B1"],
] as const;

type PaletteColor = { hex: string; hue: number };

const PALETTE_COLORS: PaletteColor[] = BALLOON_PALETTE.flatMap((row) =>
  row.map((hex, hue) => ({ hex, hue })),
);

// FNV-1a。ルームとユーザーが同じなら、どの端末でも同じ色を選ぶために使う。
const hashString = (text: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * 入室順に並んだメンバーに気球の色をランダムに割り当てる。環状の並びで隣になる人どうしは同じ色相にしない。
 * 24 人までは全員違う色になる。結果はルーム ID とユーザー ID で決まり、ポーリングしても変わらない。
 * 前の人の色をもとに選ぶので、誰かが後から入っても先にいた人の色は (最後の人を除いて) 変わらない。
 *
 * @example
 * const colors = assignBalloonColors("012345", members.map((m) => m.userId));
 * colors.get(member.userId); // "#FF6666"
 */
export function assignBalloonColors(roomId: string, userIdsInJoinOrder: string[]) {
  const colors = new Map<string, string>();
  const used = new Set<PaletteColor>();
  const picked: PaletteColor[] = [];

  const pick = (userId: string, avoidHues: number[]) => {
    const differentHue = PALETTE_COLORS.filter((color) => !avoidHues.includes(color.hue));
    const unused = differentHue.filter((color) => !used.has(color));
    const candidates = unused.length > 0 ? unused : differentHue;
    // 避ける色相は多くても 2 つなので、候補が空になることはない。
    return candidates[hashString(`${roomId}:${userId}`) % candidates.length] as PaletteColor;
  };

  userIdsInJoinOrder.forEach((userId, index) => {
    const previous = picked.at(-1);
    const avoidHues = previous ? [previous.hue] : [];
    // 最後の人は環状の並びで先頭の人とも隣になる。
    const first = picked[0];
    const isLastOfRing = index === userIdsInJoinOrder.length - 1 && index >= 2;
    if (isLastOfRing && first) avoidHues.push(first.hue);
    const color = pick(userId, avoidHues);
    picked.push(color);
    used.add(color);
    colors.set(userId, color.hex);
  });
  return colors;
}
