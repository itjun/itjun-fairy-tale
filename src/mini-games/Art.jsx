import { Cloud, CloudRain } from '@phosphor-icons/react';
import { GEMS } from './rainbow.js';
import { FLOWERS, TOOLS } from './flowers.js';
import { FLAVORS, CONTAINERS, TOPPINGS } from './treat.js';

export function Art({ name, className = '', alt = '' }) { return <img className={`mini-art ${className}`} src={`./assets/${name}.png`} alt={alt} draggable="false" />; }
export function Gem({ id, ...props }) { return <Art name={GEMS[id].image} alt={GEMS[id].name} {...props} />; }
export function Bloom({ id, ...props }) { return <Art name={FLOWERS[id].image} alt={FLOWERS[id].name} {...props} />; }
export function Tool({ id, size = 42 }) {
  const image = { water: 'mini-watering-can', sun: 'mini-sun', sunny: 'mini-sun', pollen: 'mini-butterfly' }[id];
  const label = TOOLS[id] || { cloudy: '云遮', rain: '小雨', sunny: '晴天' }[id];
  if (image) return <img src={`./assets/${image}.png`} alt={label} className={`mini-tool mini-tool-art tool-${id}`} style={{ width: size, height: size }} draggable="false" />;
  const Component = { cloudy: Cloud, rain: CloudRain }[id];
  return <Component size={size} weight="duotone" className={`mini-tool tool-${id}`} aria-label={label} />;
}
export function Ingredient({ id }) {
  if (Object.hasOwn(FLAVORS, id)) return <Art name={FLAVORS[id].image} alt={FLAVORS[id].name} />;
  if (Object.hasOwn(CONTAINERS, id)) return <Art name={`mini-${id}`} alt={CONTAINERS[id]} />;
  return <Art name={`collectible-${id}`} alt={TOPPINGS[id]} />;
}
export function IceCream({ build, className = '' }) {
  return <div className={`mini-icecream ${className}`}>
    {build.topping && <div className="ice-topping"><Ingredient id={build.topping} /></div>}
    {[...build.layers].reverse().map((flavor, i) => <div className="ice-scoop" key={i}><Ingredient id={flavor} /></div>)}
    {build.container && <div className="ice-container"><Ingredient id={build.container} /></div>}
  </div>;
}
