import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from '../App';
import LoginPage from '../pages/LoginPage';
import KanbanPage from '../pages/KanbanPage';
import ProtectedRoute from './ProtectedRoute';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<App />} />
          <Route path="/kanban" element={<KanbanPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}