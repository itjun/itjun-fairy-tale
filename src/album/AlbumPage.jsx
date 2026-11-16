import { useState } from 'react';
import { Star } from '@phosphor-icons/react';
import { HomePage } from '../HomePage.jsx';
import { readAlbum, albumPages, albumPieces, albumSources, unlockName, unlockImage, ALBUM_PAGES, PIECES_PER_PAGE } from './album.js';
import './album.css';

const picture = index => `./slideshow/${String(index + 1).padStart(2, '0')}.webp`;
// 每页点亮的顺序不一样，同一页每次打开顺序不变。
function isLit(pageIndex, cell, pieces) {
  for (let step = 0; step < pieces; step++) if ((step * 5 + pageIndex) % PIECES_PER_PAGE === cell) return true;
  return false;
}

export function AlbumPage({ onBack }) {
  const [album] = useState(readAlbum);
  const pages = albumPages(album), total = albumPieces(album);
  const [index, setIndex] = useState(() => Math.min(ALBUM_PAGES.length - 1, Math.floor(total / PIECES_PER_PAGE)));
  const page = pages[index];
  return <HomePage title="我的画册" onBack={onBack} className="home-album">
    <div className="album-layout">
      <figure className="album-picture" aria-label={`第 ${index + 1} 页 ${page.name}，点亮 ${page.pieces} 块，共 ${PIECES_PER_PAGE} 块`}>
        <img src={picture(index)} alt="" draggable="false" />
        <div className="album-pieces" aria-hidden="true">{Array.from({ length: PIECES_PER_PAGE }, (_, cell) => <span key={cell} className={isLit(index, cell, page.pieces) ? 'is-lit' : ''}>{isLit(index, cell, page.pieces) ? '' : '?'}</span>)}</div>
        <figcaption>第 {index + 1} 页　{page.name}　{page.pieces} / {PIECES_PER_PAGE}</figcaption>
      </figure>
      <aside className="album-unlock">
        <h2>{page.isComplete ? '已经解锁' : '集满解锁'}</h2>
        {page.unlocks.map(item => <p key={`${item.type}:${item.id}`} className={page.isComplete ? 'is-open' : ''}><img src={`./assets/${unlockImage(item)}.png`} alt="" />{unlockName(item)}</p>)}
        <h2>贴纸从哪里来</h2>
        <ul>{albumSources(album).map(source => <li key={source.name}>{source.name}<b>{source.count}{source.limit ? ` / ${source.limit}` : ''}</b></li>)}</ul>
        <small>一共点亮 {total} / {ALBUM_PAGES.length * PIECES_PER_PAGE} 块。画册只解锁新东西，不加攻击和血量。</small>
      </aside>
    </div>
    <nav className="album-pages" aria-label="画册页" data-gamepad-tabs="翻页">
      {pages.map(item => <button key={item.index} aria-pressed={item.index === index} aria-label={`第 ${item.index + 1} 页 ${item.name}`} onClick={() => setIndex(item.index)}>
        <img src={picture(item.index)} alt="" draggable="false" className={item.pieces ? '' : 'is-dim'} />
        {item.isComplete ? <Star size={18} weight="fill" /> : <span>{item.pieces}/{PIECES_PER_PAGE}</span>}
      </button>)}
    </nav>
  </HomePage>;
}
