'use strict';

const fs = require('fs');
const path = require('path');

// Serves the public HTML pages with per-request <head> metadata (title,
// description, canonical, Open Graph, Twitter cards) plus generated
// robots.txt and sitemap.xml.
//
// Every customer-facing URL is derived from the request origin rather than
// hardcoded, so an independent deployment advertises its own domain instead of
// the official service. Origin resolution matches the existing convention in
// server.js: APP_BASE_URL when configured, otherwise the request host.

const PUBLIC_DIR = path.join(__dirname, 'public');
const SITE_NAME = 'Markdown Mash';
const THEME_COLOR = '#0d1433';
// JPEG rather than PNG: the artwork is gradient-heavy, and several scrapers
// (WhatsApp in particular) skip preview images much above 300 KB.
const OG_IMAGE = {
  path: '/og-image.jpg',
  width: 1200,
  height: 630,
  type: 'image/jpeg',
  alt: 'Markdown Mash - live classroom quizzes from a Markdown file'
};

// Single source of truth for injected metadata, robots.txt, and sitemap.xml.
// `index: false` keeps a page out of search results while still giving it
// Open Graph tags, so shared links preview correctly even when the URL itself
// has no business being crawled.
const PAGES = [
  {
    route: '/',
    file: 'index.html',
    index: true,
    priority: '1.0',
    changefreq: 'weekly',
    title: 'Markdown Mash - Live classroom quizzes from a Markdown file',
    description:
      'Run live, Kahoot-style quizzes written in plain Markdown. Students join with a room code - no accounts, no installs. Free and open source.'
  },
  {
    route: '/play.html',
    file: 'play.html',
    index: false,
    title: 'Join a quiz - Markdown Mash',
    description:
      'Enter your room code to join a live Markdown Mash quiz. No account required.'
  },
  {
    route: '/present.html',
    file: 'present.html',
    index: false,
    title: 'Presenter view - Markdown Mash',
    description:
      'Full-screen presenter view for running a live Markdown Mash quiz on a projector or shared screen.'
  },
  {
    route: '/admin.html',
    file: 'admin.html',
    index: false,
    title: 'Host dashboard - Markdown Mash',
    description:
      'Upload a quiz, open a room, and run it live from the Markdown Mash host dashboard.'
  },
  {
    route: '/terms.html',
    file: 'terms.html',
    index: true,
    priority: '0.3',
    changefreq: 'yearly',
    title: 'Terms of Service - Markdown Mash',
    description: 'Terms of Service for the Markdown Mash Hosted subscription.'
  },
  {
    route: '/privacy.html',
    file: 'privacy.html',
    index: true,
    priority: '0.3',
    changefreq: 'yearly',
    title: 'Privacy Policy - Markdown Mash',
    description:
      'How Markdown Mash Hosted handles instructor accounts and participant data.'
  },
  {
    route: '/refunds.html',
    file: 'refunds.html',
    index: true,
    priority: '0.3',
    changefreq: 'yearly',
    title: 'Refund Policy - Markdown Mash',
    description: 'Refund terms for the Markdown Mash Hosted annual subscription.'
  }
];

const PAGES_BY_ROUTE = new Map();
for (const page of PAGES) {
  PAGES_BY_ROUTE.set(page.route, page);
  // index.html is reachable both ways; canonical always points at "/".
  if (page.route === '/') PAGES_BY_ROUTE.set('/index.html', page);
}

// Hosts are attacker-controlled when APP_BASE_URL is unset, so anything
// destined for an HTML attribute is escaped on the way out.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

// Accepts hostname[:port] only. A Host header that fails this check falls back
// to a relative-safe empty origin rather than emitting a poisoned absolute URL.
const SAFE_HOST = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

function resolveOrigin(req, appBaseUrl) {
  const configured = String(appBaseUrl || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  const host = req && typeof req.get === 'function' ? req.get('host') : '';
  if (!host || !SAFE_HOST.test(host)) return '';

  const protocol = req.protocol === 'https' ? 'https' : 'http';
  return `${protocol}://${host}`;
}

function absoluteUrl(origin, routePath) {
  const suffix = routePath === '/' ? '/' : routePath;
  return origin ? `${origin}${suffix}` : suffix;
}

function buildPageMeta({ origin, page }) {
  const canonical = absoluteUrl(origin, page.route);
  const image = absoluteUrl(origin, OG_IMAGE.path);
  const robots = page.index
    ? 'index, follow'
    : 'noindex, follow';

  const tags = [
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta name="theme-color" content="${THEME_COLOR}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:type" content="${OG_IMAGE.type}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml(OG_IMAGE.alt)}">`,
    `<link rel="icon" href="/favicon.ico" sizes="32x32">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
  ];

  return tags.map((tag) => `  ${tag}`).join('\n');
}

function renderPage({ html, origin, page }) {
  const meta = buildPageMeta({ origin, page });
  const titleTag = `<title>${escapeHtml(page.title)}</title>`;

  const withTitle = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, titleTag)
    : html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n  ${titleTag}`);

  return withTitle.replace(/<\/head>/i, `${meta}\n</head>`);
}

function buildRobotsTxt({ origin, pages = PAGES }) {
  const disallowed = pages
    .filter((page) => !page.index)
    .map((page) => `Disallow: ${page.route}`);

  const lines = [
    'User-agent: *',
    'Allow: /',
    ...disallowed,
    'Disallow: /api/',
    ''
  ];

  if (origin) lines.push(`Sitemap: ${origin}/sitemap.xml`, '');
  return lines.join('\n');
}

function buildSitemapXml({ origin, pages = PAGES, lastmod = null }) {
  const entries = pages
    .filter((page) => page.index)
    .map((page) => {
      const parts = [
        '  <url>',
        `    <loc>${escapeXml(absoluteUrl(origin, page.route))}</loc>`
      ];
      if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
      if (page.changefreq) parts.push(`    <changefreq>${page.changefreq}</changefreq>`);
      if (page.priority) parts.push(`    <priority>${page.priority}</priority>`);
      parts.push('  </url>');
      return parts.join('\n');
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
}

function createPageMiddleware(options = {}) {
  const {
    publicDir = PUBLIC_DIR,
    appBaseUrl = process.env.APP_BASE_URL || '',
    cache = process.env.NODE_ENV === 'production'
  } = options;

  const fileCache = new Map();

  function readPage(page) {
    if (cache && fileCache.has(page.file)) return fileCache.get(page.file);
    const html = fs.readFileSync(path.join(publicDir, page.file), 'utf8');
    if (cache) fileCache.set(page.file, html);
    return html;
  }

  return function pageMetadata(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const origin = resolveOrigin(req, appBaseUrl);

    if (req.path === '/robots.txt') {
      res.type('text/plain; charset=utf-8');
      return res.send(buildRobotsTxt({ origin }));
    }

    if (req.path === '/sitemap.xml') {
      res.type('application/xml; charset=utf-8');
      return res.send(buildSitemapXml({ origin }));
    }

    const page = PAGES_BY_ROUTE.get(req.path);
    if (!page) return next();

    let html;
    try {
      html = readPage(page);
    } catch (error) {
      // A missing or unreadable page falls through to express.static so the
      // metadata layer can never take the site down on its own.
      return next();
    }

    res.type('text/html; charset=utf-8');
    return res.send(renderPage({ html, origin, page }));
  };
}

module.exports = {
  PAGES,
  OG_IMAGE,
  SITE_NAME,
  THEME_COLOR,
  resolveOrigin,
  absoluteUrl,
  buildPageMeta,
  renderPage,
  buildRobotsTxt,
  buildSitemapXml,
  createPageMiddleware
};
