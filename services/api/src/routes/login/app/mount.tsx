// @jsxImportSource react
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { queryClient } from './query-client';

import './styles.css';

export function mountApp(node: ReactNode) {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
    </StrictMode>,
  );
}
