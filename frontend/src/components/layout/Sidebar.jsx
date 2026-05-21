import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import {
  LayoutGrid,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/avatar';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Board',    icon: LayoutGrid },
  { to: '/projects',  label: 'Projects', icon: FolderKanban },
];

const ROLE_COLORS = {
  manager:  'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30',
  employee: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  admin:    'bg-amber-500/20 text-amber-300 ring-amber-500/30',
};

function NavItem({ to, label, icon: Icon, active }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
        active
          ? 'bg-sidebar-accent text-white'
          : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
      )}
    >
      <Icon
        size={16}
        className={cn(
          'shrink-0 transition-colors',
          active ? 'text-white' : 'text-sidebar-muted group-hover:text-sidebar-foreground'
        )}
      />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      /* non-critical */
    } finally {
      logout();
      navigate('/');
    }
  };

  const displayName = user?.email?.split('@')[0] || user?.username || 'User';
  const role = user?.role || 'employee';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground leading-none">TaskFlow</p>
            <p className="text-[10px] text-sidebar-muted leading-none mt-0.5">Project Board</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted select-none">
          Workspace
        </p>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavItem
            key={to}
            to={to}
            label={label}
            icon={icon}
            active={location.pathname === to}
          />
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/40">
          <Avatar name={displayName} size="sm" className="ring-1 ring-sidebar-border" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate capitalize">{displayName}</p>
            <span className={cn(
              'inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ring-inset mt-0.5 capitalize',
              ROLE_COLORS[role] || ROLE_COLORS.employee
            )}>
              {role}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 group"
        >
          <LogOut size={15} className="shrink-0 group-hover:text-red-400 transition-colors" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-md"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-sidebar lg:hidden transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="absolute right-3 top-4">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-sidebar-muted hover:text-sidebar-foreground"
          >
            <X size={16} />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-sidebar h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
}
