process.env.MONGODB_URI = '';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { connectDb, disconnectDb } = require('../src/db');
const { createApp } = require('../src/app');
const SocialAccount = require('../src/models/SocialAccount');
const youtube = require('../src/lib/youtube');
const instagram = require('../src/lib/instagram');
const { encrypt, decrypt } = require('../src/lib/crypto');
const { refreshInstagramTokens } = require('../src/routes/social');

let app;
beforeAll(async () => {
  Object.assign(config.instagram, { appId: 'ig-app', appSecret: 'ig-secret', redirectUri: 'https://example.test/api/social/instagram/callback' });
  config.youtubeApiKey = 'yt-key';
  await connectDb({ inMemory: true });
  app = createApp();
});
afterAll(disconnectDb);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});
afterEach(() => jest.restoreAllMocks());

/** Fake fetch: routes by URL substring → JSON body (or [status, body]). */
function mockFetch(routes) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected fetch ${url}`);
    const r = typeof routes[key] === 'function' ? routes[key](url) : routes[key];
    const [status, body] = Array.isArray(r) ? r : [200, r];
    return new Response(JSON.stringify(body), { status });
  });
}

async function creator(email = `c${Math.random()}@x.in`) {
  const { body } = await request(app).post('/api/auth/otp/request').send({ email });
  const res = await request(app).post('/api/auth/otp/verify').send({ email, code: body.devCode });
  const auth = { Authorization: `Bearer ${res.body.token}` };
  await request(app).post('/api/onboarding/role').set(auth).send({ role: 'creator' });
  await request(app).post('/api/onboarding/creator').set(auth).send({ name: 'Riya', instagram: 'riya' });
  return { auth, id: res.body.user.id };
}

describe('link parsing and token encryption', () => {
  test('YouTube video ids', () => {
    expect(youtube.parseVideoId('https://youtube.com/shorts/abcdEFGH123?feature=share')).toBe('abcdEFGH123');
    expect(youtube.parseVideoId('https://www.youtube.com/watch?v=abcdEFGH123&t=4')).toBe('abcdEFGH123');
    expect(youtube.parseVideoId('https://youtu.be/abcdEFGH123')).toBe('abcdEFGH123');
    expect(youtube.parseVideoId('https://m.youtube.com/shorts/abcdEFGH123')).toBe('abcdEFGH123');
    expect(youtube.parseVideoId('https://vimeo.com/123')).toBeNull();
    expect(youtube.durationSeconds('PT1M5S')).toBe(65);
  });

  test('Instagram shortcodes', () => {
    expect(instagram.parseShortcode('https://www.instagram.com/reel/C9xYz12AbCd/?igsh=abc')).toBe('C9xYz12AbCd');
    expect(instagram.parseShortcode('https://instagram.com/p/C9xYz12AbCd/')).toBe('C9xYz12AbCd');
    expect(instagram.parseShortcode('https://instagram.com/riya/')).toBeNull();
    expect(instagram.parseShortcode('https://evil.com/reel/C9xYz12AbCd/')).toBeNull();
  });

  test('tokens round-trip and are not stored in plain text', () => {
    const enc = encrypt('IGQVJ-secret-token');
    expect(enc).not.toContain('secret');
    expect(decrypt(enc)).toBe('IGQVJ-secret-token');
  });
});

describe('YouTube', () => {
  const channel = { items: [{ id: 'UC123', snippet: { title: 'Riya Clips', customUrl: '@riyaclips', thumbnails: { default: { url: 'https://yt/a.jpg' } } }, statistics: { subscriberCount: '1200', videoCount: '40' } }] };

  test('connect proves channel ownership; a channel can belong to one user only', async () => {
    mockFetch({ '/channels?': channel });
    const a = await creator();
    const res = await request(app).post('/api/social/youtube/connect').set(a.auth).send({ accessToken: 'g'.repeat(30) }).expect(200);
    expect(res.body.account).toMatchObject({ platform: 'youtube', username: 'riyaclips', followers: 1200 });

    const b = await creator();
    await request(app).post('/api/social/youtube/connect').set(b.auth).send({ accessToken: 'g'.repeat(30) }).expect(409);
  });

  test('check a Short: only videos on your own channel', async () => {
    const a = await creator();
    mockFetch({ '/channels?': channel });
    await request(app).post('/api/social/youtube/connect').set(a.auth).send({ accessToken: 'g'.repeat(30) });
    jest.restoreAllMocks();

    const video = (channelId) => ({ items: [{ id: 'abcdEFGH123', snippet: { channelId, title: 'My short' }, contentDetails: { duration: 'PT45S' }, statistics: { viewCount: '15230', likeCount: '900', commentCount: '31' } }] });
    mockFetch({ '/videos?': video('UC123') });
    const ok = await request(app).post('/api/social/check').set(a.auth).send({ url: 'https://youtube.com/shorts/abcdEFGH123' }).expect(200);
    expect(ok.body.stats).toEqual({ views: 15230, likes: 900, comments: 31 });
    expect(ok.body.post.likelyShort).toBe(true);
    expect(String(global.fetch.mock.calls[0][0])).toContain('key=yt-key');

    jest.restoreAllMocks();
    mockFetch({ '/videos?': video('UC_SOMEONE_ELSE') });
    await request(app).post('/api/social/check').set(a.auth).send({ url: 'https://youtube.com/shorts/abcdEFGH123' }).expect(403);
  });
});

describe('Instagram', () => {
  const profile = { user_id: '1789', username: 'riya.edits', name: 'Riya', account_type: 'MEDIA_CREATOR', followers_count: 5400, media_count: 80 };

  async function connect(c) {
    const start = await request(app).get('/api/social/instagram/start').set(c.auth).expect(200);
    const url = new URL(start.body.url);
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_insights');
    mockFetch({
      'api.instagram.com/oauth/access_token': { data: [{ access_token: 'SHORT', user_id: '1789', permissions: 'instagram_business_basic,instagram_business_manage_insights' }] },
      'graph.instagram.com/access_token': { access_token: 'LONG-TOKEN', token_type: 'bearer', expires_in: 5183944 },
      '/me?': profile,
    });
    const cb = await request(app).get(`/api/social/instagram/callback?code=abc%23_&state=${url.searchParams.get('state')}`).expect(302);
    jest.restoreAllMocks();
    return cb;
  }

  test('connect stores an encrypted long-lived token and the profile', async () => {
    const c = await creator();
    const cb = await connect(c);
    expect(cb.headers.location).toBe(`${config.clientOrigin}/app/profile?connected=instagram`);
    const acc = await SocialAccount.findOne({ platform: 'instagram' }).select('+accessTokenEnc');
    expect(acc).toMatchObject({ externalId: '1789', username: 'riya.edits', followers: 5400 });
    expect(acc.accessTokenEnc).not.toContain('LONG-TOKEN');
    expect(decrypt(acc.accessTokenEnc)).toBe('LONG-TOKEN');
    const list = await request(app).get('/api/social/accounts').set(c.auth).expect(200);
    expect(list.body.accounts[0]).not.toHaveProperty('accessTokenEnc');
  });

  test('returns to the site and page the creator started on, never an unknown site', async () => {
    const c = await creator();
    const start = await request(app).get('/api/social/instagram/start?origin=http://127.0.0.1:5173&returnTo=/onboarding/creator').set(c.auth).expect(200);
    const state = new URL(start.body.url).searchParams.get('state');
    const cancelled = await request(app).get(`/api/social/instagram/callback?error=access_denied&error_reason=user_denied&state=${state}`).expect(302);
    expect(cancelled.headers.location).toBe('http://127.0.0.1:5173/onboarding/creator?social_error=instagram_cancelled');

    const evil = await request(app).get('/api/social/instagram/start?origin=https://evil.example&returnTo=https://evil.example').set(c.auth);
    const st2 = new URL(evil.body.url).searchParams.get('state');
    const res = await request(app).get(`/api/social/instagram/callback?error=x&state=${st2}`).expect(302);
    expect(res.headers.location.startsWith(`${config.clientOrigin}/app/profile?`)).toBe(true);
  });

  test('bad or expired state is rejected; personal accounts are refused', async () => {
    const bad = await request(app).get('/api/social/instagram/callback?code=x&state=nope').expect(302);
    expect(bad.headers.location).toContain('social_error=instagram_expired');

    const c = await creator();
    const state = jwt.sign({ sub: c.id }, config.jwtSecret, { audience: 'ig-connect', expiresIn: '10m' });
    mockFetch({
      'api.instagram.com/oauth/access_token': { data: [{ access_token: 'SHORT', user_id: '1', permissions: '' }] },
      'graph.instagram.com/access_token': { access_token: 'LONG', expires_in: 100 },
      '/me?': { ...profile, account_type: 'PERSONAL' },
    });
    const res = await request(app).get(`/api/social/instagram/callback?code=x&state=${state}`).expect(302);
    expect(res.headers.location).toContain('social_error=instagram_not_professional');
  });

  test('check a Reel on your account returns views and engagement', async () => {
    const c = await creator();
    await connect(c);
    mockFetch({
      '/1789/media?': { data: [{ id: 'm1', shortcode: 'C9xYz12AbCd', permalink: 'https://www.instagram.com/reel/C9xYz12AbCd/', media_type: 'VIDEO', like_count: 10 }], paging: {} },
      '/m1/insights?': { data: [{ name: 'views', values: [{ value: 48000 }] }, { name: 'reach', values: [{ value: 30000 }] }, { name: 'likes', values: [{ value: 2100 }] }] },
    });
    const res = await request(app).post('/api/social/check').set(c.auth).send({ url: 'https://www.instagram.com/reel/C9xYz12AbCd/?igsh=x' }).expect(200);
    expect(res.body.stats).toMatchObject({ views: 48000, reach: 30000, likes: 2100 });
    expect(global.fetch.mock.calls.every(([u]) => String(u).includes('LONG-TOKEN'))).toBe(true);

    jest.restoreAllMocks();
    mockFetch({ '/1789/media?': { data: [{ id: 'm2', shortcode: 'OTHERcode12' }], paging: {} } });
    await request(app).post('/api/social/check').set(c.auth).send({ url: 'https://www.instagram.com/reel/C9xYz12AbCd/' }).expect(403);
  });

  test('token refresh renews tokens that are due', async () => {
    const c = await creator();
    await connect(c);
    await SocialAccount.updateOne({ platform: 'instagram' }, { tokenExpiresAt: new Date(Date.now() + 5 * 86400000), tokenRefreshedAt: new Date(Date.now() - 2 * 86400000) });
    mockFetch({ 'refresh_access_token': { access_token: 'NEW-TOKEN', expires_in: 5183944 } });
    const out = await refreshInstagramTokens();
    expect(out).toEqual({ checked: 1, refreshed: 1 });
    const acc = await SocialAccount.findOne({ platform: 'instagram' }).select('+accessTokenEnc');
    expect(decrypt(acc.accessTokenEnc)).toBe('NEW-TOKEN');
  });
});

test('only creators can use social endpoints', async () => {
  const email = 'brand@x.in';
  const { body } = await request(app).post('/api/auth/otp/request').send({ email });
  const res = await request(app).post('/api/auth/otp/verify').send({ email, code: body.devCode });
  const auth = { Authorization: `Bearer ${res.body.token}` };
  await request(app).post('/api/onboarding/role').set(auth).send({ role: 'brand' });
  await request(app).get('/api/social/accounts').set(auth).expect(403);
});

describe('Instagram webhook', () => {
  const crypto = require('crypto');
  beforeAll(() => { config.instagram.webhookVerifyToken = 'verify-me'; });

  test('verification handshake echoes the challenge only with the right token', async () => {
    const ok = await request(app).get('/api/social/instagram/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345').expect(200);
    expect(ok.text).toBe('12345');
    await request(app).get('/api/social/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1').expect(403);
  });

  test('events must be signed with the app secret', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'sha256=' + crypto.createHmac('sha256', 'ig-secret').update(body).digest('hex');
    await request(app).post('/api/social/instagram/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sig).send(body).expect(200);
    await request(app).post('/api/social/instagram/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', 'sha256=bad').send(body).expect(401);
  });
});

describe('insights dashboards', () => {
  const insightsLib = require('../src/lib/insights');
  const profile = { user_id: '1789', username: 'riya.edits', name: 'Riya', account_type: 'MEDIA_CREATOR', followers_count: 5400, media_count: 80 };

  async function connectIg(c) {
    const start = await request(app).get('/api/social/instagram/start').set(c.auth);
    const state = new URL(start.body.url).searchParams.get('state');
    mockFetch({
      'api.instagram.com/oauth/access_token': { data: [{ access_token: 'SHORT', user_id: '1789', permissions: '' }] },
      'graph.instagram.com/access_token': { access_token: 'LONG-TOKEN', expires_in: 5183944 },
      '/me?': profile,
    });
    await request(app).get(`/api/social/instagram/callback?code=abc&state=${state}`);
    jest.restoreAllMocks();
  }

  test('range is split into ≤30-day windows', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    expect(insightsLib.windows(new Date(now - 90 * 86400000), now)).toHaveLength(3);
    expect(insightsLib.engagementRate({ views: 1000, likes: 40, comments: 5, shares: 3, saves: 2 })).toBe(5);
  });

  test('Instagram dashboard: totals, daily reach, top posts, then served from cache', async () => {
    const c = await creator();
    await connectIg(c);
    const today = new Date().toISOString().slice(0, 10);
    const fetchSpy = mockFetch({
      '/1789/insights?': (url) =>
        String(url).includes('time_series')
          ? { data: [{ name: 'reach', values: [{ value: 700, end_time: `${today}T07:00:00+0000` }] }] }
          : { data: [{ name: 'views', total_value: { value: 52000 } }, { name: 'reach', total_value: { value: 31000 } }, { name: 'likes', total_value: { value: 2600 } }, { name: 'saves', total_value: { value: 120 } }] },
      '/1789/media?': { data: [
        { id: 'm1', media_type: 'VIDEO', timestamp: new Date().toISOString(), permalink: 'https://instagram.com/reel/A1/', caption: 'Low' },
        { id: 'm2', media_type: 'VIDEO', timestamp: new Date().toISOString(), permalink: 'https://instagram.com/reel/B2/', caption: 'Top reel\nmore' },
      ], paging: {} },
      '/m1/insights?': { data: [{ name: 'views', values: [{ value: 2000 }] }, { name: 'likes', values: [{ value: 50 }] }] },
      '/m2/insights?': { data: [{ name: 'views', values: [{ value: 50000 }] }, { name: 'likes', values: [{ value: 2550 }] }, { name: 'shares', values: [{ value: 400 }] }] },
      '/me?': profile,
    });
    const res = await request(app).get('/api/social/instagram/insights?days=7').set(c.auth).expect(200);
    expect(res.body.totals).toMatchObject({ views: 52000, reach: 31000, likes: 2600, saves: 120 });
    expect(res.body.series).toHaveLength(7);
    expect(res.body.series.at(-1)).toMatchObject({ date: today, reach: 700, views: 52000 });
    expect(res.body.posts.map((p) => p.id)).toEqual(['m2', 'm1']);
    expect(res.body.posts[0]).toMatchObject({ title: 'Top reel', views: 50000, engagementRate: 5.9 });
    expect(res.body.cached).toBe(false);

    const calls = fetchSpy.mock.calls.length;
    const again = await request(app).get('/api/social/instagram/insights?days=7').set(c.auth).expect(200);
    expect(again.body.cached).toBe(true);
    expect(fetchSpy.mock.calls.length).toBe(calls);
  });

  test('one unsupported account metric does not break the dashboard', async () => {
    const c = await creator();
    await connectIg(c);
    mockFetch({
      '/1789/insights?': (url) => {
        const u = String(url);
        if (u.includes('time_series')) return { data: [] };
        if (u.includes('metric=views%2C')) return [400, { error: { message: 'unsupported metric' } }];
        if (u.includes('metric=views')) return [400, { error: { message: 'unsupported' } }];
        if (u.includes('metric=reach')) return { data: [{ name: 'reach', total_value: { value: 900 } }] };
        return { data: [] };
      },
      '/1789/media?': { data: [], paging: {} },
      '/me?': profile,
    });
    const res = await request(app).get('/api/social/instagram/insights?days=30').set(c.auth).expect(200);
    expect(res.body.totals.reach).toBe(900);
    expect(res.body.totals.views).toBeUndefined();
    expect(res.body.notes.join(' ')).toContain('views');
  });

  test('YouTube dashboard sums recent uploads', async () => {
    const c = await creator();
    mockFetch({ '/channels?part=snippet,statistics&mine=true': { items: [{ id: 'UC123', snippet: { title: 'Riya Clips', customUrl: '@riyaclips' }, statistics: { subscriberCount: '1200' } }] } });
    await request(app).post('/api/social/youtube/connect').set(c.auth).send({ accessToken: 'g'.repeat(30) }).expect(200);
    jest.restoreAllMocks();
    const now = new Date().toISOString();
    mockFetch({
      '/channels?part=snippet%2Cstatistics%2CcontentDetails': { items: [{ id: 'UC123', snippet: { title: 'Riya Clips' }, statistics: { subscriberCount: '1300', videoCount: '41' }, contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] },
      '/playlistItems?': { items: [{ contentDetails: { videoId: 'aaaaaaaaaaa', videoPublishedAt: now } }, { contentDetails: { videoId: 'bbbbbbbbbbb', videoPublishedAt: '2020-01-01T00:00:00Z' } }] },
      '/videos?': { items: [{ id: 'aaaaaaaaaaa', snippet: { channelId: 'UC123', title: 'Short 1', publishedAt: now }, contentDetails: { duration: 'PT30S' }, statistics: { viewCount: '9000', likeCount: '300', commentCount: '12' } }] },
    });
    const res = await request(app).get('/api/social/youtube/insights?days=30').set(c.auth).expect(200);
    expect(res.body.totals).toMatchObject({ views: 9000, likes: 300, comments: 12, shorts: 1 });
    expect(res.body.account.followers).toBe(1300);
    expect(res.body.posts).toHaveLength(1);
  });

  test('not connected → clear error code', async () => {
    const c = await creator();
    const res = await request(app).get('/api/social/instagram/insights').set(c.auth).expect(404);
    expect(res.body.code).toBe('not_connected');
  });
});
