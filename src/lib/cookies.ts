import type { NextResponse } from "next/server";

export const ROOM_CODE_COOKIE = "uc_room";
export const GUEST_ID_COOKIE = "uc_guest";

export function setGuestCookies(
  res: NextResponse,
  params: { roomCode: string; guestId: string }
) {
  res.cookies.set(ROOM_CODE_COOKIE, params.roomCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  res.cookies.set(GUEST_ID_COOKIE, params.guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
