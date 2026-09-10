#!/usr/bin/env node
/**
 * Parse the Elementor Markdown dump in src/content/pages/quality-parts.md
 * into structured vendor-directory JSON at src/data/quality-parts.json.
 *
 * Usage: node scripts/parse-quality-parts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'src/content/pages/quality-parts.md');
const OUT = path.join(ROOT, 'src/data/quality-parts.json');

const LINKED_LOGO_RE = /^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)$/;
const BARE_LOGO_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const MD_LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\s*\n/, '');
}

function normalizeAddress(lines) {
  const parts = lines
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)
    .filter((l) => l !== '|' && l !== '---');
  if (!parts.length) return undefined;
  // Join street + city lines; keep comma spacing tidy
  return parts.join(' ').replace(/\s+,/g, ',').replace(/,\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

function parse(markdown) {
  const body = stripFrontmatter(markdown);
  const lines = body.split(/\r?\n/);

  /** @type {{ name: string, id: string, vendors: object[] }[]} */
  const groups = [];
  let current = null;
  /** @type {object | null} */
  let vendor = null;
  /** Pending bare/linked logo before an h5 name */
  let pendingLogo = null;
  let pendingUrl = null;

  function startVendor({ name, url, logo }) {
    vendor = {
      name,
      ...(url ? { url } : {}),
      ...(logo ? { logo } : {}),
    };
    current.vendors.push(vendor);
    pendingLogo = null;
    pendingUrl = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    const h4 = trimmed.match(/^####\s+(.+)$/);
    if (h4) {
      const name = h4[1].trim();
      if (/^product groups$/i.test(name)) {
        vendor = null;
        pendingLogo = null;
        pendingUrl = null;
        continue;
      }
      current = { name, id: slugify(name), vendors: [] };
      groups.push(current);
      vendor = null;
      pendingLogo = null;
      pendingUrl = null;
      continue;
    }

    if (!current) continue;

    const linkedLogo = trimmed.match(LINKED_LOGO_RE);
    if (linkedLogo) {
      // Flush incomplete vendor if somehow mid-card; treat as new card logo
      pendingLogo = linkedLogo[2];
      pendingUrl = linkedLogo[3];
      vendor = null;
      continue;
    }

    const bareLogo = trimmed.match(BARE_LOGO_RE);
    if (bareLogo) {
      pendingLogo = bareLogo[2];
      // keep any prior pendingUrl only if from a linked logo; bare clears url
      pendingUrl = null;
      vendor = null;
      continue;
    }

    const h5 = trimmed.match(/^#####\s+(.+)$/);
    if (h5) {
      const inner = h5[1].trim();
      const link = inner.match(MD_LINK_RE);
      const name = link ? link[1].trim() : inner;
      const url = link ? link[2] : pendingUrl || undefined;
      startVendor({
        name,
        url: url || pendingUrl || undefined,
        logo: pendingLogo || undefined,
      });
      continue;
    }

    const h6 = trimmed.match(/^######\s+(.+)$/);
    if (h6 && vendor) {
      vendor.products = h6[1].trim();
      continue;
    }

    // Address / leftover text lines belonging to current vendor
    if (vendor && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('[!') && !trimmed.startsWith('![')) {
      if (!vendor._addressLines) vendor._addressLines = [];
      vendor._addressLines.push(trimmed);
    }
  }

  // Finalize addresses; drop internal fields
  for (const g of groups) {
    for (const v of g.vendors) {
      const address = normalizeAddress(v._addressLines || []);
      delete v._addressLines;
      if (address) v.address = address;
    }
  }

  return {
    title: 'Quality Parts',
    description:
      'Browse Federated Auto Parts product groups and preferred vendor partners — name-brand appearance, brake, chemical, electrical, engine, and more.',
    generatedFrom: 'src/content/pages/quality-parts.md',
    groups,
  };
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(1);
  }
  const data = parse(fs.readFileSync(SOURCE, 'utf8'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');

  const vendorCount = data.groups.reduce((n, g) => n + g.vendors.length, 0);
  const missingLogo = data.groups.flatMap((g) =>
    g.vendors.filter((v) => !v.logo).map((v) => `${g.name} / ${v.name}`),
  );
  const missingName = data.groups.flatMap((g) =>
    g.vendors.filter((v) => !v.name).map((v) => `${g.name} / (unnamed)`),
  );
  const missingAddr = data.groups.flatMap((g) =>
    g.vendors.filter((v) => !v.address).map((v) => `${g.name} / ${v.name}`),
  );

  console.log(`Wrote ${OUT}`);
  console.log(`Groups: ${data.groups.length}, vendors: ${vendorCount}`);
  for (const g of data.groups) {
    console.log(`  - ${g.name} (${g.id}): ${g.vendors.length}`);
  }
  if (missingLogo.length) console.log(`Missing logos (${missingLogo.length}):`, missingLogo.join('; '));
  if (missingName.length) console.log(`Missing names (${missingName.length}):`, missingName.join('; '));
  if (missingAddr.length) console.log(`Missing addresses (${missingAddr.length}):`, missingAddr.join('; '));
}

main();
