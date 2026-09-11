import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';
test('two friends compete for the final seat and only one joins',async({players},info)=>{
 const crew: {page: Awaited<ReturnType<typeof players.create>>; name: string; steps: TestSteps}[]=[];
 for(const name of ['Mira','Sol','Kai','Luz','Pip']){
  const page=await players.create();crew.push({page,name,steps:new TestSteps(page,info,'A full crew','Five seated friends see only one final join.',name.toLowerCase(),'room')});
 }
 const host=crew.at(0)!.page;
 await host.goto('./rooms/');await host.getByLabel('Your name').fill('Mira');await host.getByRole('button',{name:'Create room',exact:true}).click();
 await expect(host.getByText('Mira (You) · Host',{exact:true})).toBeVisible();
 for(const friend of crew.slice(1)){await friend.page.goto(host.url());await friend.page.getByLabel('Your name').fill(friend.name);await friend.page.getByRole('button',{name:'Join room'}).click();await expect(friend.page.getByRole('button',{name:'Ready up'})).toBeEnabled();}
 const a=await players.create(),b=await players.create();
 for(const contender of [a,b]){await contender.goto(host.url());await contender.getByLabel('Your name').fill('Nori');await contender.getByRole('button',{name:'Join room'}).focus();}
 await Promise.all([a.keyboard.press('Enter'),b.keyboard.press('Enter')]);
 await expect(host.getByRole('list',{name:'Crew'}).getByRole('listitem')).toHaveCount(6);
 await expect(a.getByRole('list',{name:'Crew'}).getByRole('listitem')).toHaveCount(6);
 await expect(b.getByRole('list',{name:'Crew'}).getByRole('listitem')).toHaveCount(6);
 const winner=await a.getByText('Nori (You)',{exact:true}).isVisible()?a:b;
 const loser=winner===a?b:a;
 const ws=new TestSteps(winner,info,'The final seat','The successful friend joins once.','winner','room');
 const ls=new TestSteps(loser,info,'The full room','The other friend gets a clear new-room option.','loser','room');
 await ws.step('seated','One final diver joins',[{description:'The winner has exactly one seat and readiness controls.',assert:async()=>{
  await expect(winner.getByText('Nori (You)',{exact:true})).toHaveCount(1);await expect(winner.getByRole('button',{name:'Ready up'})).toBeEnabled();
 }}]);
 await ls.step('full','The other invitation cannot claim a seat',[{description:'The losing friend is not seated and can create another room.',assert:async()=>{
  await expect(loser.getByRole('heading',{name:'Room full',exact:true})).toBeVisible();await expect(loser.getByRole('button',{name:'Ready up'})).toHaveCount(0);await expect(loser.getByRole('link',{name:'Create another room'})).toBeVisible();
 }}]);
 for(const friend of crew){await friend.steps.step('full-crew','The crew has exactly six seats',[{description:'All seated friends see the same six names.',assert:async()=>{
  await expect(friend.page.getByRole('list',{name:'Crew'}).getByRole('listitem')).toHaveCount(6);await expect(friend.page.getByRole('list',{name:'Crew'}).getByText('Nori',{exact:true})).toHaveCount(1);
 }}]);friend.steps.finish();}
 ws.finish();ls.finish();
});
