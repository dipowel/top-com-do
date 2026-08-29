import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import RankingPage from './pages/RankingPage';
import ExplorePage from './pages/ExplorePage';
import MyBidsPage from './pages/MyBidsPage';
import FavoritesPage from './pages/FavoritesPage';
import ProfilePage from './pages/ProfilePage';
import ProfileDetailPage from './pages/ProfileDetailPage';
import LoginPage from './pages/LoginPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminLayout from './admin/AdminLayout';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<RankingPage />} />
        <Route path="/rd/:categoria" element={<RankingPage />} />
        <Route path="/rd/:categoria/:provincia" element={<RankingPage />} />
        <Route path="/explorar" element={<ExplorePage />} />
        <Route path="/explorar/:categoria" element={<ExplorePage />} />
        <Route path="/mis-pujas" element={<MyBidsPage />} />
        <Route path="/favoritos" element={<FavoritesPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/notificaciones" element={<NotificationsPage />} />
        <Route path="/p/:id" element={<ProfileDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route path="/admin/*" element={<AdminLayout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
