/** Error from a third-party API, carrying its status and message. */
class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** fetch + JSON with a timeout. Throws ApiError with the provider's message on non-2xx. */
async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: ctrl.signal });
  } catch (err) {
    throw new ApiError(err.name === 'AbortError' ? 'Request timed out' : 'Network error', 0);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error_message || data?.error_description || (typeof data?.error === 'string' ? data.error : '') || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

module.exports = { fetchJson, ApiError };
