import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';

test('anonymous room creation persists and another browser sees the same confirmed room', async ({ players }, info) => {
  const host = await players.create();
  const guest = await players.create();
  const hostSteps = new TestSteps(host, info, 'A room that survives reload', 'Mira creates a real persisted room and returns to the same anonymous identity after reload.', 'host', 'room');
  const guestSteps = new TestSteps(guest, info, 'A second browser sees the room', 'An independently authenticated browser reads the same confirmed room without claiming a seat.', 'guest', 'room');
  await host.goto('rooms/');
  await expect(host.getByRole('status')).toHaveText('Connected');
  await host.getByLabel('Your name').fill('Mira');
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await hostSteps.step('created', 'The host sees a saved room', [{ description: 'The confirmed room belongs to Mira and retains the host identity.', assert: async () => {
    await expect(host.getByRole('status')).toHaveText('Room saved');
    await expect(host.getByRole('heading', { name: 'Mira’s room' })).toBeVisible();
    await expect(host.getByText('Host — this is your room', { exact: true })).toBeVisible();
    await expect(host.getByRole('alert')).toHaveCount(0);
  } }]);
  await guest.goto(host.url());
  await guestSteps.step('observed', 'Another browser sees the same room', [{ description: 'The host name matches while the second anonymous identity has no seat.', assert: async () => {
    await expect(guest.getByRole('status')).toHaveText('Room saved');
    await expect(guest.getByRole('heading', { name: 'Mira’s room' })).toBeVisible();
    await expect(guest.getByText('Not seated — joining comes next', { exact: true })).toBeVisible();
    await expect(guest.getByRole('alert')).toHaveCount(0);
  } }]);
  await players.reload(host);
  await hostSteps.step('reloaded', 'Reload restores the confirmed room and owner', [{ description: 'Reload keeps the host identity and room with no duplicate creation or pending action.', assert: async () => {
    await expect(host.getByRole('status')).toHaveText('Room saved');
    await expect(host.getByText('Host — this is your room', { exact: true })).toBeVisible();
    await expect(host.getByText('Your room creation is awaiting confirmation.', { exact: true })).toHaveCount(0);
    await expect(host.getByRole('alert')).toHaveCount(0);
  } }]);
  hostSteps.finish(); guestSteps.finish();
});
