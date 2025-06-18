// AudioManager.tsx
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Icon } from "@iconify/react";

interface AudioManagerProps {
  src: string;
  loop?: boolean;
  /** volumen inicial cuando no llega externalVolume (0‑1) */
  volume?: number;
  /** si el componente padre quiere arrancar reproduciendo */
  isPlaying?: boolean;
  /** control externo de volumen (0‑1) */
  externalVolume?: number;
  /** callback opcional con la referencia al <audio> */
  onMount?: (audio: HTMLAudioElement) => void;
}

const AudioManager = forwardRef<HTMLAudioElement, AudioManagerProps>(
  (
    {
      src,
      loop = false,
      volume = 0.5,
      isPlaying = false,
      externalVolume,
      onMount,
    },
    ref,
  ) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [currentVolume, setCurrentVolume] = useState<number>(
      externalVolume ?? volume,
    );
    const [open, setOpen] = useState(false);

    /* -------- exposición del <audio> al padre ---------- */
    useImperativeHandle(ref, () => audioRef.current as HTMLAudioElement, []);

    /* -------- al montar: llamar onMount ------------ */
    useEffect(() => {
      if (audioRef.current && onMount) onMount(audioRef.current);
    }, [onMount]);

    /* -------- sincronizar props -> elemento <audio> -------- */
    useEffect(() => {
      if (!audioRef.current) return;

      // src / loop sólo cambian cuando el track se reemplaza
      audioRef.current.src = src;
      audioRef.current.loop = loop;

      // reproducir / pausar
      if (isPlaying) {
        audioRef.current.play().catch((err) => {
          // El navegador puede bloquear autoplay; lo ignoramos.
          console.warn("play() bloqueado:", err);
        });
      } else {
        audioRef.current.pause();
      }
    }, [src, loop, isPlaying]);

    /* -------- volumen externo -------- */
    useEffect(() => {
      if (audioRef.current && externalVolume !== undefined) {
        audioRef.current.volume = externalVolume;
        setCurrentVolume(externalVolume);
      }
    }, [externalVolume]);

    /* -------- handlers UI internos -------- */
    const handlePlay = () => audioRef.current?.play();
    const handlePause = () => audioRef.current?.pause();

    const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setCurrentVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
    };

    /* -------- JSX -------- */
    return (
      <>
        {/* el audio REAL que sonará */}
        <audio
          ref={audioRef}
          style={{ display: "none" }}
          // src y loop se vuelven a fijar en el efecto pero
          // los ponemos también aquí para el primer render.
          src={src}
          loop={loop}
          // importantísimo: sin controles para no renderizar el UI nativo
        />

        {/* control UI */}
        <Popover isOpen={open} onOpenChange={setOpen} placement="bottom">
          <PopoverTrigger>
            <Button
              variant="bordered"
              color="default"
              className="flex items-center gap-1"
              startContent={<Icon icon="mdi:volume-high" />}
            >
              Audio
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-64 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 justify-between">
              <Button
                size="sm"
                color="success"
                variant="solid"
                onClick={handlePlay}
              >
                <Icon icon="mdi:play" />
              </Button>
              <Button
                size="sm"
                color="warning"
                variant="solid"
                onClick={handlePause}
              >
                <Icon icon="mdi:pause" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Icon icon="mdi:volume-low" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={currentVolume}
                onChange={handleSlider}
                className="flex-grow accent-primary"
              />
              <Icon icon="mdi:volume-high" />
            </div>
          </PopoverContent>
        </Popover>
      </>
    );
  },
);

export default AudioManager;
