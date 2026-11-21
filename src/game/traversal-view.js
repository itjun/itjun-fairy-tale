import { reachableGrips } from './traversal.js';

export const TRAVERSAL_IMAGES = ['desert-grip', 'desert-cave-mouth', 'cave-paper', 'adventure-root-cave'];
export const DESERT_IMAGES = ['desert-face', 'desert-pillar', 'desert-windmill', 'desert-cave-interior', 'terrain-sand',
  'desert-cliff', 'desert-mountain', 'desert-rock-hold', 'desert-cave-ledge', 'desert-cave-pool', 'desert-cave-crag'];

export class TraversalViews {
  constructor(engine) {
    const gripMaterial = engine.spriteMaterial('desert-grip');
    const isDesert = engine.world.themeId === 'desert';
    const cavePaper = engine.spriteMaterial(isDesert ? 'desert-cave-interior' : 'cave-paper');
    this.caveBackdrop = engine.sprite(cavePaper, 0, 0, 1, 1, -15);
    this.caveBackdrop.visible = false;
    const materialFor = new Map([['desert-cave-mouth', engine.spriteMaterial('desert-cave-mouth')]]);
    const artMaterial = name => {
      if (!materialFor.has(name)) materialFor.set(name, engine.spriteMaterial(name));
      return materialFor.get(name);
    };
    this.rooms = new Map();
    for (const room of engine.world.rooms) {
      const route = room.traversal;
      if (!route) continue;
      const cave = route.cave;
      const outside = [], inside = [];
      for (const item of route.art) {
        const z = item.image === 'desert-cave-mouth' ? -.08 : item.image === 'desert-cave-pool' ? -1.1 : -1.6;
        const mesh = engine.sprite(artMaterial(item.image), item.x, item.y, item.width, item.height, z);
        if (cave && item.y < room.fallY) inside.push({ mesh, caveId: item.caveId });
        else outside.push(mesh);
      }
      if (cave && !isDesert) {
        const width = cave.right - cave.left;
        inside.push({ mesh: engine.sprite(artMaterial('adventure-root-cave'), (cave.left + cave.right) / 2, cave.floorY + 4, width + 2.5, 10, -1.65) });
      }
      const points = route.grips.map(point => {
        const material = point.section !== undefined ? artMaterial('desert-rock-hold') : gripMaterial;
        const mesh = engine.sprite(engine.material(material.clone()), point.x, point.y + 1.2, .94, .43, .4);
        return { point, mesh };
      });
      for (const wall of route.walls) {
        const count = Math.max(2, Math.ceil((wall.maxY - wall.minY) / 1.55));
        const positions = wall.isLedge ? [wall.maxY] : Array.from({ length: count }, (_, n) => wall.minY + (wall.maxY - wall.minY) * n / (count - 1));
        const lip = engine.platforms[wall.topId].y - .2;
        for (const y of positions) {
          const material = wall.isNatural ? artMaterial('desert-rock-hold') : gripMaterial;
          const mesh = engine.sprite(engine.material(material.clone()), wall.x - wall.side * .42, Math.min(y + 1.1, lip), .62, .30, .42);
          mesh.rotation.z = -wall.side * .42;
          points.push({ point: wall, mesh });
        }
      }
      this.rooms.set(room.id, { outside, inside, points, route });
      for (const mesh of [...outside, ...inside.map(item => item.mesh), ...points.map(point => point.mesh)]) mesh.visible = false;
    }
  }

  update(roomId, player, x, y, camera) {
    const isInside = !!player.safe?.isCave;
    this.caveBackdrop.visible = isInside;
    if (isInside) {
      const { width, height } = this.caveBackdrop.material.map.image;
      const aspect = width / height;
      const span = Math.max(camera.right * 2 + 8, (camera.top * 2 + 7) * aspect);
      this.caveBackdrop.position.set(x, y - .8, -15);
      this.caveBackdrop.scale.set(span, span / aspect, 1);
    }
    for (const [id, { outside, inside, points, route }] of this.rooms) {
      const isHere = roomId === id;
      const current = isHere && player.grip?.point;
      const reachable = current && !current.side ? reachableGrips(route, current) : [];
      for (const mesh of outside) mesh.visible = isHere && !isInside;
      for (const { mesh, caveId } of inside) mesh.visible = isHere && isInside && caveId === player.safe?.caveId;
      for (const { point, mesh } of points) {
        mesh.visible = isHere && !isInside;
        if (mesh.visible) {
          const isLit = point === current || reachable.includes(point);
          mesh.material.color.setRGB(isLit ? 1.65 : 1, isLit ? 1.35 : 1, isLit ? .74 : 1);
        }
      }
    }
  }
}
