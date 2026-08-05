const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

const {
  PAGES,
  OG_IMAGE,
  resolveOrigin,
  buildPageMeta,
  renderPage,
  buildRobotsTxt,
  buildSitemapXml,
  createPageMiddleware
} = require('./page-metadata');

function fakeRequest({ host = 'example.com', protocol = 'https' } = {}) {
  return { protocol, get: (header) => (header.toLowerCase() === 'host' ? host : undefined) };
}

const pageFor = (route) => PAGES.find((page) => page.route === route);

// --- origin resolution -------------------------------------------------

assert.strictEqual(
  resolveOrigin(fakeRequest(), 'https://markdownmash.com'),
  'https://markdownmash.com',
  'APP_BASE_URL must win over the request host'
);

assert.strictEqual(
  resolveOrigin(fakeRequest(), 'https://markdownmash.com/'),
  'https://markdownmash.com',
  'a configured base URL must have its trailing slash stripped'
);

assert.strictEqual(
  resolveOrigin(fakeRequest({ host: 'quiz.school.edu' }), ''),
  'https://quiz.school.edu',
  'an unset APP_BASE_URL must fall back to the request host'
);

assert.strictEqual(
  resolveOrigin(fakeRequest({ host: 'localhost:3000', protocol: 'http' }), ''),
  'http://localhost:3000',
  'host:port and plain http must survive the fallback'
);

// A spoofed Host header must never reach an HTML attribute.
assert.strictEqual(
  resolveOrigin(fakeRequest({ host: 'evil.com"><script>alert(1)</script>' }), ''),
  '',
  'a malformed Host header must not produce an origin'
);

// --- meta construction -------------------------------------------------

const landingMeta = buildPageMeta({
  origin: 'https://markdownmash.com',
  page: pageFor('/')
});

