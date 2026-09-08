import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import RankingPage from './pages/RankingPage';
import Spinner from './components/common/Spinner';

// La portada (RankingPage) va en el bundle inicial; el resto se carga bajo demanda.
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const DirectoryHubPage = lazy(() => import('./pages/DirectoryHubPage'));
const MyBidsPage = lazy(() => import('./pages/MyBidsPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ProfileDetailPage = lazy(() => import('./pages/ProfileDetailPage'));
const PublicarPage = lazy(() => import('./pages/PublicarPage'));
const RegisterBusinessPage = lazy(() => import('./pages/RegisterBusinessPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const TerminosPage = lazy(() => import('./pages/legal/TerminosPage'));
const PrivacidadPage = lazy(() => import('./pages/legal/PrivacidadPage'));
const NormasPage = lazy(() => import('./pages/legal/NormasPage'));
const DevolucionesPage = lazy(() => import('./pages/legal/DevolucionesPage'));
const EntregaPage = lazy(() => import('./pages/legal/EntregaPage'));
const SeguridadPagosPage = lazy(() => import('./pages/legal/SeguridadPagosPage'));
const ContactoPage = lazy(() => import('./pages/legal/ContactoPage'));
const ReciboPage = lazy(() => import('./pages/ReciboPage'));
const EmpleosPage = lazy(() => import('./pages/jobs/EmpleosPage'));
const EmpleoDetailPage = lazy(() => import('./pages/jobs/EmpleoDetailPage'));
const PublicarEmpleoPage = lazy(() => import('./pages/jobs/PublicarEmpleoPage'));
const MisVacantesPage = lazy(() => import('./pages/jobs/MisVacantesPage'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<RankingPage />} />
          <Route path="/rd/:categoria" element={<RankingPage />} />
          <Route path="/rd/:categoria/:provincia" element={<RankingPage />} />
          <Route path="/explorar" element={<ExplorePage />} />
          <Route path="/explorar/:categoria" element={<ExplorePage />} />
          <Route path="/explorar/:categoria/:sub" element={<ExplorePage />} />
          <Route path="/explorar/:categoria/:sub/:provincia" element={<ExplorePage />} />
          <Route path="/directorio" element={<DirectoryHubPage />} />
          <Route path="/publicar" element={<PublicarPage />} />
          <Route path="/registrar-negocio" element={<RegisterBusinessPage />} />
          <Route path="/mis-pujas" element={<MyBidsPage />} />
          <Route path="/favoritos" element={<FavoritesPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/p/:id" element={<ProfileDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/terminos" element={<TerminosPage />} />
          <Route path="/privacidad" element={<PrivacidadPage />} />
          <Route path="/normas" element={<NormasPage />} />
          <Route path="/devoluciones" element={<DevolucionesPage />} />
          <Route path="/entrega" element={<EntregaPage />} />
          <Route path="/seguridad-pagos" element={<SeguridadPagosPage />} />
          <Route path="/contacto" element={<ContactoPage />} />
          <Route path="/recibo" element={<ReciboPage />} />
          <Route path="/recibo/:bidId" element={<ReciboPage />} />
          <Route path="/empleos" element={<EmpleosPage />} />
          <Route path="/empleos/publicar" element={<PublicarEmpleoPage />} />
          <Route path="/empleos/mis-vacantes" element={<MisVacantesPage />} />
          <Route path="/empleos/:filtro" element={<EmpleosPage />} />
          <Route path="/empleos/:filtro/:provincia" element={<EmpleosPage />} />
          <Route path="/empleo/:slug" element={<EmpleoDetailPage />} />
        </Route>
        <Route path="/admin/*" element={<AdminLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
