# 0.3.1 技能强化

沿用已实现的彩笔人物、纸张界面、光刃与星星素材。用户要求光刃贯穿屏幕，并在探索奖励中获得更丰富、更鲜明的技能。此次为现有攻击改进，不改变关卡布局。

- 光刃：飞到发射时前方屏幕边缘再消失；穿平台、穿怪，每发对每个怪只伤害一次。
- 魔法泡泡：缓缓向前上方飞行，接触怪物或飞到边界后爆开，半径 3.8 单位范围伤害。
- 彩虹星雨：五发扇形星弹、彩笔星光拖尾，可以命中高低不同的目标。
- 奖励沿每个区域主线随机摆放两份，类型交替，首种由种子决定；不改变生成版本 1 的已有地图和积分。
- 强化自动替换当前技能，持续 32 秒；双人共享，J / Enter / 触屏攻击键沿用。下一关从光刃开始。
- 暂停不计时、掉落保留，退出续关保留当前技能、计时和已领取编号；旧存档默认光刃。
- 视觉用现有青蓝、粉色和黄色彩笔配色；获得时光环与星星散开，人物周围保留光环，左上小状态条显示剩余时间。减少动态效果偏好下取消旋转、漂浮与弹跳动画。

## 资产

新增 `public/assets/magic-bubble.png`，使用内置 imagegen 生成，保留真正的 RGBA 透明背景和透明中心。光刃、星星、人物和云团复用现有项目资产。生成提示词：

> Use case: stylized-concept. Asset type: transparent 2D game sprite for a child's colored-pencil platform adventure. Create ONE isolated magical soap bubble centered on a square transparent canvas, large enough to occupy 80% of it. Wobbly hand-drawn wax crayon outline in cyan, pink and lavender, some pale yellow glints, a mostly clear transparent center, cheerful thick visible colored pencil strokes matching a six year old child's rainbow crayon castle drawings. Small hand-drawn glints hugging the bubble edge only. The bubble should read clearly over pale cream paper backgrounds at 80 pixels, so the colorful outline must be rich and bold. Actual transparent background and transparent bubble interior, not white paper, no ground, no text, no characters, no UI, no checkerboard painted into the art. This is a single sprite asset, not a mockup or sprite sheet.
