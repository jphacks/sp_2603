/**
 * 入室順のメンバーを、自分を先頭にして回す。
 * 返す並びは `[自分, 自分の次に入った人, ..., 自分の前に入った人]` で、自分の右隣が次の人、左隣が前の人になる。
 */
export function ringFromMe<T extends { isMe: boolean }>(membersInJoinOrder: T[]) {
  const myIndex = membersInJoinOrder.findIndex((member) => member.isMe);
  if (myIndex <= 0) return membersInJoinOrder;
  return [...membersInJoinOrder.slice(myIndex), ...membersInJoinOrder.slice(0, myIndex)];
}

/** 列が `columns` 個のとき、自分を置く列。奇数なら真ん中、偶数なら真ん中の左になる。 */
export function myColumnIndex(columns: number) {
  return Math.floor((columns - 1) / 2);
}

/**
 * 全員が 1 画面に収まるときの並び。自分を `myColumnIndex` に置き、次に入った人を右へ、前に入った人を左へ半分ずつ置く。
 * 人数が奇数で分けきれないときは右を 1 人多くする。空いた列は undefined になる。
 *
 * @example
 * placeAroundMe([me, b, c], 5); // [undefined, c, me, b, undefined]
 */
export function placeAroundMe<T>(ring: T[], columns: number) {
  const myColumn = myColumnIndex(columns);
  const rightCount = Math.min(columns - 1 - myColumn, Math.ceil((ring.length - 1) / 2));
  const right = ring.slice(1, 1 + rightCount);
  const left = ring.slice(1 + rightCount);
  const slots: (T | undefined)[] = Array.from({ length: columns }, () => undefined);
  slots[myColumn] = ring[0];
  right.forEach((member, i) => {
    slots[myColumn + 1 + i] = member;
  });
  left.forEach((member, i) => {
    slots[myColumn - left.length + i] = member;
  });
  return slots;
}
