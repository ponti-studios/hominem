import { useCallback, Suspense } from 'react';
import { Outlet } from 'react-router';

import { PasskeyEnrollmentBanner, usePasskeyAuth } from '~/lib/ui-shims';
import { AppLayout } from '~/lib/ui-shims';
import { Toaster } from '~/lib/ui-shims';

import Header from '../components/header';
import { LoadingScreen } from '../components/loading';

export default function Layout() {
  const { register } = usePasskeyAuth();
  const handleEnroll = useCallback(async () => {
    await register();
  }, [register]);

  return (
    <>
      <PasskeyEnrollmentBanner onEnroll={handleEnroll} />
      <AppLayout navigation={<Header />}>
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </AppLayout>
      <Toaster />
    </>
  );
}
