import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";
test("lost acknowledgements, competing tabs and reconnect preserve one accepted roll", async ({
  players,
}, info) => {
  const host = await players.create(),
    guest = await players.create();
  const hs = new TestSteps(
    host,
    info,
    "A move survives interruption",
    "A lost reply and competing tabs never repeat an oxygen charge.",
    "host",
    "game",
  );
  const gs = new TestSteps(
    guest,
    info,
    "The crew sees one move",
    "The other player sees the same confirmed oxygen and cargo.",
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
  await expect(host.getByRole("button", { name: "Roll dice" })).toBeEnabled();
  await players.loseNextAcknowledgement(host);
  await host.getByRole("button", { name: "Roll dice" }).click();
  await expect(
    host.getByRole("button", { name: "Pick up treasure" }),
  ).toBeEnabled();
  expect(players.faultCount(host)).toBe(1);
  await host.getByRole("button", { name: "Pick up treasure" }).click();
  await guest.getByRole("button", { name: "Roll dice" }).click();
  await guest.getByRole("button", { name: "Leave it", exact: true }).click();
  const tab = await players.tab(host);
  const ts = new TestSteps(
    tab,
    info,
    "The same diver in another tab",
    "Both tabs restore one seat and the accepted dice.",
    "tab",
    "game",
  );
  await tab.goto(host.url());
  await expect(tab.getByRole("button", { name: "Roll dice" })).toBeEnabled();
  await host.getByRole("button", { name: "Roll dice" }).focus();
  await tab.getByRole("button", { name: "Roll dice" }).focus();
  await Promise.all([
    host.keyboard.press("Enter"),
    tab.keyboard.press("Enter"),
  ]);
  await expect(
    host.getByRole("meter", { name: "Shared oxygen" }),
  ).toHaveAttribute("aria-valuenow", "24");
  await expect(
    tab.getByRole("meter", { name: "Shared oxygen" }),
  ).toHaveAttribute("aria-valuenow", "24");
  await expect(
    host.getByRole("button", { name: "Pick up treasure" }),
  ).toBeEnabled();
  await players.reload(host);
  await expect(
    host.getByRole("button", { name: "Pick up treasure" }),
  ).toBeEnabled();
  await players.setConnected(host, false);
  await hs.step("offline", "The last confirmed board stays visible", [
    {
      description: "Offline controls stop new moves while oxygen stays at 24.",
      assert: async () => {
        await expect(
          host.getByText("Reconnecting…", {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          host.getByRole("button", { name: "Pick up treasure" }),
        ).toBeDisabled();
        await expect(
          host.getByText("Last known oxygen", { exact: true }),
        ).toBeVisible();
        await expect(
          host.getByRole("meter", { name: "Shared oxygen" }),
        ).toHaveAttribute("aria-valuenow", "24");
      },
    },
  ]);
  await players.setConnected(host, true);
  await host.getByRole("button", { name: "Pick up treasure" }).click();
  await expect(guest.getByRole("button", { name: "Roll dice" })).toBeEnabled();
  await players.reload(tab);
  await ts.step("restored", "Reload keeps the accepted move", [
    {
      description:
        "The same seat, oxygen and next player return without another roll.",
      assert: async () => {
        await expect(
          tab.getByRole("heading", { name: "Sol’s turn", exact: true }),
        ).toBeVisible();
        await expect(
          tab.getByRole("meter", { name: "Shared oxygen" }),
        ).toHaveAttribute("aria-valuenow", "24");
        await expect(
          tab.getByText("Crew & cargo · 2 carried units", { exact: true }),
        ).toBeVisible();
      },
    },
  ]);
  await gs.step("one-charge", "The other diver sees one oxygen charge", [
    {
      description: "Sol can take the next turn with the same shared total.",
      assert: async () => {
        await expect(
          guest.getByRole("meter", { name: "Shared oxygen" }),
        ).toHaveAttribute("aria-valuenow", "24");
        await expect(
          guest.getByRole("button", { name: "Roll dice" }),
        ).toBeEnabled();
      },
    },
  ]);
  hs.finish();
  gs.finish();
  ts.finish();
});
