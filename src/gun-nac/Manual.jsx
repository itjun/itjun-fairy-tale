import { useState } from 'react';
import { PadKey } from '../input/PadKey.jsx';
import { ManualDemo } from './ManualDemo.jsx';

const TABS = [
  { id: 'guns', label: '武器 1-5' },
  { id: 'bombs', label: '炸弹 FBTW' },
  { id: 'items', label: '护铠与道具' },
  { id: 'drops', label: '怎么拿到' },
];

const GUN_GUIDE = [
  {
    tag: '1',
    name: '散射',
    blurb: '前方散开',
    tip: '1 级只有一发，等级越高弹越粗、散得越开，4 级起才能打到后面。',
    grow: '同号升级；换别的枪会留下现在的等级。没有机翼最高 Lv.3。',
    get: '击落、中段补给或商店 ¥10。',
    desc: '细弹、射得快，单发伤害不高。先是正前方一发，升级后向前散开，装上机翼并升到 4 级以后才会朝后打。',
  },
  {
    tag: '2',
    name: '爆破球',
    blurb: '威力最高',
    tip: '射得慢，打中会爆开一大圈。打首领最管用。',
    grow: '还是一发，但等级越高球越大、越重。换成这把枪时，等级照旧。',
    get: '击落、中段补给或商店 ¥10。',
    desc: '五种枪里单发最重。一发能量球打中后爆开圆形冲击，不追踪，也不能劈掉敌方子弹。',
  },
  {
    tag: '3',
    name: '圆月弯刀',
    blurb: '会追，不好用',
    tip: '小月牙会盯住第一只怪，打中就没了。厚血的怪别靠它。',
    grow: '等级是几就同时飞出几把，最多 8 把。换成别的枪时，等级照旧。',
    get: '击落、中段补给或商店 ¥10。',
    desc: '小月牙会拐弯去追第一只看到的敌人。伤害只比散射略高，打中就消失，不穿透，也不劈敌弹。那只怪没被打死，月牙就一直跟着它，不再去找新的。',
  },
  {
    tag: '4',
    name: '火龙',
    blurb: '越飞越短',
    tip: '左右移动，火焰会跟着弯。飞远了就变短、变弱。',
    grow: '等级是几就有几条火柱，最多 6 条。换成这把枪时，等级照旧。',
    get: '击落、中段补给或商店 ¥10。',
    desc: '火焰跟着飞机左右弯。刚喷出来比较长，飞远以后变短，伤害也跟着下降。',
  },
  {
    tag: '5',
    name: '宽幅光束',
    blurb: '穿透留空',
    tip: '光束能穿过敌机。等级越高，束越多。',
    grow: '1 级两束，之后每高一级多一束，最多 8 束。换成这把枪时，等级照旧。',
    get: '击落、中段补给或商店 ¥10。',
    desc: '细光束可以穿过敌机。升级后光束变多，排成一排往前打。不能劈掉敌方子弹。',
  },
];

const BOMB_GUIDE = [
  {
    tag: 'F',
    name: '火环',
    blurb: '原地护圈',
    tip: '挡环上敌弹并灼烧范围内目标。',
    grow: '同字母升威力，最高 Lv.4。',
    get: '中段补给掉落；终关可用钱自动换弹。',
    desc: '在投放位置张开火焰圆环，挡掉环上敌弹并持续灼烧范围内的敌人与首领。',
  },
  {
    tag: 'B',
    name: '冰壁',
    blurb: '全屏横扫',
    tip: '大范围清弹，沿途持续伤害。',
    grow: '同字母升威力，最高 Lv.4。',
    get: '中段补给掉落；终关可用钱自动换弹。',
    desc: '一道纵贯全屏的冰墙左右横扫整个战场，大范围清弹并对沿途目标持续造成伤害。',
  },
  {
    tag: 'T',
    name: '雷电',
    blurb: '折线清场',
    tip: '跟着飞机左右改变折射角度。',
    grow: '同字母升威力，最高 Lv.4。',
    get: '中段补给掉落；终关可用钱自动换弹。',
    desc: '全屏折线闪电，会跟着飞机左右位置改变折射角度，清弹同时扫荡大片敌人。',
  },
  {
    tag: 'W',
    name: '水弹',
    blurb: '延迟砸落',
    tip: '持续时间最长，适合压首领。',
    grow: '同字母升威力，最高 Lv.4。',
    get: '中段补给掉落；终关可用钱自动换弹。',
    desc: '先向上升起，片刻后化作多波水柱从顶部接连砸落，持续时间最长，适合清场和压制首领。',
  },
];

