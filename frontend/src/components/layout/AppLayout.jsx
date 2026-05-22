import Sidebar from './Sidebar';
import { Toaster } from '../ui/Toaster';

export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden app-bg font-sans relative">
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 app-grid pointer-events-none opacity-100" />
      {/* Ambient glow blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-violet-500/[0.04] blur-[100px] pointer-events-none" />
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-full">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
