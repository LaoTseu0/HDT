// API publique du registre paramétrique d'Edit mode (E12-05).
// Import : `@/features/edit/registry`.

export { isKnownKind, kindNaming, generateObject, disposeObject } from './registry'
export { referencePoints, type ReferencePoint } from './referencePoints'
export { deformHandles, type DeformHandle } from './deformHandles'
export { deriveDims, type DerivedDims } from './deriveDims'
export { isRunKind, runPointsOf } from './generateMep'
export { arcLocalPoints } from './generateSketch'
export { placeOnPlane, type Generator } from './common'
