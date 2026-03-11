import { useDeferredValue, useEffect, useState } from 'react';
import { blogApi } from './lib/blogApi';

const emptyForm = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  content_html: '',
  cover_image_url: '',
  category: '',
  tags: '',
  is_published: false,
  published_at: '',
};

const WORD_LIMITS = {
  title: 12,
  excerpt: 40,
  content: 2500,
};

function slugifyTitle(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function toInputDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function tagsToString(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function tagsToArray(tags) {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sortBlogs(items) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
    const rightDate = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
    return rightDate - leftDate;
  });
}

function mapBlogToForm(blog) {
  return {
    id: blog.id,
    title: blog.title ?? '',
    slug: blog.slug ?? '',
    excerpt: blog.excerpt ?? '',
    content_html: blog.content_html ?? '',
    cover_image_url: blog.cover_image_url ?? '',
    category: blog.category ?? '',
    tags: tagsToString(blog.tags),
    is_published: Boolean(blog.is_published),
    published_at: toInputDateTime(blog.published_at),
  };
}

function countWords(value) {
  const text = String(value ?? '').trim();
  return text ? text.split(/\s+/).length : 0;
}

function stripHtmlTags(value) {
  return String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWordLimitMessage(counts) {
  if (counts.title > WORD_LIMITS.title) {
    return `Title exceeds the ${WORD_LIMITS.title}-word limit.`;
  }

  if (counts.excerpt > WORD_LIMITS.excerpt) {
    return `Excerpt exceeds the ${WORD_LIMITS.excerpt}-word limit.`;
  }

  if (counts.content > WORD_LIMITS.content) {
    return `Content exceeds the ${WORD_LIMITS.content}-word limit.`;
  }

  return '';
}

export default function App() {
  const [blogs, setBlogs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [editorTab, setEditorTab] = useState('html');

  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLowerCase();
  const filteredBlogs = !query
    ? blogs
    : blogs.filter((blog) =>
        [
          blog.title,
          blog.slug,
          blog.category,
          blog.excerpt,
          ...(blog.tags ?? []),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query)),
      );

  const wordCounts = {
    title: countWords(form.title),
    excerpt: countWords(form.excerpt),
    content: countWords(stripHtmlTags(form.content_html)),
  };
  const wordLimitMessage = getWordLimitMessage(wordCounts);
  const hasWordLimitError = Boolean(wordLimitMessage);
  const wordSummary = `Title ${wordCounts.title}/${WORD_LIMITS.title} • Excerpt ${wordCounts.excerpt}/${WORD_LIMITS.excerpt} • Content ${wordCounts.content}/${WORD_LIMITS.content}`;

  useEffect(() => {
    void loadBlogs();
  }, []);

  async function loadBlogs() {
    setIsLoading(true);
    setError('');

    try {
      const data = await blogApi.list();
      const nextBlogs = sortBlogs(data ?? []);
      setBlogs(nextBlogs);

      if (nextBlogs.length > 0) {
        const existing =
          nextBlogs.find((blog) => blog.id === selectedId) ?? nextBlogs[0];
        setSelectedId(existing.id);
        setForm(mapBlogToForm(existing));
      } else {
        setSelectedId(null);
        setForm(emptyForm);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => {
      if (field === 'title') {
        const nextSlug = slugifyTitle(value);
        const shouldSyncSlug =
          !current.slug || current.slug === slugifyTitle(current.title);

        return {
          ...current,
          title: value,
          slug: shouldSyncSlug ? nextSlug : current.slug,
        };
      }

      if (field === 'slug') {
        return { ...current, slug: slugifyTitle(value) };
      }

      return { ...current, [field]: value };
    });
  }

  function selectBlog(blog) {
    setSelectedId(blog.id);
    setForm(mapBlogToForm(blog));
    setEditorTab('html');
    setError('');
    setNotice('');
  }

  function startNewBlog() {
    setSelectedId(null);
    setForm(emptyForm);
    setEditorTab('html');
    setError('');
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const slug = slugifyTitle(form.slug || form.title);

    if (!form.title.trim() || !slug || !form.content_html.trim()) {
      setError('Title, slug, and HTML content are required.');
      return;
    }

    if (hasWordLimitError) {
      setError(wordLimitMessage);
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    const payload = {
      title: form.title.trim(),
      slug,
      excerpt: form.excerpt.trim() || null,
      content_html: form.content_html.trim(),
      cover_image_url: form.cover_image_url.trim() || null,
      category: form.category.trim() || null,
      tags: tagsToArray(form.tags),
      is_published: Boolean(form.is_published),
      published_at: form.is_published
        ? toIsoDateTime(form.published_at) ?? new Date().toISOString()
        : null,
    };

    try {
      const data = form.id
        ? await blogApi.update(form.id, payload)
        : await blogApi.create(payload);

      const nextBlogs = sortBlogs(
        form.id
          ? blogs.map((blog) => (blog.id === data.id ? data : blog))
          : [data, ...blogs],
      );

      setBlogs(nextBlogs);
      setSelectedId(data.id);
      setForm(mapBlogToForm(data));
      setNotice(form.id ? 'Blog updated.' : 'Blog created.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id) {
      return;
    }

    const confirmed = window.confirm(`Delete "${form.title}"?`);
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    try {
      await blogApi.remove(form.id);

      const nextBlogs = blogs.filter((blog) => blog.id !== form.id);
      setBlogs(nextBlogs);

      if (nextBlogs.length > 0) {
        setSelectedId(nextBlogs[0].id);
        setForm(mapBlogToForm(nextBlogs[0]));
      } else {
        setSelectedId(null);
        setForm(emptyForm);
      }

      setEditorTab('html');
      setNotice('Blog deleted.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <p className="eyebrow">Minimal blog CMS</p>
          <h1>Blogs</h1>
        </div>

        <div className="sidebar-controls">
          <button className="secondary-button" type="button" onClick={startNewBlog}>
            New post
          </button>

          <label className="search-field">
            <span>Search</span>
            <input
              type="search"
              placeholder="title, slug, tag"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="sidebar-meta">
          <span>{filteredBlogs.length} posts</span>
          <span>{isLoading ? 'Loading' : 'Ready'}</span>
        </div>

        <div className="sidebar-list">
          {isLoading ? <p className="muted">Loading blogs...</p> : null}

          {!isLoading && filteredBlogs.length === 0 ? (
            <p className="muted">No blogs found. Create one from the editor.</p>
          ) : null}

          {filteredBlogs.map((blog) => (
            <button
              key={blog.id}
              type="button"
              className={`blog-list-item ${blog.id === selectedId ? 'active' : ''}`}
              onClick={() => selectBlog(blog)}
            >
              <strong>{blog.title}</strong>
              <span>{blog.slug}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <form id="blog-form" className="editor-layout" onSubmit={handleSubmit}>
          <header className="editor-header">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>{form.id ? 'Update blog' : 'Create blog'}</h2>
            </div>

            <div className="editor-actions">
              {form.id ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                >
                  Delete
                </button>
              ) : null}

              <button type="submit" disabled={isSaving || hasWordLimitError}>
                {isSaving ? 'Saving...' : form.id ? 'Save changes' : 'Create post'}
              </button>
            </div>
          </header>

          <section className="meta-grid">
            <label className="field field-title">
              <span>Title</span>
              <input
                type="text"
                placeholder="My first blog post"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Slug</span>
              <input
                type="text"
                placeholder="my-first-blog-post"
                value={form.slug}
                onChange={(event) => updateForm('slug', event.target.value)}
              />
            </label>

            <label className="field field-wide">
              <span>Excerpt</span>
              <textarea
                rows="3"
                placeholder="Short summary for the blog card"
                value={form.excerpt}
                onChange={(event) => updateForm('excerpt', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Category</span>
              <input
                type="text"
                placeholder="Guides"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Tags</span>
              <input
                type="text"
                placeholder="react, supabase, html"
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Cover image URL</span>
              <input
                type="url"
                placeholder="https://example.com/cover.jpg"
                value={form.cover_image_url}
                onChange={(event) => updateForm('cover_image_url', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Published at</span>
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(event) => updateForm('published_at', event.target.value)}
                disabled={!form.is_published}
              />
            </label>
          </section>

          <div className="editor-info">
            <label className="publish-toggle">
              <input
                id="is_published"
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => updateForm('is_published', event.target.checked)}
              />
              <span>Published</span>
            </label>

            <p className={`word-note ${hasWordLimitError ? 'word-note-over' : ''}`}>
              {wordSummary}
            </p>
          </div>

          <section className="content-shell">
            <div className="content-header">
              <span className="content-slug">{form.slug || 'untitled-post'}</span>

              <div className="tab-switcher">
                <button
                  type="button"
                  className={editorTab === 'html' ? 'active' : ''}
                  onClick={() => setEditorTab('html')}
                >
                  HTML
                </button>
                <button
                  type="button"
                  className={editorTab === 'preview' ? 'active' : ''}
                  onClick={() => setEditorTab('preview')}
                >
                  Preview
                </button>
              </div>
            </div>

            {editorTab === 'html' ? (
              <textarea
                className="code-editor"
                rows="20"
                placeholder="<article><h1>Hello world</h1></article>"
                value={form.content_html}
                onChange={(event) => updateForm('content_html', event.target.value)}
              />
            ) : (
              <div className="preview-pane">
                <div className="preview-meta">
                  <span>{form.category || 'Uncategorized'}</span>
                  <span>{form.tags || 'No tags'}</span>
                  <span>{form.is_published ? 'Published' : 'Draft'}</span>
                </div>

                <div className="preview-scroll">
                  {form.cover_image_url ? (
                    <img
                      className="cover-preview"
                      src={form.cover_image_url}
                      alt={form.title || 'Cover'}
                    />
                  ) : null}

                  <article
                    className="html-preview"
                    dangerouslySetInnerHTML={{
                      __html:
                        form.content_html ||
                        '<article><h1>Start writing</h1><p>Your HTML preview will render here.</p></article>',
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          <div className="messages">
            {error ? <p className="status error">{error}</p> : null}
            {notice ? <p className="status success">{notice}</p> : null}
            {hasWordLimitError ? <p className="status warning">{wordLimitMessage}</p> : null}
          </div>
        </form>
      </main>
    </div>
  );
}
