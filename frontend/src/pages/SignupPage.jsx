import { useState, useEffect } from 'react';
import { Eye, EyeOff, Zap, ArrowRight, UserPlus, RefreshCw } from 'lucide-react';
import { register, confirmRegistration, resendCode } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

function FloatingOrb({ className, delay = 0 }) {
  return (
    <div
      className={cn('absolute rounded-full blur-[80px] pointer-events-none', className)}
      style={{ animationDelay: `${delay}s` }}
    />
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

function PasswordStrength({ password }) {
  if (!password) return null;
  const segments = [1, 2, 3, 4];
  return (
    <div className="space-y-1.5 animate-slide-down">
      <div className="flex gap-1">
        {segments.map((i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-0.5 rounded-full transition-all duration-300',
              password.length >= i * 3
                ? i <= 1 ? 'bg-red-500' : i <= 2 ? 'bg-amber-500' : i <= 3 ? 'bg-blue-500' : 'bg-emerald-500'
                : 'bg-white/10'
            )}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {password.length < 4 ? 'Too short' :
         password.length < 7 ? 'Weak' :
         password.length < 10 ? 'Good' : 'Strong'}
      </p>
    </div>
  );
}

const inputClass = cn(
  'flex h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-foreground',
  'placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40',
  'hover:border-white/[0.14] hover:bg-white/[0.06]',
  'transition-all duration-200'
);

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // step: 'register' | 'verify'
  const [step, setStep] = useState('register');

  // Register fields
  const [name, setName]                         = useState('');
  const [email, setEmail]                       = useState('');
  const [password, setPassword]                 = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);

  // Verify fields
  const [code, setCode] = useState('');

  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]   = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(email, password, name.trim());
      setStep('verify');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) { setError('Please enter the verification code'); return; }
    setLoading(true);
    try {
      await confirmRegistration(email, code.trim());
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await resendCode(email);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err) {
      setError(err.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex app-bg relative overflow-hidden">
      <FloatingOrb className="w-[600px] h-[600px] bg-primary/10 top-[-15%] left-[-10%] animate-float-orb" />
      <FloatingOrb className="w-[500px] h-[500px] bg-violet-500/08 bottom-[-15%] right-[-8%] animate-float-orb" delay={3} />
      <FloatingOrb className="w-[300px] h-[300px] bg-cyan-500/05 top-[40%] right-[25%] animate-float-orb" delay={6} />
      <div className="absolute inset-0 landing-grid pointer-events-none" />

      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative z-10">
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

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-medium">Join your team in seconds</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight">
              <span className="text-foreground">Start collaborating</span>
              <br />
              <span className="text-gradient">from day one.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              Create your account and get instant access to the Kanban board,
              task assignments, SNS notifications, and real-time CloudWatch monitoring.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { step: '01', label: 'Create your account', desc: 'Fill in your name, email, and a secure password.' },
              { step: '02', label: 'Verify your email', desc: 'Enter the 6-digit code we send to your inbox.' },
              { step: '03', label: 'Start collaborating', desc: 'Sign in and jump straight to your dashboard.' },
            ].map(({ step: s, label, desc }) => (
              <div key={s} className="flex items-start gap-4 glass rounded-xl p-4">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5">{s}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
          <div className="w-1 h-1 rounded-full bg-primary/40" />
          <span>Powered by AWS · Cognito · DynamoDB · Lambda</span>
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

          <div className="glass-strong rounded-2xl p-8 shadow-[0_25px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] animate-scale-in">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                  <UserPlus size={16} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {step === 'register' ? 'Create account' : 'Verify your email'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {step === 'register'
                  ? 'Fill in your details to get started.'
                  : `We sent a 6-digit code to ${email}. Enter it below.`}
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl animate-slide-down">
                <div className="w-1 h-full min-h-[20px] rounded-full bg-red-500 shrink-0 self-stretch" />
                <span>{error}</span>
              </div>
            )}

            {resent && (
              <div className="mb-5 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl animate-slide-down">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Verification code resent — check your inbox.</span>
              </div>
            )}

            {step === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-5">
                <InputField label="Full Name" id="name">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    required
                    className={inputClass}
                  />
                </InputField>

                <InputField label="Email" id="email">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    className={inputClass}
                  />
                </InputField>

                <InputField label="Password" id="password">
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      className={cn(inputClass, 'pr-11')}
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
                  <PasswordStrength password={password} />
                </InputField>

                <InputField label="Confirm Password" id="confirm-password">
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      required
                      className={cn(inputClass, 'pr-11')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
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
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-5">
                <InputField label="Verification Code" id="code">
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    required
                    className={cn(inputClass, 'tracking-[0.3em] text-center text-lg font-semibold')}
                  />
                </InputField>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-2 text-base gap-2 rounded-xl"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify & Continue
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                  {resending ? 'Resending…' : "Didn't receive it? Resend code"}
                </button>
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-white/[0.05] flex items-center justify-center gap-1.5">
              <span className="text-xs text-muted-foreground">Already have an account?</span>
              <Link to="/login" className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
