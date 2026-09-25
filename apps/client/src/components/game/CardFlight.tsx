"use client";

import { useEffect, useState, type ReactNode } from "react";

const FLIGHT_DURATION_MS = 420;

// Fantasma que viaja de un punto a otro de la pantalla (coordenadas de
// viewport, position: fixed) para mostrar físicamente que "algo se movió":
// una carta jugada viajando hacia el descarte, o una robada viajando desde el
// mazo hacia la ficha de quien la levantó. `content` es lo que se ve viajar
// (la carta real para una jugada, un dorso genérico para un robo — nunca se
// conoce la carta ajena robada).
export default function CardFlight({
  content,
  fromX,
  fromY,
  toX,
  toY,
  growOnArrive,
  onDone,
}: {
  content: ReactNode;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  growOnArrive?: boolean;
  onDone: () => void;
}) {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setArrived(true));
    const timer = window.setTimeout(onDone, FLIGHT_DURATION_MS + 80);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // Solo debe correr una vez por vuelo (identificado por la key en el padre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const x = arrived ? toX : fromX;
  const y = arrived ? toY : fromY;
  const arrivedScale = growOnArrive ? 1.2 : 1;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40"
      style={{
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${
          arrived ? arrivedScale : 0.8
        }) rotate(${arrived ? 0 : -14}deg)`,
        opacity: arrived ? 1 : 0.95,
        transition: `transform ${FLIGHT_DURATION_MS}ms cubic-bezier(0.22, 0.72, 0.28, 1), opacity ${FLIGHT_DURATION_MS}ms ease`,
      }}
    >
      {content}
    </div>
  );
}
