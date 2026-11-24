import { addChannelWater } from './channel-water.js';

// 大多数触点能从器材或任务本身认出来。复用同一张图但做不同动作的触点在地图上指定 reaction。
export function fieldReaction(stop) {
  if (stop.reaction) return stop.reaction;
  if (stop.icon === 'oasis-jug') return 'fill';
  if (stop.carryUntil) return 'carry';
  if (stop.display) return 'serve';
  if (stop.atDock !== undefined) return stop.icon === 'rail-signal' ? 'signal' : 'ride';
  return {
    'rail-signal':'signal', 'rail-switch':'lever', 'platform-gear':'turn',
    'oasis-mirror':'mirror', 'oasis-map':'unfold', 'oasis-well':'pour',
    'meadow-ribbon':'flag', 'meadow-kite':'fly', 'meadow-letter':'deliver',
    'rail-parcel':'deliver', 'bridge-rope':'untie', 'mini-gem-orange':'flag',
  }[stop.icon];
}

export function addFieldReaction(views,room,stop,item,sprite) {
  const g=views.engine, p=g.world.platforms[stop.platformId], kind=fieldReaction(stop);
  const x=p.x+(stop.offset||0), size=stop.size||2.25;
  const at=state=>state.field[room.id+'/'+stop.key];
  if (kind==='pour' || kind==='fill') {
    const isPour=kind==='pour';
    const spout=x+(isPour?.72:-1.1);
    addChannelWater(views,room,[{x:spout,y:p.y+1.15,lip:spout+.7,caveId:p.caveId,at}],
      {left:x-3,right:x+(isPour?10:5),surface:p.y-.65,depth:isPour?1.45:1});
  }
  const tower=kind==='beam' && room.props.find(prop=>prop.icon==='island-lighthouse' && Math.abs(prop.x-x)<2);
  const oven=kind==='heat' && room.props.find(prop=>prop.icon==='kitchen-oven' && Math.abs(prop.x-x)<2);
  const beam=kind==='beam' && sprite('lantern-beam',x,p.y,9,2.1,-.55);
  const flame=kind==='heat' && sprite('oven-flame',oven?.x??x,p.y+1.45,2.9,2.5,-.65);
  const flag=kind==='flag' && stop.icon!=='meadow-ribbon' && sprite('meadow-ribbon',x,p.y,2.5,2.5,.48);
  const light=kind==='signal' && views.glow(x,p.y);
  const vapor=kind==='heat' && sprite('tidal-cloud',(oven?.x??x)+1,p.y+4.2,1.5,.85,-.68);
  const onVehicle=stop.atDock!==undefined;
  return (state,here,carrying)=>{
    const start=at(state), done=start!==undefined;
    const age=done?Math.max(0,g.elapsed-start):0;
    const settle=g.isReducedMotion?1:Math.min(1,age/.55);
    const time=g.isReducedMotion?0:age;
    const show=here && done;
    if(beam) {
      beam.visible=show;
      if(show) {
        const angle=.08*Math.sin(time*1.5);
        // 灯室在原画靠右、靠上的位置，光束起点贴在灯芯上。
        const sourceX=tower?tower.x+tower.width*.22:x, sourceY=tower?tower.y+tower.height*.81:p.y+size*.6;
        beam.position.set(sourceX-4.1*Math.cos(angle),sourceY-4.1*Math.sin(angle),-.55);
        beam.rotation.z=angle;beam.scale.x=-9;
      }
    }
    if(flame) {
      flame.visible=vapor.visible=show;
      flame.scale.y=2.5+Math.sin(time*10)*.19;
      const drift=g.isReducedMotion?.5:(time*.62)%1;
      vapor.position.y=p.y+4.1+drift*1.3;vapor.scale.x=1.35+drift;
    }
    if(light) {
      light.visible=show && (!onVehicle || age<1.5);
      light.scale.set(1.4,1.4,1);light.position.set(p.x+(stop.offset||0),p.y+size*.57,.7);
      light.material.color.set(stop.atDock<1?'#ff6961':'#6fef86');
    }
    if(flag) {
      flag.visible=show;
      flag.position.set(p.x,p.y+1+settle,.5);
      flag.rotation.z=.09*Math.sin(time*4.5);
    }
    if(!show || stop.carryUntil && !carrying) return;
    if(carrying) {
      // 从触点飞到手边，交付后沿用柜台、邮箱或站房自己的成品。
      const end=item.position;
      end.x=x+(end.x-x)*settle;
      end.y=p.y+size*.55+(end.y-p.y-size*.55)*settle+Math.sin(settle*Math.PI)*.75;
      if(stop.icon==='meadow-kite') {end.y+=.95;item.rotation.z=.12*Math.sin(time*4);}
      if(kind==='fill') item.rotation.z=(1-settle)*-.7;
      return;
    }
    if(onVehicle) {
      // 站点图标随车，到站后在车上短暂停留，再让出视线给下一站。
      item.visible=age<1.4;
      item.position.y+=settle*.65;
      return;
    }
    item.visible=true;
    switch(kind) {
      case 'turn': item.rotation.z=g.isReducedMotion?-.65:-age*2.7;break;
      case 'weight': item.position.y-=settle*.8;item.rotation.z=-.48*settle;break;
      case 'lever': item.scale.x=-size;item.position.x-=1;break;
      case 'mirror': item.rotation.z=-.36*settle;break;
      case 'unfold': item.scale.x=size*(1+settle*.45);item.rotation.z=.18*settle;break;
      case 'flag': item.visible=!flag;item.rotation.z=.14+.1*Math.sin(time*4);item.position.y+=settle*.6;break;
      case 'fly': item.position.y+=settle*2.3+.2*Math.sin(time*3);item.rotation.z=.2+.15*Math.sin(time*2);break;
      case 'untie': item.rotation.z=-.85*settle;item.position.y-=.68*settle;break;
      case 'stamp': item.position.y-=.58*Math.sin(settle*Math.PI);item.rotation.z=.36*settle;break;
      case 'deliver': item.position.x+=settle*.95;item.position.y-=settle*.45;break;
      case 'heat': item.visible=false;break;
    }
  };
}
