import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

interface AudioManagerProps {
  src: string;
  loop?: boolean;
  isPlaying?: boolean;
  externalVolume?: number;
  onMount?: (audio: HTMLAudioElement) => void;
}

const AudioManager = forwardRef<HTMLAudioElement, AudioManagerProps>(
  (
    {
      src,
      loop = false,
      isPlaying = false,
      externalVolume = 0.5,
      onMount,
    },
    ref
  ) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useImperativeHandle(ref, () => audioRef.current as HTMLAudioElement, []);

    // Inicialización y asignación del src
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.src = src;
      audio.loop = loop;
      audio.volume = externalVolume;

      if (onMount) onMount(audio);
    }, [src, loop, onMount]);

    // Control de reproducción
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("Autoplay bloqueado:", err);
          });
        }
      } else {
        audio.pause();
      }
    }, [isPlaying]);

    // Volumen externo
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.volume = externalVolume;
    }, [externalVolume]);

    return <audio ref={audioRef} style={{ display: "none" }} />;
  }
);

export default AudioManager;
