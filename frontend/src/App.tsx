import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import PlanningPage from '@/pages/PlanningPage'
import ChantiersPage from '@/pages/ChantiersPage'
import ChantierDetailPage from '@/pages/ChantierDetailPage'
import ClientsPage from '@/pages/ClientsPage'
import EquipesPage from '@/pages/EquipesPage'
import HeuresPage from '@/pages/HeuresPage'
import AbsencesPage from '@/pages/AbsencesPage'
import PrintWeekPage from '@/pages/PrintWeekPage'
import MyPlanningPage from '@/pages/MyPlanningPage'
import ProfilePage from '@/pages/ProfilePage'
import InvitationsPage from '@/pages/InvitationsPage'
import UsersPage from '@/pages/UsersPage'
import ActivityPage from '@/pages/ActivityPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import AidePage from '@/pages/AidePage'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'
import RoleRoute from '@/components/RoleRoute'
import ModuleGate from '@/components/ModuleGate'
import HomeRedirect from '@/components/HomeRedirect'
import AppLayout from '@/components/AppLayout'
import { PLANNER_ROLES } from '@/lib/navigation'

/*
 * Routes de la SPA. Les repères « make:crud » sont utilisés par la commande
 * `php artisan make:crud … --front` pour insérer les pages générées.
 */
export default function App() {
  return (
    <Routes>
      {/* Pages publiques */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register/:token" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Planning personnel : tout le monde (ouvriers sur tablette / téléphone). */}
          <Route path="/mon-planning" element={<MyPlanningPage />} />

          {/* Mode d'emploi intégré (bouton « ? » en bas à droite) : tout le monde. */}
          <Route path="/aide" element={<AidePage />} />

          {/* Planification : chefs de chantier et admins. */}
          <Route element={<RoleRoute roles={PLANNER_ROLES} redirectTo="/mon-planning" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/chantiers" element={<ChantiersPage />} />
            <Route path="/chantiers/:id" element={<ChantierDetailPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/equipes" element={<EquipesPage />} />
            <Route path="/statistiques/heures" element={<HeuresPage />} />
            <Route path="/statistiques" element={<Navigate to="/statistiques/heures" replace />} />
            <Route path="/heures" element={<LegacyHeuresRedirect />} />
            <Route path="/absences" element={<AbsencesPage />} />
            <Route path="/planning/print" element={<PrintWeekPage />} />
          </Route>

          {/* Module « invitations » (admins, ou tous selon config/invitations.php) */}
          <Route element={<ModuleGate module="invitations" />}>
            <Route path="/invitations" element={<InvitationsPage />} />
          </Route>

          {/* make:crud (auth) */}

          {/* Réservé aux administrateurs */}
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* make:crud (admin) */}
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

/** Ancienne adresse /heures → Statistiques → Heures (en gardant les filtres de l'URL). */
function LegacyHeuresRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/statistiques/heures${search}`} replace />
}
