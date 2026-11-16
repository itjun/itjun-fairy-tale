import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp, Pause, Star } from '@phosphor-icons/react';
import { HomePage } from '../HomePage.jsx';
import { PadKey } from '../input/PadKey.jsx';
import { WEAPONS, UPGRADES } from '../../shared/adventure-catalog.js';
import { SPELLS, RARITIES } from '../../shared/combat-catalog.js';
import { ROOM_KINDS } from '../../shared/room-world.js';
import { DIFFICULTIES } from './difficulty.js';
import { SETS, SET_STEPS } from './sets.js';
import './rooms.css';

// 进度条上每间房用一个字，孩子一眼能认出来。
const KIND_MARKS = { intro: '起', battle: '战', mechanism: '机', puzzle: '宝', shop: '店', elite: '精', boss: '王' };

function roomLine(rooms) {
  if (rooms.isCleared) return rooms.kind === 'boss' ? '打赢了，往右走到终点' : rooms.kind === 'shop' ? '买完就跳到发光的门上' : '门亮了，跳过去';
  if (['battle', 'elite'].includes(rooms.kind)) return `第 ${rooms.wave} / ${rooms.waves} 波，还剩 ${rooms.left} 只`;
  if (rooms.puzzle) return rooms.puzzle.hint;
  return ROOM_KINDS[rooms.kind].hint;
}

// 第 9 版游玩中的界面：左上命和血，中间这一章的房间，右上碎片和连击，右下三个键。
export function RoomHud({ stats, person, isGamepad, isPlaying, warning, onPause, touchProps }) {
  const rooms = stats.rooms, survival = stats.survival, magic = stats.adventure?.magic;
  const spells = magic?.equipped || [], isSpellReady = spells.some(id => magic.ready.includes(id));
  const weapons = stats.activeWeapons?.length ? stats.activeWeapons : ['blade'];
  const talent = person.name === '爸爸' ? (survival.shieldRemaining > 0 ? `护盾 ${Math.ceil(survival.shieldRemaining)} 秒后好` : '护盾准备好了') : ['妈妈', '姐姐'].includes(person.name) ? `${person.talent} ${survival.attacks || 0}/4` : '';
  const line = roomLine(rooms);
  return <div className="room-hud" inert={!isPlaying}>
    <div key={rooms.roomId} className="room-fade" aria-hidden="true" />
    <aside className="room-hud-life" aria-label="玩家血量与命数">
      <img src={`./assets/${person.image}.png`} alt={person.name} />
      <div>
        <span className="room-hud-lives" aria-label={`还有 ${survival.lives} 条命`}>{Array.from({ length: Math.min(survival.lives, 6) }, (_, index) => <img key={index} src="./assets/life-potion.png" alt="" />)}{survival.lives > 6 && <b>×{survival.lives}</b>}</span>
        <progress aria-label="玩家血量" value={survival.hp} max={survival.maxHp} />
        <small>血量 {survival.hp} / {survival.maxHp}{talent && <em>{talent}</em>}</small>
      </div>
    </aside>
    <aside className="room-hud-path" aria-label="这一章的房间">
      <ol>{rooms.layers.map((layer, index) => <li key={index} data-kind={layer.kind || 'unknown'} aria-current={index === rooms.depth || undefined}>
        <b>{KIND_MARKS[layer.kind] || '？'}</b>
        <span aria-label={`${layer.stars} 颗星`}>{[0, 1, 2].map(star => <Star key={star} size={13} weight={star < layer.stars ? 'fill' : 'regular'} />)}</span>
      </li>)}</ol>
      <p><strong>{rooms.name}</strong>{line && <span>{line}</span>}</p>
    </aside>
    <aside className="room-hud-side" aria-label="碎片和积分">
      <span><img src="./assets/upgrade-recycle.png" alt="" />碎片 <b>{stats.adventure?.resources?.balance || 0}</b></span>
      <span>积分 <b key={stats.score} className="score-total">{stats.score}</b></span>
      {rooms.combo >= 2 && <span key={rooms.combo} className="room-hud-combo">连击 {rooms.combo}</span>}
      {warning && <small className="save-pending">{warning}</small>}
      <button aria-label="暂停探险" disabled={!isPlaying} onClick={onPause}>{isGamepad ? <PadKey name="menu" /> : <Pause size={24} weight="fill" />}</button>
    </aside>
    {isPlaying && rooms.prompt && <div className="room-hud-prompt" role="status">{isGamepad ? <><PadKey name="stick" />往上推</> : <kbd>W</kbd>}<span>{rooms.prompt}</span></div>}
    <aside className="room-hud-keys" aria-label="按键">
      <span>{isGamepad ? <PadKey name="A" /> : <kbd>空格</kbd>}跳</span>
      <span>{isGamepad ? <PadKey name="X" /> : <kbd>J</kbd>}{weapons.map(id => <img key={id} src={`./assets/${WEAPONS[id].image}.png`} alt={WEAPONS[id].shortName} />)}</span>
      {spells.length > 0 && <span className={isSpellReady ? 'is-ready' : ''}>{isGamepad ? <PadKey name="Y" /> : <kbd>K</kbd>}{spells.map(id => <i key={id}><img src={`./assets/${SPELLS[id].image}.png`} alt={SPELLS[id].name} /><progress aria-label={`${SPELLS[id].name}能量`} value={magic.active.some(effect => effect.id === id) ? 0 : magic.charges[id] || 0} max={SPELLS[id].charge} /></i>)}{isSpellReady && <em>可以放了</em>}</span>}
    </aside>
    {isPlaying && <div className="touch-controls room-touch" aria-label="触屏操作">
      <div><button aria-label="向左走" {...touchProps('left')}><ArrowLeft size={30} /></button><button aria-label="向右走" {...touchProps('right')}><ArrowRight size={30} /></button><button aria-label="向下跳台" {...touchProps('drop')}><ArrowDown size={27} /></button></div>
      <div>{rooms.prompt && <button aria-label={rooms.prompt} {...touchProps('enter')}>进</button>}{spells.length > 0 && <button aria-label="放大招" className={isSpellReady ? 'is-ready' : ''} {...touchProps('spell')}>招</button>}<button aria-label="攻击" {...touchProps('attack')}>打</button><button className="touch-jump" aria-label="跳跃" {...touchProps('jump')}><ArrowUp size={29} /><span>跳</span></button></div>
    </div>}
  </div>;
}

