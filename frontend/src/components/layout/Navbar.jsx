import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { useAuthStore } from '../../store/auth.store';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (_) {
      // ignore signout errors
    } finally {
      logout();
      navigate('/');
    }
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/projects', label: 'Projects' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Brand */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-gray-900 font-bold text-xl tracking-tight hover:opacity-75 transition-opacity"
        >
          <span className="text-indigo-600 text-2xl">⬡</span>
          Mini Jira
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* User & Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-gray-500 text-sm hidden sm:block">
              {user.username ?? user.userId ?? 'User'}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-all duration-150"
          >
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}
