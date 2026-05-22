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
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/avatar';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Board',    icon: LayoutGrid,   desc: 'Kanban view' },
  { to: '/projects',  label: 'Projects', icon: FolderKanban, desc: 'All projects' },
];

const ROLE_CONFIG = {
  manager:  { label: 'Manager',  class: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/20' },
  employee: { label: 'Employee', class: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20' },
  admin:    { label: 'Admin',    class: 'bg-amber-500/15 text-amber-300 ring-amber-500/20' },
};

function NavItem({ to, label, icon: Icon, desc, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden',
        active
          ? 'bg-primary/12 text-primary border border-primary/20 shadow-[0_0_12px_rgba(109,94,245,0.15)]'
          : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/[0.04] border border-transparent'
      )}
    >
      {/* Active glow line */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />
      )}
      <Icon
        size={16}
        className={cn(
          'shrink-0 transition-all duration-200',
          active
            ? 'text-primary'
            : 'text-sidebar-muted group-hover:text-sidebar-foreground'
        )}
      />
      <span className="flex-1">{label}</span>
      {active && (
        <ChevronRight size={12} className="text-primary/60" />
      )}
    </Link>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try { await signOut(); } catch { /* non-critical */ }
    finally {
      logout();
      navigate('/');
    }
  };

  const displayName = user?.email?.split('@')[0] || user?.username || 'User';
  const role = user?.role || 'employee';
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.employee;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.05]">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_16px_rgba(109,94,245,0.4)] group-hover:shadow-[0_0_24px_rgba(109,94,245,0.6)] transition-all duration-300">
              <Zap size={17} className="text-white" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md group-hover:bg-primary/30 transition-all duration-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-none tracking-tight">
              TaskFlow
            </p>
            <p className="text-[10px] text-sidebar-muted leading-none mt-0.5">AWS · Cloud Board</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/70 select-none">
          Workspace
        </p>
        {NAV_ITEMS.map(({ to, label, icon, desc }) => (
          <NavItem
            key={to}
            to={to}
            label={label}
            icon={icon}
            desc={desc}
            active={location.pathname === to}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Divider with subtle glow */}
      <div className="mx-3 border-t border-white/[0.05]" />

      {/* User section */}
      <div className="px-3 py-4 space-y-2">
        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl glass ring-1 ring-white/[0.05]">
          <Avatar name={displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate capitalize">
              {displayName}
            </p>
            <span
              className={cn(
                'inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ring-inset mt-0.5 capitalize',
                roleConfig.class
              )}
            >
              {roleConfig.label}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-sidebar-muted hover:text-red-400 hover:bg-red-500/[0.08] border border-transparent hover:border-red-500/15 transition-all duration-200 group"
        >
          <LogOut size={14} className="shrink-0 group-hover:text-red-400 transition-colors" />
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
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl glass-card text-sidebar-foreground shadow-lg border border-white/[0.08]"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 glass-sidebar lg:hidden transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 p-1.5 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/[0.05] transition-colors"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 glass-sidebar h-screen sticky top-0 relative z-20">
        {sidebarContent}
      </aside>
    </>
  );
}
