import './style.css'
import { Header, setupHeader } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Benefits } from './components/Benefits'
import { CtaBanner } from './components/CtaBanner'

import { setupScrollAnimations } from './utils/scrollAnimations'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `  ${Header()}
  <main>
    ${Hero()}
    ${Features()}
    ${Benefits()}
    ${CtaBanner()}
  </main>
  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} WebSIG — Geo Invest.</p>
    </div>
  </footer>
`

setupHeader()
setupScrollAnimations()