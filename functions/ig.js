// Short link for the Instagram bio: counts the tap (city, device, time), then opens the site tagged as Instagram.
export async function onRequestGet({ request, env, waitUntil }) {
  const cf = request.cf || {};
  const ua = request.headers.get('user-agent') || '';
  const bot = /bot|crawl|spider|facebookexternalhit|preview|whatsapp/i.test(ua);
  if (env.DB && !bot) {
    const db = env.DB;
    waitUntil((async () => {
      await db.prepare('CREATE TABLE IF NOT EXISTS clicks (t INTEGER NOT NULL, link TEXT, city TEXT, region TEXT, country TEXT, device TEXT)').run();
      await db.prepare('INSERT INTO clicks (t, link, city, region, country, device) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(Date.now(), 'ig', cf.city || '', cf.region || '', cf.country || '', /iphone|ipad|android|mobile/i.test(ua) ? 'phone' : 'computer').run();
    })().catch(() => {}));
  }
  const url = new URL(request.url);
  return new Response(null, { status: 302, headers: { location: `${url.origin}/?utm_source=instagram&utm_medium=bio`, 'cache-control': 'no-store' } });
}
