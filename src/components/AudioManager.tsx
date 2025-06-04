import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  volume?: number;       // Por defecto 1.0
  autoPlay?: boolean;    // Por defecto false
  loop?: boolean;        // Por defecto false
onMount?: (audio: HTMLAudioElement) => void; 
};

export default function AudioManager({ src, volume = 0.5, autoPlay = false, loop = false, onMount }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentVolume, setCurrentVolume] = useState(volume);

  useEffect(() => {
  if (!audioRef.current) {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.loop = loop;
    if (autoPlay) audio.play();
    audioRef.current = audio;

    if (onMount) onMount(audio); // <-- llama al callback con el audio creado
  }
}, [src]);

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
    <div style={{ marginBottom: 16 }}>
      <button onClick={handlePlay}>Reproducir</button>
      <button onClick={handlePause} style={{ marginLeft: 8 }}>Pausar</button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={currentVolume}
        onChange={handleVolumeChange}
        style={{ marginLeft: 16 }}
      />
      <span style={{ marginLeft: 8 }}>{Math.round(currentVolume * 100)}%</span>
    </div>
  );
}
