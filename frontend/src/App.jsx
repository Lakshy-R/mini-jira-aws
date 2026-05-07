import { Link } from 'react-router-dom';
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

      <nav style={{ marginBottom: 20 }}>
        <Link to="/kanban" style={{ padding: '10px 20px', background: '#007bff', color: 'white', borderRadius: 4, textDecoration: 'none' }}>
          Go to Kanban Board
        </Link>
      </nav>

      <h3>User Info:</h3>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
}