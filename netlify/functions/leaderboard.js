// Nur Al-Iman leaderboard serverless function
// Proxies read/write to a GitHub Gist so the token stays server-side.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

async function readGist(gistId, gistToken) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `token ${gistToken}`, 'User-Agent': 'NurAlIman/1.0' },
  });
  if (!res.ok) return {};
  const data = await res.json();
  try { return JSON.parse(data.files['leaderboard.json'].content); } catch { return {}; }
}

async function writeGist(gistId, gistToken, obj) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${gistToken}`,
      'User-Agent': 'NurAlIman/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: { 'leaderboard.json': { content: JSON.stringify(obj) } } }),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const gistId = process.env.GIST_ID;
  const gistToken = process.env.GIST_TOKEN;

  try {
    if (event.httpMethod === 'GET') {
      const lb = await readGist(gistId, gistToken);
      const entries = Object.values(lb)
        .filter(e => e && e.username)
        .sort((a, b) => (b.questsDone || 0) - (a.questsDone || 0) || (b.xp || 0) - (a.xp || 0));
      return { statusCode: 200, headers: CORS, body: JSON.stringify(entries) };
    }

    if (event.httpMethod === 'POST') {
      let entry;
      try { entry = JSON.parse(event.body || '{}'); } catch (e) {
        return { statusCode: 400, headers: CORS, body: '[]' };
      }
      if (!entry || !entry.username) return { statusCode: 400, headers: CORS, body: '[]' };
      const lb = await readGist(gistId, gistToken);
      lb[entry.username] = entry;
      await writeGist(gistId, gistToken, lb);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: CORS, body: '[]' };
  } catch (err) {
    console.error('leaderboard error:', err.message);
    return { statusCode: 200, headers: CORS, body: '[]' };
  }
};