const ITEM_GUIDE = [
  {
    sprite: 'wing',
    name: '机翼',
    blurb: '小飞机变大',
    tip: '小飞机拿到会变大，并能挡一次。已经是大飞机时，改为武器升 1 级。',
    grow: '没有机翼最高 Lv.3，有机翼最高 Lv.8。被打掉时只卸下机翼，武器和等级留着。',
    get: '掉落里很少出现；商店 ¥10。',
    desc: '让小飞机变大一点，主武器才能升过 3 级，最高到 8 级。大飞机被打中时只卸下机翼、不扣命，手里的枪和等级都留着。',
  },
  {
    tag: 'P',
    tone: 'gun',
    name: '升级芯片',
    blurb: '两枚升一级',
    tip: '集齐 2 枚 P，当前主武器自动升 1 级。',
    grow: '普通最高 Lv.3，装翼最高 Lv.8。',
    get: '击落和中段补给都会掉，比机翼常见。',
    desc: '每集齐 2 枚 P，当前主武器升 1 级。没有机翼时最高 Lv.3，有机翼时最高 Lv.8。',
  },
  {
    tag: '★',
    tone: 'gun',
    name: '清屏星',
    blurb: '瞬间清场',
    tip: '消灭画面里已出场的普通敌机并清空敌弹。',
    grow: '照常结算击落分数。',
    get: '比机翼还少，要隔很久才出现一次。',
    desc: '拾取瞬间消灭当前画面里所有已出场的普通敌机并清空敌弹，照常结算击落分数。',
  },
  {
    sprite: 'money',
    name: '钱袋 ¥',
    blurb: '过关买装备',
    tip: '每袋加 ¥3，进补给站花。',
    grow: '可买枪、机翼、连射或预送炸弹。',
    get: '击落和中段补给最常掉的就是钱袋。',
    desc: '每袋加 ¥3。打完本区后在补给站买武器、机翼、连射，或把炸弹寄到后面的区。',
  },
  {
    sprite: 'life',
    name: '备用战机 1UP',
    blurb: '加一条命',
    tip: '备用飞机 +1。如果还是小飞机，会顺便变大。',
    grow: '新局和续关都是 15 条命。',
    get: '比机翼更少见；分数到 3 万、10 万、20 万以及之后每 20 万也会奖一条命。',
    desc: '备用飞机 +1。这时候如果还是小飞机，会一起变大。',
  },
];

const DROP_GUIDE = [
  {
    sprite: 'wing',
    demo: 'wing',
    name: '机翼怎么拿',
    blurb: '掉落里很少',
    tip: '钱袋和升级芯片常见，机翼要隔十几件才会出现一次。',
    grow: '商店也能花 ¥10 买。已经是大飞机时，再拿到机翼改为升 1 级。',
    get: '击落、中段补给、商店 ¥10。',
    desc: '击落和蓝色补给机走同一条掉落顺序：大多是钱袋和升级芯片，中间夹着枪和炸弹。大约每十几件才有一只机翼。',
  },
  {
    sprite: 'courier',
    demo: 'courier',
    name: '枪和补给从哪来',
    blurb: '打下来才有',
    tip: '开局不再白送 1～5 号。同号升级，换一种枪会留下现在的等级。',
    grow: '新局从 1 号 1 级起飞。',
    get: '击落、中段补给兵、海上长船、商店 ¥10。',
    desc: '每关直接从 1 号散射开始打。击落大约每 6 只掉一件，中段补给兵也走同一条顺序。商店里花 ¥10 可以换枪或升级。',
  },
  {
    sprite: 'money',
    demo: 'money',
    name: '钱袋、补给站与奖命',
    blurb: '过关花钱包',
    tip: '枪和机翼各 ¥10，连射 ¥6，预送炸弹 ¥4。',
    grow: '得分达 3 万、10 万、20 万及之后每 20 万奖 1 命。',
    get: '战斗里经常掉，第 5 区的敌人也走同一条顺序。',
    desc: '每个钱袋加 ¥3。过关进补给站可买 1～5 号枪、机翼、连射提速或预送炸弹。第 7 区结束后每攒够 ¥10 自动换 1 枚炸弹并升威力。',
  },
  {
    tag: '00',
    tone: 'bomb',
    demo: 'hidden',
    name: '隐藏第 0 区怎么进',
    blurb: '声音测试解锁',
    tip: '声音测试调到 05，再选出发地区 0。',
    grow: '打完隐藏区接回第 1 区。',
    get: '机库 → 飞行设置。',
    desc: '在机库打开「飞行设置」，把「声音测试」调到 05，就会解锁「出发地区」，选「0 隐藏星域」即可进入隐藏关，打完接回第 1 区。',
  },
];

