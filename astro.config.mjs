// @ts-check
import { defineConfig } from 'astro/config';
import { rehypePrefixBase } from './src/lib/withBase.ts';

const base = '/FederatedAutoParts/';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://herminott.github.io',
  base,
  trailingSlash: 'always',
  markdown: {
    rehypePlugins: [rehypePrefixBase(base)],
  },
});
