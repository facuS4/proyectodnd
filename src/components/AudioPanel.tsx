import { useRef, useState } from "react";
import AudioManager from "./AudioManager";

export default function AudioPanel() {
  const availableTracks = [
    { name: "Rain", src: "/music/rain.mp3" },
    { name: "Wind", src: "/music/wind.mp3" },
  ];

  const [activeTracks, setActiveTracks] = useState<
    { id: string; name: string; src: string }[]
  >([]);

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const addTrack = (track: { name: string; src: string }) => {
    const id = crypto.randomUUID();
    setActiveTracks((prev) => [...prev, { ...track, id }]);
  };

  const removeTrack = (id: string) => {
    const audio = audioRefs.current.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRefs.current.delete(id);
    }

    setActiveTracks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ padding: 20, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
      <h3>🎵 Pistas Disponibles</h3>
      {availableTracks.map((track) => (
        <button
          key={track.name}
          onClick={() => addTrack(track)}
          style={{
            marginRight: 8,
            marginBottom: 8,
            padding: "6px 12px",
            backgroundColor: "#ddd",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Agregar: {track.name}
        </button>
      ))}

      <hr style={{ margin: "16px 0" }} />

      <h3>🔊 Reproduciendo</h3>
      {activeTracks.length === 0 && <p>No hay pistas activas.</p>}
      {activeTracks.map((track) => (
        <div key={track.id} style={{ marginBottom: 16 }}>
          <strong>{track.name}</strong>
          <button
            onClick={() => removeTrack(track.id)}
            style={{
              marginLeft: 10,
              padding: "2px 6px",
              backgroundColor: "#faa",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ❌
          </button>
          <AudioManager
            src={track.src}
            autoPlay
            loop
            onMount={(audio) => {
              audioRefs.current.set(track.id, audio);
            }}
          />
        </div>
      ))}
    </div>
  );
}
