import * as THREE from 'three';

// 水面和出水口都取自同一张彩笔池塘。宽水面往返取中段，保留两端的岸线。
function waterRibbon(g, material, curve, width, depth, sections) {
  const vertices = [], uv = [], indices = [];
  for (let i = 0; i <= sections; i++) {
    const t = i / sections, point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const radius = width / 2;
    const u = i === 0 ? 0 : i === sections ? 1 : i % 2 ? .78 : .22;
    for (const side of [1, -1]) {
      vertices.push(point.x - tangent.y * radius * side, point.y + tangent.x * radius * side, 0);
      uv.push(u, side === 1 ? 1 : 0);
    }
    if (i) { const j = i * 2; indices.push(j-2,j-1,j,j-1,j+1,j); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  g.resources.push(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = depth;
  g.scene.add(mesh);
  return mesh;
}

export function addChannelWater(views, room, sources, {left, right, surface, depth = 3.2}) {
  const g = views.engine, water = g.spriteMaterial('water-pond');
  const middle = surface - depth / 2;
  const river = waterRibbon(g, water, new THREE.LineCurve(new THREE.Vector2(left,middle), new THREE.Vector2(right,middle)),
    depth, -.32, Math.max(4, Math.ceil((right-left)/11)));
  const foam = g.material(new THREE.MeshBasicMaterial({color:0xc0f5ff}));
  const outlets = sources.map(({x, y, lip, at, wheel}) => {
    // 出水口绕过台边，在下方水面收住。水和地形前后分层，荷叶上仍能看清落脚点。
    const landing = Math.max(x+2.3, lip+.65);
    const curve = new THREE.CatmullRomCurve3([
      [x,y], [x+.55,y+.08], [landing-.5,y-.4], [landing,y-1],
      [landing+.35, Math.min(y-1.1,(surface+y)/2)], [landing+.52,surface-.28]
    ].map(([a,b])=>new THREE.Vector3(a,b,0)));
    const jet = waterRibbon(g,water,curve,.52,.10,32);
    const streaks = Array.from({length:Math.max(2,Math.ceil(curve.getLength()/2.2))},()=>g.sprite(foam,0,0,.32,.045,.115));
    const drops = Array.from({length:4},()=>g.sprite(foam,0,0,.10,.22,.12));
    return {jet,curve,streaks,drops,at,wheel,landing};
  });
  const point = new THREE.Vector3(), tangent = new THREE.Vector3();
  views.items.push({roomId:room.id,update(state,here) {
    const player = g.players[0];
    const visible = here && player.safe?.caveId === sources[0].caveId;
    river.visible = visible;
    let rise = 0;
    for (const {jet,curve,streaks,drops,at,wheel,landing} of outlets) {
      const start = at(state);
      const open = start != null;
      const age = open ? Math.max(0,g.elapsed-start) : 0;
      const amount = open && g.isReducedMotion ? 1 : Math.min(1,age/.46);
      jet.visible = visible && open;
      if (jet.visible) jet.geometry.setDrawRange(0, Math.max(1,Math.ceil(32*amount))*6);
      for (const [i, streak] of streaks.entries()) {
        const t=((g.isReducedMotion ? .13 : age*.7)+i/streaks.length)%1;
        streak.visible=jet.visible && t<amount;
        if (!streak.visible) continue;
        curve.getPointAt(t,point);curve.getTangentAt(t,tangent);
        streak.position.set(point.x,point.y,.115);
        streak.rotation.z=Math.atan2(tangent.y,tangent.x);
      }
      if (wheel) {
        wheel.visible = visible;
        wheel.rotation.z = open ? (g.isReducedMotion ? -.4 : -age*2.6) : 0;
      }
      const fill = Math.min(1, Math.max(0,(age-.3)/1.15));
      rise = Math.max(rise, open && g.isReducedMotion ? 1 : fill);
      drops.forEach((drop,i)=>{
        drop.visible = jet.visible && amount >= 1;
        if (!drop.visible) return;
        const phase = ((g.isReducedMotion ? .34 : age*1.65)+i/drops.length)%1;
        drop.rotation.z = (i%2 ? -1 : 1)*.6;
        drop.position.set(landing+.52+(i%2 ? 1 : -1)*phase*(.55+i*.16),
          surface + fill*.45 + 2.7*phase*(1-phase), .12);
      });
    }
    river.position.y = rise*.45;
  }});
}
