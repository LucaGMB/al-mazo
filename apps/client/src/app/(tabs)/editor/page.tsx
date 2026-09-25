import type { Metadata } from "next";
import GameEditor from "@/components/editor/GameEditor";

export const metadata: Metadata = {
  title: "Editor de Juegos | Al Mazo",
  description: "Crea y personaliza tus propios juegos de mesa y cartas con el motor modular de Al Mazo.",
};

export default function EditorPage() {
  return <GameEditor />;
}
