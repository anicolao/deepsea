import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';

test('friends create, join, ready and start a room through real browser actions', async ({ players }, info) => {
  const host = await players.create();
  const guest = await players.create();
  const third = await players.create();
  const hostSteps = new TestSteps(host, info, 'Gather and launch a crew', 'Mira creates a room from the home screen, invites friends, chooses a first diver and starts.', 'host', 'room');
  const guestSteps = new TestSteps(guest, info, 'Accept an invite', 'Sol joins through the invite, readies up, and sees the same saved start after reload.', 'guest', 'room');
  const thirdSteps = new TestSteps(third, info, 'Join the crew', 'Ada joins as a third player; the roster change clears earlier readiness.', 'third', 'room');
  await host.goto('./');
  await host.getByRole('link', { name: 'Create room', exact: true }).click();
  await host.getByLabel('Your name').fill('Mira');
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await hostSteps.step('created', 'The host invites friends', [{ description: 'Mira is seated as host and cannot start alone.', assert: async () => {
    await expect(host.getByText('Mira (You) · Host', { exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Start dive' })).toBeDisabled();
    await expect(host.getByText('Invite at least one friend to start.')).toBeVisible();
  } }]);
  await host.bringToFront();
  await host.getByRole('button', { name: 'Copy invite' }).click();
  await expect(host.getByText('Invite copied', { exact: true })).toBeVisible();
  const invite = await players.readInvite(host);
  await guest.goto(invite);
  await guest.getByLabel('Your name').fill('Sol');
  await guest.getByRole('button', { name: 'Join room' }).click();
  await guest.getByRole('button', { name: 'Ready up' }).click();
  await guestSteps.step('joined', 'A friend joins and readies up', [{ description: 'Sol has a seat and can withdraw readiness, but cannot start the room.', assert: async () => {
    await expect(guest.getByText('Sol (You)', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Not ready', exact: true })).toBeEnabled();
    await expect(guest.getByRole('button', { name: 'Start dive' })).toHaveCount(0);
  } }]);
  await third.goto(invite);
  await third.getByLabel('Your name').fill('Ada');
  await third.getByRole('button', { name: 'Join room' }).click();
  await thirdSteps.step('joined', 'A third friend joins', [{ description: 'Ada is seated in the same three-person crew and all readiness has reset.', assert: async () => {
    await expect(third.getByRole('list', { name: 'Crew' }).getByRole('listitem')).toHaveCount(3);
    await expect(third.getByText('Ada (You)', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Ready up' })).toBeEnabled();
    await expect(host.getByRole('button', { name: 'Start dive' })).toBeDisabled();
  } }]);
  await host.getByRole('button', { name: 'Ready up' }).click();
  await guest.getByRole('button', { name: 'Ready up' }).click();
  await third.getByRole('button', { name: 'Ready up' }).click();
  await host.getByLabel('First diver').selectOption({ label: 'Sol' });
  await host.getByRole('button', { name: 'Start dive' }).click();
  hostSteps.gameLayout();
  await hostSteps.step('started', 'The host starts with the selected first diver', [{ description: 'The confirmed start freezes three seats and assigns Sol the first turn.', assert: async () => {
    await expect(host.getByRole('heading', { name: 'Sol’s turn', exact: true })).toBeVisible();
    await expect(host.getByRole('meter', { name: 'Shared oxygen' })).toHaveAttribute('aria-valuenow', '25');
    await expect(host.getByRole('button', { name: 'Roll dice' })).toHaveCount(0);
    await expect(third.getByRole('heading', { name: 'Sol’s turn', exact: true })).toBeVisible();
  } }]);
  await expect(guest.getByRole('button', { name: 'Roll dice' })).toBeEnabled();
  await players.reload(guest);
  guestSteps.gameLayout();
  await guestSteps.step('reloaded', 'Reload keeps the player and confirmed start', [{ description: 'Sol returns to the same seat and the same first diver without a second join.', assert: async () => {
    await expect(guest.getByRole('heading', { name: 'Your turn', exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Roll dice' })).toBeEnabled();
    await expect(guest.getByRole('alert')).toHaveCount(0);
  } }]);
  hostSteps.finish(); guestSteps.finish(); thirdSteps.finish();
});
