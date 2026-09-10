/**
 * Prefix site `base` onto root-absolute paths so assets and internal links
 * work on GitHub project Pages (`/FederatedAutoParts/`) and locally with base.
 */
export function withBase(path: string | undefined | null): string {
  if (!path) return '';
  if (
    /^(https?:|mailto:|tel:|data:)/i.test(path) ||
    path.startsWith('//') ||
    path.startsWith('#')
  ) {
    return path;
  }

  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  if (path.startsWith(normalizedBase)) return path;

  if (path.startsWith('/')) {
    return `${normalizedBase}${path.slice(1)}`;
  }

  return `${normalizedBase}${path}`;
}

/** Rehype plugin factory: rewrite root-absolute href/src in Markdown HTML. */
export function rehypePrefixBase(base: string) {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

  function rewrite(url: unknown): unknown {
    if (typeof url !== 'string') return url;
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    if (normalizedBase && url.startsWith(`${normalizedBase}/`)) return url;
    if (normalizedBase === '' || normalizedBase === '/') return url;
    return `${normalizedBase}${url}`;
  }

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'element' && node.properties) {
      if ('href' in node.properties) node.properties.href = rewrite(node.properties.href);
      if ('src' in node.properties) node.properties.src = rewrite(node.properties.src);
      if (typeof node.properties.srcSet === 'string') {
        node.properties.srcSet = node.properties.srcSet
          .split(',')
          .map((part: string) => {
            const [u, ...rest] = part.trim().split(/\s+/);
            return [rewrite(u), ...rest].join(' ');
          })
          .join(', ');
      }
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  }

  return () => (tree: any) => {
    walk(tree);
  };
}
