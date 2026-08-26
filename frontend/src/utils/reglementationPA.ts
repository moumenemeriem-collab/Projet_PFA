export interface RegleDesignation {
  code: string
  zone: string
  typeOperation: string
  appartement: string
  bureau: string
  commerce: string
  cos: string
  ces: string
  surfaceMin: string
  largeurMin: string
  hauteurMax: string
  conditions: string
  statut: string
  source: string
}

const REGLES: RegleDesignation[] = [
  { code: 'B2', zone: 'B', typeOperation: 'Lotissement', appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Libre', ces: 'Libre avec cour de 16 m\u00B2', surfaceMin: '80 m\u00B2', largeurMin: '8 m', hauteurMax: 'R+2 / 11,50 m', conditions: "Si voie d'am\u00E9nagement >=20 m : 120 m\u00B2 et fa\u00E7ade >=12 m. Les r\u00E8gles de prospects/hauteur restent applicables.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.15-16, art. 1.B, 2-B, 3-B, 4-B' },
  { code: 'B2', zone: 'B', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: "70 m\u00B2/logement", largeurMin: '\u2014', hauteurMax: 'R+2 / 11,50 m', conditions: "Pour groupe d'habitation : COS/CES non fix\u00E9s ; minimum habitable 70 m\u00B2/logement.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.16, art. 3-B et p.17, art. 4-B' },
  { code: 'B3', zone: 'B', typeOperation: 'Lotissement', appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Libre', ces: '75 %', surfaceMin: '200 m\u00B2', largeurMin: '10 m', hauteurMax: 'R+3 / 14,50 m', conditions: "Si voie d'am\u00E9nagement >=20 m : surface min. 300 m\u00B2 et fa\u00E7ade >=15 m.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.15-16, art. 1.B, 3-B, 4-B' },
  { code: 'B3', zone: 'B', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: "70 m\u00B2/logement", largeurMin: '\u2014', hauteurMax: 'R+3 / 14,50 m', conditions: "Pour groupe d'habitation : COS/CES non fix\u00E9s ; minimum habitable 70 m\u00B2/logement.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.16-17, art. 3-B, 4-B' },
  { code: 'B4', zone: 'B', typeOperation: 'Lotissement', appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Libre', ces: 'Libre', surfaceMin: '240 m\u00B2', largeurMin: '12 m', hauteurMax: 'R+4 / 17,50 m', conditions: "Si voie d'am\u00E9nagement >=20 m : surface min. 300 m\u00B2 et fa\u00E7ade >=15 m.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.15-16, art. 3-B, 4-B' },
  { code: 'B4', zone: 'B', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: "70 m\u00B2/logement", largeurMin: '\u2014', hauteurMax: 'R+4 / 17,50 m', conditions: "Pour groupe d'habitation : COS/CES non fix\u00E9s ; minimum habitable 70 m\u00B2/logement.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.16-17, art. 3-B, 4-B' },
  { code: 'SB2', zone: 'B', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Non', commerce: 'Non', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: "70 m\u00B2/logement", largeurMin: '\u2014', hauteurMax: 'R+2 / 11,50 m', conditions: "Secteur destin\u00E9 exclusivement aux groupes d'habitation. Lotissement interdit.", statut: 'VALID\u00E9 \u2013 APPARTEMENT', source: 'R\u00E8glement p.15-17, art. 1.B, 2-B, 3-B, 4-B' },
  { code: 'SB4', zone: 'B', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Non', commerce: 'Non', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: "70 m\u00B2/logement", largeurMin: '\u2014', hauteurMax: 'R+4 / 17,50 m', conditions: "Secteur destin\u00E9 exclusivement aux groupes d'habitation. Lotissement interdit.", statut: 'VALID\u00E9 \u2013 APPARTEMENT', source: 'R\u00E8glement p.15-18, art. 1.B, 2-B, 3-B, 4-B' },
  { code: 'SB6', zone: 'B', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Non', commerce: 'Oui*', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: "70 m\u00B2/logement", largeurMin: '\u2014', hauteurMax: 'R+6 / 25 m', conditions: "RDC obligatoirement affect\u00E9 \u00E0 des commerces de haute gamme/services. Parcelles \u25B2 identifi\u00E9es au graphique exclusivement tertiaires (commerce, services, bureaux, h\u00F4tellerie). Commerce donnant sur RN1 : min. 200 m\u00B2 sur 50 m d'emprise.", statut: 'VALID\u00E9 \u2013 CONDITIONNEL', source: 'R\u00E8glement p.15-18, art. 1.B, 3-B, 4-B' },
  { code: 'C2', zone: 'C', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Libre', ces: '40 %', surfaceMin: '2000 m\u00B2', largeurMin: '30 m', hauteurMax: 'R+2 / 11,50 m', conditions: "Les projets de groupes d'habitation peuvent s'adjoindre commerces de proximit\u00E9, bureaux et activit\u00E9s tertiaires.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.21-22, art. 1.C, 3.C, 4.C' },
  { code: 'C4', zone: 'C', typeOperation: "Construction / groupe d'habitation", appartement: 'Oui', bureau: 'Oui', commerce: 'Oui', cos: 'Libre', ces: '35 %', surfaceMin: '5000 m\u00B2', largeurMin: '50 m', hauteurMax: 'R+4 / 17,50 m', conditions: "Les projets de groupes d'habitation peuvent s'adjoindre commerces de proximit\u00E9, bureaux et activit\u00E9s tertiaires. Parcelles TE12 signal\u00E9es peuvent recevoir R+4 sous conditions graphiques.", statut: 'VALID\u00C9', source: 'R\u00E8glement p.21-24, art. 1.C, 3.C, 4.C, 11.C' },
  { code: 'ZPI', zone: 'ZPI', typeOperation: 'Projet int\u00E9gr\u00E9 / construction', appartement: 'Oui', bureau: 'Oui', commerce: 'Non explicite', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: 'Non fix\u00E9', largeurMin: 'Non fix\u00E9', hauteurMax: 'R+6 / 25 m', conditions: "P\u00F4les multifonctionnels : activit\u00E9s administratives, tertiaires, socioculturelles et/ou r\u00E9sidentielles. Lotissement interdit. Composante r\u00E9sidentielle <=50 % de la surface plancher totale. Cahier de prescriptions obligatoire.", statut: 'VALID\u00E9 \u2013 CONDITIONNEL', source: 'R\u00E8glement p.28, art. 1-2 ZPI' },
  { code: 'ZS', zone: 'ZS', typeOperation: 'Construction sur projets autoris\u00E9s', appartement: 'Non', bureau: 'Non', commerce: 'Oui*', cos: 'Selon projet/cahier des charges', ces: 'Selon projet/cahier des charges', surfaceMin: 'Non fix\u00E9', largeurMin: 'Non fix\u00E9', hauteurMax: 'Selon projet/cahier des charges', conditions: "Commerces/services autoris\u00E9s au RDC des immeubles avec fa\u00E7ade sur TE105, uniquement sur le tron\u00E7on TE308\u2013TE96, sous conditions. R\u00E9gime des projets/cahiers des charges autoris\u00E9s.", statut: 'VALID\u00C9 \u2013 COMMERCE CONDITIONNEL', source: 'R\u00E8glement p.28, chapitre V ZS' },
  { code: 'IN2', zone: 'IN', typeOperation: 'Construction / activit\u00E9', appartement: 'Non*', bureau: 'Oui', commerce: 'Oui', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: '500 m\u00B2', largeurMin: '20 m', hauteurMax: '14 m', conditions: "Activit\u00E9s non polluantes ; commerces, plateaux de bureaux, h\u00F4tellerie, enseignement, formation/recherche, etc. Habitat interdit, sauf logement de surveillance/gestion/direction.", statut: 'VALID\u00C9 \u2013 BUREAU/COMMERCE', source: 'R\u00E8glement p.29-30, art. 1.IN, 2.IN, 3.IN, 4.IN' },
  { code: 'IN3', zone: 'IN', typeOperation: 'Construction / activit\u00E9', appartement: 'Oui*', bureau: 'Non explicite', commerce: 'Oui', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: '120 m\u00B2', largeurMin: '10 m', hauteurMax: 'R+2 / 11,50 m', conditions: "Secteur r\u00E9serv\u00E9 aux activit\u00E9s artisanales et commerciales ; habitat autoris\u00E9 aux \u00E9tages. Habitat interdit au rez-de-chauss\u00E9e.", statut: 'VALID\u00C9 \u2013 COMMERCE + HABITAT AUX \u00C9TAGES', source: 'R\u00E8glement p.29-30, art. 1.IN, 2.IN, 3.IN, 4.IN' },
  { code: 'INS', zone: 'INS', typeOperation: 'Construction / activit\u00E9', appartement: 'Non', bureau: 'Oui', commerce: 'Oui', cos: 'Non fix\u00E9', ces: 'Non fix\u00E9', surfaceMin: '1000 m\u00B2', largeurMin: '40 m', hauteurMax: '14 m', conditions: "Zone Show-Room : bureaux, services, activit\u00E9s tertiaires, commerces et animations. Habitat individuel ou collectif interdit.", statut: 'VALID\u00C9 \u2013 BUREAU/COMMERCE', source: 'R\u00E8glement p.32, art. 1.INS, 2.INS, 3.INS, 4.INS' },
  { code: 'DS1', zone: 'D', typeOperation: 'Lotissement villa', appartement: 'Non', bureau: 'Conditionnel*', commerce: 'Conditionnel*', cos: 'Libre', ces: "30 % (isol\u00E9e) / 40 % (jumel\u00E9e) / 50 % (bande)", surfaceMin: "400 m\u00B2 isol\u00E9e / 300 m\u00B2 jumel\u00E9e / 200 m\u00B2 bande", largeurMin: "20 m isol\u00E9e / 15 m jumel\u00E9e / 10 m bande", hauteurMax: 'R+1 / 8,50 m', conditions: "Zone destin\u00E9e aux logements individuels type villa. Commerce/services/bureaux/tertiaire incorpor\u00E9s \u00E0 l'habitat interdits sauf le long des axes TE01, TE05, TE06, TE31, TE34.", statut: 'VALID\u00C9 \u2013 COMMERCE/BUREAU CONDITIONNEL SUR AXES', source: 'R\u00E8glement p.24-25, art. 1.D-2.D' },
  { code: 'D1', zone: 'D', typeOperation: 'Lotissement villa isol\u00E9e', appartement: 'Non', bureau: 'Conditionnel*', commerce: 'Conditionnel*', cos: 'Libre', ces: '30 %', surfaceMin: '400 m\u00B2', largeurMin: '20 m', hauteurMax: 'R+1 / 8,50 m', conditions: "Zone destin\u00E9e \u00E0 la villa isol\u00E9e. Exception commerciale/services/bureaux/tertiaire uniquement le long des axes TE01, TE05, TE06, TE31, TE34.", statut: 'VALID\u00C9 \u2013 CONDITIONNEL SUR AXES', source: 'R\u00E8glement p.24-26, art. 1.D-2.D-3.D' },
  { code: 'D5', zone: 'D', typeOperation: 'Lotissement villa isol\u00E9e', appartement: 'Non', bureau: 'Conditionnel*', commerce: 'Conditionnel*', cos: 'Libre', ces: '20 %', surfaceMin: '1000 m\u00B2', largeurMin: '30 m', hauteurMax: 'R+1 / 8,50 m', conditions: "Zone destin\u00E9e \u00E0 la villa isol\u00E9e. Exception commerciale/services/bureaux/tertiaire uniquement le long des axes TE01, TE05, TE06, TE31, TE34.", statut: 'VALID\u00C9 \u2013 CONDITIONNEL SUR AXES', source: 'R\u00E8glement p.24-26, art. 1.D-2.D-3.D' },
  { code: 'D5', zone: 'D', typeOperation: 'Construction', appartement: 'Non', bureau: 'Non', commerce: 'Non', cos: 'Libre', ces: '15 %', surfaceMin: '3000 m\u00B2', largeurMin: '30 m', hauteurMax: 'R+1 / 8,50 m', conditions: "Construction de villas : 2 logements/parcelle, surface minimale de l'unit\u00E9 au sol 200 m\u00B2. Les bureaux/commerces/activit\u00E9s tertiaires incorpor\u00E9s \u00E0 l'habitat sont interdits hors axes express\u00E9ment autoris\u00E9s.", statut: 'VALID\u00C9 \u2013 VILLA UNIQUEMENT', source: 'R\u00E8glement p.25-26, art. 2.D-3.D-4.D' },
]

const rulesByCode = new Map<string, RegleDesignation[]>()
for (const r of REGLES) {
  const key = r.code.toUpperCase()
  if (!rulesByCode.has(key)) rulesByCode.set(key, [])
  rulesByCode.get(key)!.push(r)
}

export function getReglesDesignation(code: string): RegleDesignation[] {
  return rulesByCode.get(code.toUpperCase()) ?? []
}

export function getReglesPrincipales(code: string): RegleDesignation | null {
  const rules = rulesByCode.get(code.toUpperCase())
  if (!rules || rules.length === 0) return null
  return rules.find((r) => /lotissement/i.test(r.typeOperation)) ?? rules[0]
}

export function isCosEditable(cos: string | null): boolean {
  if (cos == null) return true
  const c = cos.toLowerCase().trim()
  return c === '' || c === 'libre' || c === 'non fixé' || c === 'non fixe' || c === 'selon projet/cahier des charges'
}

export function isCusEditable(cus: string | null): boolean {
  if (cus == null) return true
  const c = cus.toLowerCase().trim()
  return c === '' || c === 'libre' || c === 'non fixé' || c === 'non fixe' || c === 'selon projet/cahier des charges'
}
