import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../store/toast.store';

const roleBadge = {
  manager: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  employee: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  admin: 'bg-amber-100 text-amber-700 border border-amber-200',
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch {
      // Amplify signOut error is non-critical
    } finally {
      logout();
      navigate('/');
    }
  };

  const navLinks = [
    { to: '/dashboard', label: 'Board' },
    { to: '/projects', label: 'Projects' },
  ];

  const role = user?.role;
  const displayName = user?.email || user?.username || 'User';

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        {/* Brand */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-gray-900 font-semibold text-lg tracking-tight hover:opacity-80 transition-opacity shrink-0"
        >
          <span className="text-indigo-600 font-bold text-xl">◈</span>
          <span>Mini Jira</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
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

        {/* User info + logout */}
        <div className="flex items-center gap-3 shrink-0">
          {role && (
            <span className={`hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full capitalize ${roleBadge[role] || roleBadge.employee}`}>
              {role}
            </span>
          )}
          {displayName && (
            <span className="text-sm text-gray-500 hidden md:block max-w-[140px] truncate">
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-all"
          >
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}
