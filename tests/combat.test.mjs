import test from 'node:test';
import assert from 'node:assert/strict';
import {fireWave,fireSkill,stepWave} from '../src/game/combat.js';
import {touchEnemy} from '../src/game/enemies.js';
const monster=(x=4,y=0)=>({id:1,x,y,width:1,height:1.5,hp:1,elapsed:0,isDefeated:false});
test('光刃左右与空中贯穿当前屏幕、平台和多个目标，屏幕外不误伤',()=>{
 for(const facing of [-1,1]) for(const halfWidth of [12,24,80]) {
 const player={x:0,y:3,facing};
 const enemies=[4,halfWidth-1,halfWidth+6].map((x,i)=>({...monster(facing*x,3),id:i+1}));
 const wave=fireWave(player,1,{left:-halfWidth,right:halfWidth});
 const hits=stepWave(wave,enemies,[{x:facing*3,y:4.5,width:1}],2,3);
 assert.deepEqual(hits.map(h=>h.enemy.id),[1,2]);
 assert.equal(enemies[2].isDefeated,false);assert.equal(wave.isActive,false);
 }
 const strong={...monster(4),hp:2,width:5};
 const wave=fireWave({x:0,y:0,facing:1},0);
 stepWave(wave,[strong],[],0.08,0.08);
 stepWave(wave,[strong],[],0.01,0.09);
 assert.equal(strong.hp,1,'同一光刃停留在同一只怪体内不重复扣血');
});
test('按住发射间隔及双人同帧、踩头和光波不重复击败',()=>{
 const p={x:0,y:0,facing:1},e=monster();
 assert.ok(fireWave(p,0)); assert.equal(fireWave(p,0.2),null);assert.ok(fireWave(p,0.4));
 const a=fireWave({...p,nextShot:0},1),b=fireWave({...p,nextShot:0},1);
 assert.equal(stepWave(a,[e],[],0.3,1.3)[0].isDefeated,true);
 assert.deepEqual(stepWave(b,[e],[],0.3,1.3),[]);
 assert.equal(touchEnemy({x:4,y:1,vy:-3,protection:0},e,2),null);
 const strong=monster();strong.hp=2;
 assert.equal(stepWave(fireWave({...p,nextShot:0},2),[strong],[],0.3,2.3)[0].isDefeated,false);
 assert.equal(touchEnemy({x:4,y:1.5,vy:-3,protection:0},strong,2),'stomp');
});
test('魔法泡泡爆开范围命中，彩虹星雨覆盖高低目标',()=>{
 const p={x:0,y:0,facing:1};
 const enemies=[{...monster(5),id:1},{...monster(5,2),id:2},{...monster(13),id:3}];
 const [bubble]=fireSkill(p,0,{left:-24,right:24},'bubble');
 const hits=stepWave(bubble,enemies,[],0.5,0.5);
 assert.deepEqual(hits.map(h=>h.enemy.id),[1,2]);
 assert.ok(bubble.burst);assert.equal(bubble.isActive,false);
 assert.deepEqual(stepWave(bubble,enemies,[],1,1),[]);
 const stars=fireSkill({...p,nextShot:0},0,{left:-24,right:24},'stars');
 assert.equal(stars.length,5);
 const high={...monster(10,3),id:7},low={...monster(10,-3),id:8};
 for(const star of stars) stepWave(star,[high,low],[],0.5,0.5);
 assert.equal(high.isDefeated,true);assert.equal(low.isDefeated,true);
});
