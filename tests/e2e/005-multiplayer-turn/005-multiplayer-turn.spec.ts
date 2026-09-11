import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';

test('a real turn moves treasure and survives a reload in both browsers', async ({ players }, info) => {
  const host = await players.create(), guest = await players.create();
  const hostSteps = new TestSteps(host, info, 'Dive for treasure', 'Mira rolls, collects treasure and observes Sol taking the next turn.', 'host', 'game');
  const guestSteps = new TestSteps(guest, info, 'Follow a friend', 'Sol sees the confirmed move, reloads, and takes the next turn.', 'guest', 'game');
  await host.goto('./rooms/');
  await host.getByLabel('Your name').fill('Mira');
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(host.getByText('Mira (You) · Host', { exact: true })).toBeVisible();
  await guest.goto(host.url());
  await guest.getByLabel('Your name').fill('Sol');
  await guest.getByRole('button', { name: 'Join room' }).click();
  await guest.getByRole('button', { name: 'Ready up' }).click();
  await host.getByRole('button', { name: 'Ready up' }).click();
  await host.getByRole('button', { name: 'Start dive' }).click();
  await host.getByRole('button', { name: 'Roll dice' }).click();
  await hostSteps.step('rolled', 'Mira lands on concealed treasure', [{description:'The confirmed dice move six spaces without using oxygen on an empty cargo hold.', assert:async()=>{
    await expect(host.getByText('Dice: 3 + 3 − 0 cargo = 6 spaces', {exact:true})).toBeVisible();
    await expect(host.getByRole('button',{name:'Pick up treasure'})).toBeEnabled();
    await expect(guest.getByRole('meter',{name:'Shared oxygen'})).toHaveAttribute('aria-valuenow','25');
    await expect(guest.getByRole('button',{name:'Roll dice'})).toHaveCount(0);
  }}]);
  await players.reload(host);
  await expect(host.getByRole('button',{name:'Pick up treasure'})).toBeEnabled();
  await expect(host.getByText('Dice: 3 + 3 − 0 cargo = 6 spaces',{exact:true})).toBeVisible();
  await host.getByRole('button',{name:'Pick up treasure'}).click();
  await guestSteps.step('next-turn','Sol sees the pickup and takes over',[{description:'The shared path now has an empty sixth space and the next player can roll.',assert:async()=>{
    await expect(guest.getByRole('heading',{name:'Your turn',exact:true})).toBeVisible();
    await expect(guest.getByLabel('Space 6, empty',{exact:true})).toHaveCount(1);
    await expect(host.getByRole('heading',{name:'Sol’s turn',exact:true})).toBeVisible();
    await expect(guest.getByRole('button',{name:'Roll dice'})).toBeEnabled();
  }}]);
  hostSteps.finish();guestSteps.finish();
});