function guideFor(tab) {
  if (tab === 'guns') return GUN_GUIDE;
  if (tab === 'bombs') return BOMB_GUIDE;
  if (tab === 'items') return ITEM_GUIDE;
  return DROP_GUIDE;
}

function itemKey(item) {
  return item.tag || item.sprite || item.name;
}

function leadText(tab) {
  if (tab === 'guns') return '共有 1～5 五种主武器。捡到相同数字就升级，换一种数字会换成那把枪，并留下现在的等级。小飞机最高 Lv.3，装上机翼最高 Lv.8。';
  if (tab === 'bombs') return '捡到相同字母炸弹升 1 级（最高 Lv.4），不同字母切换炸弹；Lv.1 耗 1 枚，Lv.2 及以上耗 2 枚。';
  if (tab === 'items') return '机翼很少见到。拿到后小飞机变大，武器才能升过 3 级；被打中只卸翼，枪和等级留着。';
  return '掉落以钱袋和升级芯片为主。枪和炸弹夹在中间，机翼大约每十几件才有一只。';
}

function titleOf(tab, item) {
  if (tab === 'guns') return `${item.tag} 号 ${item.name}`;
  if (tab === 'bombs') return `${item.tag} ${item.name}`;
  return item.name;
}

export function FlightManual({ isGamepad, backLabel, onBack }) {
  const [tab, setTab] = useState('guns');
  const [selected, setSelected] = useState(0);
  const [level, setLevel] = useState(4);
  const guide = guideFor(tab);
  const item = guide[Math.min(selected, guide.length - 1)];

  function openTab(id) {
    setTab(id);
    setSelected(0);
    setLevel(4);
  }

  return (
    <div className="gn-manual-shell">
      <div className="gn-manual-head">
        <h2>彩笔战机说明书</h2>
        <div className="gn-manual-tabs" role="tablist" aria-label="说明书章节" data-gamepad-tabs="切页">
          {TABS.map((entry, idx) => (
            <button
              key={entry.id}
              role="tab"
              data-gn-first={idx === 0 ? true : undefined}
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
            <span className="gn-btn-pad" aria-hidden="true">
              <PadKey name="B" />
            </span>
          ) : (
            <kbd className="gn-kbd" aria-hidden="true">
              Esc
            </kbd>
          )}
          {backLabel}
        </button>
      </div>

      <div className="gn-manual-stage">
        <aside className="gn-manual-rail" aria-label="条目列表">
          <p className="gn-manual-lead">{leadText(tab)}</p>
          <ul className="gn-manual-picker">
            {guide.map((entry, idx) => (
              <li key={itemKey(entry)}>
                <button
                  type="button"
                  className="gn-manual-pick"
                  aria-pressed={idx === selected}
                  data-gn-manual-item={idx}
                  onFocus={() => setSelected(idx)}
                  onClick={() => setSelected(idx)}
                >
                  {entry.sprite ? (
                    <i className={'gn-item-sprite gn-sprite-' + entry.sprite} aria-hidden="true" />
                  ) : (
                    <i
                      className={'gn-badge gn-badge-' + (entry.tone || (tab === 'bombs' ? 'bomb' : 'gun'))}
                      aria-hidden="true"
                    >
                      {entry.tag}
                    </i>
                  )}
                  <span>
                    <strong>{titleOf(tab, entry)}</strong>
                    <small>{entry.blurb}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="gn-manual-detail" aria-live="polite">
          <div className="gn-manual-showcase">
            <ManualDemo tab={tab} item={item} level={level} />
            {tab === 'guns' && (
              <div className="gn-manual-levels" role="group" aria-label="武器等级预览">
                {[
                  { lv: 1, label: 'Lv.1' },
                  { lv: 4, label: 'Lv.4' },
                  { lv: 8, label: 'Lv.8 机翼' },
                ].map((opt) => (
                  <button
                    key={opt.lv}
                    type="button"
                    aria-pressed={level === opt.lv}
                    onClick={() => setLevel(opt.lv)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="gn-manual-copy">
            <h3>{titleOf(tab, item)}</h3>
            <p className="gn-manual-blurb">{item.blurb}</p>
            <p>{item.desc}</p>
            <dl className="gn-manual-facts">
              <div>
                <dt>实战提示</dt>
                <dd>{item.tip}</dd>
              </div>
              <div>
                <dt>成长</dt>
                <dd>{item.grow}</dd>
              </div>
              <div>
                <dt>怎么拿到</dt>
                <dd>{item.get}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
