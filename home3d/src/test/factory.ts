// Fabriques de fixtures pour les tests unitaires.
//
// Les modules métier prennent des `AppObject` complets ; les tests ne
// renseignent que ce qui compte pour le cas testé (kind/params/plane). La
// fabrique complète les champs de nommage avec des valeurs neutres et
// centralise LE cast — les fichiers de tests restent strictement typés.

import type { AppObject, AppObjectOf, Kind, ObjectPlane, ParamsByKind } from '@/types'

/** Plan nominal par défaut des fixtures (repère monde identité). */
export const testPlane: ObjectPlane = {
  type: 'ground',
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
}

/**
 * Objet app de test : params/plane fournis par le test, nommage neutre.
 * `params` est volontairement permissif (Partial) — certains tests exercent
 * précisément la robustesse aux params incomplets (rétro-compat GLB).
 */
export function appObj<K extends Kind>(
  kind: K,
  params: Partial<ParamsByKind[K]>,
  extra: Partial<Omit<AppObjectOf<K>, 'kind' | 'params'>> = {}
): AppObjectOf<K> {
  return {
    id: 'app-1',
    system: 'structure',
    type: 'forme',
    zone: 'libre',
    level: 'rdc',
    index: 1,
    kind,
    params,
    plane: testPlane,
    ...extra,
  } as AppObjectOf<K>
}

/** Cast explicite d'une fixture arbitraire en AppObject (cas volontairement invalides). */
export function asAppObject(fixture: unknown): AppObject {
  return fixture as AppObject
}
