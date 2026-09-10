#!/usr/bin/env node
/**
 * Download WordPress media from the federated-rebuild manifest (+ any
 * wp-content/uploads URLs still in src/content), store under
 * public/media/uploads/YYYY/MM/..., rewrite Markdown to /media/..., and
 * copy brand assets into public/media/brand/.
 *
 * Usage: node scripts/download-media.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = '/workspace/federated-rebuild/media/manifest.json';
const BRAND_DIR = '/workspace/federated-rebuild/assets/brand';
const HOST = 'http://35.92.119.176.nip.io';
const CONCURRENCY = 8;
const TIMEOUT_MS = 45_000;

const MEDIA_RE =
  /https?:\/\/35\.92\.119\.176\.nip\.io(\/wp-content\/(?:uploads|plugins)\/[^\s"'\)\]\>]+)/g;

function cleanPathPart(p) {
  return decodeURIComponent(p.split('?')[0].split('#')[0]).replace(/[.,;:!?)\]}>]+$/, '');
}

function urlToLocalRel(url) {
  const u = url.startsWith('http') ? url : HOST + url;
  const idx = u.indexOf('/wp-content/');
  if (idx === -1) return null;
  const rest = cleanPathPart(u.slice(idx + '/wp-content/'.length));
  // uploads/... or plugins/...
  if (!rest.startsWith('uploads/') && !rest.startsWith('plugins/')) return null;
  return `media/${rest}`;
}

function localPublicPath(rel) {
  return path.join(ROOT, 'public', rel);
}

function localUrl(rel) {
  return '/' + rel.split(path.sep).join('/');
}

function collectUrls() {
  const set = new Set();
  if (fs.existsSync(MANIFEST)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    for (const item of manifest) {
      if (item.url && item.url.includes('/wp-content/')) {
        set.add(item.url.replace(/\/$/, ''));
      }
    }
  }
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(md|astro|ts|js|mjs|css|html)$/.test(ent.name)) {
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(MEDIA_RE)) {
          set.add(HOST + cleanPathPart(m[1]));
        }
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  return [...set];
}

async function downloadOne(url, dest, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'FederatedAutoParts-media-mirror/1.0' },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return { ok: true, bytes: buf.length };
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500));
      return downloadOne(url, dest, attempt + 1);
    }
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function rewriteMarkdown() {
  let filesRewritten = 0;
  let replacements = 0;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) {
        let text = fs.readFileSync(p, 'utf8');
        const before = text;
        text = text.replace(MEDIA_RE, (_full, pathPart) => {
          const rel = urlToLocalRel(HOST + cleanPathPart(pathPart));
          if (!rel) return _full;
          replacements++;
          return localUrl(rel);
        });
        // bare /wp-content/uploads|plugins/...
        text = text.replace(/(?<![/\w])\/wp-content\/(uploads|plugins)\/([^\s"'\)\]\>]+)/g, (_full, kind, rest) => {
          const rel = `media/${kind}/${cleanPathPart(rest)}`;
          replacements++;
          return localUrl(rel);
        });
        if (text !== before) {
          fs.writeFileSync(p, text);
          filesRewritten++;
        }
      }
    }
  };
  walk(path.join(ROOT, 'src', 'content'));
  return { filesRewritten, replacements };
}

function copyBrand() {
  const destDir = path.join(ROOT, 'public', 'media', 'brand');
  fs.mkdirSync(destDir, { recursive: true });
  const copied = [];
  if (!fs.existsSync(BRAND_DIR)) return copied;
  for (const name of fs.readdirSync(BRAND_DIR)) {
    if (name === 'downloaded.json') continue;
    const src = path.join(BRAND_DIR, name);
    if (!fs.statSync(src).isFile()) continue;
    const dest = path.join(destDir, name);
    fs.copyFileSync(src, dest);
    copied.push(name);
  }
  // Prefer canonical logo filename for header
  const gold = path.join(destDir, 'federatedgoldlogo.png');
  const logoOut = path.join(destDir, 'federated-logo.png');
  if (fs.existsSync(gold)) {
    fs.copyFileSync(gold, logoOut);
    copied.push('federated-logo.png');
  }
  return copied;
}

function writeReport(report) {
  const out = path.join(ROOT, 'scripts', 'media-download-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  return out;
}

async function main() {
  console.log('Collecting URLs...');
  const urls = collectUrls();
  console.log(`Found ${urls.length} unique upload URLs`);

  const attempted = urls.length;
  let downloaded = 0;
  let skippedExisting = 0;
  const failed = [];

  await mapPool(urls, CONCURRENCY, async (url) => {
    const rel = urlToLocalRel(url);
    if (!rel) {
      failed.push({ url, error: 'bad path' });
      return;
    }
    const dest = localPublicPath(rel);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skippedExisting++;
      downloaded++;
      return;
    }
    process.stdout.write(`  GET ${url}\n`);
    const result = await downloadOne(url, dest);
    if (result.ok) {
      downloaded++;
    } else {
      failed.push({ url, ...result });
      console.error(`  FAIL ${url}: ${result.error || result.status}`);
    }
  });

  console.log('Copying brand assets...');
  const brandCopied = copyBrand();

  console.log('Rewriting Markdown...');
  const { filesRewritten, replacements } = rewriteMarkdown();

  // size
  let totalBytes = 0;
  const walkSize = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walkSize(p);
      else totalBytes += fs.statSync(p).size;
    }
  };
  walkSize(path.join(ROOT, 'public', 'media'));

  const report = {
    attempted,
    downloaded,
    skippedExisting,
    failedCount: failed.length,
    failed: failed.slice(0, 50),
    brandCopied,
    filesRewritten,
    replacements,
    totalBytes,
    totalMB: +(totalBytes / (1024 * 1024)).toFixed(2),
  };
  const reportPath = writeReport(report);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
