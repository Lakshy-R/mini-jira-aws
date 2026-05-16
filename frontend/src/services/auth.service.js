import { signIn, signOut, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export const login = async (email, password) => {
  // Clear any stale Cognito session before signing in
  try {
    await signOut();
  } catch (_) {
    // No active session — that's fine, carry on
  }

  const { isSignedIn, nextStep } = await signIn({
    username: email,
    password,
  });

  if (isSignedIn) {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    return { user, token, isSignedIn };
  }

  return { isSignedIn, nextStep, user: null, token: null };
};
