import Sidebar from './Sidebar';
import { Toaster } from '../ui/Toaster';

export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-8 min-h-full">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
