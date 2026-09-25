import { useContext } from "react";
import { RoomContext } from "./room-context";

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("useRoom debe usarse dentro de <RoomProvider>");
  }
  return ctx;
}
