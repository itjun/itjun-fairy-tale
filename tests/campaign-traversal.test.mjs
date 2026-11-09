import test from 'node:test';
import assert from 'node:assert/strict';
import {play} from './helpers/campaign-runner.mjs';
import {CAMPAIGNS} from '../shared/campaign.js';
// 使用真实物理连续走完主线，不把角色逐段传送。此控制器不模拟人的观察和战斗时间。
test('连续路线模拟经过全部区域并拿够宝物，内容用时逐关增加',()=>{
 for(const seed of [1,42,137]){
  let previous=0;
  for(const id of Object.keys(CAMPAIGNS)){
   const result=play(id,seed);
   assert.equal(result.failed,undefined,JSON.stringify({seed,...result}));
   assert.equal(result.visited,result.total,JSON.stringify({seed,...result}));
   assert.ok(result.collected>=result.required,JSON.stringify({seed,...result}));
   assert.ok(result.seconds>previous,JSON.stringify({seed,...result,previous}));previous=result.seconds;
  }
 }
});
