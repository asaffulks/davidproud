import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Writings — poems, philosophy, essays. Created by David through /admin.
const writings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(['Poetry', 'Philosophy']).default('Poetry'),
    excerpt: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// Testimonials — from students/readers. Body of the file is the quote.
const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/testimonials' }),
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),   // e.g. "Philosophy undergraduate" / "Private student"
    order: z.number().default(0),  // lower = shown first
    draft: z.boolean().default(false),
  }),
});

// Editable page content (Home, About, Tutoring, Contact) so David can revise it in /admin.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    // Contact page
    email: z.string().optional(),
    linkedin: z.string().optional(),
    // Home page
    tutoringText: z.string().optional(),
    contactText: z.string().optional(),
  }),
});

export const collections = { writings, testimonials, pages };
