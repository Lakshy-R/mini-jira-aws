import { useAuthStore } from './store/auth.store';
import { useEffect, useState } from 'react';
import api from './services/api';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/health')
      .then((res) => setMessage(res.data.message))
      .catch(() => setMessage('Backend error'));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>

      <p>{message}</p>

      <h3>User Info:</h3>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
}