// 暂停里的“本领一览”，游玩中按 View 也能打开。只看不改。
export function RunOverview({ stats, onBack }) {
  const adventure = stats.adventure, rooms = stats.rooms, magic = adventure.magic;
  const weapons = stats.activeWeapons?.length ? stats.activeWeapons : adventure.weapons;
  const quality = key => adventure.qualities?.[key] || 'common';
  return <HomePage title="本领一览" onBack={onBack} backLabel="回到暂停" className="in-game-page run-overview">
    <section aria-label="武器和大招">
      <h2>武器和大招</h2>
      <ul className="overview-cards">
        {weapons.map(id => <li key={id} style={{ '--rarity-color': RARITIES[quality(`weapon:${id}`)].color }}><img src={`./assets/${WEAPONS[id].image}.png`} alt="" /><strong>{WEAPONS[id].name}</strong><small>每枚伤害 {stats.weaponStats?.[id] || WEAPONS[id].damage}，一次 {stats.weaponCounts?.[id] || 1} 枚</small></li>)}
        {(magic?.equipped || []).map(id => <li key={id} style={{ '--rarity-color': RARITIES[quality(`spell:${id}`)].color }}><img src={`./assets/${SPELLS[id].image}.png`} alt="" /><strong>{SPELLS[id].name}</strong><small>大招 {magic.ranks[id]} 级，打中怪攒能量</small></li>)}
      </ul>
    </section>
    <section aria-label="本领">
      <h2>本领</h2>
      {rooms ? <p className="option-note">同一系凑够 {SET_STEPS[0]} 个有套装效果，{SET_STEPS[1]} 个再加强。</p> : <p className="option-note">这次冒险用的是老地图，没有套装效果。</p>}
      <div className="overview-sets">{Object.entries(SETS).map(([family, set]) => {
        const owned = Object.keys(adventure.upgrades).filter(id => UPGRADES[id].family === family), level = rooms ? SET_STEPS.filter(step => owned.length >= step).length : 0;
        return <div key={family} data-level={level}>
          <h3>{set.name} <b>{owned.length}</b>{rooms && <small>{level ? set.steps[level - 1] : `差 ${SET_STEPS[0] - owned.length} 个：${set.steps[0]}`}</small>}</h3>
          <ul>{owned.map(id => <li key={id}><img src={`./assets/${UPGRADES[id].image}.png`} alt="" />{UPGRADES[id].name}{adventure.upgrades[id] > 1 && ` ${adventure.upgrades[id]} 级`}</li>)}{!owned.length && <li className="is-empty">还没有</li>}</ul>
        </div>;
      })}</div>
    </section>
    {rooms && <section aria-label="这一章的门">
      <h2>这一章的门</h2>
      <ol className="overview-path">{rooms.layers.map((layer, index) => <li key={index} aria-current={index === rooms.depth || undefined}><b>{KIND_MARKS[layer.kind] || '？'}</b>{layer.kind ? ROOM_KINDS[layer.kind].name : '还没选'}{layer.stars > 0 && <small>{layer.stars} 颗星</small>}</li>)}</ol>
      {rooms.doors.length > 0 && <p className="option-note">{rooms.isCleared ? '门亮着' : '清完这间房，门才会亮'}。前面有{rooms.doors.length === 2 ? '两扇门，一扇在高处，一扇在低处，跳到哪扇就进哪扇' : '一扇门，跳上去就能进'}。</p>}
      <p className="option-note">难度：{DIFFICULTIES[rooms.difficulty].name}。一共拿到 {rooms.stars} 颗星。重抽券 {rooms.rerolls} 张{rooms.tierUp > 0 && '，下一次奖励高一档'}。</p>
    </section>}
  </HomePage>;
}
