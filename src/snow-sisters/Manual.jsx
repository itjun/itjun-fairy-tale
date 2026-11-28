import { useEffect, useRef, useState } from 'react';
import { PadKey } from '../input/PadKey.jsx';

const TABS = [
  { id: 'basics', label: '雪球与连招' },
  { id: 'potions', label: '药水与道具' },
  { id: 'monsters', label: '怪物与首领' },
  { id: 'secrets', label: '隐藏与规则' },
];

const BASICS_GUIDE = [
  {
    atlas: 'characters',
    cell: 18,
    name: '投雪结球',
    blurb: '九发变雪球',
    tip: '连续丢雪片击中敌人 9 次（喝蓝药水只要 3 次）就能把怪滚成雪球，半结冰时还能暂时挡住路过的普通怪。',
    detail: '雪球不踢放着不管的话，过一段时间会慢慢融化，怪物会重新爬出来继续追你！',
  },
  {
    atlas: 'characters',
    cell: 19,
    name: '慢推与顶高',
    blurb: '搭梯子上高台',
    tip: '贴着静止雪球走过去，雪球就会顺着你的方向滚起来；从雪球下面向上跳可以把它顶飞到上一层台阶；跳到雪球顶上也能当垫脚石！',
    detail: '第 24、26、28 层的相扑手在高台上，正是靠雪球垫脚或顶上去砸到的。',
  },
  {
    atlas: 'items',
    cell: 12,
    name: '踢飞与双色连锁',
    blurb: '一滚撞一片',
    tip: '靠近静止雪球按攻击键就能用力踢飞！白色雪球撞到另一颗静止雪球，会让被撞的雪球变成蓝(1P)或红(2P)并高速飞出。',
    detail: '双色连锁雪球击破的怪物固定 +8,000 分，还会必掉最高档 2,000 分海胆寿司！触碰滚雪球还能无敌随球同行，按跳脱出。',
  },
  {
    atlas: 'items',
    cell: 8,
    name: '一球全灭红包雨',
    blurb: '10,000 分祝字袋',
    tip: '踢出的这一波雪球连锁一次性消灭了整层所有敌人，顶部就会降下「祝」字红包雨，每个 10,000 分！',
    detail: '注意：第 24/26/28 层顶层的相扑手不算过关必须，只要其余小怪一次全清就能拿满红包。',
  },
];

const POTIONS_GUIDE = [
  {
    atlas: 'items',
    cell: 0,
    name: '红药水（加速）',
    blurb: '跑得快跳得高',
    tip: '喝下后移动速度与跳跃高度明显提升，连续攀爬多层更轻巧。',
    detail: '如果已经拥有红药水效果再捡一瓶，额外加 1,000 分。阵亡扣命后药水效果会重置。',
  },
  {
    atlas: 'items',
    cell: 1,
    name: '蓝药水（强雪）',
    blurb: '大雪片三击成球',
    tip: '雪片变大，威力变为 3 倍！普通小怪只需 3 下就能裹成大雪球，打 Boss 也更顺手。',
    detail: '搭配红药水可以快速结球+走位清屏，非常容易触发一球全灭。',
  },
  {
    atlas: 'items',
    cell: 2,
    name: '黄药水（远射）',
    blurb: '加长雪片射程',
    tip: '让雪片飞得更平更远，站在安全平台也能冻结远处的小怪和隐藏点。',
    detail: '按 FC 原版规则，第 24 层以后不再掉落黄药水，前 23 层捡到可一直保留到阵亡前。',
  },
  {
    atlas: 'items',
    cell: 3,
    name: '绿药水（巨大化）',
    blurb: '飞天无敌撞怪',
    tip: '角色立刻变成巨人，可以自由向任意方向飞行并完全无敌，撞到的怪物直接消灭（+8,000 分并掉最高档寿司）！',
    detail: '持续约 9 秒。如果这层用了绿药水撞怪，则本层不会再触发一球全灭红包雨。',
  },
  {
    atlas: 'items',
    cell: 4,
    name: '雪人头与寿司',
    blurb: '集齐 S-N-O-W 奖命',
    tip: '吃下雪人头徽章会立刻出现 4 只带 S/N/O/W 字母的蓝色 Bonus Kun，裹成雪球推倒每只 +30,000 分并点亮对应字母！',
    detail: '集齐 S、N、O、W 四个字母立刻奖励 1UP！平时小怪掉落 10 档寿司（100～2,000 分）。',
  },
];

const MONSTERS_GUIDE = [
  {
    atlas: 'enemies',
    cell: 0,
    name: '紫魔怪 / 黄猴 / 喷火怪',
    blurb: '1～20 层常见伙伴',
    tip: '紫魔遇到斜坡会缩成球滚下来（21 层起平地也会突然翻滚）；黄猴喜欢往高台跳；绿喷火怪会喷火（21 层起还能向下喷火）。',
    detail: '先观察它们停步喷火或跳台的间隙再靠过去丢雪片最安全。',
  },
  {
    atlas: 'enemies',
    cell: 7,
    name: '蓝忍者 / 火焰怪 / 独角 / 蝙蝠',
    blurb: '12～49 层进阶敌群',
    tip: '蓝忍者会丢手里剑或变成无敌旋风穿墙突袭；火焰怪抛出的火弹落地留火融化雪球；独角怪直线冲撞；蝙蝠贴空盘旋。',
    detail: '旋风状态时雪片打不进去，记得躲开等它停下来变成蓝忍者再裹雪球！',
  },
  {
    atlas: 'enemies',
    cell: 18,
    name: '南瓜头与幽灵',
    blurb: '超时催促怪',
    tip: '同一层停留太久，无敌的南瓜头就会飞进来追你并持续放出穿墙幽灵！用雪片打南瓜头可 +10 分并将它弹传到别处。',
    detail: '趁早把必需怪物清光过关，就能把南瓜头甩在上一层。',
  },
  {
    atlas: 'bosses',
    cell: 0,
    name: '五大守塔 Boss',
    blurb: '10 / 20 / 30 / 40 / 50 层',
    tip: '每 10 层都会遇见一座大 Boss：10F 巨蜥、20F 炮弹蛙、30F 双怪鸟、40F 大鼻绿魔、50F 双泡泡石像+下降尖刺！',
    detail: 'Boss 会吐出小恐龙、炸弹兵或火怪，把这些小怪裹成雪球踢过去砸 Boss 伤害最高，也能直接用雪片远程攻击！',
  },
];

