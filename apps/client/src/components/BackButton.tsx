"use client";

import { useRouter } from "next/navigation";
import IconButton from "./IconButton";

// Nunca router.back(): si se entra a la pantalla desde otro lado que no sea
// el flujo esperado (un link externo, refrescar la página, etc.), el
// historial del navegador no tiene por qué volver a donde este botón dice
// que vuelve. Cada pantalla declara su destino real con `to`.
export default function BackButton({ to, className }: { to: string; className?: string }) {
  const router = useRouter();
  return <IconButton icon="chevron-left" onClick={() => router.push(to)} className={className} />;
}
