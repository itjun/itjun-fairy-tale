import { heal, resourcesFor } from './expedition.js';

export function hazardState(hazard, elapsed) {
  const beat=(elapsed+hazard.phase)%hazard.period;
  const isWarning=beat<hazard.warning, isActive=beat>=hazard.warning&&beat<hazard.warning+hazard.active;
  const swing=Math.sin(elapsed*1.25+hazard.phase)*.7;
  const fallingY=hazard.y+5-Math.max(0,(beat-hazard.warning)/hazard.active)*5;
  return {isWarning,isActive,angle:swing,x:hazard.x+(hazard.kind==='pendulum'?Math.sin(swing)*hazard.length:0),y:hazard.kind==='icicle'?fallingY:hazard.y+(hazard.kind==='pendulum'?hazard.length-Math.cos(swing)*hazard.length+1:0)};
}
export function stepMechanisms(world, player, elapsed, dt) {
  for(const p of world.platforms){
    if(p.isCrumbling){
      if(player.ground?.id===p.id&&p.collapseAt===undefined)p.collapseAt=elapsed+2.2;
      if(p.collapseAt!==undefined){p.isEnabled=elapsed<p.collapseAt||elapsed>=p.collapseAt+4;if(elapsed>=p.collapseAt+4)delete p.collapseAt;}
    }
    if(p.isSeesaw){const previous=p.slope;const target=player.ground?.id===p.id?Math.max(-.22,Math.min(.22,-(player.x-p.x)*.06)):0;p.slope+=Math.max(-dt*.25,Math.min(dt*.25,target-p.slope));if(player.ground?.id===p.id)player.y+=(player.x-p.x)*(p.slope-previous);}
  }
}
export function touchingHazard(player,hazard,elapsed){
  if(player.protection>0)return false;
  const state=hazardState(hazard,elapsed);
  if(hazard.kind==='pendulum')return Math.abs(player.x-state.x)<1.2&&Math.abs(player.y+.8-state.y)<1.4;
  if(hazard.kind==='icicle')return state.isActive&&Math.abs(player.x-hazard.x)<1.1&&Math.abs(player.y+.8-state.y-.8)<1.6;
  return state.isActive&&Math.abs(player.x-hazard.x)<1.3&&player.y<hazard.y+(hazard.kind==='thorns'?1.2:3)&&player.y+1.6>hazard.y;
}
export function takeLifeSupply(world,claimed,player,survival,adventure,powers={}){
  const item=world.supplies?.find(s=>!claimed.includes(s.id)&&Math.abs(player.x-s.x)<1&&Math.abs(player.y+.8-s.y)<1.5);
  if(!item||survival.phase!=='alive')return null;
  if(!heal(survival)){
    if(!adventure||!powers.snack||resourcesFor(adventure).snack)return null;
    adventure.resources.snack=1;
  }
  claimed.push(item.id);return item;
}
export function mechanismSave(world){return world.platforms.filter(p=>p.collapseAt!==undefined||p.isSeesaw).map(p=>({id:p.id,...(p.collapseAt!==undefined?{collapseAt:p.collapseAt}:{}),...(p.isSeesaw?{slope:p.slope}:{})}));}
export function restoreMechanisms(world,states,elapsed){for(const saved of states||[]){const p=world.platforms[saved.id];if(saved.collapseAt!==undefined){p.collapseAt=saved.collapseAt;p.isEnabled=elapsed<p.collapseAt||elapsed>=p.collapseAt+4;}if(saved.slope!==undefined)p.slope=saved.slope;}}
