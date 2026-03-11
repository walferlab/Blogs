import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const app = express();
const port = Number(process.env.PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const distIndex = path.join(distDir, 'index.html');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const isServerConfigured = Boolean(supabaseUrl && serviceRoleKey);

const supabase = isServerConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const currentModulePath = fileURLToPath(import.meta.url);

function slugifyTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function tagsToArray(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeBlogPayload(input) {
  const title = String(input.title ?? '').trim();
  const slug = slugifyTitle(input.slug || title);
  const isPublished = Boolean(input.is_published);
  const requestedPublishedAt = input.published_at ? new Date(input.published_at) : null;
  const publishedAt =
    isPublished && requestedPublishedAt && !Number.isNaN(requestedPublishedAt.getTime())
      ? requestedPublishedAt.toISOString()
      : isPublished
        ? new Date().toISOString()
        : null;

  return {
    title,
    slug,
    excerpt: String(input.excerpt ?? '').trim() || null,
    content_html: String(input.content_html ?? '').trim(),
    cover_image_url: String(input.cover_image_url ?? '').trim() || null,
    category: String(input.category ?? '').trim() || null,
    tags: tagsToArray(input.tags),
    is_published: isPublished,
    published_at: publishedAt,
  };
}

function requireServerConfig(response) {
  if (isServerConfigured) {
    return true;
  }

  response.status(500).json({
    error:
      'Server is missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
  });

  return false;
}

function validatePayload(payload) {
  if (!payload.title || !payload.slug || !payload.content_html) {
    return 'Title, slug, and HTML content are required.';
  }

  return null;
}

function sendSupabaseError(request, response, error) {
  console.error(`[${request.method} ${request.originalUrl}]`, error);

  if (error?.code === '23505') {
    response.status(409).json({ error: 'Slug already exists. Use a unique title or slug.' });
    return;
  }

  response.status(500).json({ error: error?.message || 'Supabase request failed.' });
}

app.use((request, response, next) => {
  if (process.env.NODE_ENV !== 'production') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, configured: isServerConfigured });
});

app.get('/api/blogs', async (request, response) => {
  if (!requireServerConfig(response)) {
    return;
  }

  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    sendSupabaseError(request, response, error);
    return;
  }

  response.json(data ?? []);
});

app.post('/api/blogs', async (request, response) => {
  if (!requireServerConfig(response)) {
    return;
  }

  const payload = normalizeBlogPayload(request.body);
  const validationError = validatePayload(payload);

  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const { data, error } = await supabase
    .from('blogs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    sendSupabaseError(request, response, error);
    return;
  }

  response.status(201).json(data);
});

app.put('/api/blogs/:id', async (request, response) => {
  if (!requireServerConfig(response)) {
    return;
  }

  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: 'Invalid blog id.' });
    return;
  }

  const payload = normalizeBlogPayload(request.body);
  const validationError = validatePayload(payload);

  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const { data, error } = await supabase
    .from('blogs')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    sendSupabaseError(request, response, error);
    return;
  }

  response.json(data);
});

app.delete('/api/blogs/:id', async (request, response) => {
  if (!requireServerConfig(response)) {
    return;
  }

  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    response.status(400).json({ error: 'Invalid blog id.' });
    return;
  }

  const { error } = await supabase.from('blogs').delete().eq('id', id);

  if (error) {
    sendSupabaseError(request, response, error);
    return;
  }

  response.json({ success: true });
});

if (fs.existsSync(distIndex)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(distIndex);
  });
} else {
  app.get('/', (_request, response) => {
    response.send('Frontend build not found. Use npm run dev for local development.');
  });
}

app.use((error, request, response, _next) => {
  console.error(`[${request.method} ${request.originalUrl}] Unhandled error`, error);
  response.status(500).json({ error: error?.message || 'Internal server error.' });
});

export { app, isServerConfigured };

export function startServer(listenPort = port) {
  const server = app.listen(listenPort, () => {
    const address = server.address();
    const activePort =
      typeof address === 'object' && address !== null ? address.port : listenPort;
    console.log(`Blog server running on http://localhost:${activePort}`);
  });

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentModulePath) {
  startServer();
}
