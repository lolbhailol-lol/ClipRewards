import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import App from './App.jsx';
import Backdrop from './components/Backdrop';
import ErrorBoundary, { reloadForUpdate } from './components/ErrorBoundary';
import './index.css';

// A new deploy replaced the file this tab wanted: reload once to get the new version.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForUpdate()) e.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Backdrop />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
