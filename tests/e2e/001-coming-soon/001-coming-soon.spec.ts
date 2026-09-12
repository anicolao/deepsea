import { test, expect } from "../helpers/fixture";
import { TestSteps } from "../helpers/test-steps";

test("visitors enter their name and learn the game from the arrival card", async ({
  page,
}, info) => {
  const steps = new TestSteps(
    page,
    info,
    "Arrive and gather",
    "The illustrated arrival card offers name entry and an invitation form. Keyboard help preserves the visitor’s name.",
  );
  await page.goto("./");
  await page.getByLabel("Your name").fill("Mira");
  await steps.step(
    "splash",
    "Name entry and invitations share the arrival card",
    [
      {
        description:
          "The name, enabled create action, invitation field and game facts fit the responsive card.",
        assert: async () => {
          await expect(
            page.getByRole("heading", {
              level: 1,
              name: "Deep Sea",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Create room", exact: true }),
          ).toBeEnabled();
          await expect(page.getByLabel("Invite link")).toBeVisible();
          await expect(
            page.getByRole("list", { name: "Game at a glance" }),
          ).toContainText("Shared oxygen");
        },
      },
    ],
  );
  await page.getByRole("button", { name: "How to play" }).press("Enter");
  await steps.step("game-brief", "A keyboard user can learn the game", [
    {
      description:
        "The dialog explains shared oxygen and safe return, and focuses its close control.",
      assert: async () => {
        await expect(
          page.getByRole("dialog", { name: "One ocean. One oxygen tank." }),
        ).toContainText("shared oxygen");
        await expect(page.getByRole("dialog")).toContainText(
          "treasure only scores if you reach the submarine",
        );
        await expect(
          page.getByRole("button", { name: "Back to the surface" }),
        ).toBeFocused();
      },
    },
  ]);
  await page.keyboard.press("Escape");
  await steps.step("return", "Closing help preserves the arrival form", [
    {
      description:
        "Escape restores focus to help and retains the entered name.",
      assert: async () => {
        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(
          page.getByRole("button", { name: "How to play" }),
        ).toBeFocused();
        await expect(page.getByLabel("Your name")).toHaveValue("Mira");
      },
    },
  ]);
  steps.finish();
});
