const apiBaseUrl = (() => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }

  return '';
})();

function withBaseUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(withBaseUrl(path), {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    });
  } catch {
    throw new Error('API server is not reachable. Start the backend with `npm run dev`.');
  }

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed.');
  }

  return payload;
}

export const blogApi = {
  async list() {
    return request('/api/blogs');
  },
  async create(payload) {
    return request('/api/blogs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async update(id, payload) {
    return request(`/api/blogs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  async remove(id) {
    return request(`/api/blogs/${id}`, {
      method: 'DELETE',
    });
  },
};
