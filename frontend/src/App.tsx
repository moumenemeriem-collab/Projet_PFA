import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { getPostAuthRedirect, getStoredUser, isAuthenticated } from './api/auth'
import { HomePage } from './pages/home'
import { AboutPage } from './pages/about'
import { LoginPage } from './pages/login'
import { RegisterPage } from './pages/register'
import { ProjectsPage } from './pages/projects'
import { CreateProjectPage } from './pages/create-project'
import { ClassementPage } from './pages/classement'
import { GeoportalPage } from './pages/geoportal'
import { MessagesPage } from './pages/messages'
import { ProfilePage } from './pages/profile'
import { AdminUsersPage } from './pages/admin/users'
import { AdminDataPage } from './pages/admin/data'
import { AdminMessagesPage } from './pages/admin/messages'
import { AdminProfilePage } from './pages/admin/profile'

function ScrollToTop(): null {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, '')
      requestAnimationFrame(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else window.scrollTo(0, 0)
      })
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return null
}

function GuestGuard({ children }: { children: ReactNode }): React.JSX.Element {
  const user = getStoredUser()
  if (isAuthenticated()) return <Navigate to={getPostAuthRedirect(user!.role)} replace />
  return <>{children}</>
}

function AuthGuard({ role, children }: { role?: 'investisseur' | 'admin'; children: ReactNode }): React.JSX.Element {
  const user = getStoredUser()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (role === 'investisseur' && user?.role !== 'investisseur') return <Navigate to="/admin/utilisateurs" replace />
  if (role === 'admin' && user?.role !== 'admin') return <Navigate to="/projets" replace />
  return <>{children}</>
}

export default function App(): React.JSX.Element {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/a-propos" element={<AboutPage />} />
        <Route path="/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="/register" element={<GuestGuard><RegisterPage /></GuestGuard>} />
        <Route path="/projets" element={<AuthGuard role="investisseur"><ProjectsPage /></AuthGuard>} />
        <Route path="/projets/nouveau" element={<AuthGuard role="investisseur"><CreateProjectPage /></AuthGuard>} />
        <Route path="/projets/:id/classement" element={<AuthGuard role="investisseur"><ClassementPage /></AuthGuard>} />
        <Route path="/projets/:id/classement/ajouter" element={<AuthGuard role="investisseur"><GeoportalPage /></AuthGuard>} />
        <Route path="/messages" element={<AuthGuard role="investisseur"><MessagesPage /></AuthGuard>} />
        <Route path="/profil" element={<AuthGuard role="investisseur"><ProfilePage /></AuthGuard>} />
        <Route path="/admin/utilisateurs" element={<AuthGuard role="admin"><AdminUsersPage /></AuthGuard>} />
        <Route path="/admin/donnees" element={<AuthGuard role="admin"><AdminDataPage /></AuthGuard>} />
        <Route path="/admin/messages" element={<AuthGuard role="admin"><AdminMessagesPage /></AuthGuard>} />
        <Route path="/admin/profil" element={<AuthGuard role="admin"><AdminProfilePage /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
