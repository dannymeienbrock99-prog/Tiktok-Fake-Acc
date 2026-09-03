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
    unique_id: cleanHandle(pick(root, ['unique_id','uniqueId','username','secUid'], requestedHandle)),
    nickname: String(pick(root, ['nickname','display_name','displayName'], '')),
    bio: String(pick(root, ['signature','bio','description'], '')),
    avatar_url: String(pick(root, ['avatar_url','avatarLarger','avatarMedium','avatarThumb','avatar'], '')),
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

module.exports = { fetchProfile, normalize, cleanHandle };
