# Rapport Méthodologique — Analyse Multicritère Hybride AHP + ROC

## Projet GEO INVEST — Module d'Analyse Pondérée

---

## 1. Introduction à l'analyse multicritère dans GEO INVEST

### 1.1 Pourquoi une approche hybride AHP + ROC

L'analyse multicritère du module d'analyse pondérée de GEO INVEST repose sur la combinaison de deux méthodes complémentaires :

- **AHP (Analytic Hierarchy Process)** pour la pondération **inter-catégories** : il s'agit de déterminer l'importance relative de chaque grande catégorie de critères (accessibilité, positionnement, topographie) par comparaison par paires.
- **ROC (Rank Order Centroid)** pour la pondération **intra-catégories** : au sein de chaque catégorie, les sous-critères sont hiérarchisés par ordre de priorité, et des poids leur sont attribués par la méthode ROC, qui ne nécessite que l'ordre ordinal des critères.

Cette hybride permet de combiner la rigueur des comparaisons par paires d'AHP (pour le niveau le plus stratégique) avec la simplicité de ROC (pour le niveau opérationnel des sous-critères), tout en minimisant la charge cognitive de l'utilisateur.

### 1.2 Les trois catégories et leurs sous-critères

| Catégorie | Sous-critères | Nature du score brut |
|---|---|---|
| **Accessibilité** | Enseignement, Santé, Administration, Transport, Marchés, Loisirs, Repos, Hygiène | Distance (m) à l'équipement le plus proche de chaque type |
| **Positionnement** | Localisation | Score binaire (centre-ville ou périurbaine) |
| **Topographie** | Altitude | Score binaire (appartenance à une plage altitudinale) |

L'accessibilité se décline en 8 sous-critères de distance, tandis que le positionnement et la topographie ne comptent chacun qu'un seul sous-critère.

---

## 2. Étape 1 — Construction de la matrice AHP (pondération des catégories)

### 2.1 L'échelle de Saaty

L'échelle de Saaty utilisée s'étend de **1 à 9**, conformément à la méthode AHP standard. Les valeurs d'intensité sont les suivantes :

| Intensité | Signification |
|---|---|
| 1 | Importance égale |
| 3 | Importance modérée d'un critère sur un autre |
| 5 | Importance forte |
| 7 | Importance très forte |
| 9 | Importance extrême |
| 2, 4, 6, 8 | Valeurs intermédiaires |

### 2.2 Entrée utilisateur : classement et deux comparaisons d'intensité

L'utilisateur fournit deux informations :

1. **L'ordre des catégories** : une liste ordonnée du plus important au moins important, par exemple `["accessibilite", "positionnement", "topographie"]`.
2. **Deux intensités consécutives** : `[a12, a23]` correspondant respectivement à l'intensité de préférence du rang 1 sur le rang 2, et du rang 2 sur le rang 3.

### 2.3 Construction de la matrice 3×3

La matrice de comparaison par paires est construite selon la structure suivante :

$$
A = \begin{bmatrix}
1 & a_{12} & a_{13} \\
1/a_{12} & 1 & a_{23} \\
1/a_{13} & 1/a_{23} & 1
\end{bmatrix}
$$

La troisième comparaison $a_{13}$ (rang 1 vs rang 3) est **dérivée automatiquement** par :

$$a_{13} = a_{12} \times a_{23}$$

Cette construction garantit la transitivité parfaite et, par conséquent, un ratio de cohérence CR ≈ 0.

**Exemple chiffré** : Soit l'ordre `["accessibilite", "positionnement", "topographie"]` et les intensités `[3, 5]` (accessibilité modérément plus importante que positionnement, positionnement fortement plus importante que topographie).

$$a_{12} = 3, \quad a_{23} = 5, \quad a_{13} = 3 \times 5 = 15$$

