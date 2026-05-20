import Navbar from './Navbar';
import Toaster from '../ui/Toaster';

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
