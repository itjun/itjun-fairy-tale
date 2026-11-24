import { PadHint } from './PadKey.jsx';

// 只列出当前手柄操作；游玩和换装各有自己的提示。
export function GamepadHints({ state }) {
  if (state.mode !== 'gamepad' || !state.connected || ['playing', 'bindings'].includes(state.context)) return null;
  return <div className="gamepad-guide" aria-label="手柄操作提示">
    {state.context === 'practice' ? <><PadHint keys={['stick']}>移动</PadHint><PadHint keys={['A']}>跳</PadHint><PadHint keys={['X']}>攻击</PadHint><PadHint keys={['B']}>回按钮区</PadHint></>
      : state.context === 'stamps' ? <><PadHint keys={['stick']}>移动贴纸</PadHint><PadHint keys={['A']}>放下</PadHint><PadHint keys={['B']}>回按钮区</PadHint></>
      : <>
        <PadHint keys={['stick']}>选择</PadHint>
        {state.shoulder && <PadHint keys={['LB', 'RB']}>{state.shoulder}</PadHint>}
        <PadHint keys={['A']}>确定</PadHint>
        {state.hasBack && <PadHint keys={['B']}>{state.backLabel || '返回'}</PadHint>}
      </>}
  </div>;
}
