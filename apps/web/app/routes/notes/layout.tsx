import { Outlet } from 'react-router';

export default function NotesLayout() {
  return (
    <div className="flex flex-col h-full">
      <Outlet />
    </div>
  );
}
