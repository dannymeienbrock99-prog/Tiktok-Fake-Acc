function cleanHandle(value = '') {
  return String(value).trim().replace(/^@+/, '');
}

function pick(obj, paths, fallback = '') {
  for (const path of paths) {
    let cur = obj;
    for (const part of path.split('.')) cur = cur?.[part];
    if (cur !== undefined && cur !== null) return cur;
  }
  return fallback;
}

function normalize(provider, payload, requestedHandle) {
  const root = payload?.user || payload?.data?.user || payload?.data || payload || {};
  const stats = root?.stats || root?.authorStats || root?.statistics || {};
  return {
    provider,
    user_id: String(pick(root, ['id','user_id','userId','uid'], '')),
    unique_id: cleanHandle(pick(root, ['unique_id','uniqueId','username','author.uniqueId','secUid'], requestedHandle)),
    nickname: String(pick(root, ['nickname','display_name','displayName','author.nickname'], '')),
    bio: String(pick(root, ['signature','bio','description','author.signature'], '')),
    avatar_url: String(pick(root, ['avatar_url','avatarLarger','avatarMedium','avatarThumb','avatar','author.avatarLarger','author.avatarMedium'], '')),
    follower_count: Number(pick(stats, ['followerCount','followers','follower_count'], pick(root, ['follower_count'], 0))) || 0,
    following_count: Number(pick(stats, ['followingCount','following','following_count'], pick(root, ['following_count'], 0))) || 0,
    likes_count: Number(pick(stats, ['heartCount','heart','diggCount','likes','likes_count'], pick(root, ['likes_count'], 0))) || 0,
    video_count: Number(pick(stats, ['videoCount','videos','video_count'], pick(root, ['video_count'], 0))) || 0,
    verified: pick(root, ['verified'], false) ? 1 : 0,
    region: String(pick(root, ['region','commerceUserInfo.commerceUserRegion'], '')),
    raw_json: JSON.stringify(payload)
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(data?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

async function fetchEuler(handle, apiKey, baseUrl) {
  if (!apiKey) throw new Error('Euler API-Key fehlt.');
  const clean = cleanHandle(handle);
  const base = String(baseUrl || 'https://api.eulerstream.com').replace(/\/$/, '');
  const url = `${base}/tiktok/users/${encodeURIComponent(clean)}/basic`;
  const data = await requestJson(url, { headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' } });
  return normalize('euler', data, clean);
}

async function fetchTikApi(handle, apiKey) {
  if (!apiKey) throw new Error('TikAPI API-Key fehlt.');
  const clean = cleanHandle(handle);
  const url = `https://api.tikapi.io/public/check?username=${encodeURIComponent(clean)}`;
  const data = await requestJson(url, { headers: { 'X-API-KEY': apiKey, 'Accept': 'application/json' } });
  return normalize('tikapi', data, clean);
}

async function fetchCustom(handle, apiKey, template) {
  if (!template) throw new Error('Custom URL-Template fehlt.');
  const clean = cleanHandle(handle);
  const url = template.replaceAll('{username}', encodeURIComponent(clean)).replaceAll('{handle}', encodeURIComponent(clean));
  const headers = { 'Accept': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const data = await requestJson(url, { headers });
  return normalize('custom', data, clean);
}

async function fetchProfile(provider, handle, settings) {
  switch (provider) {
    case 'euler': return fetchEuler(handle, settings.eulerKey, settings.eulerBaseUrl);
    case 'tikapi': return fetchTikApi(handle, settings.tikapiKey);
    case 'custom': return fetchCustom(handle, settings.customKey, settings.customTemplate);
    default: throw new Error(`Unbekannter Provider: ${provider}`);
  }
}

function flattenSearchItems(data) {
  const candidates = [
    data?.results, data?.users, data?.data?.users, data?.data?.results,
    data?.item_list, data?.user_list, data?.data?.user_list,
    data?.response?.results, data?.response?.users
  ];
  for (const value of candidates) if (Array.isArray(value)) return value;
  return [];
}

function normalizeSearchItem(provider, item) {
  const root = item?.user || item?.user_info || item?.author || item;
  const handle = cleanHandle(pick(root, ['unique_id','uniqueId','username','author.uniqueId'], ''));
  if (!handle) return null;
  return normalize(provider, { user: root }, handle);
}

function buildSearchQueries(source) {
  const out = new Set();
  const handle = cleanHandle(source?.unique_id || '');
  const nickname = String(source?.nickname || '').trim();
  if (handle) {
    out.add(handle);
    const withoutNumbers = handle.replace(/[._-]?\d+$/g, '').replace(/[._-]+$/g, '');
    if (withoutNumbers.length >= 3) out.add(withoutNumbers);
    const firstPart = handle.split(/[._-]/)[0];
    if (firstPart.length >= 3) out.add(firstPart);
  }
  if (nickname) {
    out.add(nickname);
    for (const part of nickname.split(/\s+/).filter(x => x.length >= 3).slice(0, 2)) out.add(part);
  }
  return [...out].slice(0, 5);
}

async function searchTikApi(query, apiKey) {
  if (!apiKey) return [];
  const url = `https://api.tikapi.io/public/search/users?query=${encodeURIComponent(query)}`;
  const data = await requestJson(url, { headers: { 'X-API-KEY': apiKey, 'Accept': 'application/json' } });
  return flattenSearchItems(data).map(x => normalizeSearchItem('tikapi', x)).filter(Boolean);
}

async function searchEuler(query, apiKey, baseUrl) {
  if (!apiKey) return [];
  const base = String(baseUrl || 'https://api.eulerstream.com').replace(/\/$/, '');
  const url = `${base}/webcast/rankings/catalog/anchors/search?query=${encodeURIComponent(query)}&limit=20`;
  const data = await requestJson(url, { headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' } });
  return flattenSearchItems(data).map(x => normalizeSearchItem('euler-search', x)).filter(Boolean);
}

async function searchCandidates(source, settings) {
  const queries = buildSearchQueries(source);
  const discovered = [];
  const errors = [];

  for (const query of queries) {
    if (settings.tikapiKey) {
      try { discovered.push(...await searchTikApi(query, settings.tikapiKey)); }
      catch (e) { errors.push(`TikAPI (${query}): ${e.message}`); }
    }
    if (settings.eulerKey) {
      try { discovered.push(...await searchEuler(query, settings.eulerKey, settings.eulerBaseUrl)); }
      catch (e) { errors.push(`Euler (${query}): ${e.message}`); }
    }
  }

  const sourceHandle = cleanHandle(source?.unique_id || '').toLowerCase();
  const byHandle = new Map();
  for (const p of discovered) {
    const key = cleanHandle(p.unique_id).toLowerCase();
    if (!key || key === sourceHandle) continue;
    const existing = byHandle.get(key);
    if (!existing || (p.nickname && !existing.nickname)) byHandle.set(key, p);
  }

  const results = [...byHandle.values()].slice(0, 60);

  // Enrich a limited number of candidates with full public profile data.
  const enrichProvider = settings.tikapiKey ? 'tikapi' : (settings.eulerKey ? 'euler' : null);
  if (enrichProvider) {
    for (let i = 0; i < Math.min(results.length, 15); i++) {
      try { results[i] = await fetchProfile(enrichProvider, results[i].unique_id, settings); }
      catch { /* keep search-result profile */ }
    }
  }

  return { queries, results, errors };
}

module.exports = { fetchProfile, searchCandidates, normalize, cleanHandle };
