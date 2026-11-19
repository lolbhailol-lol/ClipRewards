import { Component } from 'react';

const RELOAD_KEY = 'cr_reloaded_for_update';

/** After a new deploy, an open tab may ask for files that no longer exist. Reload once to get the new version. */
export function isStaleBuildError(err) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(String(err?.message || err));
}

export function reloadForUpdate() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false; // already tried once this session
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

/** Shows a friendly screen instead of a blank page if something on a page crashes. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (isStaleBuildError(error) && reloadForUpdate()) return;
    console.error('[app] page crashed', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="mt-2 text-sm text-muted">This page hit a problem. Reloading usually fixes it. Your account and earnings are safe.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-fg hover:bg-primary-hover">
              Reload
            </button>
            <a href="/" className="glass inline-flex h-11 items-center rounded-full px-6 text-sm font-medium">
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
