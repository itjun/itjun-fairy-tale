import { miniHint } from './session.js';

export const PHASE_NARRATION = {
  rainbow: [
    '来，我们一起找一找。先看看颜色，再看看形状。不着急，我陪你慢慢来。',
    '线索找齐啦！现在，试着把宝石排一排。放错也没关系，我们可以再调整。',
    '就快找到彩虹啦！看看每一小块的颜色，把它们慢慢接起来吧。',
    '看，彩虹回来啦！这是你一点一点拼好的。真想和你一起，再欣赏一会儿。',
  ],
  garden: [
    '小花园等着我们呢。看看花床上的图案，帮每一颗种子找到自己的家吧。',
    '小芽探出头啦！看看它们现在需要什么。下雨的时候，小雨也能帮我们浇水哦。',
    '花儿开得真好看！我们来配几束花，送给喜欢的人吧。',
    '你把小花照顾得真好。花束也配好啦，家人收到一定很开心。',
  ],
  treat: [
    '欢迎来到甜蜜小屋。先看看家人想吃什么，我们从蛋筒和小杯开始吧。',
    '现在，我们来做多层冰淇淋。照着订单，从下往上放，最后加上小装饰。',
    '两位家人都来啦！先做谁的，由你来决定。另一份会在这里等着你。',
    '大家都收到冰淇淋啦。谢谢你，把这份甜甜的快乐，送给了每一个人。',
  ],
};

export function warmHint(text) {
  return text.replace(/^试着把/, '可以试试，把').replace(/^试着给/, '我们来试试，给')
    .replace(/^先给/, '来，先给').replace(/^下一球放/, '接下来，放一球')
    .replace(/^找一找/, '仔细看看，找一找').replace(/^已经搭配好啦/, '嗯，已经搭配好啦');
}

export function narrationText(session) {
  const hint = miniHint(session);
  if (hint) return warmHint(hint);
  return PHASE_NARRATION[session.id][session.tasks[session.taskIndex]?.phase ?? 3];
}

// 文件名只取决于文案，更新某一句时不会影响其他录制片段。
export function narrationFile(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  return `guide-${hash.toString(16)}.mp3`;
}
