import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";

test("safe return, final oxygen turn and lost cargo ordering resolve one shared dive", async ({
  players,
}, info) => {
  const host = await players.create(),
    guest = await players.create();
  const hostSteps = new TestSteps(
    host,
    info,
    "Bring treasure home",
    "Mira returns safely and follows Sol through the end of the dive.",
    "host",
    "game",
  );
  const guestSteps = new TestSteps(
    guest,
    info,
    "Treasure left behind",
    "Sol stays underwater, finishes the last turn and orders lost cargo with the keyboard.",
    "guest",
    "game",
  );
  await host.goto("./rooms/");
  await host.getByLabel("Your name").fill("Mira");
  await host.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(
    host.getByText("Mira (You) · Host", { exact: true }),
  ).toBeVisible();
  await guest.goto(host.url());
  await guest.getByLabel("Your name").fill("Sol");
  await guest.getByRole("button", { name: "Join room" }).click();
  await guest.getByRole("button", { name: "Ready up" }).click();
  await expect(
    host.getByRole("list", { name: "Crew" }).getByRole("listitem"),
  ).toHaveCount(2);
  await host.getByRole("button", { name: "Ready up" }).click();
  await host.getByRole("button", { name: "Start dive" }).click();
  for (const move of [
    { player: "Mira", choice: "pickup", back: false },
    { player: "Sol", choice: "pickup", back: false },
    { player: "Mira", choice: "pickup", back: true },
    { player: "Sol", choice: "pickup", back: false },
    { player: "Mira", choice: "pass", back: false },
    { player: "Sol", choice: "pickup", back: false },
    { player: "Mira", choice: "return", back: false },
    { player: "Sol", choice: "pass", back: false },
    { player: "Sol", choice: "pickup", back: false },
    { player: "Sol", choice: "pickup", back: false },
    { player: "Sol", choice: "pass", back: false },
  ]) {
    const actor = move.player === "Mira" ? host : guest;
    if (move.back) await actor.getByLabel("Turn back", { exact: true }).check();
    await actor.getByRole("button", { name: "Roll dice" }).click();
    if (move.choice !== "return")
      await actor
        .getByRole("button", {
          name: move.choice === "pickup" ? "Pick up treasure" : "Leave it",
          exact: true,
        })
        .click();
    else {
      await expect(
        actor.getByRole("heading", { name: "Back aboard", exact: true }),
      ).toBeVisible();
      await players.setConnected(host, false);
      await expect(
        host.getByText("Reconnecting…", { exact: true }),
      ).toBeVisible();
    }
  }
  await guest.getByRole("button", { name: "Roll dice" }).click();
  await guestSteps.step("last-turn", "Finish the last oxygen-exhausting turn", [
    {
      description:
        "Oxygen is exhausted but Sol still has the legal landing choice.",
      assert: async () => {
        await expect(
          guest.getByRole("meter", { name: "Shared oxygen" }),
        ).toHaveAttribute("aria-valuenow", "0");
        await expect(
          guest.getByText("Last turn of this dive", { exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByText("Your cargo prevents movement.", { exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByRole("button", { name: "Leave it", exact: true }),
        ).toBeEnabled();
        await expect(
          host.getByRole("heading", { name: "Back aboard", exact: true }),
        ).toBeVisible();
      },
    },
  ]);
  await guest.getByRole("button", { name: "Leave it", exact: true }).click();
  await players.setConnected(host, true);
  await expect(
    guest.getByRole("button", { name: "Confirm order" }),
  ).toBeEnabled();
  await players.setConnected(guest, false);
  await expect(
    guest.getByRole("button", { name: "Confirm order" }),
  ).toBeDisabled();
  await players.setConnected(guest, true);
  await expect(
    guest.getByRole("button", { name: "Confirm order" }),
  ).toBeEnabled();
  await players.reload(guest);
  await guestSteps.step("lost-order", "Choose how lost cargo forms stacks", [
    {
      description:
        "Five whole units remain concealed, with grouping guidance and keyboard controls.",
      assert: async () => {
        await expect(
          guest.getByRole("heading", {
            name: "Choose the order of your lost treasure",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          guest
            .getByRole("list", { name: "Lost treasure order" })
            .getByRole("listitem"),
        ).toHaveCount(5);
        await expect(
          host.getByRole("heading", {
            name: "Waiting for Sol to order lost treasure",
            exact: true,
          }),
        ).toBeVisible();
      },
    },
  ]);
  await guest
    .getByRole("button", { name: "Move unit 2 earlier", exact: true })
    .focus();
  await guest.keyboard.press("Enter");
  await expect(
    guest
      .getByRole("list", { name: "Lost treasure order" })
      .getByRole("listitem")
      .first(),
  ).toContainText("Unit 2");
  await guest.getByRole("button", { name: "Confirm order" }).click();
  await hostSteps.step(
    "review",
    "Safe treasure scores and lost treasure does not",
    [
      {
        description:
          "Both clients see the same returned and lost outcomes, separate dive and cumulative scores, and next starter.",
        assert: async () => {
          await expect(
            host.getByRole("heading", { name: "Dive 1 complete", exact: true }),
          ).toBeVisible();
          await expect(
            host.getByRole("row", {
              name: "Mira (You) Returned 2 2",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            host.getByRole("row", {
              name: "Sol Treasure lost 0 0",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            guest.getByRole("heading", {
              name: "Sol starts the next dive",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            guest.getByRole("row", { name: "Mira Returned 2 2", exact: true }),
          ).toBeVisible();
        },
      },
    ],
  );
  hostSteps.finish();
  guestSteps.finish();
});
