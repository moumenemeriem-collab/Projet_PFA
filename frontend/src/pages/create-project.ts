import { icons, icon } from '../components/icons.ts'
import { renderAppLayout, setupAppLayout } from '../components/layout/AppLayout.ts'
import { getStoredUser } from '../api/auth.ts'
import { createProjet, fetchTypesProjet, type TypeProjet, type ProjetPayload } from '../api/projets.ts'
import { formatApiErrors } from '../api/auth.ts'
import { t } from '../i18n/index'
import gisBg from '../assets/features/create_project.jpg'

let allTypes: TypeProjet[] = []

function renderContent(): string {
  return `
    <div class="cp-page">
      <div class="cp-header">
        <div>
          <div class="cp-breadcrumb">${t('projects.title').toUpperCase()} / ${t('projects.new')}</div>
          <h1 class="cp-title">${t('projects.create_title')}</h1>
          <p class="cp-subtitle">${t('projects.create_subtitle')}</p>
        </div>
        <div class="cp-header-actions">
          <a href="/projets" class="btn btn-outline">${t('projects.btn_cancel')}</a>
        </div>
      </div>

      <div class="cp-divider"></div>

      <div id="cp-alert" class="cp-alert cp-alert--error" hidden></div>

      <div class="cp-grid">
        <div class="cp-left-col">
          <section class="cp-card">
            <h2 class="cp-card-title">
              ${icon('document', 'cp-card-icon')}
              ${t('projects.section_basics')}
            </h2>
            <div class="cp-row">
              <div class="cp-field">
                <label class="cp-label" for="cp-nom">
                  ${t('projects.field_name_label')} <span class="cp-required">*</span>
                </label>
                <input type="text" id="cp-nom" class="cp-input" placeholder="${t('projects.field_name_placeholder')}" />
              </div>
              <div class="cp-field">
                <label class="cp-label" for="cp-type">
                  ${t('projects.field_type_label')} <span class="cp-required">*</span>
                </label>
                <select id="cp-type" class="cp-input cp-select">
                  ${allTypes.map((tp) => `<option value="${tp.id}">${tp.nom}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="cp-field">
              <label class="cp-label" for="cp-description">${t('projects.field_description_label')}</label>
              <textarea id="cp-description" class="cp-input cp-textarea" rows="3" placeholder="${t('projects.field_description_placeholder')}"></textarea>
            </div>
          </section>

          <section class="cp-card">
            <h2 class="cp-card-title">
              ${icon('trending', 'cp-card-icon')}
              ${t('projects.section_land')}
            </h2>
            <div class="cp-row cp-row-3">
              <div class="cp-field">
                <label class="cp-label" for="cp-surface">
                  ${t('projects.field_surface_label')} <span class="cp-required">*</span>
                </label>
                <input type="number" step="0.01" id="cp-surface" class="cp-input" placeholder="500" />
              </div>
              <div class="cp-field">
                <label class="cp-label" for="cp-budget">
                  ${t('projects.field_budget_label')} <span class="cp-required">*</span>
                </label>
                <input type="number" step="0.01" id="cp-budget" class="cp-input" placeholder="500000" />
              </div>
              <div class="cp-field">
                <label class="cp-label" for="cp-unites">${t('projects.field_units_label')}</label>
                <input type="number" id="cp-unites" class="cp-input" placeholder="20" />
              </div>
            </div>
          </section>

          <section class="cp-card">
            <h2 class="cp-card-title">
              ${icon('euro', 'cp-card-icon')}
              ${t('projects.section_financial')}
            </h2>
            <div class="cp-row">
              <div class="cp-field">
                <label class="cp-label" for="cp-prix-terrain">${t('projects.field_land_price')}</label>
                <input type="number" step="0.01" id="cp-prix-terrain" class="cp-input" placeholder="400000" />
              </div>
              <div class="cp-field">
                <label class="cp-label" for="cp-cout">${t('projects.field_construction_cost')}</label>
                <input type="number" step="0.01" id="cp-cout" class="cp-input" placeholder="300000" />
              </div>
            </div>
            <div class="cp-row">
              <div class="cp-field">
                <label class="cp-label" for="cp-surface-construite">${t('projects.field_built_area')}</label>
                <input type="number" step="0.01" id="cp-surface-construite" class="cp-input" placeholder="0" />
              </div>
              <div class="cp-field">
                <label class="cp-label" for="cp-charges">${t('projects.field_other_charges')}</label>
                <input type="number" step="0.01" id="cp-charges" class="cp-input" placeholder="50000" />
              </div>
            </div>
            <div class="cp-row">
              <div class="cp-field">
                <label class="cp-label" for="cp-prix-vente">${t('projects.field_unit_price')}</label>
                <input type="number" step="0.01" id="cp-prix-vente" class="cp-input" placeholder="800000" />
              </div>
              <div class="cp-field">
                <label class="cp-label" for="cp-revenu">${t('projects.field_estimated_revenue')}</label>
                <input type="number" step="0.01" id="cp-revenu" class="cp-input" placeholder="1500000" />
              </div>
            </div>
          </section>

          <section class="cp-card">
            <h2 class="cp-card-title">
              ${icon('search', 'cp-card-icon')}
              ${t('projects.section_image')}
            </h2>
            <div class="cp-field">
              <label class="cp-label" for="cp-image">${t('projects.field_image_url')}</label>
              <input type="url" id="cp-image" class="cp-input" placeholder="https://exemple.com/image.jpg" />
            </div>
          </section>
        </div>

        <div class="cp-right-col">
          <div class="cp-gis-card" style="background-image: linear-gradient(to top, rgba(13,27,72,.88), rgba(13,27,72,.15)), url('${gisBg}');">
            <div class="cp-gis-content">
              <span class="cp-gis-eyebrow">${t('projects.gis_badge')}</span>
              <h3 class="cp-gis-title">${t('projects.gis_title')}</h3>
              <p class="cp-gis-text">
                ${t('projects.gis_description')}
              </p>
            </div>
          </div>

          <div class="cp-tips-card">
            <div class="cp-tips-title">
              <div class="cp-tips-icon">✓</div>
              <span>${t('projects.tips_title')}</span>
            </div>
            <ol class="cp-tips-list">
              <li>
                <span class="cp-tips-num">1</span>
                <p>${t('projects.tip1')}</p>
              </li>
              <li>
                <span class="cp-tips-num">2</span>
                <p>${t('projects.tip2')}</p>
              </li>
              <li>
                <span class="cp-tips-num">3</span>
                <p>${t('projects.tip3')}</p>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <div class="cp-footer">
        <span class="cp-footer-note">${t('common.required_fields')}</span>
        <div class="cp-footer-actions">
          <button type="button" class="btn btn-outline" id="cp-reset">${t('common.reset')}</button>
          <button type="button" class="btn btn-primary" id="cp-submit">${icons.plus} ${t('projects.btn_create')}</button>
        </div>
      </div>
    </div>
  `
}

function collectPayload(): ProjetPayload | null {
  const nom = (document.querySelector<HTMLInputElement>('#cp-nom')?.value ?? '').trim()
  const id_type = Number(document.querySelector<HTMLSelectElement>('#cp-type')?.value)
  const surface_souhaitee = Number(document.querySelector<HTMLInputElement>('#cp-surface')?.value)
  const budget_total = Number(document.querySelector<HTMLInputElement>('#cp-budget')?.value)
  const description = (document.querySelector<HTMLTextAreaElement>('#cp-description')?.value ?? '').trim()

  if (!nom || !id_type || !surface_souhaitee || !budget_total) return null

  const val = (id: string) => {
    const el = document.querySelector<HTMLInputElement>(id)
    return el?.value ? Number(el.value) : null
  }
  const strVal = (id: string) => (document.querySelector<HTMLInputElement>(id)?.value ?? '').trim()

  return {
    nom,
    id_type,
    surface_souhaitee,
    budget_total,
    description,
    nombre_unites: val('#cp-unites'),
    surface_construite: val('#cp-surface-construite'),
    prix_terrain: val('#cp-prix-terrain'),
    cout_construction: val('#cp-cout'),
    autres_charges: val('#cp-charges'),
    prix_vente_unitaire: val('#cp-prix-vente'),
    revenu_estime: val('#cp-revenu'),
    image: strVal('#cp-image'),
  }
}

function showError(msg: string): void {
  const el = document.querySelector<HTMLElement>('#cp-alert')
  if (!el) return
  el.textContent = msg
  el.className = 'cp-alert cp-alert--error'
  el.hidden = false
}

function setLoading(loading: boolean): void {
  const submitBtn = document.querySelector<HTMLButtonElement>('#cp-submit')
  const resetBtn = document.querySelector<HTMLButtonElement>('#cp-reset')
  if (submitBtn) {
    submitBtn.disabled = loading
    submitBtn.innerHTML = loading
      ? `<span class="cp-spinner"></span> ${t('projects.loading_creation')}`
      : `${icons.plus} ${t('projects.btn_create')}`
  }
  if (resetBtn) resetBtn.disabled = loading
}

async function handleSubmit(): Promise<void> {
  const payload = collectPayload()
  if (!payload) {
    showError(t('projects.validation_required'))
    return
  }

  const alertEl = document.querySelector<HTMLElement>('#cp-alert')
  if (alertEl) alertEl.hidden = true

  setLoading(true)
  try {
    const projet = await createProjet(payload)
    window.history.pushState({}, '', `/projets/${projet.id}/classement`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch (error) {
    showError(formatApiErrors(error))
    setLoading(false)
  }
}

function resetForm(): void {
  const form = document.querySelector<HTMLElement>('.cp-page')
  if (!form) return
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
    if (el.tagName === 'SELECT') {
      (el as HTMLSelectElement).selectedIndex = 0
    } else {
      el.value = ''
    }
  })
  const alertEl = document.querySelector<HTMLElement>('#cp-alert')
  if (alertEl) alertEl.hidden = true
}

function bindEvents(): void {
  document.querySelector('#cp-submit')?.addEventListener('click', handleSubmit)
  document.querySelector('#cp-reset')?.addEventListener('click', resetForm)
}

export async function mountCreateProjectPage(root: HTMLElement): Promise<void> {
  const user = getStoredUser()
  if (!user) return

  try {
    allTypes = await fetchTypesProjet()
  } catch {
    allTypes = []
  }

  root.innerHTML = renderAppLayout({
    user,
    role: 'investisseur',
    activePage: 'projects',
    content: renderContent(),
  })
  setupAppLayout(root)
  bindEvents()
}
