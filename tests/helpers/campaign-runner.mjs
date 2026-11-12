import {createCampaignWorld} from '../../shared/campaign.js';
import {createPlayer,stepPlayer} from '../../src/game/physics.js';
import {moveCampaignPlatforms} from '../../src/game/combat.js';
import {touchSpring} from '../../src/game/enemies.js';
export function play(id,seed=42,version=1){
 const w=createCampaignWorld(seed,id,version),p=createPlayer(w.start);let elapsed=0,idx=0,lastAdvance=0;const visited=new Set(),collected=new Set();
 for(let frame=0;frame<120*1800;frame++){
  elapsed+=1/120;moveCampaignPlatforms(w.lifts,elapsed);
  const next=w.platforms[w.mainPath[idx+1]];if(!next)return {id,seconds:Math.round(elapsed),recoveries:p.recoveries,visited:visited.size,collected:collected.size,required:w.requiredFlowers,total:w.zones.length};
  const routeDirection=Math.sign(next.x-w.platforms[w.mainPath[idx]].x);
  const aim=next.x+routeDirection*(next.width/2-0.6);
  let direction=Math.sign(aim-p.x),jump=false,drop=false;
  if(p.isGrounded){
   const ground=p.ground,index=w.mainPath.indexOf(ground.id);
   if(index>idx){idx=index;lastAdvance=elapsed;continue;}
   const delta=next.x-p.x;
   if(next.isMoving && (Math.abs(next.y-p.y)>2 || Math.abs(delta)>ground.width/2+next.width/2+3)) direction=0;
   else if(ground.isMoving) { if(next.y-ground.y>2 || Math.abs(delta)>7)direction=0;else jump=true; }
   else if(ground.isBranch && ground.y>next.y && Math.abs(delta)<next.width/2){direction=0;drop=true;}
   else if(ground.id!==next.id){
    const launch=ground.x+direction*Math.min(ground.width/2-0.65,1.3);
    if((launch-p.x)*direction<=0.05)jump=true;
   }
  }
  const near=w.platforms.filter(a=>Math.abs(a.x-p.x)<25);
  const result=stepPlayer(p,{direction,jump,drop},near,1/120,w);
  if(result.isRescued){idx=Math.max(0,w.mainPath.indexOf(p.safe.id));lastAdvance=elapsed;}
  if(p.ground){const index=w.mainPath.indexOf(p.ground.id);if(index>idx){idx=index;lastAdvance=elapsed;}}
  for(const s of w.springs)touchSpring(p,s);
  for(const s of w.switches)if(p.ground?.id===s.platformId&&Math.abs(p.x-s.x)<1){s.isOpen=true;w.platforms[s.bridgeId].isEnabled=true;}
  if(p.ground?.milestone)visited.add(p.ground.milestone);
  for(const t of w.treasures)if(Math.abs(t.x-p.x)<0.9&&Math.abs(t.y-p.y-0.9)<1.25)collected.add(t.id);
  if(elapsed-lastAdvance>15)return {id,failed:idx,next:next.id,ground:p.ground?.id,pos:[p.x,p.y],target:[next.x,next.y],recoveries:p.recoveries};
 }
 return {id,failed:'timeout'};
}
