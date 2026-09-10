import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    slug: z.string(),
    draft: z.boolean().default(false),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    sourceUrl: z.string().optional(),
    wpId: z.number().optional(),
    featuredImage: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    sourceUrl: z.string().optional(),
    wpId: z.number().optional(),
    draft: z.boolean().default(false),
    featuredImage: z.string().optional(),
    menuOrder: z.number().optional(),
    parentSlug: z.string().optional(),
    template: z.enum(['marketing', 'legal', 'home']).or(z.string()).optional(),
  }),
});

export const collections = { news, pages };
