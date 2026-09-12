import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";
test("keyboard players join by invite, inspect cargo and keep their direction while reading help", async ({
  players,
}, info) => {
  const host = await players.create(),
    guest = await players.create();
  const name = "Mira the fearless explorer of deep water";
  const hs = new TestSteps(
    host,
    info,
    "Every control has a keyboard path",
    "A long player name stays readable while help, cargo and history preserve the current move.",
    "host",
    "game",
  );
  const gs = new TestSteps(
    guest,
    info,
    "Join with an invitation",
    "Sol pastes a real invitation and joins using native form controls.",
    "guest",
    "room",
  );
  await host.goto("./rooms/");
  await host.getByLabel("Your name").fill(name);
  await expect(
    host.getByRole("button", { name: "Create room", exact: true }),
  ).toBeEnabled();
  await host.getByLabel("Your name").press("Enter");
  await expect(
    host.getByText(name + " (You) · Host", { exact: true }),
  ).toBeVisible();
  await expect(host.getByRole("button", { name: "Copy invite" })).toBeEnabled();
  await host.getByRole("button", { name: "Copy invite" }).press("Enter");
  const invite = await players.readInvite(host);
  await guest.goto("./");
  await guest.getByRole("link", { name: "Join with code" }).press("Enter");
  await guest.getByLabel("Room code or invite link").fill(invite);
  await expect(guest.getByRole("button", { name: "Find room" })).toBeEnabled();
  await guest.getByRole("button", { name: "Find room" }).press("Enter");
  await guest.getByLabel("Your name").fill("Sol");
  await expect(guest.getByRole("button", { name: "Join room" })).toBeEnabled();
  await guest.getByLabel("Your name").press("Enter");
  await gs.step("joined", "An invitation leads to the right crew", [
    {
      description:
        "Sol joins the invited room; the long host name wraps without blocking controls.",
      assert: async () => {
        await expect(guest.getByRole("list", { name: "Crew" })).toContainText(
          name + " · Host",
        );
        await expect(
          guest.getByRole("button", { name: "Ready up" }),
        ).toBeEnabled();
      },
    },
  ]);
  await expect(
    host.getByRole("list", { name: "Crew" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(host.getByRole("button", { name: "Ready up" })).toBeEnabled();
  await host.getByRole("button", { name: "Ready up" }).press("Enter");
  await expect(guest.getByRole("button", { name: "Ready up" })).toBeEnabled();
  await guest.getByRole("button", { name: "Ready up" }).press("Enter");
  await expect(host.getByRole("button", { name: "Start dive" })).toBeEnabled();
  await host.getByRole("button", { name: "Start dive" }).press("Enter");
  await expect(host.getByRole("button", { name: "Roll dice" })).toBeEnabled();
  await host.getByRole("button", { name: "Roll dice" }).press("Enter");
  await expect(
    host.getByRole("button", { name: "Pick up treasure" }),
  ).toBeEnabled();
  await host.getByRole("button", { name: "Pick up treasure" }).press("Enter");
  await expect(guest.getByRole("button", { name: "Roll dice" })).toBeEnabled();
  await guest.getByRole("button", { name: "Roll dice" }).press("Enter");
  await expect(
    guest.getByRole("button", { name: "Leave it", exact: true }),
  ).toBeEnabled();
  await guest
    .getByRole("button", { name: "Leave it", exact: true })
    .press("Enter");
  await host.getByLabel("Turn back", { exact: true }).press("Space");
  await hs.step(
    "direction",
    "Direction and concealed cargo remain visible together",
    [
      {
        description:
          "The return direction is selected before committing a roll, with visible cargo and oxygen cost.",
        assert: async () => {
          await expect(
            host.getByLabel("Turn back", { exact: true }),
          ).toBeChecked();
          await expect(
            host.getByRole("region", { name: "Your concealed cargo" }),
          ).toContainText("1 unit");
          await expect(
            host.getByRole("button", { name: "Roll dice", exact: true }),
          ).toBeEnabled();
          await expect(
            host.getByText("After your turn cost:", { exact: false }),
          ).toBeVisible();
        },
      },
    ],
  );
  await expect(host.getByRole("button", { name: "How to play" })).toBeEnabled();
  await host.getByRole("button", { name: "How to play" }).press("Enter");
  await hs.step("help", "Help does not discard the chosen direction", [
    {
      description:
        "The named dialog explains movement and oxygen in player language and has a keyboard close control.",
      assert: async () => {
        await expect(
          host.getByRole("dialog", { name: "One ocean. One oxygen tank." }),
        ).toBeVisible();
        await expect(host.getByRole("dialog")).toContainText(
          "Oxygen changes only on turns",
        );
        await expect(
          host.getByRole("button", { name: "Back to the dive" }),
        ).toBeFocused();
      },
    },
  ]);
  await host.keyboard.press("Escape");
  await expect(host.getByRole("button", { name: "How to play" })).toBeFocused();
  await expect(host.getByLabel("Turn back", { exact: true })).toBeChecked();
  await expect(
    host.getByRole("button", {
      name: "Crew & cargo · 1 carried unit",
      exact: true,
    }),
  ).toBeEnabled();
  await host
    .getByRole("button", { name: "Crew & cargo · 1 carried unit", exact: true })
    .press("Enter");
  await hs.step("cargo", "Cargo shows units and tiles without a peek", [
    {
      description:
        "The held unit is concealed and the roster has readable long names and statuses.",
      assert: async () => {
        await expect(
          host.getByRole("dialog", { name: "Your crew & cargo" }),
        ).toContainText("Unit 1: 1 tile, level 1");
        await expect(host.getByRole("dialog")).not.toContainText(
          /seed|actorUid|createdAt|Level 1: 0 points/,
        );
      },
    },
  ]);
  await host.keyboard.press("Escape");
  await expect(
    host.getByRole("button", { name: "History", exact: true }),
  ).toBeEnabled();
  await host.getByRole("button", { name: /Crew & cargo/ }).press("Enter");
  await host
    .getByRole("button", { name: "Find Sol", exact: true })
    .press("Enter");
  await expect(host.locator("#space-2")).toBeInViewport();
  await host
    .getByRole("button", { name: "History", exact: true })
    .press("Enter");
  await hs.step("history", "Confirmed moves have a readable history", [
    {
      description:
        "History names the divers and their actions without exposing hidden values or event data.",
      assert: async () => {
        await expect(
          host.getByRole("dialog", { name: "Game history" }),
        ).toContainText("Picked up one treasure unit.");
        await expect(host.getByRole("dialog")).toContainText("Sol");
        await expect(host.getByRole("dialog")).not.toContainText(
          /seed|actorUid|expectedActionId|schemaVersion/,
        );
      },
    },
  ]);
  await host.keyboard.press("Escape");
  await expect(host.getByLabel("Turn back", { exact: true })).toBeChecked();
  hs.finish();
  gs.finish();
});
