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
    blurb: '扇形清场',
    tip: '升级后斜后方也能扫到，适合分散小怪。',
    grow: '同号升级；装机翼后最高 Lv.8。',
    get: '开局蓝球补给机或中段补给掉落；商店 ¥10。',
    desc: '初始主枪，向前高速直射。升级后展开多方向扇形弹，高级可覆盖斜后方，清理分散小怪很顺手。',
  },
  {
    tag: '2',
    name: '爆破球',
    blurb: '命中爆圈',
    tip: '打集群和大型目标很强，节奏偏慢。',
    grow: '3 级起附带斜后方副弹。',
    get: '开局蓝球补给机或中段补给掉落；商店 ¥10。',
    desc: '射出高伤能量球，击中敌人或首领后爆开范围伤害；3 级起附带斜后方副弹，打集群和大型目标很强。',
  },
  {
    tag: '3',
    name: '圆月弯刀',
    blurb: '最强追踪巨刃',
    tip: '大弯刀自动锁敌并连斩多只敌机，还能劈碎可破坏敌弹。',
    grow: '同号每升 1 级多 1 把，最多 6 把巨刃同飞。',
    get: '开局正中航道补给、战机与中段掉落；商店 ¥10。',
    desc: '与跳台探险同款的彩笔大圆月弯刀，是全场威力最猛的主武器。出膛后大弧线自动追敌并连续斩穿多只小怪，升级后最多一次齐射 6 把大弯刀满场横扫。',
  },
  {
    tag: '4',
    name: '火龙',
    blurb: '贴身扫射',
    tip: '自动连射向前喷火，左右移动可弯焰。',
    grow: '高等级增加并行火束。',
    get: '开局蓝球补给机或中段补给掉落；商店 ¥10。',
    desc: '向前喷出的穿透火焰束，左右移动时火焰会跟着弯曲扫射；自动连射时仍保持足够射程，贴近输出极高。',
  },
  {
    tag: '5',
    name: '宽幅光束',
    blurb: '贯穿整排',
    tip: '压制正面编队和抢攻首领弱点很稳。',
    grow: '升级增加并行光柱。',
    get: '开局蓝球补给机或中段补给掉落；商店 ¥10。',
    desc: '多束高速穿透光柱，能直接贯穿整排敌人，用来压制正面编队和抢攻首领弱点很稳。',
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
    name: '外置机翼护铠',
    blurb: '酷炫合体 + 解锁 Lv.8',
    tip: '合体展开双炮重装巨翼；已有护铠再捡直接给武器升 1 级。',
    grow: '小飞机上限 Lv.3，装翼后 Lv.8。',
    get: '击落敌方战机高频掉落；中段首架蓝球必掉；商店 ¥10。',
    desc: '合体装上酷炫的双炮重装大机翼，替战机抵挡一次伤害（中弹只卸护铠、不扣命），同时把主武器上限从 Lv.3 提高到 Lv.8。',
  },
  {
    tag: 'P',
    tone: 'gun',
    name: '升级芯片',
    blurb: '两枚升一级',
    tip: '集齐 2 枚 P，当前主武器自动升 1 级。',
    grow: '普通最高 Lv.3，装翼最高 Lv.8。',
    get: '中段补给循环掉落。',
    desc: '每集齐 2 枚 P，当前装备的主武器自动升 1 级（普通最高 Lv.3，装有机翼护铠最高 Lv.8）。',
  },
  {
    tag: '★',
    tone: 'gun',
    name: '清屏星',
    blurb: '瞬间清场',
    tip: '消灭画面里已出场的普通敌机并清空敌弹。',
    grow: '照常结算击落分数。',
    get: '中段补给循环掉落。',
    desc: '拾取瞬间消灭当前画面里所有已出场的普通敌机并清空敌弹，照常结算击落分数。',
  },
  {
    sprite: 'money',
    name: '钱袋 ¥',
    blurb: '过关买装备',
    tip: '每袋加 ¥3，进补给站花。',
    grow: '可买枪、机翼、连射或预送炸弹。',
    get: '每击落 5 只普通小怪掉 1 袋；补给也会掉。',
    desc: '每袋加 ¥3。打完本区关底首领进入星际补给站后，用来购买武器、机翼护铠、连射提速或预送炸弹。',
  },
  {
    sprite: 'life',
    name: '备用战机 1UP',
    blurb: '加命并装翼',
    tip: '备用战机 +1，并立刻装上机翼护铠。',
    grow: '初始与续关均有 30 架备用战机。',
    get: '中段补给循环掉落；高分也会奖命。',
    desc: '备用战机数量 +1，并且立刻帮你装上一副外置机翼护铠。',
  },
];

const DROP_GUIDE = [
  {
    sprite: 'wing',
    demo: 'wing',
    name: '外置机翼护铠怎么拿',
    blurb: '战机与补给高频掉',
    tip: '打敌方战机和中段补给都会常掉护铠。',
    grow: '没护铠时掉率更高，商店也能买。',
    get: '击落战机、蓝球补给、海上长船、商店 ¥10、捡 1UP。',
    desc: '击落普通敌方战机就会高频爆出机翼护铠与武器；中段蓝色补给机和海上长船也会多次掉落护铠，过关还能在补给站花 ¥10 购买。',
  },
  {
    sprite: 'courier',
    demo: 'courier',
    name: '开局慢选五武器与战利品',
    blurb: '五条车道依次出现',
    tip: '开局 1～5 号分五列逐架慢飞，慢慢挑不会选错。',
    grow: '途中打战机多掉护铠与武器类别，少掉钱袋。',
    get: '开局五航道 + 战机战利品 + 中段补给。',
    desc: '每关刚开始按从左到右五条独立航道一架接一架慢速飞出 1～5 号武器，选完或落完前不刷怪，方便从容挑选。战斗中击落敌机主要掉落机翼护铠、1～5 号武器与升级芯片，少量掉钱袋。',
  },
  {
    sprite: 'money',
    demo: 'money',
    name: '钱袋、补给站与奖命',
    blurb: '过关花钱包',
    tip: '枪和机翼各 ¥10，连射 ¥6，预送炸弹 ¥4。',
    grow: '得分达 3 万、10 万、20 万及之后每 20 万奖 1 命。',
    get: '战斗中低频掉落，第 5 区金钱世界更多。',
    desc: '每个钱袋加 ¥3。过关进补给站可买 1～5 号枪、机翼护铠、连射提速或预送炸弹。第 7 区结束后每攒够 ¥10 自动换 1 枚炸弹并升威力。',
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
  if (tab === 'guns') return '共有 1～5 五种主武器。捡到相同数字升级，不同数字换枪；小飞机上限 Lv.3，装上机翼护铠上限 Lv.8。';
  if (tab === 'bombs') return '捡到相同字母炸弹升 1 级（最高 Lv.4），不同字母切换炸弹；Lv.1 耗 1 枚，Lv.2 及以上耗 2 枚。';
  if (tab === 'items') return '机翼护铠既能挡一枪、又能把武器解锁到 Lv.8，是最值得优先拿的装备。';
  return '补给按固定循环出现；开局五武器编队让你自由挑选开局枪。';
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
        <h2>加纳战机说明书</h2>
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
