import type { Preview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, passthrough } from 'msw';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { TooltipProvider } from '~/components/ui/tooltip';
import { HonoProvider } from '~/lib/api/provider';

import '../app/app.css';

const StoryContentContext = createContext<ReactNode>(null);

function StoryRoute() {
  return useContext(StoryContentContext);
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  const [router] = useState(() =>
    createMemoryRouter([{ path: '*', element: <StoryRoute />, action: () => null }], {
      initialEntries: ['/'],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <HonoProvider baseUrl="/">
        <TooltipProvider>
          <StoryContentContext.Provider value={children}>
            <RouterProvider router={router} />
          </StoryContentContext.Provider>
        </TooltipProvider>
      </HonoProvider>
    </QueryClientProvider>
  );
}

const preview: Preview = {
  loaders: [mswLoader()],
  decorators: [
    (Story) => (
      <Providers>
        <Story />
      </Providers>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light' },
    msw: {
      handlers: [http.get('/rive/mana-2.0.riv', () => passthrough())],
    },
  },
};

export default preview;
