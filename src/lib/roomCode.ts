import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRoomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}
