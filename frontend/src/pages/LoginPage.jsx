import { useState, useEffect } from 'react';
import { confirmSignIn, getCurrentUser } from 'aws-amplify/auth';
import { login } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // If already logged in, go straight to the board
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // New password step state
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Initial login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user, isSignedIn, nextStep } = await login(email, password);

      if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // Show the new password form
        setNeedsNewPassword(true);
        setLoading(false);
        return;
      }

      if (!isSignedIn) {
        throw new Error(nextStep?.signInStep || 'Sign-in incomplete');
      }

      setAuth(user);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit new password
  const handleNewPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { isSignedIn } = await confirmSignIn({
        challengeResponse: newPassword,
      });

      if (isSignedIn) {
        const user = await getCurrentUser();
        setAuth(user);
        navigate('/dashboard');
      } else {
        throw new Error('Could not complete sign-in after password change');
      }
    } catch (err) {
      console.error('New password error:', err);
      setError(err.message || 'Failed to set new password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {!needsNewPassword ? (
        // ── Step 1: Login form ──
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-xl shadow w-[400px] space-y-4"
        >
          <h1 className="text-2xl font-bold">Mini Jira Login</h1>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white px-4 py-2 rounded w-full disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>
      ) : (
        // ── Step 2: Set new password form ──
        <form
          onSubmit={handleNewPassword}
          className="bg-white p-8 rounded-xl shadow w-[400px] space-y-4"
        >
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-sm text-gray-500">
            Your account requires a new password before you can continue.
          </p>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="border p-2 rounded w-full"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white px-4 py-2 rounded w-full disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set Password & Login'}
          </button>
        </form>
      )}
    </div>
  );
}