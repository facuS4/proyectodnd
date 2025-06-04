// hooks/useBackgroundMusic.ts
import { useEffect, useRef } from "react";

export function useBackgroundMusic(src: string, volume: number = 0.5, loop: boolean = true) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = volume;
    audioRef.current = audio;

    audio.play().catch((err) => {
      console.warn("Autoplay fallido, debe iniciarse manualmente:", err);
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [src, volume, loop]);

  return audioRef;
}
