import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';

test('two players can leave, rejoin and start while late invites are rejected', async ({ players }, info) => {
  const host = await players.create();
  const guest = await players.create();
  const late = await players.create();
  const hostSteps = new TestSteps(host, info, 'Start with two divers', 'The host starts a confirmed two-person crew after a friend leaves and rejoins.', 'host', 'room');
  const guestSteps = new TestSteps(guest, info, 'Leave and rejoin', 'A friend can leave an unstarted lobby and rejoin through the same invite.', 'guest', 'room');
  const lateSteps = new TestSteps(late, info, 'An invite after start', 'A fresh browser cannot join a crew whose dive has already started.', 'late', 'room');
  await host.goto('./');
  await host.getByRole('link', { name: 'Create room', exact: true }).click();
  await host.getByLabel('Your name').fill('Mira');
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(host.getByText('Mira (You) · Host', { exact: true })).toBeVisible();
  await guest.goto(host.url());
  await guest.getByLabel('Your name').fill('Sol');
  await guest.getByRole('button', { name: 'Join room' }).click();
  await guest.getByRole('button', { name: 'Leave room' }).click();
  await guestSteps.step('left', 'Leaving releases the seat', [{ description: 'The guest can rejoin and the host is alone again.', assert: async () => {
    await expect(guest.getByRole('button', { name: 'Join room' })).toBeEnabled();
    await expect(guest.getByText('You left the room. You can join again while it is open.')).toBeVisible();
    await expect(host.getByRole('list', { name: 'Crew' }).getByRole('listitem')).toHaveCount(1);
    await expect(host.getByRole('button', { name: 'Start dive' })).toBeDisabled();
  } }]);
  await guest.getByRole('button', { name: 'Join room' }).click();
  await guest.getByRole('button', { name: 'Ready up' }).click();
  await expect(host.getByRole('list',{name:'Crew'}).getByRole('listitem')).toHaveCount(2);
  await host.getByRole('button',{name:'Ready up'}).click();
  await host.getByRole('button', { name: 'Start dive' }).click();
  hostSteps.gameLayout();
  await hostSteps.step('started', 'Two ready friends start', [{ description: 'The saved start contains both seats and Mira as first diver.', assert: async () => {
    await expect(host.getByRole('heading', { name: 'Your turn', exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Roll dice' })).toBeEnabled();
    await expect(guest.getByRole('heading', { name: 'Mira’s turn', exact: true })).toBeVisible();
  } }]);
  await late.goto(host.url());
  await lateSteps.step('late-invite', 'Late arrivals get a clear explanation', [{ description: 'The started room rejects a new player and offers a new room.', assert: async () => {
    await expect(late.getByRole('heading', { name: 'This dive has already started' })).toBeVisible();
    await expect(late.getByRole('button', { name: 'Join room' })).toHaveCount(0);
    await expect(late.getByRole('link', { name: 'Create another room' })).toBeVisible();
  } }]);
  hostSteps.finish(); guestSteps.finish(); lateSteps.finish();
});
