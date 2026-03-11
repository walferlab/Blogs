# Minimal Blog CMS

A simple React blog manager built around the `public.blogs` schema, with Supabase access handled by a local Node API.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase URL and service role key.
4. Run `npm run dev`.

## Notes

- The React app talks to `/api/blogs`; only the Node server reads the service role key.
- Keep `SUPABASE_SERVICE_ROLE_KEY` unprefixed. Do not expose it as `VITE_*`.
- `VITE_SUPABASE_URL` is supported for convenience, but `SUPABASE_URL` is the safer long-term name.
- In development, the frontend defaults to `http://localhost:8787` for the API. Override it with `VITE_API_URL` if needed.

## Features

- Create, edit, update, and delete blogs from the `blogs` table.
- Auto-generate hyphenated slugs from the blog title.
- Paste raw HTML into the editor and preview it live.
- Manage excerpt, cover image, category, tags, publish state, and publish date.