$$
A = \begin{bmatrix}
1 & 3 & 15 \\
1/3 & 1 & 5 \\
1/15 & 1/5 & 1
\end{bmatrix}
=
\begin{bmatrix}
1.000 & 3.000 & 15.000 \\
0.333 & 1.000 & 5.000 \\
0.067 & 0.200 & 1.000
\end{bmatrix}
$$

> **Note** : Bien que $a_{13} = 15$ dépasse l'échelle de Saaty (1–9), ce phénomène est inhérent au produit transitif. En pratique, les utilisateurs sont guidés pour choisir des intensités faibles afin de maintenir les valeurs dans des plages raisonnables.

### 2.4 Normalisation des colonnes

Chaque élément de la matrice est divisé par la somme de sa colonne :

$$n_{ij} = \frac{a_{ij}}{\sum_{k=1}^{3} a_{kj}}$$

Pour l'exemple :

- Somme colonne 1 : $1.000 + 0.333 + 0.067 = 1.400$
- Somme colonne 2 : $3.000 + 1.000 + 0.200 = 4.200$
- Somme colonne 3 : $15.000 + 5.000 + 1.000 = 21.000$

$$
N = \begin{bmatrix}
0.7143 & 0.7143 & 0.7143 \\
0.2381 & 0.2381 & 0.2381 \\
0.0476 & 0.0476 & 0.0476
\end{bmatrix}
$$

### 2.5 Calcul du vecteur de poids (moyenne des lignes)

Le poids de chaque catégorie est la **moyenne des éléments de sa ligne** dans la matrice normalisée :

$$w_i = \frac{1}{n} \sum_{j=1}^{n} n_{ij}$$

Pour l'exemple :

- $w_{\text{accessibilite}} = \frac{0.7143 + 0.7143 + 0.7143}{3} = 0.7143$
- $w_{\text{positionnement}} = \frac{0.2381 + 0.2381 + 0.2381}{3} = 0.2381$
- $w_{\text{topographie}} = \frac{0.0476 + 0.0476 + 0.0476}{3} = 0.0476$

> **Remarque** : Comme $a_{13} = a_{12} \times a_{23}$, les lignes de la matrice normalisée sont parfaitement identiques, ce qui rend la moyenne triviale. Le CR sera exactement 0 dans ce cas.

Les poids sont arrondis à 6 décimales dans l'implémentation (`round(poids[i], 6)`).

### 2.6 Calcul du ratio de cohérence CR

Le ratio de cohérence est calculé selon le protocole standard d'AHP :

**Étape 1** — Vecteur produit $Aw$ :

$$\text{produit}_i = \sum_{j=1}^{n} a_{ij} \times w_j$$

**Étape 2** — Calcul de $\lambda_i$ pour chaque ligne :

$$\lambda_i = \frac{\text{produit}_i}{w_i}$$

**Étape 3** — Valeur propre dominante $\lambda_{\max}$ :

$$\lambda_{\max} = \frac{1}{n} \sum_{i=1}^{n} \lambda_i$$

**Étape 4** — Indice de cohérence CI :

$$CI = \frac{\lambda_{\max} - n}{n - 1}$$

**Étape 5** — Indice aléatoire RI (pour $n = 3$) :

$$RI = 0.58 \quad \text{(valeur tabulée de Saaty)}$$

**Étape 6** — Ratio de cohérence CR :

$$CR = \frac{CI}{RI}$$

**Application à l'exemple** :

$$\text{produit}_1 = 1.0 \times 0.7143 + 3.0 \times 0.2381 + 15.0 \times 0.0476 = 2.1429$$

$$\lambda_1 = \frac{2.1429}{0.7143} = 3.0000$$

De même pour les autres lignes (par transitivité parfaite) :

$$\lambda_{\max} = \frac{3.0000 + 3.0000 + 3.0000}{3} = 3.0000$$

$$CI = \frac{3.0000 - 3}{3 - 1} = 0$$

$$CR = \frac{0}{0.58} = 0$$

