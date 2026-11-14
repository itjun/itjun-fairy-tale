import { randomGenerator } from '../../shared/random.js';
import { heal, resourcesFor } from './expedition.js';
import { grow } from './growth.js';

export const LIFE_CHOICES = {
  heal:{name:'爱心补血',hint:'立即恢复 2 点生命',image:'life-potion'},
  heart:{name:'生命长大',hint:'生命上限 +1，同时恢复 1 点',image:'collectible-heart'},
  reserve:{name:'备用补给',hint:'存一份，下次受伤后恢复 2 点生命',image:'icecream'},
};
export function newCombatLoot() { return {drops:[],misses:0,pendingId:null}; }
export function rollCombatLoot(loot,world,enemy,player) {
  if(enemy.isBoss||enemy.parentId||enemy.isSummoned||loot.drops.length>=3||loot.drops.some(d=>d.enemyId===enemy.id))return null;
  loot.misses++;
  const random=randomGenerator((world.seed ^ Math.imul(enemy.id,2654435761))>>>0);
  if(loot.misses<3 || loot.misses<8&&random()>=.24)return null;
  const platform=world.platforms.filter(p=>!p.isMoving&&!p.isCrumbling&&p.isEnabled!==false&&p.y<=enemy.y+1&&Math.abs(p.x-enemy.x)<p.width/2+4).sort((a,b)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y))[0] || player.safe;
  const offsetX=Math.max(-platform.width/2+.5,Math.min(platform.width/2-.5,enemy.x-platform.x));
  const drop={enemyId:enemy.id,platformId:platform.id,offsetX,choice:null};
  loot.drops.push(drop);loot.misses=0;return drop;
}
export function lootPosition(world,drop) { const p=world.platforms[drop.platformId];return {x:p.x+drop.offsetX,y:p.y+1}; }
export function nearbyLoot(loot,world,player) {
  return loot?.drops.find(drop=>{const p=lootPosition(world,drop);return drop.choice===null&&!drop.isDeferred&&Math.hypot(p.x-player.x,p.y-player.y-1)<3;});
}
export function canChooseLife(id,adventure,survival) {
  if(survival.phase!=='alive')return false;
  if(id==='heal')return survival.lives<survival.maxLives;
  if(id==='heart')return survival.maxLives<99;
  return id==='reserve'&&!(adventure.resources?.reserveHearts);
}
export function chooseLifeLoot(loot,adventure,survival,enemyId,id) {
  const drop=loot.drops.find(d=>d.enemyId===enemyId);
  if(loot.pendingId!==enemyId||!drop||drop.choice!==null||!canChooseLife(id,adventure,survival))return false;
  if(id==='heal')heal(survival,2);
  else if(id==='heart')grow(adventure,survival,'heart');
  else resourcesFor(adventure).reserveHearts=2;
  drop.choice=id;loot.pendingId=null;adventure.revision++;return true;
}
export function isValidCombatLoot(loot,world,defeatedIds) {
  if(loot===undefined)return true;
  if(!loot||!Array.isArray(loot.drops)||loot.drops.length>3||new Set(loot.drops.map(d=>d?.enemyId)).size!==loot.drops.length||!Number.isInteger(loot.misses)||loot.misses<0||loot.misses>8)return false;
  if(!loot.drops.every(d=>{const e=world.enemies[d?.enemyId-1],p=world.platforms[d?.platformId];return e&&!e.isBoss&&!e.parentId&&defeatedIds.includes(d.enemyId)&&p&&!p.isMoving&&!p.isCrumbling&&Number.isFinite(d.offsetX)&&Math.abs(d.offsetX)<=p.width/2&&(d.isDeferred===undefined||typeof d.isDeferred==='boolean')&&(d.choice===null||Object.hasOwn(LIFE_CHOICES,d.choice));}))return false;
  return loot.pendingId===null||loot.drops.some(d=>d.enemyId===loot.pendingId&&d.choice===null&&!d.isDeferred);
}
