import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";

test("host departure closes a lobby for invited friends", async ({
  players,
}, info) => {
  const host = await players.create();
  const guest = await players.create();
  const hostSteps = new TestSteps(
    host,
    info,
    "Close an unstarted room",
    "The host explicitly confirms that leaving closes the room for everyone.",
    "host",
    "room",
  );
  const guestSteps = new TestSteps(
    guest,
    info,
    "A closed invite",
    "A friend sees that the room is closed and can create another room.",
    "guest",
    "room",
  );
  await host.goto("./");
  await host.getByLabel("Your name").fill("Mira");
  await host.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(
    host.getByText("Mira (You) · Host", { exact: true }),
  ).toBeVisible();
  await guest.goto(host.url());
  await guest.getByLabel("Your name").fill("Sol");
  await guest.getByRole("button", { name: "Join room" }).click();
  await expect(guest.getByText("Sol (You)", { exact: true })).toBeVisible();
  await host.getByRole("button", { name: "Leave room" }).click();
  await hostSteps.step(
    "confirm",
    "Closing the room needs a deliberate confirmation",
    [
      {
        description: "The host sees who will be affected and can stay instead.",
        assert: async () => {
          await expect(
            host.getByRole("group", { name: "Confirm room closure" }),
          ).toContainText("Leaving closes this room for everyone.");
          await expect(
            host.getByRole("button", { name: "Stay", exact: true }),
          ).toBeEnabled();
        },
      },
    ],
  );
  await host.getByRole("button", { name: "Close room", exact: true }).click();
  await guestSteps.step("closed", "The invite reflects the confirmed closure", [
    {
      description:
        "Both browsers show the closed room and joining is unavailable.",
      assert: async () => {
        await expect(
          guest.getByRole("heading", { name: "Room closed" }),
        ).toBeVisible();
        await expect(
          host.getByRole("heading", { name: "Room closed" }),
        ).toBeVisible();
        await expect(
          guest.getByRole("button", { name: "Join room" }),
        ).toHaveCount(0);
        await expect(
          guest.getByRole("link", { name: "Create another room" }),
        ).toBeVisible();
      },
    },
  ]);
  hostSteps.finish();
  guestSteps.finish();
});
