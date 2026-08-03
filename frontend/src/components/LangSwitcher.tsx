import { useEffect, useRef, useState } from 'react'
import { getLang, setLang, type Lang } from '../i18n/index'
import { icons } from './icons'

const LANG_LABELS: Record<Lang, string> = { fr: 'FR', en: 'EN', ar: 'AR' }
const LANGS: Lang[] = ['fr', 'en', 'ar']

export function LangSwitcher({ className = '' }: { className?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = getLang()

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <div
      ref={ref}
      className={`lang-switcher${className ? ' ' + className : ''}${open ? ' lang-switcher--open' : ''}`}
    >
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {icons.globe}
        <span>{LANG_LABELS[current]}</span>
      </button>
      <div className="lang-dropdown" role="menu">
        {LANGS.map((lang) => (
          <button
            key={lang}
            type="button"
            className={`lang-option${lang === current ? ' lang-option--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setLang(lang)
            }}
          >
            <span>{LANG_LABELS[lang]}</span>
            <span className="lang-option-check">{icons.check}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
