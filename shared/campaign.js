import { expandEncounters } from './encounters.js';
import { createRogueliteWorld } from './roguelite-world.js';
import { createBossWorld } from './boss-world.js';
import { expandAdventureWorld } from './adventure-world.js';
import { randomGenerator } from './random.js';
import { COLLECTIBLES, LEVEL_COLLECTIBLES, collectionPoints } from './collectibles.js';

// 版本 1 的种子规则随存档保留；后续生成规则变更必须新增版本。
export const GENERATION_VERSION = 1;
export const ENEMY_POINTS = Object.freeze({ jelly: 10, leaf: 15, puff: 20 });
export const CAMPAIGNS = Object.freeze({
  rainbow: { index: 0, steps: 31, name: '花田与彩虹山丘', regions: ['花田缓坡', '拱桥花径', '彩虹山丘'], kinds: ['hill', 'arches', 'terraces'], hint: '跟着旗子翻过花丘，J 使用已装备的武器。' },
  family: { index: 1, steps: 34, name: '街巷与屋顶穿行', regions: ['门前街道', '遮阳棚', '屋顶小桥', '钟楼广场'], kinds: ['awnings', 'roofs', 'alleys'], hint: '从遮阳棚跳上屋顶，再沿小巷穿过小镇。' },
  sweet: { index: 2, steps: 37, name: '城堡机关探险', regions: ['糖果庭院', '饼干大厅', '星星开桥', '冰淇淋地窖', '屋顶花园'], kinds: ['conveyor', 'gate', 'cellar'], hint: '踩亮星星打开桥，弹簧花送你回到屋顶。' },
  beach: { index: 3, steps: 39, name: '群岛与移动木筏', regions: ['沙滩小湾', '浅滩踏石', '木筏航道', '沙堡岛', '木栈群岛', '灯塔岛'], kinds: ['islands', 'raft', 'pier'], hint: '搭上小木筏，沿群岛找到灯塔。' },
  meadow: { index: 4, steps: 38, name: '风车山谷', regions: ['田埂', '花田沟壑', '风车升降', '山谷', '弹跳花坡', '山脊桥', '观景台'], kinds: ['valley', 'windmill', 'springs'], hint: '乘风车台升高，借弹簧花跃过山谷。' },
  snow: { index: 5, steps: 41, name: '冰洞与雪山滑道', regions: ['雪坡', '缓滑冰面', '雪洞', '冰阶', '横移冰台', '下坡道', '冰桥', '雪人营地'], kinds: ['ice', 'snowcave', 'iceferry'], hint: '冰面会缓缓滑动，雪地可以稳稳停下。' },
  forest: { index: 6, steps: 40, name: '树根到树冠', regions: ['林间入口', '蘑菇弹跳', '树根洞', '树干内层', '双叶升降', '树间主枝', '蘑菇登高', '树冠吊桥', '猫头鹰树屋'], kinds: ['roots', 'trunk', 'canopy'], hint: '穿树洞、搭叶台，沿树冠找到树屋。' },
  cartoon: { index: 7, steps: 43, name: '玩具机关接力', regions: ['积木入口', '玩具传送带', '齿轮升降', '恐龙足迹', '弹簧车间', '纸箱落差', '气球平台', '火箭塔', '彩虹栈桥', '派对终点'], kinds: ['blocks', 'factory', 'balloons', 'rocket'], hint: '跳过积木与机关，去参加终点派对。' },
});

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

