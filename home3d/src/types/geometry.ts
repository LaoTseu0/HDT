// Types géométriques de base du domaine (Phase 1 du refactor TS).
//
// Tout le code métier travaille sur des TABLEAUX nus ([x,y,z] monde, (s,t) plan
// d'esquisse) — pas des THREE.Vector3 — pour rester pur et testable hors
// navigateur (cf. lib/workPlanes). Ces alias figent cette convention.

/** Coordonnées (s,t) dans un plan d'esquisse (repère u/v). */
export type Vec2 = [number, number]

/** Point ou vecteur monde [x, y, z]. */
export type Vec3 = [number, number, number]

/** Segment/ligne d'inférence : deux extrémités monde. */
export type Segment3 = [Vec3, Vec3]

/**
 * Repère orthonormé DIRECT d'un plan : `u`/`v` = axes du plan (largeur/
 * profondeur du tracé), `normal` = perpendiculaire (axe d'extrusion du
 * Push/Pull). `u × v = normal` (cf. makeBasisFromNormal).
 */
export interface Basis {
  u: Vec3
  v: Vec3
  normal: Vec3
}

/**
 * Provenance d'un plan :
 *  - `ground` : plan de SOL (horizontal, niveau 0) — plan d'esquisse par défaut ;
 *  - `face`   : face de mesh survolée (plan d'esquisse contextuel, E12-02) ;
 *  - `run`    : plan NOMINAL d'un objet routé (câble/tuyau/vanne) — la géométrie
 *               vit en coordonnées monde dans ses params, le repère est ignoré.
 */
export type PlaneType = 'ground' | 'face' | 'run'

/**
 * Plan de travail RÉSOLU (frame) : repère + origine monde. C'est ce que
 * produisent groundFrame/faceFrame et que consomment le tracé et le snapping.
 * `faceOf` : node name du mesh dont la face a fourni le plan (liaison mur,
 * posée par faceFrame, immuable).
 */
export interface WorkFrame extends Basis {
  type: PlaneType
  origin: Vec3
  faceOf?: string
}

/**
 * Plan PORTÉ par un objet app (champ `plane` du payload) : même shape que
 * WorkFrame (`origin` = CENTRE/seuil de la forme, le repère fige
 * l'orientation), plus la liaison d'hébergement des menuiseries.
 * `hostOf` : node name de l'ouverture hôte (menuiserie/vantail, E14-05).
 * Rétro-compat : les objets d'avant E12-02 peuvent n'avoir que `origin`
 * (frameOfObjectPlane replie sur le repère sol).
 */
export interface ObjectPlane extends Partial<Basis> {
  type?: PlaneType
  origin: Vec3
  faceOf?: string
  hostOf?: string
}
