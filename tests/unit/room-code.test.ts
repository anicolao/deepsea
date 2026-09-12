import { it, expect, vi } from "vitest";
import {
  invitationRoom,
  newRoomCode,
  roomCodeGenerator,
  createCodedRoom,
} from "../../src/lib/backend/room-code";
import { RoomCollisionError } from "../../src/lib/backend/rest";
import { RoomRepository } from "../../src/lib/backend/repository";

it("generates five unambiguous letters and rejects biased random bytes", () => {
  expect(
    newRoomCode((bytes) => {
      bytes.set([255, 240, 0, 1, 2, 3, 4, 5]);
      return bytes;
    }),
  ).toBe("ABCDE");
  for (let i = 0; i < 50; i++)
    expect(newRoomCode()).toMatch(/^[A-HJ-NP-Z]{5}$/);
});
it("accepts lowercase codes and existing same-table links", () => {
  expect(invitationRoom(" coral ", "https://example.com", "/game")).toBe(
    "CORAL",
  );
  expect(
    invitationRoom(
      "https://example.com/game/rooms/?room=old-room-uuid",
      "https://example.com",
      "/game",
    ),
  ).toBe("old-room-uuid");
  for (const value of [
    "ABCD",
    "ABCDEF",
    "12ABC",
    "https://elsewhere.com/game/rooms/?room=CORAL",
    "https://example.com/other/rooms/?room=CORAL",
  ])
    expect(() =>
      invitationRoom(value, "https://example.com", "/game"),
    ).toThrow();
});
function repository(create: (pending: unknown) => Promise<void>) {
  const saved = new Map<string, string>();
  return new RoomRepository(
    { create, watch: () => () => {} },
    {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => {
        saved.set(key, value);
      },
      removeItem: (key) => {
        saved.delete(key);
      },
    },
    "mira",
    "tab",
    "local",
  );
}
it("retries a confirmed code collision without joining or modifying that room", async () => {
  const create = vi
    .fn()
    .mockRejectedValueOnce(new RoomCollisionError("collision"))
    .mockResolvedValue(undefined);
  const repo = repository(create);
  const generate = vi
    .fn()
    .mockReturnValueOnce("CORAL")
    .mockReturnValue("ABYSS");
  expect(await createCodedRoom(repo, "Mira", generate)).toBe("ABYSS");
  expect(repo.pending("CORAL")).toBeNull();
  expect(create).toHaveBeenCalledTimes(2);
});
it("retains uncertain creation for exact retry instead of creating another room", async () => {
  const create = vi.fn().mockRejectedValue(new Error("offline"));
  const repo = repository(create);
  await expect(createCodedRoom(repo, "Mira", () => "CORAL")).rejects.toThrow(
    "offline",
  );
  expect(repo.pending("CORAL")?.id).toBe("created");
  expect(create).toHaveBeenCalledTimes(1);
});
it("bounds collision retries and never discards normal moves", async () => {
  const create = vi.fn().mockRejectedValue(new RoomCollisionError("collision"));
  const repo = repository(create);
  await expect(createCodedRoom(repo, "Mira", () => "CORAL")).rejects.toThrow(
    "available room code",
  );
  expect(create).toHaveBeenCalledTimes(5);
  const move = repo.prepareAction("ABYSS", "lobby/left", {});
  expect(() => repo.discardRejectedCreation(move)).toThrow();
  expect(repo.pending("ABYSS")).toEqual(move);
});

it("reproduces room-code initialization only when explicitly seeded", () => {
  expect(roomCodeGenerator()).toBe(newRoomCode);
  const first = roomCodeGenerator(2026),
    second = roomCodeGenerator(2026);
  const sequence = Array.from({ length: 10 }, first);
  expect(sequence).toEqual(Array.from({ length: 10 }, second));
  expect(new Set(sequence).size).toBe(10);
  for (const code of sequence) expect(code).toMatch(/^[A-HJ-NP-Z]{5}$/);
  expect(roomCodeGenerator(393)()).not.toBe(sequence[0]);
});
