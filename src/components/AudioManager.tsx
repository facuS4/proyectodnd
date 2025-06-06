import React, { useEffect, useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface AudioManagerProps {
  src: string;
  volume?: number;       // Default: 1.0
  autoPlay?: boolean;    // Default: false
  loop?: boolean;        // Default: false
  onMount?: (audio: HTMLAudioElement) => void;
}

export default function AudioManager({
  src,
  volume = 0.5,
  autoPlay = false,
  loop = false,
  onMount,
}: AudioManagerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentVolume, setCurrentVolume] = useState(volume);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.loop = loop;
      if (autoPlay) audio.play();

      audioRef.current = audio;

      if (onMount) onMount(audio);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [src, volume, autoPlay, loop, onMount]);

  const handlePlay = () => {
    audioRef.current?.play();
  };

  const handlePause = () => {
    audioRef.current?.pause();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setCurrentVolume(newVolume);
    if (audioRef.current) audioRef.current.volume = newVolume;
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom">
      <PopoverTrigger>
        <Button
          color="default"
          variant="bordered"
          className="flex items-center gap-2"
          startContent={<Icon icon="mdi:volume-high" />}
        >
          Audio
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-4 w-64 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <button
            onClick={handlePlay}
            className="px-3 py-1 rounded border bg-green-500 text-white hover:bg-green-600 transition"
          >
            ▶️ Reproducir
          </button>
          <button
            onClick={handlePause}
            className="px-3 py-1 rounded border bg-yellow-400 text-black hover:bg-yellow-500 transition"
          >
            ⏸ Pausar
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={currentVolume}
            onChange={handleVolumeChange}
            className="flex-grow"
          />
          <span>{Math.round(currentVolume * 100)}%</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
