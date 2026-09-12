import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";

test("a real turn moves treasure and survives a reload in both browsers", async ({
  players,
}, info) => {
  const host = await players.create(),
    guest = await players.create();
  const hostSteps = new TestSteps(
    host,
    info,
    "Dive for treasure",
    "Mira rolls, collects treasure and observes Sol taking the next turn.",
    "host",
    "game",
  );
  const guestSteps = new TestSteps(
    guest,
    info,
    "Follow a friend",
    "Sol sees the confirmed move, reloads, and takes the next turn.",
    "guest",
    "game",
  );
  await host.goto("./rooms/");
  await host.getByLabel("Your name").fill("Mira");
  await host.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(
    host.getByText("Mira (You) · Host", { exact: true }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Room code", exact: true }).click();
  const code = await host.getByLabel("Room code", { exact: true }).innerText();
  expect(code).toMatch(/^[A-Z]{5}$/);
  await host.getByRole("button", { name: "Back to crew" }).click();
  await guest.goto("./");
  await guest
    .getByLabel("Room code or invite link")
    .fill(" " + code.toLowerCase() + " ");
  await guest.getByRole("button", { name: "Find room" }).click();
  await guest.getByLabel("Your name").fill("Sol");
  await guest.getByRole("button", { name: "Join room" }).click();
  await guest.getByRole("button", { name: "Ready up" }).click();
  await expect(
    host.getByRole("list", { name: "Crew" }).getByRole("listitem"),
  ).toHaveCount(2);
  await host.getByRole("button", { name: "Ready up" }).click();
  await host.getByRole("button", { name: "Start dive" }).click();
  await host.getByRole("button", { name: "Roll dice" }).click();
  await guestSteps.step("watch-roll", "Follow Mira’s roll and air use", [
    {
      description:
        "Sol sees Mira’s dice, destination and zero air charge while she chooses treasure.",
      assert: async () => {
        await expect(
          guest.getByRole("img", { name: "Dice: 3 and 3" }),
        ).toBeVisible();
        await expect(
          guest.getByText("0 air used", { exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByRole("heading", { name: "Mira is choosing treasure" }),
        ).toBeVisible();
        await expect(
          guest.getByRole("button", { name: "Follow turn" }),
        ).toHaveAttribute("aria-pressed", "true");
      },
    },
  ]);
  await hostSteps.step("rolled", "Mira lands on concealed treasure", [
    {
      description:
        "The confirmed dice move six spaces without using oxygen on an empty cargo hold.",
      assert: async () => {
        await expect(
          host.getByRole("img", { name: "Dice: 3 and 3" }),
        ).toBeVisible();
        await expect(
          host.getByText("Dice: 3 + 3 − 0 cargo = 6 spaces", { exact: true }),
        ).toBeVisible();
        await expect(
          host.getByRole("button", { name: "Pick up treasure" }),
        ).toBeEnabled();
        await expect(
          host.getByRole("button", { name: "Leave it", exact: true }),
        ).toBeEnabled();
        await expect(
          host.getByRole("button", { name: "Keep treasure", exact: true }),
        ).toHaveCount(0);
        await expect(
          guest.getByRole("meter", { name: "Shared oxygen" }),
        ).toHaveAttribute("aria-valuenow", "25");
        await expect(
          guest.getByRole("button", { name: "Roll dice" }),
        ).toHaveCount(0);
      },
    },
  ]);
  await host
    .getByRole("button", { name: "Show submarine", exact: true })
    .press("Enter");
  await hostSteps.step("surface", "Look back toward the sunlit submarine", [
    {
      description:
        "The submarine is visible at the surface while the treasure decision remains available.",
      assert: async () => {
        await expect(
          host.getByText("Submarine", { exact: true }),
        ).toBeInViewport();
        await expect(
          host.getByRole("button", { name: "Pick up treasure" }),
        ).toBeEnabled();
      },
    },
  ]);
  await host
    .getByLabel("Space 18, concealed level 3 treasure, 1 tiles", {
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await hostSteps.step("twilight", "Explore the darker water below", [
    {
      description:
        "Level III treasure is visible deeper down; the submarine scrolls away and the landing controls stay available.",
      assert: async () => {
        await expect(
          host.getByLabel("Space 18, concealed level 3 treasure, 1 tiles", {
            exact: true,
          }),
        ).toBeInViewport();
        await expect(
          host.getByText("Submarine", { exact: true }),
        ).not.toBeInViewport();
        await expect(
          host.getByRole("button", { name: "Pick up treasure" }),
        ).toBeEnabled();
      },
    },
  ]);
  await host
    .getByLabel("Space 27, concealed level 4 treasure, 1 tiles", {
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await hostSteps.step("midnight", "Explore the bioluminescent deep", [
    {
      description:
        "Level IV treasure is visible in the abyss while the same pickup or leave decision stays available.",
      assert: async () => {
        await expect(
          host.getByLabel("Space 27, concealed level 4 treasure, 1 tiles", {
            exact: true,
          }),
        ).toBeInViewport();
        await expect(
          host.getByRole("button", { name: "Pick up treasure" }),
        ).toBeEnabled();
        await expect(
          host.getByRole("button", { name: "Leave it", exact: true }),
        ).toBeEnabled();
      },
    },
  ]);
  await host
    .getByText("THE DEEP · What will you bring home?", { exact: true })
    .scrollIntoViewIfNeeded();
  await hostSteps.step("abyss", "Reach the midnight seabed", [
    {
      description:
        "The last level IV treasure and seabed are visible, with the same six-space roll and unchanged oxygen.",
      assert: async () => {
        await expect(
          host.getByText("THE DEEP · What will you bring home?", {
            exact: true,
          }),
        ).toBeInViewport();
        await expect(
          host.getByLabel("Space 32, concealed level 4 treasure, 1 tiles", {
            exact: true,
          }),
        ).toBeInViewport();
        await expect(
          host.getByRole("meter", { name: "Shared oxygen" }),
        ).toHaveAttribute("aria-valuenow", "25");
        await expect(
          host.getByText("Dice: 3 + 3 − 0 cargo = 6 spaces", { exact: true }),
        ).toBeVisible();
      },
    },
  ]);
  await host
    .getByRole("button", { name: "Find my diver", exact: true })
    .press("Enter");
  await expect(
    host.getByLabel("Space 6, concealed level 1 treasure, 1 tiles", {
      exact: true,
    }),
  ).toBeInViewport();
  await players.reload(host);
  await expect(
    host.getByRole("button", { name: "Pick up treasure" }),
  ).toBeEnabled();
  await expect(
    host.getByText("Dice: 3 + 3 − 0 cargo = 6 spaces", { exact: true }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Pick up treasure" }).click();
  await guestSteps.step("next-turn", "Sol sees the pickup and takes over", [
    {
      description:
        "The shared path now has an empty sixth space and the next player can roll.",
      assert: async () => {
        await expect(
          guest.getByRole("heading", { name: "Your turn", exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByLabel("Space 6, empty", { exact: true }),
        ).toHaveCount(1);
        await expect(
          host.getByRole("heading", { name: "Sol’s turn", exact: true }),
        ).toBeVisible();
        await expect(
          guest.getByRole("button", { name: "Roll dice" }),
        ).toBeEnabled();
      },
    },
  ]);
  hostSteps.finish();
  guestSteps.finish();
});
