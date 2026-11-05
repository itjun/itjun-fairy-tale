import test from 'node:test';
import assert from 'node:assert/strict';
test('启动时空队列同步后，新游玩仍真正发送；重叠保存合并为最新版本', async () => {
  const values = new Map(), sent = [];
  const originalFetch=globalThis.fetch, originalStorage=globalThis.localStorage;
  globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  globalThis.fetch=async(_url,options)=>{const run=JSON.parse(options.body);sent.push(run);return {ok:true,json:async()=>({run})};};
  try {
    const client=await import('../src/scores/client.js?test');
    assert.equal((await client.flushScores()).isSaved,true);
    client.queueRun({id:'test-run',revision:1});
    const save=client.flushScores();
    client.queueRun({id:'test-run',revision:2});
    await save;
    assert.equal(sent.length,2); assert.equal(sent.at(-1).revision,2); assert.equal(client.pendingCount(),0);
  } finally { globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage; }
});
