import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Always fetch a fresh Cognito token from Amplify on every request.
// Amplify handles expiry + refresh automatically — we never store the JWT manually.
api.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // No active Amplify session — request will go through without token
    console.warn('No Amplify session found:', err.message);
  }
  return config;
});

export default api;