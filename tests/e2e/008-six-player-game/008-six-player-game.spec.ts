import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';
test('six friends complete three dives and share victory', async ({players},info)=>{
 const crew: {page: Awaited<ReturnType<typeof players.create>>; name: string; steps: TestSteps}[]=[];
 for(const name of ['Mira','Sol','Kai','Luz','Nori','Pip']){
  const page=await players.create(393);
  const steps=new TestSteps(page,info,'Six friends dive together','Every friend plays all three dives and agrees on the shared result.',name.toLowerCase(),'game');
  crew.push({page,steps,name});
 }
 const host=crew.at(0)!.page;
 await host.goto('./rooms/');await host.getByLabel('Your name').fill('Mira');await host.getByRole('button',{name:'Create room',exact:true}).click();
 await expect(host.getByText('Mira (You) · Host',{exact:true})).toBeVisible();
 await Promise.all(crew.slice(1).map(async friend=>{await friend.page.goto(host.url());await friend.page.getByLabel('Your name').fill(friend.name);}));
 for(const friend of crew.slice(1)){
  await friend.page.getByRole('button',{name:'Join room'}).click();
  await expect(friend.page.getByRole('button',{name:'Ready up'})).toBeEnabled();
 }
 for(const friend of crew)await expect(friend.page.getByRole('list',{name:'Crew'}).getByRole('listitem')).toHaveCount(6);
 await Promise.all(crew.map(friend=>friend.page.getByRole('button',{name:'Ready up'}).click()));
 await host.getByRole('button',{name:'Start dive'}).click();
 for(const [index,moves] of [[{"seat":0,"back":false,"choice":"pass"},{"seat":1,"back":false,"choice":"pass"},{"seat":2,"back":false,"choice":"pass"},{"seat":3,"back":false,"choice":"pass"},{"seat":4,"back":false,"choice":"pass"},{"seat":5,"back":false,"choice":"pass"},{"seat":0,"back":true,"choice":null},{"seat":1,"back":true,"choice":null},{"seat":2,"back":true,"choice":null},{"seat":3,"back":true,"choice":"pass"},{"seat":4,"back":true,"choice":null},{"seat":5,"back":true,"choice":null},{"seat":3,"back":false,"choice":null}],[{"seat":3,"back":false,"choice":"pass"},{"seat":4,"back":false,"choice":"pass"},{"seat":5,"back":false,"choice":"pass"},{"seat":0,"back":false,"choice":"pass"},{"seat":1,"back":false,"choice":"pass"},{"seat":2,"back":false,"choice":"pass"},{"seat":3,"back":true,"choice":null},{"seat":4,"back":true,"choice":null},{"seat":5,"back":true,"choice":null},{"seat":0,"back":true,"choice":"pass"},{"seat":1,"back":true,"choice":null},{"seat":2,"back":true,"choice":null},{"seat":0,"back":false,"choice":null}],[{"seat":0,"back":false,"choice":"pass"},{"seat":1,"back":false,"choice":"pass"},{"seat":2,"back":false,"choice":"pass"},{"seat":3,"back":false,"choice":"pass"},{"seat":4,"back":false,"choice":"pass"},{"seat":5,"back":false,"choice":"pass"},{"seat":0,"back":true,"choice":null},{"seat":1,"back":true,"choice":null},{"seat":2,"back":true,"choice":null},{"seat":3,"back":true,"choice":null},{"seat":4,"back":true,"choice":null},{"seat":5,"back":true,"choice":null}]].entries()){
  const roll = async (move: typeof moves[number]) => {
   const actor=crew.at(move.seat)!.page;
   if(move.back)await actor.getByLabel('Turn back',{exact:true}).check();
   await actor.getByRole('button',{name:'Roll dice'}).click();
  };
  let rolled=roll(moves.at(0)!);
  for(const [position,move] of moves.entries()){
   await rolled;
   const actor=crew.at(move.seat)!.page,next=moves.at(position+1);
   const landing=move.choice?actor.getByRole('button',{name:'Leave it',exact:true}).click():Promise.resolve();
   rolled=next?roll(next):Promise.resolve();
   await Promise.all([landing,rolled]);
  }
  if(index<2)await host.getByRole('button',{name:'Continue to dive '+(index+2),exact:true}).click();
 }
 await Promise.all(crew.map(async friend=>{
  await friend.steps.step('shared-result','Six divers share the result',[{description:'All six names and three dive scores agree, with no fourth dive.',assert:async()=>{
   await expect(friend.page.getByRole('heading',{name:'Mira & Sol & Kai & Luz & Nori & Pip share victory!',exact:true})).toBeVisible();
   for(const other of crew)await expect(friend.page.getByRole('row',{name:other.name+(other.name===friend.name?' (You)':'')+' 0 0 0 0',exact:true})).toBeVisible();
   await expect(friend.page.getByRole('button',{name:'Play again',exact:true})).toBeEnabled();
  }}]);friend.steps.finish();
 }));
});
