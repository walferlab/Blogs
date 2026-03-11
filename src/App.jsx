import { useDeferredValue, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Code2,
  Eye,
  ExternalLink,
  FileText,
  Folder,
  House,
  NotebookPen,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
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

function sortPublishedBlogs(items) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(
      left.published_at ?? left.updated_at ?? left.created_at ?? 0,
    ).getTime();
    const rightDate = new Date(
      right.published_at ?? right.updated_at ?? right.created_at ?? 0,
    ).getTime();
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

function plainExcerpt(value) {
  const text = stripHtmlTags(value);
  if (text.length <= 150) {
    return text;
  }

  return `${text.slice(0, 147).trim()}...`;
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

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function PageHeader() {
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <NotebookPen size={16} strokeWidth={1.8} />
        <span>Minimal Blog</span>
      </Link>

      <nav className="topnav">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <House size={14} strokeWidth={1.8} />
          <span>Blogs</span>
        </NavLink>
        <NavLink
          to="/admin"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <NotebookPen size={14} strokeWidth={1.8} />
          <span>Admin</span>
        </NavLink>
      </nav>
    </header>
  );
}

function BlogListPage({ blogs, isLoading }) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLowerCase();
  const filteredBlogs = !query
    ? blogs
    : blogs.filter((blog) =>
        [blog.title, blog.slug, blog.category, blog.excerpt, ...(blog.tags ?? [])]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query)),
      );

  return (
    <section className="page page-width">
      <div className="page-head">
        <div>
          <p className="section-kicker">
            <FileText size={13} strokeWidth={1.8} />
            <span>Published posts</span>
          </p>
          <h1 className="page-title">All blogs</h1>
          <p className="page-copy">Clean public list. Open any post from here.</p>
        </div>

        <Link className="ghost-link" to="/admin">
          <NotebookPen size={14} strokeWidth={1.8} />
          <span>Manage posts</span>
        </Link>
      </div>

      <label className="search-bar">
        <Search size={14} strokeWidth={1.8} />
        <input
          type="search"
          placeholder="Search blogs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="list-summary">
        <span>{filteredBlogs.length} posts</span>
      </div>

      <div className="blog-grid">
        {isLoading ? <p className="empty-state">Loading blogs...</p> : null}

        {!isLoading && filteredBlogs.length === 0 ? (
          <p className="empty-state">No blogs matched this search.</p>
        ) : null}

        {filteredBlogs.map((blog) => (
          <article key={blog.id} className="blog-card">
            <div className="card-meta">
              <span className="meta-chip">
                <Folder size={12} strokeWidth={1.8} />
                <span>{blog.category || 'General'}</span>
              </span>
              <span className="meta-chip">
                <CalendarDays size={12} strokeWidth={1.8} />
                <span>{formatDate(blog.published_at || blog.created_at)}</span>
              </span>
            </div>

            <h2>{blog.title}</h2>
            <p>{blog.excerpt || plainExcerpt(blog.content_html)}</p>

            <div className="card-footer">
              <div className="tag-row">
                {(blog.tags ?? []).slice(0, 3).map((tag) => (
                  <span key={tag} className="tag-pill">
                    <Tag size={11} strokeWidth={1.8} />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>

              <Link className="inline-link" to={`/blog/${blog.slug}`}>
                <span>Visit</span>
                <ArrowRight size={14} strokeWidth={1.8} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BlogDetailPage({ blogs, isLoading }) {
  const { slug } = useParams();
  const blog = blogs.find((item) => item.slug === slug);

  if (isLoading) {
    return (
      <section className="page page-width">
        <p className="empty-state">Loading blog...</p>
      </section>
    );
  }

  if (!blog) {
    return (
      <section className="page page-width">
        <Link className="back-link" to="/">
          <ArrowLeft size={14} strokeWidth={1.8} />
          <span>Back to blogs</span>
        </Link>
        <div className="not-found">
          <h1 className="page-title">Blog not found</h1>
          <p className="page-copy">The slug does not match any published post.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page page-width">
      <Link className="back-link" to="/">
        <ArrowLeft size={14} strokeWidth={1.8} />
        <span>Back to blogs</span>
      </Link>

      <article className="article">
        <div className="article-head">
          <div className="card-meta">
            <span className="meta-chip">
              <CalendarDays size={12} strokeWidth={1.8} />
              <span>{formatDate(blog.published_at || blog.created_at)}</span>
            </span>
            <span className="meta-chip">
              <Folder size={12} strokeWidth={1.8} />
              <span>{blog.category || 'General'}</span>
            </span>
          </div>

          <h1 className="article-title">{blog.title}</h1>
          {blog.excerpt ? <p className="article-copy">{blog.excerpt}</p> : null}

          <div className="tag-row">
            {(blog.tags ?? []).map((tag) => (
              <span key={tag} className="tag-pill">
                <Tag size={11} strokeWidth={1.8} />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        </div>

        {blog.cover_image_url ? (
          <img className="article-cover" src={blog.cover_image_url} alt={blog.title} />
        ) : null}

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: blog.content_html }}
        />
      </article>
    </section>
  );
}

function AdminPage({
  blogs,
  form,
  selectedId,
  isLoading,
  isSaving,
  error,
  notice,
  editorTab,
  setEditorTab,
  hasWordLimitError,
  wordLimitMessage,
  wordSummary,
  updateForm,
  selectBlog,
  startNewBlog,
  handleSubmit,
  handleDelete,
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLowerCase();
  const filteredBlogs = !query
    ? blogs
    : blogs.filter((blog) =>
        [blog.title, blog.slug, blog.category, blog.excerpt, ...(blog.tags ?? [])]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query)),
      );

  return (
    <section className="admin-page">
      <aside className="admin-sidebar">
        <div className="sidebar-head">
          <div>
            <p className="section-kicker">
              <NotebookPen size={13} strokeWidth={1.8} />
              <span>Editor</span>
            </p>
            <h1 className="sidebar-title">Posts</h1>
          </div>

          <button className="icon-button" type="button" onClick={startNewBlog}>
            <Plus size={14} strokeWidth={1.8} />
            <span>New</span>
          </button>
        </div>

        <label className="search-bar admin-search">
          <Search size={14} strokeWidth={1.8} />
          <input
            type="search"
            placeholder="Search posts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="list-summary">
          <span>{filteredBlogs.length} posts</span>
        </div>

        <div className="admin-list">
          {isLoading ? <p className="empty-state">Loading blogs...</p> : null}

          {!isLoading && filteredBlogs.length === 0 ? (
            <p className="empty-state">No blogs found.</p>
          ) : null}

          {filteredBlogs.map((blog) => (
            <button
              key={blog.id}
              type="button"
              className={`admin-list-item ${blog.id === selectedId ? 'active' : ''}`}
              onClick={() => selectBlog(blog)}
            >
              <div className="admin-list-item-top">
                <strong>{blog.title}</strong>
                <span className={`status-dot ${blog.is_published ? 'published' : 'draft'}`} />
              </div>
              <span>{blog.slug}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="admin-editor">
        <form className="editor-form" onSubmit={handleSubmit}>
          <div className="editor-top">
            <div>
              <p className="section-kicker">
                <FileText size={13} strokeWidth={1.8} />
                <span>{form.id ? 'Edit post' : 'New post'}</span>
              </p>
              <h2 className="editor-title">{form.id ? form.title || 'Untitled' : 'Create blog'}</h2>
            </div>

            <div className="editor-actions">
              {form.id && form.is_published && form.slug ? (
                <Link
                  className="ghost-link"
                  to={`/blog/${form.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} strokeWidth={1.8} />
                  <span>Visit</span>
                </Link>
              ) : null}

              {form.id ? (
                <button
                  className="ghost-danger"
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                  <span>Delete</span>
                </button>
              ) : null}

              <button className="icon-button" type="submit" disabled={isSaving || hasWordLimitError}>
                <Save size={14} strokeWidth={1.8} />
                <span>{isSaving ? 'Saving' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className="editor-grid">
            <label className="input-group input-title">
              <span className="label-row">
                <FileText size={13} strokeWidth={1.8} />
                <span>Title</span>
              </span>
              <input
                type="text"
                placeholder="My first blog post"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
              />
            </label>

            <label className="input-group">
              <span className="label-row">
                <ExternalLink size={13} strokeWidth={1.8} />
                <span>Slug</span>
              </span>
              <input
                type="text"
                placeholder="my-first-blog-post"
                value={form.slug}
                onChange={(event) => updateForm('slug', event.target.value)}
              />
            </label>

            <label className="input-group input-wide">
              <span className="label-row">
                <FileText size={13} strokeWidth={1.8} />
                <span>Excerpt</span>
              </span>
              <textarea
                rows="3"
                placeholder="Short summary"
                value={form.excerpt}
                onChange={(event) => updateForm('excerpt', event.target.value)}
              />
            </label>

            <label className="input-group">
              <span className="label-row">
                <Folder size={13} strokeWidth={1.8} />
                <span>Category</span>
              </span>
              <input
                type="text"
                placeholder="Guides"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
              />
            </label>

            <label className="input-group">
              <span className="label-row">
                <Tag size={13} strokeWidth={1.8} />
                <span>Tags</span>
              </span>
              <input
                type="text"
                placeholder="react, supabase"
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
              />
            </label>

            <label className="input-group">
              <span className="label-row">
                <ExternalLink size={13} strokeWidth={1.8} />
                <span>Cover image</span>
              </span>
              <input
                type="url"
                placeholder="https://example.com/cover.jpg"
                value={form.cover_image_url}
                onChange={(event) => updateForm('cover_image_url', event.target.value)}
              />
            </label>

            <label className="input-group">
              <span className="label-row">
                <CalendarDays size={13} strokeWidth={1.8} />
                <span>Published at</span>
              </span>
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(event) => updateForm('published_at', event.target.value)}
                disabled={!form.is_published}
              />
            </label>
          </div>

          <div className="editor-meta">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => updateForm('is_published', event.target.checked)}
              />
              <span>Published</span>
            </label>

            <p className={`limit-copy ${hasWordLimitError ? 'error' : ''}`}>{wordSummary}</p>
          </div>

          <section className="surface">
            <div className="surface-head">
              <span className="surface-label">{form.slug || 'untitled-post'}</span>

              <div className="surface-tabs">
                <button
                  type="button"
                  className={editorTab === 'html' ? 'active' : ''}
                  onClick={() => setEditorTab('html')}
                >
                  <Code2 size={13} strokeWidth={1.8} />
                  <span>HTML</span>
                </button>
                <button
                  type="button"
                  className={editorTab === 'preview' ? 'active' : ''}
                  onClick={() => setEditorTab('preview')}
                >
                  <Eye size={13} strokeWidth={1.8} />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {editorTab === 'html' ? (
              <textarea
                className="html-editor"
                rows="20"
                placeholder="<article><h1>Hello world</h1></article>"
                value={form.content_html}
                onChange={(event) => updateForm('content_html', event.target.value)}
              />
            ) : (
              <div className="preview-area">
                <div className="preview-topline">
                  <span>{form.category || 'Uncategorized'}</span>
                  <span>{form.tags || 'No tags'}</span>
                  <span>{form.is_published ? 'Published' : 'Draft'}</span>
                </div>

                <div className="preview-body">
                  {form.cover_image_url ? (
                    <img
                      className="preview-cover"
                      src={form.cover_image_url}
                      alt={form.title || 'Cover'}
                    />
                  ) : null}

                  <article
                    className="preview-html"
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

          <div className="message-row">
            {error ? <p className="message error">{error}</p> : null}
            {notice ? <p className="message success">{notice}</p> : null}
            {hasWordLimitError ? <p className="message warning">{wordLimitMessage}</p> : null}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function App() {
  const [blogs, setBlogs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editorTab, setEditorTab] = useState('html');

  const wordCounts = {
    title: countWords(form.title),
    excerpt: countWords(form.excerpt),
    content: countWords(stripHtmlTags(form.content_html)),
  };
  const wordLimitMessage = getWordLimitMessage(wordCounts);
  const hasWordLimitError = Boolean(wordLimitMessage);
  const wordSummary =
    `Title ${wordCounts.title}/${WORD_LIMITS.title} | ` +
    `Excerpt ${wordCounts.excerpt}/${WORD_LIMITS.excerpt} | ` +
    `Content ${wordCounts.content}/${WORD_LIMITS.content}`;
  const publishedBlogs = sortPublishedBlogs(blogs.filter((blog) => blog.is_published));

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
        const existing = nextBlogs.find((blog) => blog.id === selectedId) ?? nextBlogs[0];
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
    <div className="app-root">
      <PageHeader />

      <Routes>
        <Route path="/" element={<BlogListPage blogs={publishedBlogs} isLoading={isLoading} />} />
        <Route
          path="/blog/:slug"
          element={<BlogDetailPage blogs={publishedBlogs} isLoading={isLoading} />}
        />
        <Route
          path="/admin"
          element={
            <AdminPage
              blogs={blogs}
              form={form}
              selectedId={selectedId}
              isLoading={isLoading}
              isSaving={isSaving}
              error={error}
              notice={notice}
              editorTab={editorTab}
              setEditorTab={setEditorTab}
              hasWordLimitError={hasWordLimitError}
              wordLimitMessage={wordLimitMessage}
              wordSummary={wordSummary}
              updateForm={updateForm}
              selectBlog={selectBlog}
              startNewBlog={startNewBlog}
              handleSubmit={handleSubmit}
              handleDelete={handleDelete}
            />
          }
        />
      </Routes>
    </div>
  );
}