const SECRETS_GUIDE = [
  {
    atlas: 'items',
    cell: 10,
    name: '隐藏美食坐标',
    blurb: '对着空气连续射雪',
    tip: '第 1、3、11、15、18、31、34、38、41、45、48 层的特定平台空处连续喷雪 6 次，会蹦出 5,000～15,000 分隐藏甜点！',
    detail: '苹果派 5,000、糖果奶昔 7,000、蘑菇汉堡 10,000、樱桃圣代 15,000，顺手打出来超爽！',
  },
  {
    atlas: 'items',
    cell: 9,
    name: '第 12/23/33/42 层跳关红包',
    blurb: '触发 3 轮跳关老虎机',
    tip: '在这些楼层墙角隐藏点连射 6 发，会掉出闪光红包！捡起来触发三轮跳关转轮，最多一次跳过 6 层！',
    detail: '分别对应第 12 层左侧底、23 层右侧底、33 层右上台、42 层右中台。',
  },
  {
    atlas: 'bosses',
    cell: 11,
    name: 'Boss 战后老虎机 & Time 模式',
    blurb: 'FC 版独占惊喜',
    tip: '打赢 10/20/30/40 层后进入 3 轮老虎机，抽出 S-N-O-W 或雪人娃娃直接加 50,000 分并奖 1UP！在标题页输入 ↑×2 →×8 ↓×2 ←×8 或在设置里打开「Time 模式」可体验 2 分钟极速挑战。',
    detail: '在 Time 模式下打到第 40 层，大鼻绿魔还会戴上帅气的紫色墨镜哦！',
  },
  {
    atlas: 'characters',
    cell: 10,
    name: '1P / 2P 双人同屏合作',
    blurb: '随时中途加入',
    tip: '1P 姐姐负责稳健控场，2P 妹妹随时可以按下加入键（Enter / 2P 手柄）同屏配合：一人裹球、一人踢球或叠雪球！',
    detail: '两姐妹共分享 9 次续关机会；得分达到 100,000 和 600,000 还会各自额外奖 1 条命！',
  },
];

function guideFor(tab) {
  if (tab === 'basics') return BASICS_GUIDE;
  if (tab === 'potions') return POTIONS_GUIDE;
  if (tab === 'monsters') return MONSTERS_GUIDE;
  return SECRETS_GUIDE;
}

function SpritePreview({ atlas, cell }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cols = atlas === 'bosses' ? 4 : 5;
    const img = new Image();
    let dead = false;
    img.src = `./snow-sisters/${atlas}.webp`;
    img.onload = () => {
      if (dead) return;
      ctx.clearRect(0, 0, 128, 128);
      const sx = (cell % cols) * 256;
      const sy = Math.floor(cell / cols) * 256;
      ctx.drawImage(img, sx, sy, 256, 256, 8, 8, 112, 112);
    };
    return () => {
      dead = true;
    };
  }, [atlas, cell]);

  return <canvas ref={ref} width={128} height={128} className="sn-manual-preview" aria-hidden="true" />;
}

export function SnowManual({ isGamepad, backLabel, onBack }) {
  const [tab, setTab] = useState('basics');
  const [selected, setSelected] = useState(0);
  const guide = guideFor(tab);
  const item = guide[Math.min(selected, guide.length - 1)];

  function openTab(id) {
    setTab(id);
    setSelected(0);
  }

  return (
    <div className="sn-manual-shell">
      <div className="sn-manual-head">
        <h2>小雪人姐妹说明书</h2>
        <div className="sn-manual-tabs" role="tablist" aria-label="说明书章节" data-gamepad-tabs="切页">
          {TABS.map((entry, idx) => (
            <button
              key={entry.id}
              role="tab"
              data-sn-first={idx === 0 ? true : undefined}
              aria-selected={tab === entry.id}
              aria-pressed={tab === entry.id}
              onClick={() => openTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <button data-gamepad-back onClick={onBack}>
          {isGamepad ? (
            <span className="sn-btn-pad" aria-hidden="true">
              <PadKey name="B" />
            </span>
          ) : (
            <kbd className="sn-kbd" aria-hidden="true">
              Esc
            </kbd>
          )}
          {backLabel}
        </button>
      </div>

      <div className="sn-manual-stage">
        <aside className="sn-manual-rail" aria-label="条目列表">
          <ul className="sn-manual-picker">
            {guide.map((entry, idx) => (
              <li key={entry.name}>
                <button
                  type="button"
                  className="sn-manual-pick"
                  aria-pressed={idx === selected}
                  onFocus={() => setSelected(idx)}
                  onClick={() => setSelected(idx)}
                >
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.blurb}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="sn-manual-detail" aria-live="polite">
          <SpritePreview atlas={item.atlas} cell={item.cell} />
          <div className="sn-manual-copy">
            <h3>{item.name}</h3>
            <p className="sn-manual-blurb">{item.blurb}</p>
            <p>{item.tip}</p>
            <p className="sn-manual-extra">{item.detail}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