### 2.7 Interprétation du CR et justification de son caractère non bloquant

Le seuil de cohérence est fixé à **CR < 0.10** (10 %). La valeur retournée par le code est :

```python
"coherent": cr < 0.10
```

Cependant, dans l'architecture du pipeline, **le résultat du test de cohérence n'est pas un garde-fou bloquant**. La fonction `calculer_poids_ahp` retourne le CR et le booléen `coherent`, mais la vue `AnalysePondereeView` utilise les poids quoi qu'il arrive (les poids sont retournés dans la réponse HTTP, mais ne conditionnent pas le calcul). La raison est double :

1. **Le caractère transitif par construction** ($a_{13} = a_{12} \times a_{23}$) rend le CR théoriquement nul dans le cas simplifié à 2 paramètres.
2. **UX utilisateur** : bloquer le calcul sur un CR élevé priverait l'utilisateur de tout résultat, alors que même un jugement partiellement incohérent fournit une estimation utile.

Le CR est communiqué à l'utilisateur pour information, permettant d'apprécier la fiabilité des poids.

---

## 3. Étape 2 — Pondération ROC des sous-critères (intra-catégories)

### 3.1 Principe du Rank Order Centroid

La méthode ROC (Rank Order Centroid) attribue des poids à des critères uniquement à partir de leur **ordre ordinal** (le plus important au moins important). Elle ne nécessite aucun jugement d'intensité, contrairement à AHP.

### 3.2 Formule générale ROC

Pour $n$ critères classés du rang $i = 1$ (le plus important) au rang $i = n$ (le moins important), le poids du critère de rang $i$ est :

$$w_i^{\text{ROC}} = \frac{1}{n} \sum_{k=i}^{n} \frac{1}{k}$$

**Propriétés** :

- $w_1^{\text{ROC}} \geq w_2^{\text{ROC}} \geq \ldots \geq w_n^{\text{ROC}}$ (décroissance monotone)
- $\sum_{i=1}^{n} w_i^{\text{ROC}} = 1$

### 3.3 Tableau ROC précalculé

Le module `roc.py` contient un tableau précalculé pour $n = 1$ à $8$ :

| $n$ | Rang 1 | Rang 2 | Rang 3 | Rang 4 | Rang 5 | Rang 6 | Rang 7 | Rang 8 |
|---|---|---|---|---|---|---|---|---|
| 1 | 1.000 | | | | | | | |
| 2 | 0.750 | 0.250 | | | | | | |
| 3 | 0.611 | 0.278 | 0.111 | | | | | |
| 4 | 0.521 | 0.271 | 0.146 | 0.063 | | | | |
| 5 | 0.457 | 0.257 | 0.156 | 0.087 | 0.043 | | | |
| 6 | 0.408 | 0.242 | 0.159 | 0.101 | 0.060 | 0.030 | | |
| 7 | 0.369 | 0.229 | 0.157 | 0.107 | 0.072 | 0.044 | 0.022 | |
| 8 | 0.338 | 0.217 | 0.153 | 0.108 | 0.078 | 0.053 | 0.032 | 0.016 |

Pour $n > 8$, les poids sont calculés à la volée via la formule.

### 3.4 Application aux catégories de GEO INVEST

**Accessibilité (8 sous-critères)** :

Pour $n = 8$, les poids ROC sont :

| Rang | Sous-critère (exemple) | Poids ROC |
|---|---|---|
| 1 | Enseignement | 0.338 |
| 2 | Santé | 0.217 |
| 3 | Administration | 0.153 |
| 4 | Transport | 0.108 |
| 5 | Marchés | 0.078 |
| 6 | Loisirs | 0.053 |
| 7 | Repos | 0.032 |
| 8 | Hygiène | 0.016 |

**Vérification** : $0.338 + 0.217 + 0.153 + 0.108 + 0.078 + 0.053 + 0.032 + 0.016 = 0.995 \approx 1.0$ (les arrondis à 6 décimales introduisent une légère déviation).

