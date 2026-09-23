import { Route, Routes } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import PlanningPage from '@/pages/PlanningPage'
import ChantiersPage from '@/pages/ChantiersPage'
import MyPlanningPage from '@/pages/MyPlanningPage'
import ProfilePage from '@/pages/ProfilePage'
import InvitationsPage from '@/pages/InvitationsPage'
import UsersPage from '@/pages/UsersPage'
import ActivityPage from '@/pages/ActivityPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'
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

          {/* Planification : chefs de chantier et admins. */}
          <Route element={<RoleRoute roles={PLANNER_ROLES} redirectTo="/mon-planning" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/chantiers" element={<ChantiersPage />} />
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
