// E17-10 — entrées analogiques du mode visite (joysticks virtuels + manette).
// Module PUR (maths sur les axes) + un singleton mutable `touchInput` écrit par
// l'overlay tactile (VisitSticks) et lu par VisitControls dans la boucle de
// rendu — même philosophie que les refs clavier : aucun re-render par frame.
//
// Conventions d'axes (pour les DEUX sticks, tactile comme manette) :
//   x ∈ [-1, 1] : + vers la droite ; y ∈ [-1, 1] : + vers l'avant/le haut.
// (La manette et l'écran donnent y+ vers le bas → inversé ici, une fois.)

export const DEADZONE = 0.15 // zone morte manette (dérive des sticks au repos)

// Zone morte re-normalisée : 0 dans la zone morte, puis progression CONTINUE
// de 0 à 1 (pas de saut à la sortie de la zone morte).
export function applyDeadzone(value, deadzone = DEADZONE) {
  const a = Math.abs(value)
  if (a < deadzone) return 0
  return Math.sign(value) * Math.min(1, (a - deadzone) / (1 - deadzone))
}

// Borne un vecteur stick au cercle unité (diagonale clavier, doigt sorti de la
// base) en préservant la direction et les amplitudes intermédiaires.
export function clampStick(x, y) {
  const len = Math.hypot(x, y)
  if (len <= 1) return { x, y }
  return { x: x / len, y: y / len }
}

// Position du doigt (offset px depuis le centre de la base) → vecteur stick.
// L'axe écran y+ descend → inversé (doigt vers le haut = avancer).
export function stickFromPointer(dx, dy, radius) {
  return clampStick(dx / radius, -dy / radius)
}

// Lit la première manette connectée (mapping « standard » : axes 0/1 = stick
// gauche, 2/3 = stick droit) → { move, look } dans nos conventions, ou null.
// À appeler à CHAQUE frame : Chrome ne rafraîchit les axes qu'au getGamepads().
export function gamepadInput(gamepads) {
  if (!gamepads) return null
  for (const pad of gamepads) {
    if (!pad || !pad.connected || pad.axes.length < 4) continue
    return {
      move: clampStick(applyDeadzone(pad.axes[0]), -applyDeadzone(pad.axes[1])),
      look: clampStick(applyDeadzone(pad.axes[2]), -applyDeadzone(pad.axes[3])),
    }
  }
  return null
}

// État partagé des joysticks virtuels (écrit par VisitSticks, lu par
// VisitControls). Mutation en place : jamais de nouvelle référence par frame.
export const touchInput = {
  move: { x: 0, y: 0 }, // stick gauche : se déplacer
  look: { x: 0, y: 0 }, // stick droit : regarder
}

// Écriture EN PLACE d'un stick (handlers pointeur de VisitSticks). Centralisée
// ici : c'est ce module qui possède la convention « mutation en place, jamais
// de nouvelle référence » (et la règle react-hooks/immutability interdit à un
// composant de muter sa prop directement).
export function setStick(stick, x, y) {
  stick.x = x
  stick.y = y
}

export function resetTouchInput() {
  setStick(touchInput.move, 0, 0)
  setStick(touchInput.look, 0, 0)
}
