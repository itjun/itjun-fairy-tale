import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from '@phosphor-icons/react';
import './home-menu.css';

export const artworkNames = ['爱心花园', '绿色小城堡', '我们在一起', '阳光下的小家', '粉色城堡', '彩虹花园王国', '幸福的一家人', '蓝色大城堡', '我的花园王国', '超级冰淇淋', '高高的城堡'];
export const turns = [-90, -90, -90, -90, 90, 90, -90, -90, 0, 0, 0];

export function HomeMenu({ savedAdventure, isActive, onAdventure, onNewAdventure, onMiniGames, onOptions }) {
  const [index, setIndex] = useState(8);
  const [isPlaying, setIsPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [isVisible, setIsVisible] = useState(!document.hidden);
  useEffect(() => {
    const onVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!isPlaying || !isActive || !isVisible) return;
    const timer = setTimeout(() => setIndex(value => (value + 1) % 11), 8000);
    return () => clearTimeout(timer);
  }, [index, isPlaying, isActive, isVisible]);
  return <main className="home-menu">
    <div className="home-artworks" aria-hidden="true">
      {artworkNames.map((name, i) => <div key={name} className={`home-slide ${i === index ? 'is-current' : ''}`}>
        <svg className="home-paper" width="100%" height="100%" focusable="false">
          <defs>
            <pattern id={`home-paper-${i}`} width="200" height="200" patternUnits="userSpaceOnUse">
              <image href={`./slideshow/${String(i + 1).padStart(2, '0')}.webp`} width="1672" height="941" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#home-paper-${i})`} />
        </svg>
        <img src={`./slideshow/${String(i + 1).padStart(2, '0')}.webp`} alt="" draggable="false" />
      </div>)}
    </div>
    <header className="home-title"><h1>花园王国</h1><p>一个小画家的奇妙世界</p></header>
    <nav className="home-navigation" aria-label="游戏主菜单">
      <button className="home-menu-button home-play" onClick={onAdventure}>{savedAdventure ? (savedAdventure.state.survival?.phase === 'over' ? '查看探险结算' : '继续跳台探险') : '彩笔跳台探险'}</button>
      {savedAdventure && <button className="home-menu-button" onClick={onNewAdventure}>新冒险</button>}
      <button className="home-menu-button" onClick={onMiniGames}>小游戏</button>
      <button className="home-menu-button" onClick={onOptions}>选项</button>
    </nav>
    <div className="home-slideshow" role="group" aria-label="原画轮播">
      <span className="home-art-caption">{artworkNames[index]}<small>{index + 1} / 11</small></span>
      <button aria-label="上一张背景原画" onClick={() => setIndex((index + 10) % 11)}><ArrowLeft size={20} /></button>
      <button aria-label={isPlaying ? '暂停原画轮播' : '播放原画轮播'} onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause size={19} /> : <Play size={19} />}</button>
      <button aria-label="下一张背景原画" onClick={() => setIndex((index + 1) % 11)}><ArrowRight size={20} /></button>
    </div>
  </main>;
}
