// 动效在规则接受操作后播放。换题时只在原来的位置留一小簇光点，不移动下一题的道具。
export function miniMotion(action, session, result, stage) {
  if (!stage || !result.isSuccess) return null;
  const task=session.tasks[session.taskIndex];
  const slot=i=>'[data-drop="'+i+'"]';
  if(result.isTaskComplete) {
    const source=action.type==='find' ? stage.querySelector('[data-gem="'+action.item+'"]') :
      Number.isInteger(action.target) ? stage.querySelector(slot(action.target)) : null;
    if(!source) return null;
    const box=stage.getBoundingClientRect(), rect=source.getBoundingClientRect();
    const point={x:(rect.left+rect.width/2-box.left)/box.width,y:(rect.top+rect.height/2-box.top)/box.height};
    return {targets:[{particles:'spark',point}]};
  }
  const plant=(i,particles)=>({selector:slot(i)+' > img',kind:'grow',art:true,particles});
  if(action.type==='weather') {
    const targets=task.plants.flatMap((p,i)=>result.session.board.steps[i]>session.board.steps[i]
      ? [plant(i,p.needs[session.board.steps[i]])] : []);
    return {targets};
  }
  if(action.type==='care' || task.kind==='sow') return {targets:[plant(action.target,action.type==='care'?action.item:'soil')]};
  if(action.type==='ingredient') return {targets:[{selector:'.icecream-drop .mini-icecream img',kind:'drop',art:true}]};
  if(action.type==='place') return {targets:[{selector:slot(action.target)+(task.kind==='restore'?' .rainbow-crop':' > img'),kind:'drop',art:true,particles:'spark'}]};
  return null;
}
