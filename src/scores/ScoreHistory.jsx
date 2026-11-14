import { useEffect, useRef, useState } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler } from 'chart.js';
import { ArrowLeft, Trophy, Flower, CalendarBlank, ArrowsClockwise } from '@phosphor-icons/react';
import { LEVELS as WORLDS, STAGES } from '../../shared/levels.js';
import { flushScores, pendingCount } from './client.js';
import './scores.css';
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);
Chart.defaults.font.family = "GardenHand, KaiTi, serif";
function dayString(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function presetDates(preset) { const end = new Date(), start = new Date(); start.setDate(start.getDate() - (preset === '7' ? 6 : preset === '30' ? 29 : 0)); if (preset === 'all') start.setFullYear(2020, 0, 1); return { from: dayString(start), to: dayString(end) }; }
const timeText = value => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const LEVELS = [...WORLDS, ...STAGES.map(stage=>({...stage,name:`${stage.name} / ${stage.chapterName}`}))];
const names = Object.fromEntries(LEVELS.map(level => [level.id, level.name]));
function statusText(run) { if (run.status === 'completed') return '已通关'; if (run.status === 'ended') return '已结束'; return Date.now() - Date.parse(run.updatedAt) > 60000 ? '中途离开' : run.status === 'paused' ? '休息中' : '游玩中'; }
function ScoreChart({ data, view }) {
  const canvas = useRef(null);
  useEffect(() => {
    const isDaily = view === 'daily' || data.isDailyOnly;
    const values = isDaily ? data.days : data.points;
    const datasets = LEVELS.map(level => ({ label: level.name, borderColor: level.color, backgroundColor: level.color, pointRadius: values.length > 100 ? 2 : 4, pointHoverRadius: 7, borderWidth: 2, tension: 0.15,
      data: values.filter(point => point.levelId === level.id).map(point => ({ x: isDaily ? new Date(point.date + 'T12:00:00').getTime() : Date.parse(point.startedAt), y: isDaily ? point.average : point.score, sessions: point.sessions, status: point.status })).sort((a, b) => a.x - b.x) })).filter(dataset => dataset.data.length);
    const chart = new Chart(canvas.current, { type: 'line', data: { datasets }, options: { responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      interaction: { mode: 'nearest', intersect: false }, plugins: { legend: { position: 'bottom', labels: { color: '#6b7059', boxWidth: 16, padding: 22 } }, tooltip: { callbacks: { title: items => isDaily ? new Date(items[0].raw.x).toLocaleDateString('zh-CN') : timeText(items[0].raw.x), label: item => `${item.dataset.label}：${item.raw.y} 分${isDaily ? `（${item.raw.sessions} 次平均）` : ''}` } } },
      scales: { x: { type: 'linear', title: { display: true, text: '游玩时间', color: '#8b806b' }, ticks: { maxTicksLimit: 6, color: '#8b806b', callback: value => new Date(value).toLocaleString('zh-CN', isDaily ? { month: 'numeric', day: 'numeric' } : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) }, grid: { display: false } }, y: { beginAtZero: true, suggestedMax: 50, title: { display: true, text: isDaily ? '平均积分' : '本次积分', color: '#8b806b' }, ticks: { precision: 0, color: '#8b806b' }, grid: { color: '#ebe6d9' } } } } });
    return () => chart.destroy();
  }, [data, view]);
  return <div className="score-chart"><canvas ref={canvas} role="img" aria-label="按游玩时间排列的积分曲线，不同颜色代表不同关卡；每次积分可在下方记录表查看" /></div>;
}
export function ScoreHistory({ onClose }) {
  const [preset, setPreset] = useState('7');
  const [dates, setDates] = useState(() => presetDates('7'));
  const [level, setLevel] = useState('');
  const [view, setView] = useState('runs');
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [syncNote, setSyncNote] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let isActive = true;
    async function load() {
      setIsLoading(true); setError('');
      try {
        const start = new Date(dates.from + 'T00:00:00'), end = new Date(dates.to + 'T00:00:00'); end.setDate(end.getDate() + 1);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new Error('请选择正确的开始和结束日期。');
        const sync = await flushScores(); if (!isActive) return;
        setSyncNote(sync.isSaved ? '' : sync.message);
        const query = new URLSearchParams({ from: start.toISOString(), until: end.toISOString(), level, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, offset: String(offset) });
        const response = await fetch(`/api/scores?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error('成绩本暂时没连上，请确认本机游戏服务正在运行。');
        const result = await response.json();
        if (!result.summary || !Array.isArray(result.records)) throw new Error('请使用项目的 Node 启动器打开成绩本。');
        if (isActive) setData(result);
      } catch (failure) { if (isActive) { setError(failure.message); setData(null); } }
      finally { if (isActive) setIsLoading(false); }
    }
    load(); return () => { isActive = false; controller.abort(); };
  }, [dates.from, dates.to, level, offset, refresh]);
  function choosePreset(value) { setPreset(value); setDates(presetDates(value)); setOffset(0); }
  return <div className="score-screen"><div className="score-shell">
    <header className="score-header"><button className="quiet-button" onClick={onClose}><ArrowLeft size={21} />返回</button><span>花园王国 / 我的成绩本</span><button className="quiet-button" disabled={isLoading} onClick={() => setRefresh(v => v + 1)}><ArrowsClockwise size={20} />刷新</button></header>
    <div className="score-heading"><div><small>每一次探索，都留下小小足迹</small><h1>我的探险成绩本</h1><p>看看收集了多少快乐，也看看每一次的进步。</p></div><Trophy size={60} weight="duotone" /></div>
    <section className="score-filters" aria-label="成绩筛选"><div className="score-presets">{[['today','今天'],['7','近 7 天'],['30','近 30 天'],['all','全部']].map(([id,label]) => <button key={id} aria-pressed={preset===id} onClick={() => choosePreset(id)}>{label}</button>)}</div><div className="score-date-range"><label>开始日期<input type="date" value={dates.from} onChange={e => { setDates(d => ({...d,from:e.target.value})); setPreset('custom'); setOffset(0); }} /></label><label>结束日期<input type="date" value={dates.to} onChange={e => { setDates(d => ({...d,to:e.target.value})); setPreset('custom'); setOffset(0); }} /></label><label>关卡<select value={level} onChange={e => { setLevel(e.target.value); setOffset(0); }}><option value="">全部关卡</option>{LEVELS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></section>
    {syncNote && <p className="score-warning" role="status">{syncNote} 待补存 {pendingCount()} 次。</p>}
    {error ? <div className="score-empty" role="alert"><h2>成绩还在路上</h2><p>{error}</p><button className="primary-button" onClick={()=>setRefresh(v=>v+1)}>再试一次</button></div> : isLoading ? <div className="score-empty" role="status">正在翻开成绩本…</div> : data && <>
      <section className="score-summary" aria-label="积分汇总">{[['累计积分',data.summary.total,'分'],['游玩次数',data.summary.sessions,'次'],['最高积分',data.summary.best,'分'],['平均积分',data.summary.average,'分']].map(([label,value,unit])=><div key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</section>
      <p className="score-caption">所选时间内通关 {data.summary.completed} 次，游玩 {Math.floor(data.summary.seconds/60)} 分 {data.summary.seconds%60} 秒。每次进入一关记一次，双人共同计分。</p>
      <section className="score-chart-card"><div className="score-section-heading"><div><h2>积分的小脚印</h2><p>{view==='daily'||data.isDailyOnly?'每天每个关卡的平均分；没玩的日期不补零。':'每个点是一次游玩，横轴按实际时间间隔排列。'}</p></div><label className="chart-select">查看方式<select aria-label="曲线查看方式" value={data.isDailyOnly?'daily':view} onChange={e=>setView(e.target.value)} disabled={data.isDailyOnly}><option value="runs">每次游玩</option><option value="daily">每天平均</option></select></label></div>
      {data.summary.sessions ? <ScoreChart data={data} view={view} /> : <div className="score-empty"><Flower size={45} weight="duotone" /><h3>这里还没有小脚印</h3><p>换个时间看看，或去花园完成第一次探险吧。</p><button className="primary-button" onClick={onClose}>去探险</button></div>}
      {data.isDailyOnly&&<p className="score-caption">记录超过 1,000 次，曲线按每天平均展示。明细仍可翻页查看。</p>}</section>
      {data.levels.length>0&&<section className="level-score-list" aria-label="各关卡汇总">{LEVELS.map(item=>{const summary=data.levels.find(v=>v.levelId===item.id);return summary&&<div key={item.id}><img src={`./assets/${item.image}.png`} alt="" /><div><strong>{item.name}</strong><span>{summary.sessions} 次游玩 / {summary.completed} 次通关</span><span>累计 {summary.total} 分，最高 {summary.best} 分</span></div></div>;})}</section>}
      <section className="score-records"><div className="score-section-heading"><h2>每次游玩的记录</h2><span>本机时间（{data.timezone}）</span></div><div className="score-table-wrap"><table><thead><tr><th>开始时间</th><th>关卡</th><th>方式</th><th>积分</th><th>收集</th><th>时长</th><th>状态</th></tr></thead><tbody>{data.records.map(run=><tr key={run.id}><td>{new Date(run.startedAt).toLocaleString('zh-CN',{hour12:false})}</td><td>{names[run.levelId]}</td><td>{run.players===2?'双人':'单人'}</td><td><b>{run.score}</b></td><td>{run.flowers}</td><td>{Math.floor(run.seconds/60)}分{run.seconds%60}秒</td><td>{statusText(run)}</td></tr>)}</tbody></table></div>{!data.records.length&&<p className="score-caption">这个时间段还没有游玩记录。</p>}<div className="score-pagination"><button disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-20))}>上一页</button><span>{data.summary.sessions?`${offset+1}–${Math.min(offset+20,data.summary.sessions)} / ${data.summary.sessions}`:'0 条记录'}</span><button disabled={offset+20>=data.summary.sessions} onClick={()=>setOffset(v=>v+20)}>下一页</button></div></section>
    </>}
    <footer className="score-footer"><CalendarBlank size={18} />宝物按种类计分，通关另有奖励。旧成绩保留原分数，掉落不扣分。</footer>
  </div></div>;
}
