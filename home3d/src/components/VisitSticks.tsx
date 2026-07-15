import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import useStore from '@/store/useStore'
import { touchInput, stickFromPointer, setStick } from '@/features/visit/visitInput'
import type { StickVec } from '@/features/visit/visitInput'

// E17-10 : joysticks virtuels du mode visite, affichés sur appareil tactile.
// Gauche = se déplacer, droit = regarder. Chaque stick capture SON pointeur
// (multi-touch : les deux sticks s'utilisent en même temps) et écrit son vecteur
// dans `touchInput`, lu par VisitControls à chaque frame — aucun re-render
// pendant la manipulation.

const STICK_RADIUS = 40 // px — course max du pommeau depuis le centre de la base

function Stick({ side, vector }: { side: 'left' | 'right'; vector: StickVec }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)

  // Remise à zéro au démontage (sortie du mode visite doigt posé).
  useEffect(() => () => setStick(vector, 0, 0), [vector])

  const apply = (x: number, y: number) => {
    setStick(vector, x, y)
    // y stick + = avant/haut → offset écran vers le haut (py négatif).
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${x * STICK_RADIUS}px, ${-y * STICK_RADIUS}px)`
    }
  }

  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const v = stickFromPointer(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
      STICK_RADIUS
    )
    apply(v.x, v.y)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return // déjà tenu par un autre doigt
    pointerId.current = event.pointerId
    baseRef.current?.setPointerCapture(event.pointerId)
    update(event)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId === pointerId.current) update(event)
  }
  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return
    pointerId.current = null
    apply(0, 0) // le stick revient au centre : on s'arrête net
  }

  return (
    <div
      ref={baseRef}
      className={`visit-stick ${side}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={knobRef} className="visit-stick-knob" />
    </div>
  )
}

export default function VisitSticks() {
  const viewMode = useStore((state) => state.viewMode)
  // Capacité tactile (pas « mobile » : un portable à écran tactile les a aussi,
  // la souris + verrou restent disponibles en parallèle).
  if (viewMode !== 'visit' || !(navigator.maxTouchPoints > 0)) return null

  return (
    <div className="visit-sticks">
      <Stick side="left" vector={touchInput.move} />
      <Stick side="right" vector={touchInput.look} />
    </div>
  )
}