**Exemple chiffré détaillé** :

Pour $n = 3$ critères classés [A, B, C] :

$$w_1 = \frac{1}{3}\left(\frac{1}{1} + \frac{1}{2} + \frac{1}{3}\right) = \frac{1}{3} \times \frac{11}{6} = \frac{11}{18} = 0.6111$$

$$w_2 = \frac{1}{3}\left(\frac{1}{2} + \frac{1}{3}\right) = \frac{1}{3} \times \frac{5}{6} = \frac{5}{18} = 0.2778$$

$$w_3 = \frac{1}{3}\left(\frac{1}{3}\right) = \frac{1}{9} = 0.1111$$

**Vérification** : $\frac{11}{18} + \frac{5}{18} + \frac{2}{18} = \frac{18}{18} = 1.0$

**Positionnement (1 sous-critère)** :

Pour $n = 1$ : $w_1 = 1.0$. Le critère « Localisation » reçoit la totalité du poids de la catégorie.

**Topographie (1 sous-critère)** :

Pour $n = 1$ : $w_1 = 1.0$. Le critère « Altitude » reçoit la totalité du poids de la catégorie.

---

## 4. Étape 3 — Combinaison des poids globaux

### 4.1 Formule de combinaison

Le poids global de chaque sous-critère est le produit du poids AHP de sa catégorie par le poids ROC local du sous-critère :

$$w_i^{\text{global}} = w_{\text{cat}(i)}^{\text{AHP}} \times w_i^{\text{ROC}}$$

### 4.2 Redistribution des catégories vides

Si une catégorie entière n'a aucun sous-critère actif (par exemple, si l'utilisateur ne sélectionne aucun critère d'accessibilité), son poids AHP est redistribué proportionnellement aux sous-critères existants :

$$\text{facteur} = \frac{\sum w_{\text{actuels}} + w_{\text{redistribué}}}{\sum w_{\text{actuels}}}$$

Chaque poids existant est multiplié par ce facteur.

### 4.3 Renormalisation

Après combinaison et redistribution éventuelle, les poids globaux sont renormalisés pour que leur somme soit exactement égale à 1 :

$$w_i^{\text{global, norm}} = \frac{w_i^{\text{global}}}{\sum_j w_j^{\text{global}}}$$

### 4.4 Exemple chiffré complet

