// Thème noir & blanc / gris sobre partagé par les générateurs PDF manuels
// (pdfPlan.ts et rentaPdfReport.ts). Les couleurs "template" sont neutralisées
// (fond blanc, texte noir / gris foncé, filets fins) ; les couleurs métier
// (légendes d'affectations, géométries) sont gérées séparément.

export const AP = 595.28 // A4 portrait largeur
export const APH = 841.89 // A4 portrait hauteur
export const AL = 841.89 // A4 paysage largeur
export const ALH = 595.28 // A4 paysage hauteur

// Bandes / titres forts (remplace l'ancien "navy") : charbon presque noir
export const NAVY = '0.12 0.12 0.14'
export const BLUE_ACCENT = '0 0 0'
export const DARK = '0.16 0.16 0.17'
export const GRAY = '0.35 0.38 0.42'
export const LIGHT_GRAY = '0.55 0.58 0.62'

// Filets & fonds
export const LINE = '0.82 0.84 0.86'
export const GRID = '0.88 0.89 0.9'
export const BG_CARD = '1 1 1'
export const BG_GREEN = '1 1 1'
export const GREEN_TEXT = '0.16 0.16 0.17'
export const BG_BLUE = '1 1 1'
export const BLUE_TEXT = '0.16 0.16 0.17'
export const BG_AMBER = '1 1 1'
export const AMBER_TEXT = '0.16 0.16 0.17'

// Surlignage discret (lignes de sous-total / bandes)
export const BG_SUBTLE = '0.95 0.95 0.95'
export const TEXT_SUBTLE = '0.4 0.4 0.4'
