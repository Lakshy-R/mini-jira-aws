import { signIn, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export const login = async (email, password) => {
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