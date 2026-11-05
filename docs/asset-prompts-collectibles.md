# 跳台宝物素材

使用内置 image_gen 工具生成，透明背景，未使用 API/CLI。输出已复制到 `public/assets/`，由 `src/game/collectibles.js` 和 Three.js 消费。

通用提示：Use case: illustration-story. Generate one isolated game collectible sprite. Match a six year old child's felt-tip marker drawings: naïve asymmetric outline, thick wobbly strokes, visibly overlapping marker scribbles, little paper-white gaps inside the color, vivid colors. Flat front view, NOT polished vector, NOT 3D, no face, no words, no other objects. Center the single motif inside a square image, occupies about 80% of canvas with generous transparent padding. Background must be truly transparent, including empty spaces beneath the rainbow arch. Consistent with pink dresses, blue-turret castles and green flower stems in a child's garden kingdom drawing.

各张的主体：

- `collectible-heart.png`：one big irregular hot pink heart, rough dark charcoal outline。
- `collectible-star.png`：one wonky five-point star, lemon yellow scribble fill with thick deep purple marker outline。
- `collectible-rainbow.png`：one small simple uneven arch rainbow, broad hand-drawn red yellow green cyan deep blue and pink marker bands, no clouds。

继续复用 `flower.png` 与 `icecream.png`。外轮廓透明，彩笔内部的纸张留白保留。每件宝物统一 10 分，旧 `flowers` 字段存总收集数量以兼容历史库。
