# 初始圆月弯刀（2026-11-13）

用户要求给初始角色增加类似圆月弯刀的技能。沿用已确认的彩笔素材和单一攻击键，四位角色默认开局只装备一把圆月弯刀，自选时可以换成另外一种武器，人物天赋继续生效。

## 行为与数值

- 按住 J（或原触屏攻击键）同时使用已装备武器。弯刀每 0.18 秒发射一次，多把可同时飞行；探索中获得的其他武器保持各自的发射间隔。
- 没有敌人也能持续发射，弯刀朝角色面向方向直飞，途中自动锁定附近 22 单位内最近的敌人，包括上下方、身后和 BOSS。锁定后持续跟随目标位置；目标隐藏、休眠或被击败时沿当前方向继续飞并重新寻找。命中后寻找尚未命中的目标，最多飞行 40 单位后消散，可穿过平台。这是 2026-11-14 确认的新规则，替代无目标立即消散。
- 每把基础伤害 48，同一把对同一个目标只命中一次。BOSS 护盾、实际剩余生命会影响显示扣血。
- 飞行速度 20，最久约 2 秒；继承攻击成长、双重发射、范围、连锁等通用强化。武器本身在本次冒险中持续保留，可在休息点主动取下或重新装备。
- 2026-11-14 用户指定参考《加纳战机》的 3 号追踪月牙。[GameFAQs 玩家攻略](https://gamefaqs.gamespot.com/nes/587323-gun-nac/faqs/52597) 将其描述为多枚月牙追敌，强化后数量和速度增加。本项目采用密集连发、弧线追踪、叠加后扇形散射并分配目标的手感；0.18 秒、伤害 48、40 单位射程均为本项目数值，并非复刻原作数值。
- 月牙以较小的 1.6 × 1.6 世界单位显示，轨迹星点随飞行方向转向；同批月牙初始角度分散，优先保持各自目标，失效后重新寻找。初始仍每轮一把，持续攻击形成连续月牙，奖励增加每轮数量。营地、工作台与实战使用同一套弹道。
- 已有冒险只补发一次，保留原武器、天赋、成长、命数和限时效果；主动取下后读档不强制重新装备。旧地图不重抽。
- 角色营地、实战武器栏和工作台均显示弯刀。工作台试用沿用真实的独立武器发射间隔。

## 探索中的叠加成长

所有武器基础发射一枚。关卡随机奖励可以给新武器，也可以再次给已拥有武器；同种武器每次叠加基础发射数量 +1、单枚伤害增加初始伤害的 20%，与全局攻击成长、多重发射和专属强化一起计算。数量与伤害在奖励卡、实战武器栏和工作台展示，跨关与存档保留。数量存档范围为 1～99；旧档未记录数量的武器按 1 计算，已有武器不因本次初始规则改变而删除。

## 素材

- 项目素材：`public/assets/weapon-moonblade.png`，1254 × 1254 RGBA PNG，保留透明背景和空心月牙。
- 生成方式：内置 `image_gen`，`transparent_background: true`；不是 CLI/API 回退。
- 风格参考：`public/assets/weapon-boomerang.png`、`public/assets/light-wave.png`，仅参考笔触和配色，不替换原素材。
- 原始输出：`/Users/itjun/.codex/generated_images/01a1d48d-d3b5-70f1-b4f0-515f91bb653b/exec-acdad04d-9dbd-40a1-82af-b03147bd7b13.png`。

最终生成提示词：

```text
Use case: stylized-concept. Asset type: a single transparent PNG sprite for the child's crayon platform game 花园王国. Input images are STYLE REFERENCES ONLY: the existing crayon star boomerang and cyan-pink light wave. Create one NEW distinct moon-shaped curved throwing blade, 圆月弯刀, with a broad almost circular C-shaped crescent silhouette, clearly hollow open center and two curved tapered tips. No handle. Compact circular silhouette, cyan and pale blue scribbled body, warm yellow outer cutting rim, purple rough crayon outline, a few pink crayon accents. Thick uneven children's wax-crayon strokes and visible scribble texture matching the references. Centered, square composition with 10 percent transparent margin; the blade itself occupies 80 percent of the canvas. Friendly magical game prop rather than realistic metal. One blade only. No character, no other objects, no motion trail, no text, no logo, no border, no ground, no shadow. True transparent background including the hollow center, preserve crisp irregular crayon edges, no white or checkerboard background.
```

## 验证证据

自动测试见 `tests/moonblade.test.mjs` 和 `tests/weapon-stacking.test.mjs`；追踪与叠加的最新实机截图位于 `/Users/itjun/Documents/Codex/2026-11-13/fairy-homing/`，初版素材展示位于同级 `fairy-moonblade/`。完整构建安装结果见根目录 `design-qa.md` 的本次追加记录。
