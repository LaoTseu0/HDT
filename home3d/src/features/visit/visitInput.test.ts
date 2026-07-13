import { describe, it } from 'vitest'
import assert from 'node:assert/strict'

import {
  DEADZONE,
  applyDeadzone,
  clampStick,
  stickFromPointer,
  gamepadInput,
  touchInput,
  resetTouchInput,
} from '@/features/visit/visitInput'

// Module visitInput PUR (maths sur les axes) → testable hors navigateur.

describe('applyDeadzone', () => {
  it('annule la dérive au repos (|v| < zone morte)', () => {
    assert.equal(applyDeadzone(0), 0)
    assert.equal(applyDeadzone(0.1), 0)
    assert.equal(applyDeadzone(-0.14), 0)
  })

  it('re-normalise CONTINÛMENT de 0 à 1 à la sortie de la zone morte', () => {
    assert.ok(applyDeadzone(DEADZONE + 0.001) < 0.01) // pas de saut
    assert.equal(applyDeadzone(1), 1)
    assert.equal(applyDeadzone(-1), -1)
  })

  it('borne à ±1 les axes hors plage', () => {
    assert.equal(applyDeadzone(1.5), 1)
    assert.equal(applyDeadzone(-1.5), -1)
  })
})

describe('clampStick', () => {
  it('laisse passer les vecteurs dans le cercle unité', () => {
    assert.deepEqual(clampStick(0.3, -0.4), { x: 0.3, y: -0.4 })
  })

  it('ramène la diagonale pleine (clavier) sur le cercle unité', () => {
    const v = clampStick(1, 1)
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-12)
    assert.ok(Math.abs(v.x - v.y) < 1e-12) // direction préservée
  })
})

describe('stickFromPointer', () => {
  it('inverse l’axe écran : doigt vers le haut = avancer (y > 0)', () => {
    assert.deepEqual(stickFromPointer(0, -40, 40), { x: 0, y: 1 })
  })

  it('doigt sorti de la base : direction gardée, amplitude bornée à 1', () => {
    const v = stickFromPointer(120, 0, 40)
    assert.deepEqual(v, { x: 1, y: -0 })
  })

  it('demi-course = amplitude 0,5 (marche lente)', () => {
    assert.deepEqual(stickFromPointer(20, 0, 40), { x: 0.5, y: -0 })
  })
})

describe('gamepadInput', () => {
  // Fixture de manette minimale : gamepadInput ne lit que connected + axes.
  const pad = (axes: number[], connected = true) =>
    ({ connected, axes }) as unknown as Gamepad

  it('sans manette (null, tableau vide, entrées null) → null', () => {
    assert.equal(gamepadInput(null), null)
    assert.equal(gamepadInput([]), null)
    assert.equal(gamepadInput([null, null]), null) // slots fantômes Chrome
  })

  it('mappe axes 0/1 → move et 2/3 → look, y inversé (haut = avant)', () => {
    const input = gamepadInput([pad([1, -1, -1, 1])])!
    assert.ok(Math.abs(Math.hypot(input.move.x, input.move.y) - 1) < 1e-12)
    assert.ok(input.move.x > 0 && input.move.y > 0) // droite + avant
    assert.ok(input.look.x < 0 && input.look.y < 0) // gauche + bas
  })

  it('applique la zone morte sur chaque axe', () => {
    const input = gamepadInput([pad([0.1, -0.1, 0.05, -0.05])])
    assert.deepEqual(input, { move: { x: 0, y: -0 }, look: { x: 0, y: -0 } })
  })

  it('ignore les manettes déconnectées ou sans les 4 axes standard', () => {
    assert.equal(gamepadInput([pad([1, 1, 1, 1], false)]), null)
    assert.equal(gamepadInput([pad([1, 1])]), null)
    const input = gamepadInput([pad([1, 1], false), pad([0.5, 0, 0, 0])])
    assert.ok(input && input.move.x > 0)
  })
})

describe('touchInput', () => {
  it('resetTouchInput remet les deux sticks à zéro EN PLACE (même référence)', () => {
    const move = touchInput.move
    move.x = 0.7
    touchInput.look.y = -1
    resetTouchInput()
    assert.equal(touchInput.move, move) // mutation en place, pas de re-création
    assert.deepEqual(touchInput, { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } })
  })
})
