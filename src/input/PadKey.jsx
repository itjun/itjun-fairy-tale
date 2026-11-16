// 彩笔风格的手柄按键小图标。颜色跟 Xbox 手柄上的字母一致，孩子能对上。
const LABELS = { stick: '摇杆', view: 'View', menu: '≡' };
export function PadKey({ name }) {
  const id = name.toLowerCase();
  return <kbd className={`pad-key pad-key-${id}`}>{LABELS[id] || name}</kbd>;
}
export function PadHint({ keys, children }) {
  return <span className="pad-hint">{keys.map(name => <PadKey key={name} name={name} />)}<span>{children}</span></span>;
}
