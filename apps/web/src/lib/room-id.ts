export const ROOM_ID_LENGTH = 6;

export const isRoomId = (value: string) => /^\d{6}$/.test(value);
