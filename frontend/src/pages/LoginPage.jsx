import { useState, useEffect } from 'react';
import { confirmSignIn, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { login } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input, Label } from '../components/ui/input';
import { cn } from '../lib/utils';

const resolveUserWithRole = async () => {
  const cognitoUser = await getCurrentUser();
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken;
  const role = idToken?.payload?.['custom:role'] || 'employee';
  const teamId = idToken?.payload?.['custom:teamId'] || null;
  const email = idToken?.payload?.email || cognitoUser.username;
  return { ...cognitoUser, role, teamId, email };
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // If user navigates to /login from landing page, don't redirect back to /
  // (the above effect already handles the authenticated case)

  const [email, setEmail]                         = useState('');
  const [password, setPassword]                   = useState('');
  const [showPassword, setShowPassword]           = useState(false);
  const [needsNewPassword, setNeedsNewPassword]   = useState(false);
  const [newPassword, setNewPassword]             = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError]                         = useState('');
  const [loading, setLoading]                     = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await login(email, password);
      if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNeedsNewPassword(true);
        return;
      }
      if (!isSignedIn) throw new Error(nextStep?.signInStep || 'Sign-in incomplete');
      const user = await resolveUserWithRole();
      setAuth(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { isSignedIn } = await confirmSignIn({ challengeResponse: newPassword });
      if (!isSignedIn) throw new Error('Could not complete sign-in after password change');
      const user = await resolveUserWithRole();
      setAuth(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to set new password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-sidebar flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-primary" />
          <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 rounded-full bg-indigo-400" />
        </div>

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">TaskFlow</p>
            <p className="text-sidebar-muted text-xs leading-none mt-0.5">Project Management</p>
          </div>
        </Link>

        {/* Testimonial */}
        <div className="relative space-y-6">
          <blockquote className="text-sidebar-foreground text-xl font-medium leading-relaxed">
            "The cleanest way to manage your team's tasks and projects — built for speed and clarity."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold">
              TF
            </div>
            <div>
              <p className="text-sidebar-foreground text-sm font-semibold">TaskFlow Team</p>
              <p className="text-sidebar-muted text-xs">Engineering Platform</p>
            </div>
          </div>
        </div>

        {/* Bottom features */}
        <div className="relative grid grid-cols-2 gap-4">
          {[
            { label: 'Kanban Board', desc: 'Visual task management' },
            { label: 'Real-time', desc: 'Live status updates' },
            { label: 'Role-based', desc: 'Manager & employee flows' },
            { label: 'Event-driven', desc: 'SNS/SQS notifications' },
          ].map(({ label, desc }) => (
            <div key={label} className="bg-sidebar-accent/60 rounded-xl p-3">
              <p className="text-sidebar-foreground text-xs font-semibold">{label}</p>
              <p className="text-sidebar-muted text-[11px] mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-foreground font-bold text-xl">TaskFlow</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {needsNewPassword ? 'Set new password' : 'Sign in'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {needsNewPassword
                ? 'Your account requires a new password to continue.'
                : 'Welcome back — sign in to your workspace.'}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {!needsNewPassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 mt-2">
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleNewPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="h-10"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-10 mt-2">
                {loading ? 'Saving…' : 'Set Password & Continue'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
