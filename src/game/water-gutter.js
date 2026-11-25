import * as THREE from 'three';

const SWING = .32;
export const TIP_TIME = .28;

export function gutterLip(x, baseY, width, height, direction = 1, tilt = 1) {
  const angle = -direction * SWING * tilt;
  const dx = direction * width*.472, dy = height*.26;
  return {x:x+dx*Math.cos(angle)-dy*Math.sin(angle),
    y:baseY+height*.59+dx*Math.sin(angle)+dy*Math.cos(angle)};
}

// 原画上缘是摆动的槽身，下缘是固定支架。转轴取自画上的圆钉。
export function waterGutter(g, x, baseY, width, height) {
  const pivotY = baseY + height*.59;
  const material = g.spriteMaterial('water-gutter');
  const wood = (top, bottom) => {
    const geometry = new THREE.PlaneGeometry(width, height*(bottom-top));
    const uv = geometry.attributes.uv;
    for (let i=0; i<uv.count; i++) uv.setY(i,1-bottom+uv.getY(i)*(bottom-top));
    g.resources.push(geometry);
    const mesh = new THREE.Mesh(geometry,material);
    mesh.position.y = height*(.41-(top+bottom)/2);
    return mesh;
  };
  const support = wood(.54,1);
  support.position.set(x,pivotY+support.position.y,.54);
  g.scene.add(support);
  const trough = new THREE.Group();
  trough.position.set(x,pivotY,.55);
  trough.add(wood(0,.55));
  g.scene.add(trough);
  const inlet = g.sprite(g.spriteMaterial('water-pond'),0,0,width*.55,height*.11,.02);
  trough.add(inlet);
  const lipX = width*.472, lipY = height*.26;

  return function tilt(here, age, direction = 1, isReady = true) {
    support.visible = trough.visible = here;
    if (!here) return null;
    material.color.set(!isReady ? '#969397' : age == null ? '#ffffff' : '#fff1c1');
    const t = age == null ? 0 : g.isReducedMotion ? 1 : Math.min(1, Math.max(0,age)/TIP_TIME);
    const progress = t*t*(3-2*t);
    trough.rotation.z = -direction * SWING * progress;
    inlet.position.x = direction*lipX*.47*t;
    inlet.position.y = height*.11 + lipY*.33*t;
    inlet.rotation.z = direction * Math.atan2(lipY,lipX)*t;
    inlet.scale.x = width*(.44+.08*t);
    return gutterLip(x,baseY,width,height,direction,progress);
  };
}
