import { Toaster } from '@hominem/ui/toaster';
import { Outlet } from 'react-router';

export default function AuthLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
