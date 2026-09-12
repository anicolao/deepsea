import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";

test("friends complete three dives and play again without losing the result", async ({
  players,
}, info) => {
  const host = await players.create(),
    guest = await players.create();
  const hostSteps = new TestSteps(
    host,
    info,
    "Three dives together",
    "Mira and Sol bring treasure home over three dives, then create a fresh room.",
    "host",
    "game",
  );
  const guestSteps = new TestSteps(
    guest,
    info,
    "A shared final result",
    "Sol sees all three dive scores and can return to the completed result after another room is created.",
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
  await expect(
    host.getByRole("list", { name: "Crew" }).getByRole("listitem"),
  ).toHaveCount(2);
  await guest.getByRole("button", { name: "Ready up" }).click();
  await host.getByRole("button", { name: "Ready up" }).click();
  await host.getByRole("button", { name: "Start dive" }).click();
  for (const dive of [
    {
      number: 1,
      moves: [
        {
          seat: 0,
          back: false,
          choice: "pickup",
        },
        {
          seat: 1,
          back: false,
          choice: "pickup",
        },
        {
          seat: 0,
          back: true,
          choice: "pass",
        },
        {
          seat: 1,
          back: true,
          choice: null,
        },
        {
          seat: 0,
          back: false,
          choice: "pass",
        },
        {
          seat: 0,
          back: false,
          choice: null,
        },
      ],
    },
    {
      number: 2,
      moves: [
        {
          seat: 0,
          back: false,
          choice: "pickup",
        },
        {
          seat: 1,
          back: false,
          choice: "pickup",
        },
        {
          seat: 0,
          back: true,
          choice: "pass",
        },
        {
          seat: 1,
          back: true,
          choice: "pass",
        },
        {
          seat: 0,
          back: false,
          choice: "pass",
        },
        {
          seat: 1,
          back: false,
          choice: null,
        },
        {
          seat: 0,
          back: false,
          choice: null,
        },
      ],
    },
    {
      number: 3,
      moves: [
        {
          seat: 0,
          back: false,
          choice: "pickup",
        },
        {
          seat: 1,
          back: false,
          choice: "pickup",
        },
        {
          seat: 0,
          back: true,
          choice: "pass",
        },
        {
          seat: 1,
          back: true,
          choice: "pass",
        },
        {
          seat: 0,
          back: false,
          choice: null,
        },
        {
          seat: 1,
          back: false,
          choice: null,
        },
      ],
    },
  ]) {
    for (const move of dive.moves) {
      const actor = move.seat === 0 ? host : guest;
      if (move.back)
        await actor.getByLabel("Turn back", { exact: true }).check();
      await actor.getByRole("button", { name: "Roll dice" }).click();
      if (move.choice)
        await actor
          .getByRole("button", {
            name:
              move.choice === "pickup"
                ? "Pick up treasure"
                : /^(Leave it|Keep treasure|End turn)$/,
            exact: true,
          })
          .click();
      else
        await expect(
          actor.getByRole("heading", {
            name: /^(Back aboard|Dive [123] complete|Game complete)$/,
          }),
        ).toBeVisible();
    }
    if (dive.number < 3) {
      await expect(
        guest.getByRole("heading", {
          name: `Dive ${dive.number} complete`,
          exact: true,
        }),
      ).toBeVisible();
      if (dive.number === 1)
        await hostSteps.step(
          "first-review",
          "A safe first dive banks both hauls",
          [
            {
              description:
                "Both returned, and only safely banked values are revealed.",
              assert: async () => {
                await expect(
                  host.getByRole("row", {
                    name: "Mira (You) Returned 0 0",
                    exact: true,
                  }),
                ).toBeVisible();
                await expect(
                  guest.getByRole("row", {
                    name: "Sol (You) Returned 3 3",
                    exact: true,
                  }),
                ).toBeVisible();
                await expect(
                  host.getByRole("button", {
                    name: "Continue to dive 2",
                    exact: true,
                  }),
                ).toBeEnabled();
              },
            },
          ],
        );
      await guest
        .getByRole("button", {
          name: `Continue to dive ${dive.number + 1}`,
          exact: true,
        })
        .click();
      await expect(
        host.getByRole("meter", { name: "Shared oxygen" }),
      ).toHaveAttribute("aria-valuenow", "25");
    }
  }
  await guestSteps.step(
    "final-result",
    "Every dive contributes to the final score",
    [
      {
        description:
          "Sol wins with 12 points, Mira has 2, and both clients show the same three-dive totals.",
        assert: async () => {
          await expect(
            guest.getByRole("heading", { name: "Sol wins!", exact: true }),
          ).toBeVisible();
          await expect(
            guest.getByRole("row", { name: "Mira 0 0 2 2", exact: true }),
          ).toBeVisible();
          await expect(
            guest.getByRole("row", { name: "Sol (You) 3 7 2 12", exact: true }),
          ).toBeVisible();
          await expect(
            host.getByRole("heading", { name: "Sol wins!", exact: true }),
          ).toBeVisible();
          await expect(
            guest.getByRole("button", { name: "Continue to dive 4" }),
          ).toHaveCount(0);
        },
      },
    ],
  );
  await guest.getByText("View game history", { exact: true }).press("Enter");
  await guest.getByText("Dive 1", { exact: true }).press("Enter");
  await guest
    .getByText("Saved treasure: level 1, 3 points", { exact: true })
    .scrollIntoViewIfNeeded();
  await guestSteps.step("saved-dive", "Earlier hauls remain inspectable", [
    {
      description:
        "The first dive still reveals only its safely returned treasure and keeps the three-dive result available.",
      assert: async () => {
        await expect(
          guest.getByText("Saved treasure: level 1, 3 points", { exact: true }),
        ).toBeVisible();
        await expect(
          guest
            .locator('details:has(> summary:text-is("Dive 1"))')
            .getByText("Saved treasure: level 1, 0 points", { exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByRole("button", { name: "Play again", exact: true }),
        ).toBeEnabled();
      },
    },
  ]);
  const original = host.url();
  await host.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(
    host.getByText("Mira (You) · Host", { exact: true }),
  ).toBeVisible();
  expect(host.url()).not.toBe(original);
  await players.reload(guest);
  await expect(
    guest.getByRole("heading", { name: "Sol wins!", exact: true }),
  ).toBeVisible();
  await players.visit(guest, host.url());
  await guest.getByLabel("Your name").fill("Sol");
  await guest.getByRole("button", { name: "Join room" }).click();
  hostSteps.roomLayout();
  await hostSteps.step("fresh-room", "Play again starts a new invitation", [
    {
      description:
        "The original result survives reload, and both friends join a fresh unready lobby with the host name retained.",
      assert: async () => {
        await expect(
          host.getByRole("list", { name: "Crew" }).getByRole("listitem"),
        ).toHaveCount(2);
        await expect(
          host.getByText("Mira (You) · Host", { exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByRole("button", { name: "Ready up" }),
        ).toBeEnabled();
        await expect(
          host.getByRole("button", { name: "Start dive" }),
        ).toBeDisabled();
      },
    },
  ]);
  hostSteps.finish();
  guestSteps.finish();
});
