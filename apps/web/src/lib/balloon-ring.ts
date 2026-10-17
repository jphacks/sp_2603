/**
 * 入室順のメンバーを、自分を先頭にして回す。
 * 返す並びは `[自分, 自分の次に入った人, ..., 自分の前に入った人]` で、自分の右隣が次の人、左隣が前の人になる。
 */
export function ringFromMe<T extends { isMe: boolean }>(membersInJoinOrder: T[]) {
  const myIndex = membersInJoinOrder.findIndex((member) => member.isMe);
  if (myIndex <= 0) return membersInJoinOrder;
  return [...membersInJoinOrder.slice(myIndex), ...membersInJoinOrder.slice(0, myIndex)];
}
