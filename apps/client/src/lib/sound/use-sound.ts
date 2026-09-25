"use client";

import { useCallback, useSyncExternalStore } from "react";
import { soundManager, type SoundName } from "./sound-manager";

// Snapshot/subscribe estables a nivel módulo para useSyncExternalStore: el
// estado de mute vive fuera de React (localStorage + singleton de audio).
const subscribe = (onStoreChange: () => void) => soundManager.subscribe(onStoreChange);
const getSnapshot = () => soundManager.isMuted();
const getServerSnapshot = () => false;

export function useSound() {
  const muted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const play = useCallback((name: SoundName) => soundManager.play(name), []);
  const toggleMute = useCallback(() => {
    soundManager.toggleMuted();
  }, []);

  return { play, muted, toggleMute };
}
