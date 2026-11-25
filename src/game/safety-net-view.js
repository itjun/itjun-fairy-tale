import * as THREE from 'three';
import { netOffset } from './safety-net.js';

export function addNetView(engine, group, net, material) {
  const width = net.width, height = width * .31, segments = 32;
  const geometry = new THREE.PlaneGeometry(width, height, segments);
  engine.resources.push(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  // 原画中心的上网绳距图顶约 43%，把它对齐角色脚底。
  mesh.position.set(0, -height * .07, .3);
  group.add(mesh);
  const position = geometry.attributes.position;
  position.setUsage(THREE.DynamicDrawUsage);
  let lastBend = 0, lastFocus = 0;
  return () => {
    if (!group.visible) return;
    const bend = net.netMotion?.bend ?? 0, focus = net.netMotion?.focus ?? 0;
    if (bend === lastBend && focus === lastFocus) return;
    for (let column = 0; column <= segments; column++) {
      const offset = netOffset(net, net.x + position.getX(column));
      position.setY(column, height / 2 + offset);
      position.setY(column + segments + 1, -height / 2 + offset);
    }
    position.needsUpdate = true;
    lastBend = bend;
    lastFocus = focus;
  };
}
