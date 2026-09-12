import { stream } from "../game/random";
import { RoomCollisionError } from "./rest";
import type { RoomRepository } from "./repository";

const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newRoomCode(
  random = (bytes: Uint8Array<ArrayBuffer>) => crypto.getRandomValues(bytes),
): string {
  let code = "";
  while (code.length < 5) {
    for (const byte of random(new Uint8Array(8))) {
      if (byte < 240) code += letters[byte % letters.length];
      if (code.length === 5) break;
    }
  }
  return code;
}

// Isolated browser runs reproduce initialization; ordinary rooms use crypto.
export function roomCodeGenerator(seed?: number): () => string {
  if (seed === undefined) return newRoomCode;
  const next = stream(seed, "room-codes");
  return () =>
    newRoomCode((bytes) => {
      for (let i = 0; i < bytes.length; i++) bytes[i] = next() & 255;
      return bytes;
    });
}

export function invitationRoom(
  input: string,
  origin: string,
  base: string,
): string {
  const value = input.trim();
  if (/^[a-z]{5}$/i.test(value)) return value.toUpperCase();
  const url = new URL(value);
  const id = url.searchParams.get("room") ?? "";
  if (
    url.origin !== origin ||
    url.pathname !== base + "/rooms/" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  )
    throw new Error("Invalid invitation");
  return /^[a-z]{5}$/i.test(id) ? id.toUpperCase() : id;
}

export async function createCodedRoom(
  repository: RoomRepository,
  name: string,
  generate = newRoomCode,
  prepared = (_id: string) => {},
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generate();
    const pending = repository.prepareCreation(id, name);
    prepared(id);
    try {
      await repository.submit(pending);
      return id;
    } catch (error) {
      if (!(error instanceof RoomCollisionError)) throw error;
      repository.discardRejectedCreation(pending);
    }
  }
  throw new Error("Could not find an available room code. Please try again.");
}
