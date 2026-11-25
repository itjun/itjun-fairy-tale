import { waterCourse } from './water-course.js';
import { channelPool, waterEffects } from './water-effects.js';

export function addChannelWater(views, room, sources, {left, right, surface, depth = 3.2}) {
  const g = views.engine, river = channelPool(g, left, right, surface, depth);
  const createPart = waterEffects(g);
  const platforms = room.platformIds.map(id => g.world.platforms[id]);
  const outlets = sources.map(source => ({ source, parts: [] }));
  views.items.push({roomId:room.id, update(state, here) {
    const visible = here && g.players[0].safe?.caveId === sources[0].caveId;
    river.visible = visible;
    let rise = 0;
    for (const outlet of outlets) {
      const {source, parts} = outlet;
      const start = source.at(state);
      if (source.wheel) source.wheel.visible = visible;
      if (!visible || start == null) {
        for (const part of parts) part.ribbon.visible = part.splash.visible = false;
        if (source.wheel) source.wheel.rotation.z = 0;
        outlet.course = null;
        continue;
      }
      // 沙漠的泉眼在石槽里，水直接落入槽内。花园的露天水路逐层接水。
      const course = waterCourse(source, source.isBasin ? [] : platforms, surface);
      const last = course.at(-1);
      const arrival = last ? last.start + last.duration : 0;
      const age = g.isReducedMotion ? arrival+2 : Math.max(0,g.elapsed-start);
      rise = Math.max(rise, Math.min(1, Math.max(0,(age-arrival)/1.15))*.45);
      outlet.course = course;
      outlet.age = age;
      if (source.wheel) {
        const wheelAge = Math.max(0,age-(source.wheel.position.x-source.x)/source.vx);
        source.wheel.rotation.z = g.isReducedMotion ? -.4 : -2.6*(wheelAge-(1-Math.exp(-3*wheelAge))/3);
      }
    }
    if (!visible) return;
    river.material.uniforms.clock.value = g.isReducedMotion ? 0 : g.elapsed;
    river.position.y = surface - depth/2 + rise;
    for (const {source, parts, course, age} of outlets) {
      if (!course) continue;
      // 多个槽口共用此刻的水位，最后一段的水花跟随水面。
      const path = rise ? waterCourse(source, source.isBasin ? [] : platforms, surface+rise) : course;
      for (let i=0; i<path.length; i++) {
        const part = parts[i] ||= createPart();
        part.update(path[i], age, i===path.length-1, i ? .77 : 1);
      }
      for (let i=path.length; i<parts.length; i++) parts[i].ribbon.visible = parts[i].splash.visible = false;
    }
  }});
}
