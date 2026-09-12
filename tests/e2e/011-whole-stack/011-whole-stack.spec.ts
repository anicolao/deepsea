import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";
test("a lost stack can be recovered and dropped whole with the keyboard", async ({
  players,
}, info) => {
  const host = await players.create(1),
    guest = await players.create(1);
  const hs = new TestSteps(
    host,
    info,
    "A whole stack travels together",
    "Mira loses treasure, finds its stack on the next dive, and drops the entire unit with the keyboard.",
    "host",
    "game",
  );
  const gs = new TestSteps(
    guest,
    info,
    "The same stack on the path",
    "Sol sees the complete two-tile stack returned to an empty space.",
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
  for (const [index, moves] of [
    [
      { seat: 0, back: false, choice: "pickup" },
      { seat: 1, back: false, choice: "pass" },
      { seat: 0, back: false, choice: "pickup" },
      { seat: 1, back: true, choice: null },
      { seat: 0, back: false, choice: "pickup" },
      { seat: 0, back: false, choice: "pickup" },
      { seat: 0, back: false, choice: "pickup" },
      { seat: 0, back: false, choice: "pass" },
      { seat: 0, back: false, choice: "pass" },
      { seat: 0, back: false, choice: "pass" },
    ],
    [
      { seat: 0, back: false, choice: "pass" },
      { seat: 1, back: false, choice: "pass" },
      { seat: 0, back: false, choice: "pass" },
      { seat: 1, back: true, choice: "pass" },
      { seat: 0, back: false, choice: "pass" },
      { seat: 1, back: false, choice: null },
      { seat: 0, back: false, choice: "pass" },
      { seat: 0, back: false, choice: "pass" },
      { seat: 0, back: false, choice: "pickup" },
      { seat: 0, back: false, choice: "drop" },
    ],
  ].entries()) {
    for (const move of moves) {
      const actor = move.seat === 0 ? host : guest;
      if (move.back) {
        await actor.getByLabel("Turn back", { exact: true }).focus();
        await actor.keyboard.press("Space");
      }
      await expect(
        actor.getByRole("button", { name: "Roll dice" }),
      ).toBeEnabled();
      await actor.getByRole("button", { name: "Roll dice" }).focus();
      await actor.keyboard.press("Enter");
      if (move.choice === "drop") {
        await actor.getByLabel("Choose a whole unit").focus();
        await actor.keyboard.press("ArrowDown");
        await actor.keyboard.press("Tab");
        await hs.step("whole-unit", "The stack is one cargo choice", [
          {
            description:
              "Both concealed tiles are selected as one unit; the alternative explicitly keeps the treasure.",
            assert: async () => {
              await expect(
                host.getByRole("button", {
                  name: "Keep treasure",
                  exact: true,
                }),
              ).toBeEnabled();
              await expect(
                host.getByRole("button", { name: "Leave it", exact: true }),
              ).toHaveCount(0);
              await expect(
                host.getByRole("option", { name: /Unit 1 · 2 tiles · level/ }),
              ).toHaveCount(1);
              await expect(
                host.getByRole("button", { name: "Drop selected treasure" }),
              ).toBeEnabled();
            },
          },
        ]);
        await expect(
          actor.getByRole("button", { name: "Drop selected treasure" }),
        ).toBeEnabled();
        await actor
          .getByRole("button", { name: "Drop selected treasure" })
          .focus();
        await actor.keyboard.press("Enter");
      } else if (move.choice) {
        await expect(
          actor.getByRole("button", {
            name:
              move.choice === "pickup"
                ? "Pick up treasure"
                : /^(Leave it|Keep treasure|End turn)$/,
            exact: true,
          }),
        ).toBeEnabled();
        await actor
          .getByRole("button", {
            name:
              move.choice === "pickup"
                ? "Pick up treasure"
                : /^(Leave it|Keep treasure|End turn)$/,
            exact: true,
          })
          .focus();
        await actor.keyboard.press("Enter");
      } else
        await expect(
          actor.getByRole("heading", {
            name: /^(Back aboard|Dive [123] complete)$/,
          }),
        ).toBeVisible();
    }
    if (index === 0) {
      await expect(
        host.getByRole("button", { name: "Confirm order" }),
      ).toBeEnabled();
      await host.getByRole("button", { name: "Confirm order" }).focus();
      await host.keyboard.press("Enter");
      await expect(
        host.getByRole("button", { name: "Continue to dive 2" }),
      ).toBeEnabled();
      await host.getByRole("button", { name: "Continue to dive 2" }).focus();
      await host.keyboard.press("Enter");
    }
  }
  await expect(
    host.getByText("Crew & cargo · 0 carried units", { exact: true }),
  ).toBeVisible();
  await guest
    .getByLabel(/concealed level .* treasure, 2 tiles$/)
    .scrollIntoViewIfNeeded();
  await gs.step("stack-returned", "Both tiles return to the same space", [
    {
      description:
        "The other browser sees a concealed two-tile stack on the shared path.",
      assert: async () => {
        await expect(
          guest.getByLabel(/concealed level .* treasure, 2 tiles$/),
        ).toHaveCount(1);
        await expect(
          guest.getByRole("heading", { name: "Mira’s turn", exact: true }),
        ).toBeVisible();
      },
    },
  ]);
  hs.finish();
  gs.finish();
});
