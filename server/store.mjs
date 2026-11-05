import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { findLevel, calculateScore, hasCompleted } from '../shared/levels.js';

export class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
function integer(value, min, max, label) { if (!Number.isInteger(value) || value < min || value > max) throw new InputError(`${label}不正确`); return value; }
export function validateRun(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('游玩记录不正确');
  const level = findLevel(input.levelId);
  if (!level) throw new InputError('找不到这个关卡');
  if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new InputError('记录编号不正确');
  const started = Date.parse(input.startedAt);
  if (!Number.isFinite(started) || started < Date.UTC(2020, 0, 1) || started > Date.now() + 300000) throw new InputError('游玩时间不正确');
  const flowers = integer(input.flowers, 0, level.platforms, '小花数量');
  const platform = integer(input.platform, 0, level.platforms, '跳台进度');
  if (!['playing', 'paused', 'ended', 'completed'].includes(input.status)) throw new InputError('记录状态不正确');
  if (input.status === 'completed' && !hasCompleted(level, flowers, platform)) throw new InputError('还没完成关卡目标');
  return { id: input.id, levelId: level.id, startedAt: new Date(started).toISOString(), players: integer(input.players, 1, 2, '玩家数量'), seed: integer(input.seed, 0, 4294967295, '地图编号'), flowers, platform, seconds: integer(input.seconds, 0, 604800, '游玩时长'), revision: integer(input.revision, 1, 10000000, '记录版本'), status: input.status, score: calculateScore(flowers, input.status === 'completed', level) };
}
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, levelId TEXT NOT NULL, startedAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      players INTEGER NOT NULL, seed INTEGER NOT NULL, flowers INTEGER NOT NULL,
      platform INTEGER NOT NULL, seconds INTEGER NOT NULL, revision INTEGER NOT NULL,
      status TEXT NOT NULL, score INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runs_started ON runs(startedAt);
    CREATE INDEX IF NOT EXISTS runs_level_started ON runs(levelId, startedAt);
    PRAGMA user_version=1;`);
  const get = db.prepare('SELECT * FROM runs WHERE id = ?');
  const write = db.prepare(`INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updatedAt=excluded.updatedAt, flowers=excluded.flowers,
    platform=excluded.platform, seconds=excluded.seconds, revision=excluded.revision,
    status=excluded.status, score=excluded.score`);
  return {
    save(input) {
      const run = validateRun(input), previous = get.get(run.id);
      if (previous) {
        if (previous.levelId !== run.levelId || previous.startedAt !== run.startedAt || previous.players !== run.players || previous.seed !== run.seed) throw new InputError('这次游玩的关卡或开始时间不能改变');
        if (run.revision <= previous.revision || ['completed', 'ended'].includes(previous.status)) return previous;
        run.flowers = Math.max(run.flowers, previous.flowers);
        run.platform = Math.max(run.platform, previous.platform);
        run.seconds = Math.max(run.seconds, previous.seconds);
        run.score = calculateScore(run.flowers, run.status === 'completed', findLevel(run.levelId));
      }
      write.run(run.id, run.levelId, run.startedAt, new Date().toISOString(), run.players, run.seed, run.flowers, run.platform, run.seconds, run.revision, run.status, run.score);
      return get.get(run.id);
    },
    report({ from, until, levelId, timezone = 'Asia/Shanghai', offset = 0 }) {
      if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(until)) || Date.parse(from) >= Date.parse(until)) throw new InputError('请选择有效的开始和结束日期');
      if (levelId && !findLevel(levelId)) throw new InputError('关卡筛选不正确');
      integer(offset, 0, 10000000, '页码');
      let dayFormatter;
      try { dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { throw new InputError('时区不正确'); }
      const where = 'startedAt >= ? AND startedAt < ?' + (levelId ? ' AND levelId = ?' : '');
      const params = [new Date(from).toISOString(), new Date(until).toISOString(), ...(levelId ? [levelId] : [])];
      const summary = db.prepare(`SELECT COUNT(*) AS sessions, COALESCE(SUM(score),0) AS total, COALESCE(MAX(score),0) AS best,
        COALESCE(ROUND(AVG(score),1),0) AS average, COALESCE(SUM(status='completed'),0) AS completed,
        COALESCE(SUM(seconds),0) AS seconds FROM runs WHERE ${where}`).get(...params);
      const levels = db.prepare(`SELECT levelId, COUNT(*) AS sessions, SUM(score) AS total, MAX(score) AS best,
        ROUND(AVG(score),1) AS average, SUM(status='completed') AS completed FROM runs WHERE ${where} GROUP BY levelId`).all(...params);
      const records = db.prepare(`SELECT * FROM runs WHERE ${where} ORDER BY startedAt DESC, id DESC LIMIT 20 OFFSET ?`).all(...params, offset);
      const days = new Map();
      // 迭代读取，汇总不会把所有历史记录同时载入内存。
      for (const row of db.prepare(`SELECT startedAt, levelId, score FROM runs WHERE ${where} ORDER BY startedAt, id`).iterate(...params)) {
        const date = dayFormatter.format(new Date(row.startedAt));
        const key = `${date}:${row.levelId}`;
        const day = days.get(key) || { date, levelId: row.levelId, total: 0, sessions: 0 };
        day.total += row.score; day.sessions++; days.set(key, day);
      }
      const points = summary.sessions <= 1000 ? db.prepare(`SELECT id, startedAt, levelId, score, status FROM runs WHERE ${where} ORDER BY startedAt, id`).all(...params) : [];
      return { summary, levels, records, points, days: [...days.values()].map(day => ({ ...day, average: Math.round(day.total / day.sessions * 10) / 10 })), isDailyOnly: summary.sessions > 1000, timezone, offset };
    },
    close() { db.close(); },
  };
}
