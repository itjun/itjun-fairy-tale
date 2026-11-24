import * as THREE from 'three';
import { growthFraction } from '../../shared/flower-valley.js';

export const VALLEY_IMAGES = ['water-gutter', 'water-sunflower', 'water-leaf', 'water-lily', 'water-pond', 'water-bank'];

export const WATER_NOTICES = {
  demo: '一片新叶展开了',
  flower: '雨水流到了花根',
  pond: '池塘里的水涨起来了',
  bridge: '叶桥铺回了城门',
};

export function valleyHint(world, state, player) {
  if (world.rooms[state.roomId].kind === 'battle') return state.cleared.includes(state.roomId) ? '栅栏打开了' : '桥头有守卫';
  if (world.rooms[state.roomId].kind === 'boss') return state.cleared.includes(state.roomId) ? '去城门前庆祝' : '花王庭院';
  const water = state.water;
  if (water.demo === null) return '雨水会落在哪里？';
  if (!water.flow) return '跳上水槽的一边试试看';
  if (world.valley.layout === 'aqueduct' && player.y > 9) return water.bridge === null ? '沿高渠往左走' : '沿叶桥向左，城门就在对岸';
  return water.flow === 'flower' ? '花叶伸向山脊' : '荷叶浮出水面';
}

// 地形按固定步长启用碰撞，画面按同一时钟显示叶片展开和水流到达的顺序。
export function addValleyViews(views) {
  const engine = views.engine, world = engine.world, valley = world.valley;
  const materials = new Map();
  const sprite = (name, x, y, width, height, z = -.2) => {
    if (!materials.has(name)) materials.set(name, engine.spriteMaterial(name));
    return engine.sprite(materials.get(name), x, y, width, height, z);
  };
  const watch = (roomId, update) => views.items.push({ roomId, update });
  // 细水槽在河岸前方。浅色底线一直显示，蓝色水线和高光沿实际引水方向前进。
  function stream(points, roomId, enabled, width = .1, color = '#29a4da') {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,y]) => new THREE.Vector3(x,y,.4)));
    const steps = 44;
    const vertices = [], indices = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, p = curve.getPoint(t), d = curve.getTangent(t);
      const w = width * (.95 + .11 * Math.cos(i * 1.4));
      vertices.push(p.x-d.y*w,p.y+d.x*w,.4,p.x+d.y*w,p.y-d.x*w,.4);
      if (i) { const j = i*2; indices.push(j-2,j-1,j,j-1,j+1,j); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices); engine.resources.push(geometry);
    const mesh = new THREE.Mesh(geometry, engine.material(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, depthWrite: false })));
    engine.scene.add(mesh);
    const beads = Array.from({length:color === '#61923f' ? 0 : 4}, () => sprite('magic-bubble',0,0,.22,.29,.43));
    watch(roomId, (state, current) => {
      const start = enabled(state.water);
      mesh.visible = current && start !== null;
      const amount = mesh.visible ? Math.min(1, Math.max(0,(engine.elapsed - start) / .4)) : 0;
      geometry.setDrawRange(0, Math.floor(steps * amount) * 6);
      beads.forEach((bead,i) => {
        const t = ((engine.isReducedMotion ? .3 : engine.elapsed * .72) + i / beads.length) % 1;
        bead.visible = mesh.visible && t < amount;
        if (bead.visible) { const p = curve.getPoint(t); bead.position.set(p.x,p.y,.44); }
      });
    });
  }
  const {left,right,y} = valley.pool;
  const pond = sprite('water-pond',(left+right)/2,y-1,(right-left)+1,2.4,-.45);
  watch(0, (state,current) => {
    const since = state.water.pond;
    const amount = since === null ? 0 : Math.min(1, (engine.elapsed - since) / 1.4);
    pond.visible = current;
    pond.scale.y = .35 + 2.05 * amount;
    pond.position.y = y - 1.8 + amount * 1.7;
  });
  for (const bed of valley.beds) {
    const flower = sprite('water-sunflower',bed.x,bed.y,1,1,-.14);
    watch(bed.roomId, (state,current) => {
      const since = state.water[bed.channel];
      const amount = since === null ? 0 : Math.min(1, Math.max(0, (engine.elapsed-since-.15) / .8));
      const height = 1.5 + (bed.height-1.5)*amount;
      flower.visible = current;
      flower.scale.set(height * .58,height,1);
      flower.position.y = bed.y + height/2;
    });
  }
  // 把同一根花茎连接到相邻的叶台，分水后每节才长出来。
  const vineParts = world.platforms.filter(p => p.roomId === 0 && p.channel === 'flower');
  vineParts.forEach((p,i) => {
    const source = vineParts[i-1] || {x:22.9,y:0};
    stream([[source.x,source.y-.75],[(source.x+p.x)/2,(source.y+p.y)/2-1],[p.x,p.y-.65]],0,
      water => water.flower === null ? null : water.flower + p.delay,.095,'#61923f');
  });

  const first = valley.controls[0];
  const cloud = sprite('platform-cloud',first.x-1,first.y+6.7,4.3,1.6,-.3);
  watch(0, (_,current) => { cloud.visible = current; });
  stream([[first.x-.5,first.y+6.25],[first.x-.3,first.y+4.5],[first.x,first.y+1.1]],0,() => 0,.13);
  stream([[first.x+1.15,first.y+1.05],[4.1,first.y+.85],[4.9,first.y*.5+.45],[5.45,.08]],0,water => water.demo,.23);
  const forkX = valley.forkX;
  const forkCloud = sprite('platform-cloud',forkX-1,6.1,4.3,1.6,-.3);
  watch(0, (_,current) => { forkCloud.visible = current; });
  stream([[forkX-.5,5.55],[forkX-.15,4.1],[forkX,2.25]],0,() => 0,.07);
  stream([[forkX+2.3,2],[21.5,1.7],[22.1,.7],[22.9,.08]],0,
    water => water.flow === 'flower' ? water.flower : null,.15);
  stream([[forkX-2,2],[15.5,1],[16,-.8],[22,-1.6],[26,-3.5]],0,
    water => water.flow === 'pond' ? water.pond : null,.15);
  if (valley.layout === 'aqueduct') {
    stream([[22.2,15.35],[20.1,14.6],[16.8,13.9],[12.3,13.5]],0,water => water.bridge,.14);
  }

  const gutters = [{x:first.x,y:first.y,key:'demo'}, {x:forkX,y:0,key:'fork'}];
  const upper = valley.controls.find(item => item.channel === 'bridge');
  if (upper) gutters.push({x:upper.x,y:upper.y,key:'bridge'});
  for (const item of gutters) {
    const fork = item.key === 'fork', width = fork ? 6.8 : 3.5, height = width / 2.6;
    const gutter = sprite('water-gutter',item.x,item.y+height*.46,width,height,.34);
    watch(0,(state,current) => {
      gutter.visible = current;
      const active = fork ? state.water.flow : state.water[item.key] !== null;
      gutter.rotation.z = active ? (active === 'pond' || item.key === 'bridge' ? .14 : -.14) : 0;
    });
  }
  for (const p of world.platforms.filter(platform => platform.channel)) {
    const group = engine.platformViews.get(p.id);
    watch(p.roomId, (state,current) => {
      const amount = growthFraction(p,state.water,engine.elapsed);
      group.visible = current && amount > 0;
      group.scale.set(Math.max(.01,amount),Math.max(.01,amount),1);
      group.position.y = p.y - (1-amount) * (p.channel === 'pond' ? 1.15 : .5);
    });
  }
}
