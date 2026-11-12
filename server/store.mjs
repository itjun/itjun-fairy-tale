import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { findLevel, calculateScore, hasCompleted } from '../shared/levels.js';
import { collectionForPlatforms } from '../shared/collectibles.js';
import { createCampaignWorld, campaignScore, GENERATION_VERSION } from '../shared/campaign.js';

export class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
function integer(value, min, max, label) { if (!Number.isInteger(value) || value < min || value > max) throw new InputError(`${label}不正确`); return value; }
export function validateRun(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('游玩记录不正确');
  const level = findLevel(input.levelId);
  if (!level) throw new InputError('找不到这个关卡');
  if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new InputError('记录编号不正确');
  const started = Date.parse(input.startedAt);
  if (!Number.isFinite(started) || started < Date.UTC(2020, 0, 1) || started > Date.now() + 300000) throw new InputError('游玩时间不正确');
  const scoringVersion = input.scoringVersion === undefined ? 1 : integer(input.scoringVersion, 1, 3, '计分规则');
  const seed = integer(input.seed, 0, 4294967295, '地图编号');
  const generationVersion = scoringVersion === 3 ? integer(input.generationVersion, GENERATION_VERSION, 2, '地图版本') : 0;
  const world = scoringVersion === 3 ? createCampaignWorld(seed, level, generationVersion) : null;
  const treasureCount = world?.treasures.length ?? level.platforms;
  const flowers = integer(input.flowers, 0, treasureCount, '小花数量');
  let collectedIds = [];
  if (scoringVersion >= 2) {
    if (!Array.isArray(input.collectedIds) || input.collectedIds.length !== flowers) throw new InputError('宝物明细与数量不一致');
    collectedIds = input.collectedIds.map(id => integer(id, 1, treasureCount, '宝物位置'));
    if (new Set(collectedIds).size !== collectedIds.length) throw new InputError('同一件宝物不能重复计分');
    collectedIds.sort((a, b) => a - b);
  }
  let defeatedIds = [];
  if (world) {
    if (!Array.isArray(input.defeatedIds) || input.defeatedIds.length > world.enemies.length) throw new InputError('小怪明细不正确');
    defeatedIds = input.defeatedIds.map(id => integer(id, 1, world.enemies.length, '小怪编号')).sort((a,b) => a-b);
    if (new Set(defeatedIds).size !== defeatedIds.length) throw new InputError('同一只小怪不能重复计分');
  }
  const platform = integer(input.platform, 0, world?.zones.length ?? level.platforms, '跳台进度');
  if (!['playing', 'paused', 'ended', 'completed'].includes(input.status)) throw new InputError('记录状态不正确');
  if (input.status === 'completed' && !(world ? flowers >= world.requiredFlowers && platform === world.zones.length : hasCompleted(level, flowers, platform))) throw new InputError('还没完成关卡目标');
  const collection = scoringVersion === 2 ? collectionForPlatforms(level.id, seed, collectedIds, level.platforms) : flowers;
  return { id: input.id, levelId: level.id, startedAt: new Date(started).toISOString(), players: integer(input.players, 1, 2, '玩家数量'), seed, scoringVersion, generationVersion, collectedIds, defeatedIds, flowers, platform, seconds: integer(input.seconds, 0, 604800, '游玩时长'), revision: integer(input.revision, 1, 10000000, '记录版本'), status: input.status, score: world ? campaignScore(world, collectedIds, defeatedIds, input.status === 'completed', level.bonus).score : calculateScore(collection, input.status === 'completed', level) };
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
    CREATE INDEX IF NOT EXISTS runs_level_started ON runs(levelId, startedAt);`);
  // 旧记录保持原分数和旧规则，旧页面/离线队列也可以继续保存。
  const columns = db.prepare('PRAGMA table_info(runs)').all().map(column => column.name);
  if (!columns.includes('scoringVersion')) {
    db.exec(`BEGIN;
      ALTER TABLE runs ADD COLUMN scoringVersion INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE runs ADD COLUMN collectedIds TEXT NOT NULL DEFAULT '[]';
      PRAGMA user_version=2;
      COMMIT;`);
  }
  if (!columns.includes('generationVersion')) {
    db.exec(`BEGIN;
      ALTER TABLE runs ADD COLUMN generationVersion INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE runs ADD COLUMN defeatedIds TEXT NOT NULL DEFAULT '[]';
      PRAGMA user_version=3; COMMIT;`);
  }
  const get = db.prepare('SELECT * FROM runs WHERE id = ?');
  const readRun = id => { const row = get.get(id); return row && { ...row, collectedIds: JSON.parse(row.collectedIds), defeatedIds: JSON.parse(row.defeatedIds) }; };
  const write = db.prepare(`INSERT INTO runs (id, levelId, startedAt, updatedAt, players, seed, flowers, platform, seconds, revision, status, score, scoringVersion, collectedIds, generationVersion, defeatedIds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET updatedAt=excluded.updatedAt, flowers=excluded.flowers,
    platform=excluded.platform, seconds=excluded.seconds, revision=excluded.revision,
    status=excluded.status, score=excluded.score, collectedIds=excluded.collectedIds, defeatedIds=excluded.defeatedIds`);
  return {
    save(input) {
      const run = validateRun(input), previous = readRun(run.id);
      if (previous) {
        if (previous.levelId !== run.levelId || previous.startedAt !== run.startedAt || previous.players !== run.players || previous.seed !== run.seed) throw new InputError('这次游玩的关卡或开始时间不能改变');
        if (previous.scoringVersion !== run.scoringVersion || previous.generationVersion !== run.generationVersion) throw new InputError('这次游玩的计分规则不能改变');
        if (run.revision <= previous.revision || ['completed', 'ended'].includes(previous.status)) return previous;
        run.flowers = Math.max(run.flowers, previous.flowers);
        run.platform = Math.max(run.platform, previous.platform);
        run.seconds = Math.max(run.seconds, previous.seconds);
        if (run.scoringVersion >= 2) {
          run.collectedIds = [...new Set([...previous.collectedIds, ...run.collectedIds])].sort((a, b) => a - b);
          run.flowers = run.collectedIds.length;
        }
        const level = findLevel(run.levelId);
        const collection = run.scoringVersion === 2 ? collectionForPlatforms(run.levelId, run.seed, run.collectedIds, level.platforms) : run.flowers;
        if (run.scoringVersion === 3) {
          run.defeatedIds = [...new Set([...previous.defeatedIds, ...run.defeatedIds])].sort((a,b) => a-b);
          run.score = campaignScore(createCampaignWorld(run.seed, level, run.generationVersion), run.collectedIds, run.defeatedIds, run.status === 'completed', level.bonus).score;
        } else run.score = calculateScore(collection, run.status === 'completed', level);
      }
      write.run(run.id, run.levelId, run.startedAt, new Date().toISOString(), run.players, run.seed, run.flowers, run.platform, run.seconds, run.revision, run.status, run.score, run.scoringVersion, JSON.stringify(run.collectedIds), run.generationVersion, JSON.stringify(run.defeatedIds));
      return readRun(run.id);
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
    importRuns(rows) {
      // A malformed/conflicting backup must not leave a partially imported history.
      db.exec('BEGIN');
      try { for (const row of rows) this.save(row); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); },
  };
}
