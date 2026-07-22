import { createMessage } from '../api/messagerie.ts'
import { formatApiErrors, isAuthenticated } from '../api/auth.ts'
import { icons } from './icons.ts'

export function ContactForm(): string {
  return `
    <section class="contact-section" id="contact">
      <div class="container">
        <div class="contact-wrapper">
          <div class="contact-info" data-reveal="fade-left">
            <div class="contact-info-badge">
              <span class="contact-info-badge-dot"></span>
              Contactez-nous
            </div>
            <h2 class="contact-info-title">Une question ? Envoyez-nous un message</h2>
            <p class="contact-info-desc">
              Notre équipe est disponible pour répondre à toutes vos questions
              concernant la plateforme GEO INVEST et le potentiel foncier.
            </p>
            <div class="contact-info-items">
              <div class="contact-info-item">
                <span class="contact-info-item-icon">${icons.mail}</span>
                <div>
                  <span class="contact-info-item-label">Email</span>
                  <span class="contact-info-item-value">contact@websig.ma</span>
                </div>
              </div>
              <div class="contact-info-item">
                <span class="contact-info-item-icon">${icons.phone}</span>
                <div>
                  <span class="contact-info-item-label">Téléphone</span>
                  <span class="contact-info-item-value">+212 6 00 00 00 00</span>
                </div>
              </div>
            </div>
          </div>
          <div class="contact-form-wrap" data-reveal="fade-right">
            <form id="contact-form" class="contact-form" novalidate>
              <div id="contact-alert" class="contact-alert" hidden></div>
              <div class="contact-form-field">
                <label for="contact-sujet" class="contact-label">Sujet</label>
                <input id="contact-sujet" name="sujet" type="text" class="contact-input" placeholder="Ex: Demande d'information" required />
              </div>
              <div class="contact-form-field">
                <label for="contact-contenu" class="contact-label">Message</label>
                <textarea id="contact-contenu" name="contenu" class="contact-input contact-textarea" rows="5" placeholder="Décrivez votre demande..." required></textarea>
              </div>
              <button type="submit" class="btn btn-primary contact-submit" id="contact-submit-btn">
                <span class="contact-submit-icon">${icons.send}</span>
                Envoyer le message
              </button>
              <p class="contact-hint">
                ${isAuthenticated()
                  ? 'Votre message sera envoyé directement à l\'administrateur.'
                  : 'Connectez-vous pour suivre les réponses à vos messages.'}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  `
}

export function setupContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('#contact-form')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const alertEl = form.querySelector<HTMLElement>('#contact-alert')
    const submitBtn = form.querySelector<HTMLButtonElement>('#contact-submit-btn')

    if (alertEl) alertEl.hidden = true
    if (!submitBtn) return

    if (!isAuthenticated()) {
      window.location.href = '/login'
      return
    }

    const formData = new FormData(form)
    const sujet = String(formData.get('sujet') ?? '').trim()
    const contenu = String(formData.get('contenu') ?? '').trim()

    if (!sujet || !contenu) {
      if (alertEl) {
        alertEl.textContent = 'Veuillez remplir tous les champs.'
        alertEl.className = 'contact-alert contact-alert--error'
        alertEl.hidden = false
      }
      return
    }

    submitBtn.disabled = true
    submitBtn.innerHTML = `<span class="contact-spinner"></span> Envoi en cours...`

    try {
      await createMessage({ sujet, contenu })
      if (alertEl) {
        alertEl.textContent = 'Message envoyé avec succès ! Nous vous répondrons dès que possible.'
        alertEl.className = 'contact-alert contact-alert--success'
        alertEl.hidden = false
      }
      form.reset()
    } catch (error) {
      if (alertEl) {
        alertEl.textContent = formatApiErrors(error)
        alertEl.className = 'contact-alert contact-alert--error'
        alertEl.hidden = false
      }
    } finally {
      submitBtn.disabled = false
      submitBtn.innerHTML = `<span class="contact-submit-icon">${icons.send}</span> Envoyer le message`
    }
  })
}
