import { Navigate } from 'react-router-dom'
import { getStoredUser } from '../api/auth'
import { PageEffects } from '../utils/PageEffects'
import { Header } from '../components/Header'
import { Hero } from '../components/Hero'
import { Features } from '../components/Features'
import { Benefits } from '../components/Benefits'
import { CtaBanner } from '../components/CtaBanner'

export function HomePage(): React.JSX.Element {
  const user = getStoredUser()

  if (user?.role === 'investisseur') return <Navigate to="/projets" replace />
  if (user?.role === 'admin') return <Navigate to="/admin/utilisateurs" replace />

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Benefits />
        <CtaBanner />
      </main>
      <footer className="footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} GEO INVEST.</p>
        </div>
      </footer>
      <PageEffects />
    </>
  )
}
