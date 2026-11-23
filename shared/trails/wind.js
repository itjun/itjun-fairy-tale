import { hasMark } from './field-progress.js';

// Wind only catches an airborne player. A child can stand still at the base,
// jump into the stream, steer across it, or drop out over the safe path below.
export function pushInWind(room,marks,player,dt) {
  if(player.isGrounded || player.grip || player.crawl)return false;
  for(const jet of room.wind||[]) {
    if(jet.after && !hasMark(room,marks,jet.after))continue;
    if(Math.abs(player.x-jet.x)>jet.width/2 || player.y<jet.y-.35 || player.y>jet.y+jet.height)continue;
    player.x+=jet.dx*dt;
    player.vy=Math.max(player.vy,jet.dy);
    player.fallPeak=player.y;
    return true;
  }
  return false;
}