function generate(seed, levelId, attempt) {
  const profile = CAMPAIGNS[levelId];
  if (!profile) throw new Error('找不到这个世界');
  const terrain = randomGenerator((seed ^ 0x16a8be31 ^ Math.imul(attempt, 0x45d9f3b)) >>> 0);
  const rewards = randomGenerator((seed ^ 0x27c45ab1) >>> 0);
  const monsters = randomGenerator((seed ^ 0x65b8c234) >>> 0);
  const world = { version: GENERATION_VERSION, seed, levelId, route: levelId, attempt, platforms: [], treasures: [], enemies: [], springs: [], lifts: [], switches: [], zones: [], milestones: [], decorations: [], mainPath: [], edges: [] };
  let cursor;
  function add(x, y, width = 5.8, extra = {}) {
    const p = { id: world.platforms.length, x, y, width, isOneWay: true, zone: Math.max(0, world.zones.length - 1), ...extra };
    world.platforms.push(p); return p;
  }
  function main(dx, dy, extra = {}) {
    const p = add(cursor.x + dx, cursor.y + dy, 5.8 + terrain() * 0.8, extra);
    world.edges.push({ from: cursor.id, to: p.id, kind: 'jump' });
    world.mainPath.push(p.id); cursor = p; return p;
  }
  function elevator(axis, distance, skin) {
    const before = cursor;
    const p = add(before.x + 4.5, before.y, 5.6, { isMoving: true, axis, baseX: before.x + 4.5, baseY: before.y, travel: distance, period: 5.5, phase: 0, skin });
    world.lifts.push(p); world.mainPath.push(p.id);
    world.edges.push({ from: before.id, to: p.id, kind: 'board' });
    cursor = p;
    const after = main(axis === 'x' ? distance + 4.5 : 4.5, axis === 'y' ? distance : 0);
    world.edges.at(-1).kind = 'ride';
    return after;
  }
  function spring() {
    const p = cursor;
    world.springs.push({ x: p.x, y: p.y, platformId: p.id, power: 18 });
    main(4.8, 6.2); world.edges.at(-1).kind = 'spring';
  }
  function gate() {
    const before = cursor;
    const bridge = main(7, 0, { width: 8, isBridge: true, gateId: world.switches.length, isEnabled: false });
    world.switches.push({ id: world.switches.length, x: before.x, y: before.y, platformId: before.id, bridgeId: bridge.id, isOpen: false });
    main(7, 0); world.edges[world.edges.length - 2].kind = 'gate';
  }
  world.start = cursor = add(0, 0, 12, { isCheckpoint: true, isOneWay: false, zone: 0 });
  world.mainPath.push(cursor.id);
  const regionNames = [profile.regions[0], ...shuffled(profile.regions.slice(1, -1), terrain), profile.regions.at(-1)];
  const kindOrder = shuffled(profile.kinds, terrain);
  for (let zoneIndex = 0; zoneIndex < profile.regions.length; zoneIndex++) {
    const kind = kindOrder[zoneIndex % kindOrder.length];
    const zone = { id: zoneIndex, name: regionNames[zoneIndex], kind, startId: cursor.id, minX: cursor.x, baseY: cursor.y, platformIds: [], targetSeconds: 34 + profile.index * 2 };
    world.zones.push(zone);
    const firstId = world.platforms.length;
    const phase = Math.floor(terrain() * 3);
    const steps = profile.steps + Math.floor(terrain() * 4);
    const isMirroredSlope = terrain() < 0.5;
    // 各主题有独立的纵向曲线与机关组合；段内也抽取不同的转折点。
    for (let n = 0; n < steps; n++) {
      const cycle = ((n + phase) % 12 + (isMirroredSlope && n >= 12 ? 6 : 0)) % 12;
      let dy = 0, dx = 6.3 + terrain() * 0.8;
      const extra = {};
      if (kind === 'hill') dy = cycle < 5 ? 1.7 : cycle < 10 ? -1.7 : 0;
      if (kind === 'arches') { dy = cycle < 4 ? 2 : cycle < 8 ? -2 : 0; extra.isBridge = cycle >= 4 && cycle < 7; }
      if (kind === 'terraces') dy = cycle < 3 ? 2.2 : cycle < 6 ? 0 : cycle < 9 ? -2.2 : 0;
      if (kind === 'awnings') { dy = cycle < 5 ? 1.8 : cycle === 5 ? -3.6 : cycle >= 9 ? -1.8 : 0; extra.skin = 'awning'; }
      if (kind === 'roofs') { dy = cycle < 4 ? 1.6 : cycle < 8 ? -1.6 : 0; extra.skin = 'roof'; extra.isBridge = cycle === 10; }
      if (kind === 'alleys') dy = cycle < 3 ? -1.8 : cycle < 6 ? 1.8 : 0;
      if (kind === 'conveyor') { dy = cycle < 3 ? 1.5 : cycle >= 9 ? -1.5 : 0; extra.conveyor = cycle >= 3 && cycle < 8 ? (phase % 2 ? -1.4 : 1.4) : 0; }
      if (kind === 'gate') { dy = cycle < 4 ? 1.6 : cycle >= 8 ? -1.6 : 0; if (n === 8) gate(); }
      if (kind === 'cellar' || kind === 'snowcave' || kind === 'roots') { dy = cycle < 5 ? -1.6 : cycle >= 7 ? 1.6 : 0; extra.isTunnel = cycle < 8; if (kind === 'cellar' && n === steps - 3 || kind === 'roots' && n === 8) spring(); }
      if (kind === 'islands') { dy = cycle < 4 ? 1.6 : cycle >= 8 ? -1.6 : 0; extra.skin = 'sand'; }
      if (kind === 'raft' || kind === 'iceferry') { dy = cycle < 3 ? 1.4 : cycle >= 9 ? -1.4 : 0; if (n === 8 || n === 20) elevator('x', 12, kind === 'raft' ? 'raft' : 'ice'); }
      if (kind === 'pier') { dy = cycle < 4 ? 1.7 : cycle >= 8 ? -1.7 : 0; extra.isBridge = cycle >= 4 && cycle < 8; }
      if (kind === 'valley') dy = cycle < 5 ? -2 : cycle >= 7 ? 2 : 0;
      if (kind === 'windmill') { dy = cycle >= 7 ? -1.3 : 0; if (n % 12 === 5) elevator('y', 6.5, 'windmill'); }
      if (kind === 'springs') { dy = cycle >= 7 ? -1.24 : 0; if (n % 12 === 5) spring(); }
      if (kind === 'ice') { dy = cycle < 6 ? -0.8 : 0.8; extra.isIce = cycle < 8; }
      if (kind === 'trunk') { dy = cycle < 6 ? 1.8 : -1.8; dx = cycle >= 3 && cycle < 6 ? -4 : 7; if (n === 14 || n === 28) elevator('y', 6, 'leaf'); }
      if (kind === 'canopy') { dy = cycle < 4 ? 1.9 : cycle >= 8 ? -1.9 : 0; extra.isBridge = cycle >= 4 && cycle < 8; if (n === 14 || n === 28) elevator('y', 6, 'leaf'); }
      if (kind === 'blocks') { dy = cycle < 3 ? 2 : cycle < 6 ? -2 : 0; extra.skin = 'blocks'; }
      if (kind === 'factory') { extra.conveyor = cycle < 6 ? 1.5 : -1.5; if (n === 8) gate(); if (n === 18) elevator('y', 5.4, 'gear'); dy = cycle >= 9 ? -1.8 : 0; }
      if (kind === 'balloons') { dy = cycle < 4 ? 1.5 : cycle >= 8 ? -1.5 : 0; if (n === 10) elevator('x', 12, 'balloon'); }
      if (kind === 'rocket') { dy = cycle < 6 ? 2 : -2; dx = cycle >= 3 && cycle < 6 ? -4 : 7; if (n === 14) spring(); }
      main(dx, dy, extra);
    }
    // 每段出口都是可识别、静止的恢复旗；下一段从这里接上。
    const exit = main(6.5, 0, { width: 10, isCheckpoint: true, milestone: zoneIndex + 1 });
    world.milestones.push(exit.id);
    zone.exitId = exit.id; zone.maxX = Math.max(...world.platforms.slice(firstId).map(p => p.x + p.width / 2));
    zone.platformIds = world.platforms.slice(firstId).map(p => p.id);
    // 每段一条向上分岔后汇回的短支路，入口位置与形状按种子改变。
    const eligible = zone.platformIds.filter(id => !world.platforms[id].isMoving && world.platforms[id].gateId === undefined && world.platforms[id].x < exit.x - 22);
    const fork = world.platforms[eligible[Math.floor(terrain() * eligible.length)]];
    if (fork) {
      const a = add(fork.x, fork.y + 2.6, 4.2, { isBranch: true, zone: zoneIndex });
      const b = add(fork.x + 4.5, fork.y + 4.8, 4.2, { isBranch: true, zone: zoneIndex });
      world.edges.push({ from: fork.id, to: a.id, kind: 'jump' }, { from: a.id, to: b.id, kind: 'jump' }, { from: b.id, to: fork.id, kind: 'drop' });
    }
    for (let i=0;i<zone.platformIds.length;i+=6) {
      const chunk=zone.platformIds.slice(i,i+6).map(id=>world.platforms[id]);
      const minX=Math.min(...chunk.map(p=>p.x-p.width/2)),maxX=Math.max(...chunk.map(p=>p.x+p.width/2));
      world.decorations.push({kind:levelId,x:(minX+maxX)/2,y:Math.min(...chunk.map(p=>p.y))-3,width:maxX-minX,height:Math.max(...chunk.map(p=>p.y))-Math.min(...chunk.map(p=>p.y))+12,zone:zoneIndex});
    }
  }
  world.finish = cursor; world.finish.isFinish = true;
  for (const p of world.platforms) {
    p.progress = Math.min(profile.regions.length, p.milestone || p.zone);
    if (p.isMoving || p.isCheckpoint || p.gateId !== undefined) continue;
    if (p.isBranch || rewards() < 0.6) {
      const pool = LEVEL_COLLECTIBLES[levelId];
      const kind = p.isBranch ? pool.reduce((best, id) => COLLECTIBLES[id].points > COLLECTIBLES[best].points ? id : best, pool[0]) : pool[Math.floor(rewards() * pool.length)];
      world.treasures.push({ id: world.treasures.length + 1, platformId: p.id, x: p.x, y: p.y + 1.15, kind, isBranch: !!p.isBranch });
    }
  }
  for (const zone of world.zones) {
    const homes = shuffled(zone.platformIds.filter(id => { const p = world.platforms[id]; return !p.isMoving && !p.isCheckpoint && p.gateId === undefined && !p.conveyor && Math.abs(p.x - world.platforms[zone.startId].x) > 12; }), monsters);
    if(zone.id===0) {
      const intro=homes.find(id=>world.platforms[id].x>14&&world.platforms[id].x<55);
      if(intro!==undefined){homes.splice(homes.indexOf(intro),1);homes.unshift(intro);}
    }
    const count=3+Math.floor(monsters()*2)+Math.floor(profile.index/3), selected=[];
    for(const id of homes) {
      const p=world.platforms[id];
      if(selected.every(other=>Math.abs(p.x-other.x)>10||Math.abs(p.y-other.y)>4))selected.push(p);
      if(selected.length===count)break;
    }
    for (const {id} of selected) {
      const p = world.platforms[id], kinds = ['jelly', 'leaf', 'puff'], kind = kinds[Math.floor(monsters() * kinds.length)];
      const height = kind === 'puff' ? 1.4 : 0, range = Math.min(2, p.width / 2 - 1);
      const dropPool = LEVEL_COLLECTIBLES[levelId];
      world.enemies.push({ id: world.enemies.length + 1, platformId: id, zone: zone.id, kind, x: p.x, y: p.y + height, baseY: p.y + height,
        minX: p.x - range, maxX: p.x + range, direction: monsters() < 0.5 ? -1 : 1, speed: 0.65 + monsters() * 0.5,
        height: kind === 'leaf' ? 1.6 : 1.3, width: 1.35, phase: monsters() * Math.PI * 2, elapsed: 0, isDefeated: false,
        hp: profile.index >= 4 && monsters() < 0.3 ? 2 : 1, points: ENEMY_POINTS[kind], drop: monsters() < 0.3 ? dropPool[Math.floor(monsters() * dropPool.length)] : null });
    }
  }
  world.requiredFlowers = Math.max(4, Math.floor(world.treasures.filter(t => !t.isBranch).length * 0.3));
  world.minX = -6; world.maxX = Math.max(...world.platforms.map(p => p.x + p.width / 2));
  world.minY = Math.min(...world.platforms.map(p => p.y)) - 10;
  world.maxY = Math.max(...world.platforms.map(p => p.y + (p.isMoving && p.axis === 'y' ? p.travel : 0))) + 6;
  world.signature = world.zones.map(z => z.kind).join('-') + ':' + world.mainPath.map(id => { const p = world.platforms[id]; return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(';');
  return world;
}

export function validateCampaign(world) {
  if (!world.treasures.length || world.requiredFlowers > world.treasures.filter(t => !t.isBranch).length) return false;
  if (world.platforms.some((p,i)=>p.id!==i || ![p.x,p.y,p.width].every(Number.isFinite) || p.width<4)) return false;
  const isJumpable=(a,b)=>b.y-a.y<=2.65 && Math.abs(b.x-a.x)-(a.width+b.width)/2<=2.5;
  for (const edge of world.edges) {
    const a = world.platforms[edge.from], b = world.platforms[edge.to];
    if (!a || !b) return false;
    if (['jump','board'].includes(edge.kind) && !isJumpable(a,b)) return false;
    if (edge.kind==='spring' && (b.y-a.y>6.3 || Math.abs(b.x-a.x)>5.00001 || !world.springs.some(s=>s.platformId===a.id&&s.power>=18))) return false;
    if (edge.kind==='drop' && (b.y>=a.y || Math.abs(b.x-a.x)>(world.version>=4 ? (a.width+b.width)/2+2.5 : 6))) return false;
    if (edge.kind==='gate' && (!isJumpable(a,b) || !world.switches.some(s=>s.platformId===a.id&&s.bridgeId===b.id))) return false;
    if (edge.kind==='ride') {
      if(!a.isMoving || !['x','y'].includes(a.axis) || a.travel>12 || a.period<4) return false;
      const end={...a,x:a.baseX+(a.axis==='x'?a.travel:0),y:a.baseY+(a.axis==='y'?a.travel:0)};
      if(!isJumpable(end,b))return false;
    }
  }
  if(world.switches.some(s=>!world.platforms[s.platformId]||world.platforms[s.platformId].isMoving||!world.platforms[s.bridgeId]))return false;
  return world.milestones.length === (world.version >= 4 ? world.zones.length : CAMPAIGNS[world.levelId].regions.length);
}
export function createCampaignWorld(seed, level, version = GENERATION_VERSION) {
  if (version === 5) return createBossWorld(seed, level);
  if (version === 4) return createRogueliteWorld(seed, level);
  if (version === 3) return expandEncounters(createCampaignWorld(seed, level, 2));
  if (version === 2) return expandAdventureWorld(createCampaignWorld(seed, level, 1));
  if (version !== GENERATION_VERSION) throw new Error('这局地图版本暂不支持');
  const id = typeof level === 'string' ? level : level.id;
  for (let attempt = 0; attempt < 4; attempt++) { const world = generate(seed, id, attempt); if (validateCampaign(world)) return world; }
  const world = generate(0, id, 0);
  if (!validateCampaign(world)) throw new Error('地图连接需要修复');
  return { ...world, seed, isFallback: true };
}

// 客户端和本机服务共用确定性奖励清单；不接受客户端提供的分值。
export function campaignScore(world, collectedIds, defeatedIds, isCompleted, bonus) {
  const collection = {}, drops = {};
  for (const id of new Set(collectedIds)) { const t = world.treasures[id - 1]; if (!t) throw new Error('宝物编号不正确'); collection[t.kind] = (collection[t.kind] || 0) + 1; }
  let combatScore = 0;
  for (const id of new Set(defeatedIds)) {
    const e = world.enemies[id - 1]; if (!e) throw new Error('小怪编号不正确');
    combatScore += e.points;
    if (e.drop) { collection[e.drop] = (collection[e.drop] || 0) + 1; drops[e.drop] = (drops[e.drop] || 0) + 1; }
  }
  const treasureScore = collectionPoints(collection);
  return { collection, drops, combatScore, treasureScore, score: treasureScore + combatScore + (isCompleted ? bonus : 0) };
}
