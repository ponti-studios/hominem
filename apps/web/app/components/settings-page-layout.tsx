import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hominem/ui/tabs';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

const SETTINGS_ROUTES = {
  account: '/account',
  security: '/settings/security',
} as const;

type SettingsTab = keyof typeof SETTINGS_ROUTES;

interface SettingsPageLayoutProps {
  currentTab: SettingsTab;
  title: string;
  description: string;
  children: ReactNode;
}

export function SettingsPageLayout({
  currentTab,
  title,
  description,
  children,
}: SettingsPageLayoutProps) {
  const navigate = useNavigate();

  function handleValueChange(value: string) {
    if (value === currentTab) {
      return;
    }

    if (value === 'account' || value === 'security') {
      navigate(SETTINGS_ROUTES[value]);
    }
  }

  return (
    <main className="container mx-auto w-full px-4 py-8 sm:px-6">
      <Tabs value={currentTab} onValueChange={handleValueChange} className="gap-6">
        <header className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          </div>
          <TabsList className="w-full justify-start gap-2 border-x-0 border-t-0 bg-transparent p-0">
            <TabsTrigger value="account" className="flex-none px-0 py-2 sm:px-3">
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-none px-0 py-2 sm:px-3">
              Security
            </TabsTrigger>
          </TabsList>
        </header>
        <TabsContent value={currentTab} className="mt-0">
          {children}
        </TabsContent>
      </Tabs>
    </main>
  );
}
