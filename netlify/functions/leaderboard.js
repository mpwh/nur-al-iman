// Nur Al-Iman leaderboard — Neon PostgreSQL backend
const { neon } = require('@neondatabase/serverless');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

async function getDb() {
  const url = process.env.DATABASE_URL
    || process.env.NEON_DATABASE_URL
    || process.env.POSTGRES_URL;
  if (!url) throw new Error('No DATABASE_URL configured');
  return neon(url);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS leaderboard (
      username    VARCHAR(16) PRIMARY KEY,
      level       INTEGER     NOT NULL DEFAULT 1,
      xp          INTEGER     NOT NULL DEFAULT 0,
      quests_done INTEGER     NOT NULL DEFAULT 0,
      coins       INTEGER     NOT NULL DEFAULT 0,
      rank_title  VARCHAR(60) NOT NULL DEFAULT 'Thalibul Ilmi',
      ts          BIGINT      NOT NULL DEFAULT 0
    )
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    const sql = await getDb();
    await ensureTable(sql);

    // ── GET — return sorted leaderboard ──────────────────────
    if (event.httpMethod === 'GET') {
      const rows = await sql`
        SELECT username, level, xp, quests_done, coins, rank_title, ts
        FROM leaderboard
        ORDER BY quests_done DESC, xp DESC
        LIMIT 100
      `;
      const entries = rows.map(r => ({
        username:   r.username,
        level:      r.level,
        xp:         r.xp,
        questsDone: r.quests_done,
        coins:      r.coins,
        rank:       r.rank_title,
        ts:         Number(r.ts),
      }));
      return { statusCode: 200, headers: CORS, body: JSON.stringify(entries) };
    }

    // ── POST — upsert one player ──────────────────────────────
    if (event.httpMethod === 'POST') {
      let entry;
      try { entry = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'bad json' }) };
      }
      if (!entry?.username) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'username required' }) };
      }

      const u  = String(entry.username).substring(0, 16);
      const lv = parseInt(entry.level)      || 1;
      const xp = parseInt(entry.xp)         || 0;
      const qd = parseInt(entry.questsDone) || 0;
      const co = parseInt(entry.coins)      || 0;
      const rk = String(entry.rank || 'Thalibul Ilmi').substring(0, 60);
      const ts = Date.now();

      await sql`
        INSERT INTO leaderboard (username, level, xp, quests_done, coins, rank_title, ts)
        VALUES (${u}, ${lv}, ${xp}, ${qd}, ${co}, ${rk}, ${ts})
        ON CONFLICT (username) DO UPDATE SET
          level       = EXCLUDED.level,
          xp          = EXCLUDED.xp,
          quests_done = EXCLUDED.quests_done,
          coins       = EXCLUDED.coins,
          rank_title  = EXCLUDED.rank_title,
          ts          = EXCLUDED.ts
      `;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'method not allowed' }) };

  } catch (err) {
    console.error('leaderboard error:', err.message);
    // Return empty array so the game still works with localStorage fallback
    return { statusCode: 200, headers: CORS, body: '[]' };
  }
};