Soient les poids AHP suivants (issus de l'étape 1) :

| Catégorie | Poids AHP |
|---|---|
| Accessibilité | 0.40 |
| Positionnement | 0.35 |
| Topographie | 0.25 |

Et les ordres ROC fournis par l'utilisateur :

| Catégorie | Ordre des sous-critères |
|---|---|
| Accessibilité | [Enseignement, Santé] |
| Positionnement | [Localisation] |
| Topographie | [Altitude] |

**Poids ROC intra-catégories** :

- Accessibilité ($n = 2$) : Enseignement = 0.750, Santé = 0.250
- Positionnement ($n = 1$) : Localisation = 1.000
- Topographie ($n = 1$) : Altitude = 1.000

**Poids globaux avant renormalisation** :

| Sous-critère | Calcul | Poids global |
|---|---|---|
| Enseignement | $0.40 \times 0.750$ | 0.300 |
| Santé | $0.40 \times 0.250$ | 0.100 |
| Localisation | $0.35 \times 1.000$ | 0.350 |
| Altitude | $0.25 \times 1.000$ | 0.250 |

**Vérification** : $0.300 + 0.100 + 0.350 + 0.250 = 1.000$ → pas de renormalisation nécessaire dans ce cas.

### 4.5 Tableau récapitulatif des poids globaux

| Catégorie | Sous-critère | Poids AHP | Poids ROC | Poids Global |
|---|---|---|---|---|
| Accessibilité | Enseignement | 0.40 | 0.750 | **0.3000** |
| Accessibilité | Santé | 0.40 | 0.250 | **0.1000** |
| Positionnement | Localisation | 0.35 | 1.000 | **0.3500** |
| Topographie | Altitude | 0.25 | 1.000 | **0.2500** |
| | | | **Total** | **1.0000** |

---

## 5. Étape 4 — Normalisation des scores par critère

Chaque score brut (distance, zone, altitude) est transformé en un score normalisé dans l'intervalle $[0, 1]$ avant d'être injecté dans l'agrégation SAW.

### 5.1 Accessibilité : normalisation min-max inversée sur la distance

**Formule** :

Pour un terrain dont la distance à l'équipement est $v$, dans un ensemble de terrains avec distances $\{d_1, d_2, \ldots, d_m\}$ :

$$\text{score} = \frac{d_{\max} - v}{d_{\max} - d_{\min}}$$

où $d_{\min} = \min_k(d_k)$ et $d_{\max} = \max_k(d_k)$.

**Propriétés** :
- Le terrain le plus proche ($v = d_{\min}$) obtient un score de **1.0**.
- Le terrain le plus éloigné ($v = d_{\max}$) obtient un score de **0.0**.
- La relation est **linéaire** entre les deux bornes.

**Cas particulier** : Si toutes les distances sont identiques ($d_{\max} - d_{\min} < 10^{-10}$), tous les terrains reçoivent un score de **1.0** (pas de discrimination possible).

**Calcul au niveau de l'ensemble** : Les bornes $d_{\min}$ et $d_{\max}$ sont calculées **par rapport à l'ensemble des terrains du projet** (tous les terrains candidats), et non par rapport à un seul terrain. Cela garantit une échelle de comparaison commune.

**Exemple** : Pour un sous-critère « Enseignement » avec les distances suivantes :

| Terrain | Distance (m) | Score normalisé |
|---|---|---|
| T1 | 150 | $\frac{2500 - 150}{2500 - 150} = 1.000$ |
| T2 | 800 | $\frac{2500 - 800}{2500 - 150} = 0.723$ |
| T3 | 1500 | $\frac{2500 - 1500}{2500 - 150} = 0.426$ |
| T4 | 2500 | $\frac{2500 - 2500}{2500 - 150} = 0.000$ |

### 5.2 Positionnement : score binaire de localisation

**Formule** :

$$\text{score}_{\text{localisation}} = \begin{cases} 1.0 & \text{si } z_{\text{terrain}} \in Z_{\text{choisi}} \\ 0.0 & \text{sinon} \end{cases}$$

où $z_{\text{terrain}}$ est la zone calculée du terrain (`centre_ville` ou `periurbaine`), et $Z_{\text{choisi}}$ est la zone (ou liste de zones) choisie par l'utilisateur.

**Cas particuliers** :
- Si $z_{\text{terrain}}$ est `None` (indéterminé), le score est **0.0**.
- Si l'utilisateur a sélectionné `["centre_ville", "periurbaine"]`, tous les terrains dont la zone est connue obtiennent 1.0.

**Justification** : La localisation est un critère qualitatif binaire dans GEO INVEST. Les terrains sont classés en deux zones mutuellement exclusives (centre-ville vs périurbaine) par rapport au centroïde de la commune de Témara. Il n'existe pas d'échelle continue de positionnement.

### 5.3 Topographie : score binaire d'altitude

**Formule** :

$$\text{score}_{\text{altitude}} = \begin{cases} 1.0 & \text{si } h \in P \\ 0.0 & \text{sinon} \end{cases}$$

où $h$ est l'altitude du terrain (issue du MNT) et $P$ est l'union des plages sélectionnées par l'utilisateur.

Les plages possibles sont :

| Clé | Condition |
|---|---|
| `lt100` | $h < 100$ m |
| `100_300` | $100 \leq h \leq 300$ m |
| `gt300` | $h > 300$ m |

**Cas particuliers** :
- Si l'altitude est `None` (inconnue), le score est **0.0**.
- Si l'utilisateur sélectionne plusieurs plages (par exemple `["lt100", "100_300"]`), le score est 1.0 si l'altitude satisfait **au moins une** des plages (condition OU).

**Justification** : Comme pour la localisation, l'altitude est traitée de manière binaire car elle est extraite d'un MNT et classée en catégories grossières par le plan d'aménagement. Une normalisation continue (min-max) de l'altitude n'aurait pas de sens physique dans ce contexte.

---

## 6. Étape 5 — Agrégation finale (SAW — Simple Additive Weighting)

### 6.1 Formule SAW

Le score final de chaque terrain est la **somme pondérée** de tous ses scores normalisés :

$$S_{\text{terrain}} = \sum_{i=1}^{N} w_i^{\text{global}} \times s_i$$

où :
- $N$ est le nombre total de sous-critères actifs,
- $w_i^{\text{global}}$ est le poids global du sous-critère $i$ (issue de l'étape 3),
- $s_i$ est le score normalisé du terrain pour le sous-critère $i$ (issue de l'étape 4).

### 6.2 Arrondi

Le score est arrondi à **4 décimales** dans la réponse HTTP :

```python
'score_final': round(score, 4)
```

Le calcul interne utilise une précision de 6 décimales, mais l'arrondi final est à 4 pour la sortie.

### 6.3 Non-persistance du score

Le score calculé **n'est pas stocké directement** comme attribut du modèle `Terrain`. Il est calculé à la volée dans la réponse HTTP. Cependant, le résultat est sauvegardé dans le modèle `ResultatAnalyse` (via la création d'une instance `Analyse` + `ResultatAnalyse` en batch) pour l'historique des analyses.

### 6.4 Exemple chiffré complet

Reprenons les poids globaux de l'étape 3 et appliquons-les à un terrain T1 :

| Sous-critère | Poids global ($w_i$) | Score normalisé ($s_i$) | Contribution ($w_i \times s_i$) |
|---|---|---|---|
| Enseignement | 0.300 | 0.85 | 0.2550 |
| Santé | 0.100 | 0.72 | 0.0720 |
| Localisation | 0.350 | 1.00 | 0.3500 |
| Altitude | 0.250 | 0.00 | 0.0000 |
| **Total** | | | **0.6770** |

$$S_{T1} = 0.300 \times 0.85 + 0.100 \times 0.72 + 0.350 \times 1.00 + 0.250 \times 0.00 = 0.6770$$

Le terrain T1 obtient un score final de **0.677** (ou **0.6770** avec 4 décimales).

### 6.5 Décomposition des contributions

Pour chaque terrain, le détail des contributions est calculé par la fonction `calculer_contributions`, retournant une liste triée par contribution décroissante :

```json
[
    {"critere": "Localisation", "poids": 0.350, "score": 1.00, "contribution": 0.350},
    {"critere": "Enseignement", "poids": 0.300, "score": 0.85, "contribution": 0.255},
    {"critere": "Santé", "poids": 0.100, "score": 0.72, "contribution": 0.072},
    {"critere": "Altitude", "poids": 0.250, "score": 0.00, "contribution": 0.000}
]
```

---

## 7. Schéma récapitulatif du pipeline complet

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAISIE UTILISATEUR                           │
│  • Ordre des catégories : [accessibilite, positionnement, ...]  │
│  • 2 intensités AHP : [a12, a23] (échelle 1-9)                │
│  • Ordres ROC par catégorie (sous-critères du + important)     │
│  • Sélections de critères actifs                                │
│  • Préférences localisation / altitude                          │
│  • Seuil de filtrage                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 : MATRICE AHP 3×3                                     │
│  a13 = a12 × a23 (déduction automatique)                       │
│  → Normalisation colonnes → Moyenne lignes → Poids AHP         │
│  → Calcul CR (informationnel, non bloquant)                    │
│  Résultat : w_AHP = {accessibilite: 0.40, ...}                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXTRACTION DES DONNÉES GIS                                     │
│  • Distances aux équipements par catégorie                      │
│  • Zone de localisation (centre_ville/periurbaine)              │
│  • Altitude (MNT)                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2 : PONDERATION ROC (intra-catégories)                  │
│  w_i^ROC = (1/n) × Σ(1/k) pour k=i..n                         │
│  Résultat : poids ROC par catégorie                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 3 : POIDS GLOBAUX                                       │
│  w_global = w_AHP × w_ROC → Redistribution → Renormalisation  │
│  Résultat : w_globaux = {Enseignement: 0.30, ...}              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 4 : NORMALISATION DES SCORES                            │
│  • Distances : min-max inversé (d_max - v)/(d_max - d_min)     │
│  • Localisation : binaire (1.0 si zone match, 0.0 sinon)       │
│  • Altitude : binaire (1.0 si plage OK, 0.0 sinon)            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ÉTAPE 5 : AGRÉGATION SAW                                      │
│  Score = Σ (w_i × s_i) → arrondi 4 décimales                   │
│  Filtrage par seuil → Tri décroissant → Rang                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  RÉPONSE HTTP                                                   │
│  {total, resultats[], poids_globaux, poids_ahp, CR, coherent}  │
│  + Sauvegarde PonderationPreference + Analyse/ResultatAnalyse   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Limites et perspectives

### 8.1 CR non bloquant : risque d'incohérence non détectée

Le test de cohérence CR est retourné dans la réponse mais n'empêche pas le calcul. Si un utilisateur fournit des intensités conduisant à un CR élevé, les poids produits pourraient ne pas refléter fidèlement ses préférences. Cependant, dans l'architecture actuelle ($a_{13} = a_{12} \times a_{23}$), le CR est toujours nul par construction — cette limitation n'est donc pas active dans le pipeline.

**Perspective** : Si l'interface évolue vers une saisie complète de la matrice 3×3 (6 paramètres au lieu de 2), le CR deviendra un indicateur utile et pourrait être rendu bloquant au-delà de 0.10.

### 8.2 Normalisation binaire pour localisation et altitude : perte d'information

Les scores binaires (0.0 ou 1.0) pour la localisation et l'altitude ne capturent pas de nuances intermédiaires :

- Un terrain à 99 m d'altitude (score 0.0 pour la plage 100–300) est traité exactement comme un terrain à 500 m. La différence de 401 m n'est pas capturée.
- Un terrain en zone périurbaine obtient le même score qu'un terrain en centre-ville si l'utilisateur sélectionne les deux zones.

**Perspectives d'amélioration** :
- **Altitude** : Remplacer le score binaire par une normalisation continue basée sur la distance à l'altitude idéale (par exemple, une fonction en cloche centrée sur une altitude cible).
- **Localisation** : Introduire un score ordinal (ex. centre-ville = 1.0, périurbaine = 0.5, hors zone = 0.0) ou une距离 pondérée au centroïde.

### 8.3 Nombre limité de catégories (3)

L'architecture AHP est codée en dur pour $n = 3$ catégories (matrice 3×3), ce qui limite la granularité de l'analyse. L'ajout de nouvelles catégories nécessiterait de généraliser la construction de la matrice AHP.

### 8.4 Choix de ROC vs AHP pour les sous-critères

La méthode ROC est plus simple que AHP mais moins précise : elle suppose une différence de perception uniforme entre les rangs consécutifs. Pour des cas où les intensités entre sous-critères varient significativement, une pondération AHP complète au niveau des sous-critères serait plus adaptée, au prix d'une complexité accrue pour l'utilisateur.

---

*Document généré à partir de l'analyse du code source du module AnalysePondereeView et des modules associés (`ahp.py`, `roc.py`, `normalisation.py`, `scoring.py`) du projet GEO INVEST.*
