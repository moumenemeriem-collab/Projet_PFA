import fr from './locales/fr.json'
import en from './locales/en.json'
import ar from './locales/ar.json'

export type Lang = 'fr' | 'en' | 'ar'

const translations: Record<Lang, Record<string, unknown>> = { fr, en, ar }

const STORAGE_KEY = 'lang'

function isLang(v: string): v is Lang {
  return v === 'fr' || v === 'en' || v === 'ar'
}

export function getLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && isLang(stored)) return stored
  return 'fr'
}

export function setLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang)
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  window.location.reload()
}

function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : undefined
}

export function t(key: string): string {
  const lang = getLang()
  const val = getNestedValue(translations[lang], key)
  if (val !== undefined) return val
  const fallback = getNestedValue(translations.fr, key)
  if (fallback !== undefined) return fallback
  return key
}

export function initLang(): void {
  const lang = getLang()
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  const locale = getLang() === 'ar' ? 'ar-MA' : getLang() === 'en' ? 'en-US' : 'fr-FR'
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const locale = getLang() === 'ar' ? 'ar-MA' : getLang() === 'en' ? 'en-US' : 'fr-FR'
  return d.toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const globeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

const LANG_LABELS: Record<Lang, string> = { fr: 'FR', en: 'EN', ar: 'AR' }

export function langSwitcherHTML(extraClass = ''): string {
  const current = getLang()
  const options = (['fr', 'en', 'ar'] as Lang[])
    .map((l) => {
      const active = l === current ? ' lang-option--active' : ''
      return `<button type="button" class="lang-option${active}" data-lang="${l}">
        <span>${LANG_LABELS[l]}</span>
        <span class="lang-option-check">${checkSvg}</span>
      </button>`
    })
    .join('')

  return `
    <div class="lang-switcher${extraClass ? ' ' + extraClass : ''}" data-lang-switcher>
      <button type="button" class="lang-trigger" data-lang-trigger aria-haspopup="true" aria-expanded="false">
        ${globeSvg}
        <span>${LANG_LABELS[current]}</span>
      </button>
      <div class="lang-dropdown" role="menu">${options}</div>
    </div>
  `
}

export function setupLangSwitcher(root: Document | HTMLElement = document): void {
  const switchers = root.querySelectorAll<HTMLElement>('[data-lang-switcher]')
  switchers.forEach((sw) => {
    const trigger = sw.querySelector<HTMLButtonElement>('[data-lang-trigger]')
    const options = sw.querySelectorAll<HTMLButtonElement>('[data-lang]')

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation()
      const isOpen = sw.classList.contains('lang-switcher--open')
      sw.classList.toggle('lang-switcher--open', !isOpen)
      trigger.setAttribute('aria-expanded', String(!isOpen))
    })

    options.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const lang = btn.dataset.lang as Lang
        if (lang) setLang(lang)
      })
    })
  })

  document.addEventListener('click', () => {
    switchers.forEach((sw) => {
      sw.classList.remove('lang-switcher--open')
      sw.querySelector<HTMLButtonElement>('[data-lang-trigger]')?.setAttribute('aria-expanded', 'false')
    })
  })
}
