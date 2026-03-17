// Nur Al-Iman leaderboard serverless function
// Proxies read/write to a private GitHub Gist so the token stays server-side.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const GIST_ID = process.env.GIST_ID || '';
const GIST_TOKEN = process.env.GIST_TOKEN || '';
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;
const AUTH_HEADER = `token ${GIST_TOKEN}`;

async function readGist() {
  if (!GIST_ID || !GIST_TOKEN) return {};
  const res = await fetch(GIST_URL, {
    headers: { Authorization: AUTH_HEADER, 'User-Agent': 'NurAlIman/1.0' },
  });
  if (!res.ok) return {};
  const data = await res.json();
  try { return JSON.parse(data.files?.['leaderboard.json']?.content || '{}'); }
  catch { return {}; }
}

async function writeGist(obj) {
  if (!GIST_ID || !GIST_TOKEN) return;
  await fetch(GIST_URL, {
    method: 'PATCH',
    headers: {
      Authorization: AUTH_HEADER,
      'User-Agent': 'NurAlIman/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { 'leaderboard.json': { content: JSON.stringify(obj) } } }),
  });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const lb = await readGist();
      const entries = Object.values(lb)
        .filter(e => e && e.username)
        .sort((a, b) => b.questsDone - a.questsDone || b.xp - a.xp);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(entries) };
    }

    if (event.httpMethod === 'POST') {
      let entry;
      try { entry = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: CORS, body: '[]' }; }
      if (!entry || !entry.username) return { statusCode: 400, headers: CORS, body: '[]' };
      const lb = await readGist();
      lb[entry.username] = entry;
      await writeGist(lb);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: CORS, body: '[]' };
  } catch (err) {
    console.error('leaderboard error:', err.message);
    return { statusCode: 200, headers: CORS, body: '[]' };
  }
};
