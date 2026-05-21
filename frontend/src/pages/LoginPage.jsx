import { useState, useEffect } from 'react';
import { confirmSignIn, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Eye, EyeOff, Zap, ArrowRight, Shield, Layers, Activity } from 'lucide-react';
import { login } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
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

function FloatingOrb({ className, delay = 0 }) {
  return (
    <div
      className={cn('absolute rounded-full blur-[80px] pointer-events-none', className)}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function FeatureChip({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 glass rounded-lg px-3 py-2">
      <Icon size={13} className="text-primary shrink-0" />
      <span className="text-xs text-sidebar-foreground font-medium">{label}</span>
    </div>
  );
}

function InputField({ label, id, error, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-400 animate-slide-down">{error}</p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, isAuthenticated } = useAuthStore();
  const justRegistered = location.state?.registered === true;

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [email, setEmail]                           = useState('');
  const [password, setPassword]                     = useState('');
  const [showPassword, setShowPassword]             = useState(false);
  const [needsNewPassword, setNeedsNewPassword]     = useState(false);
  const [newPassword, setNewPassword]               = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNew, setShowNew]                       = useState(false);
  const [error, setError]                           = useState('');
  const [loading, setLoading]                       = useState(false);

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
      if (!isSignedIn) throw new Error('Could not complete sign-in');
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
    <div className="min-h-screen flex app-bg relative overflow-hidden">
      {/* Ambient orbs */}
      <FloatingOrb className="w-[600px] h-[600px] bg-primary/10 top-[-15%] left-[-10%] animate-float-orb" />
      <FloatingOrb className="w-[500px] h-[500px] bg-violet-500/08 bottom-[-15%] right-[-8%] animate-float-orb" delay={3} />
      <FloatingOrb className="w-[300px] h-[300px] bg-cyan-500/05 top-[40%] right-[25%] animate-float-orb" delay={6} />

      {/* Grid overlay */}
      <div className="absolute inset-0 landing-grid pointer-events-none" />

      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative z-10">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group w-fit">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(109,94,245,0.5)] group-hover:shadow-[0_0_30px_rgba(109,94,245,0.7)] transition-all duration-300">
              <Zap size={20} className="text-white" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-lg" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none tracking-tight">TaskFlow</p>
            <p className="text-muted-foreground text-xs leading-none mt-0.5">AWS Cloud Board</p>
          </div>
        </Link>

        {/* Hero text */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-medium">Cloud-native • Event-driven • Real-time</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight">
              <span className="text-foreground">Your team's work,</span>
              <br />
              <span className="text-gradient">perfectly organized.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              A full-stack AWS-powered task board with SNS notifications, Lambda pipelines,
              and real-time CloudWatch monitoring.
            </p>
          </div>

          {/* Feature chips */}
          <div className="grid grid-cols-2 gap-2.5">
            <FeatureChip icon={Shield} label="Cognito Auth" />
            <FeatureChip icon={Layers} label="Kanban Board" />
            <FeatureChip icon={Activity} label="CloudWatch" />
            <FeatureChip icon={Zap} label="SNS / SQS" />
          </div>

          {/* Quote */}
          <blockquote className="glass rounded-xl p-4 border-l-2 border-primary/40">
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              "The cleanest way to manage your team's tasks — built for speed, clarity, and the cloud."
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-primary text-[10px] font-bold">TF</div>
              <span className="text-xs text-muted-foreground font-medium">TaskFlow · AWS Cloud Project</span>
            </div>
          </blockquote>
        </div>

        {/* Bottom decoration */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
          <div className="w-1 h-1 rounded-full bg-primary/40" />
          <span>Powered by AWS · DynamoDB · Lambda · CloudFront</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-5 py-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(109,94,245,0.4)]">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-foreground font-bold text-xl">TaskFlow</span>
          </div>

          {/* Form card */}
          <div className="glass-strong rounded-2xl p-8 shadow-[0_25px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] animate-scale-in">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {needsNewPassword ? 'Set new password' : 'Welcome back'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                {needsNewPassword
                  ? 'Your account requires a new password to continue.'
                  : 'Sign in to your workspace to continue.'}
              </p>
            </div>

            {/* Success message after signup */}
            {justRegistered && (
              <div className="mb-5 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Account created! Sign in to get started.</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl animate-slide-down">
                <div className="w-1 h-full min-h-[20px] rounded-full bg-red-500 shrink-0 self-stretch" />
                <span>{error}</span>
              </div>
            )}

            {/* Login form */}
            {!needsNewPassword ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <InputField label="Email" id="email">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    className={cn(
                      'flex h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-foreground',
                      'placeholder:text-muted-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40',
                      'hover:border-white/[0.14] hover:bg-white/[0.06]',
                      'transition-all duration-200'
                    )}
                  />
                </InputField>

                <InputField label="Password" id="password">
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className={cn(
                        'flex h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 pr-11 text-sm text-foreground',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40',
                        'hover:border-white/[0.14] hover:bg-white/[0.06]',
                        'transition-all duration-200'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </InputField>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-2 text-base gap-2 rounded-xl"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              /* New password form */
              <form onSubmit={handleNewPassword} className="space-y-5">
                <InputField label="New Password" id="new-password">
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className={cn(
                        'flex h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 pr-11 text-sm text-foreground',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40',
                        'transition-all duration-200'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </InputField>

                <InputField label="Confirm Password" id="confirm-password">
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    className={cn(
                      'flex h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-foreground',
                      'placeholder:text-muted-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40',
                      'transition-all duration-200'
                    )}
                  />
                </InputField>

                {/* Password strength indicator */}
                {newPassword && (
                  <div className="space-y-1.5 animate-slide-down">
                    <div className="flex gap-1">
                      {[1,2,3,4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex-1 h-0.5 rounded-full transition-all duration-300',
                            newPassword.length >= i * 3
                              ? i <= 1 ? 'bg-red-500' : i <= 2 ? 'bg-amber-500' : i <= 3 ? 'bg-blue-500' : 'bg-emerald-500'
                              : 'bg-white/10'
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {newPassword.length < 4 ? 'Too short' :
                       newPassword.length < 7 ? 'Weak' :
                       newPassword.length < 10 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-2 text-base gap-2 rounded-xl"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      Set Password & Continue
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-white/[0.05] space-y-3">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs text-muted-foreground">Don't have an account?</span>
                <Link to="/signup" className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors">
                  Sign up
                </Link>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                <p className="text-xs text-muted-foreground">Secured by AWS Cognito</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