assert.match(landingMeta, /<link rel="canonical" href="https:\/\/markdownmash\.com\/">/);
assert.match(landingMeta, /<meta property="og:url" content="https:\/\/markdownmash\.com\/">/);
assert.match(
  landingMeta,
  new RegExp(`<meta property="og:image" content="https://markdownmash\\.com${OG_IMAGE.path.replace('.', '\\.')}">`),
  'og:image must be an absolute URL on the request origin'
);
assert.match(landingMeta, /<meta name="robots" content="index, follow">/);
assert.match(landingMeta, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(landingMeta, /<meta property="og:image:width" content="1200">/);
assert.match(landingMeta, /<meta property="og:image:height" content="630">/);

for (const route of ['/admin.html', '/play.html', '/present.html']) {
  const meta = buildPageMeta({ origin: 'https://markdownmash.com', page: pageFor(route) });
  assert.match(meta, /<meta name="robots" content="noindex, follow">/, `${route} must be noindex`);
  assert.match(meta, /<meta property="og:image"/, `${route} must still carry an OG image`);
}

// Self-hosted origins must appear verbatim; the official domain must not leak.
const selfHosted = buildPageMeta({ origin: 'https://quiz.school.edu', page: pageFor('/') });
assert.match(selfHosted, /content="https:\/\/quiz\.school\.edu\//);
assert.doesNotMatch(selfHosted, /markdownmash\.com/, 'a self-hosted page must not advertise the official domain');

// --- rendering ---------------------------------------------------------

const rendered = renderPage({
  html: '<!DOCTYPE html><html><head><title>Old</title></head><body>hi</body></html>',
  origin: 'https://markdownmash.com',
  page: pageFor('/')
});

assert.match(rendered, /<title>Markdown Mash - Live classroom quizzes from a Markdown file<\/title>/);
assert.doesNotMatch(rendered, /<title>Old<\/title>/, 'the existing title must be replaced, not duplicated');
assert.strictEqual((rendered.match(/<title>/g) || []).length, 1, 'exactly one title tag must survive');
assert.match(rendered, /<meta property="og:title"[\s\S]*<\/head>/, 'meta must land inside head');
assert.match(rendered, /<body>hi<\/body>/, 'body must be untouched');

// --- robots.txt --------------------------------------------------------

const robots = buildRobotsTxt({ origin: 'https://markdownmash.com' });
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /Sitemap: https:\/\/markdownmash\.com\/sitemap\.xml/);
assert.match(robots, /Disallow: \/api\//);
for (const route of ['/admin.html', '/play.html', '/present.html']) {
  assert.match(robots, new RegExp(`Disallow: ${route.replace('.', '\\.')}`), `${route} must be disallowed`);
}
assert.doesNotMatch(robots, /Disallow: \/terms\.html/, 'indexable pages must not be disallowed');

// --- sitemap.xml -------------------------------------------------------

const sitemap = buildSitemapXml({ origin: 'https://markdownmash.com' });
assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
assert.match(sitemap, /<loc>https:\/\/markdownmash\.com\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/markdownmash\.com\/terms\.html<\/loc>/);
for (const route of ['/admin.html', '/play.html', '/present.html']) {
  assert.doesNotMatch(
    sitemap,
    new RegExp(route.replace('.', '\\.')),
    `${route} is noindex and must be absent from the sitemap`
  );
}
const indexable = PAGES.filter((page) => page.index).length;
assert.strictEqual((sitemap.match(/<url>/g) || []).length, indexable, 'sitemap must list every indexable page exactly once');

// --- assets exist ------------------------------------------------------

for (const asset of [OG_IMAGE.path, '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']) {
  const file = path.join(__dirname, 'public', asset.replace(/^\//, ''));
  assert.ok(fs.existsSync(file), `${asset} must exist in public/`);
}

// --- live HTTP behaviour ----------------------------------------------

const app = express();
app.set('trust proxy', 1);
app.use(createPageMiddleware({ appBaseUrl: '', cache: false }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

function get(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: server.address().port, path: pathname, headers },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

server.listen(0, async () => {
  try {
    const host = `127.0.0.1:${server.address().port}`;
    const expected = `http://${host}`;

    const landing = await get('/');
    assert.strictEqual(landing.status, 200);
    assert.match(landing.headers['content-type'], /text\/html/);
    assert.match(landing.body, new RegExp(`<link rel="canonical" href="${expected}/">`),
      'canonical must reflect the actual serving origin');
    assert.match(landing.body, /<meta property="og:image"/);

    // The real page must survive injection intact.
    assert.match(landing.body, /Turn quick questions into/, 'landing copy must be preserved');
    assert.match(landing.body, /<link rel="stylesheet" href="\/css\/style\.css">/, 'stylesheet link must survive');

    const play = await get('/play.html?session=ABC123');
    assert.strictEqual(play.status, 200);
    assert.match(play.body, /<meta name="robots" content="noindex, follow">/);
    assert.match(play.body, new RegExp(`<link rel="canonical" href="${expected}/play\\.html">`),
      'canonical must drop the query string');

    const robotsRes = await get('/robots.txt');
    assert.strictEqual(robotsRes.status, 200);
    assert.match(robotsRes.headers['content-type'], /text\/plain/);
    assert.match(robotsRes.body, new RegExp(`Sitemap: ${expected}/sitemap\\.xml`));

    const sitemapRes = await get('/sitemap.xml');
    assert.strictEqual(sitemapRes.status, 200);
    assert.match(sitemapRes.headers['content-type'], /xml/);
    assert.match(sitemapRes.body, new RegExp(`<loc>${expected}/</loc>`));

    // Unregistered paths must still be served by express.static.
    const css = await get('/css/style.css');
    assert.strictEqual(css.status, 200, 'static assets must fall through the middleware');
    assert.match(css.headers['content-type'], /css/);

    const image = await get(OG_IMAGE.path);
    assert.strictEqual(image.status, 200, 'the OG image must be reachable');

    server.close();
    console.log('Page metadata, robots.txt, sitemap.xml, and SEO assets passed');
  } catch (error) {
    server.close();
    console.error(error);
    process.exit(1);
  }
});
