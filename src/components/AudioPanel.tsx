import { useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react";
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
    <Popover placement="bottom">
      <PopoverTrigger>
        <Button
          color="default"
          variant="bordered"
          className="flex items-center gap-2"
          style={{ minWidth: 120 }}
        >
          🎵 Audio Panel
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-4 w-80 max-w-full" style={{ maxHeight: 400, overflowY: "auto" }}>
        <h3 style={{ marginBottom: 8 }}>🎵 Pistas Disponibles</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {availableTracks.map((track) => (
            <Button
              key={track.name}
              onClick={() => addTrack(track)}
              variant="light"
              size="sm"
              style={{ flex: "1 1 45%" }}
            >
              Agregar: {track.name}
            </Button>
          ))}
        </div>

        <hr style={{ margin: "12px 0" }} />

        <h3 style={{ marginBottom: 8 }}>🔊 Reproduciendo</h3>
        {activeTracks.length === 0 && <p>No hay pistas activas.</p>}
        {activeTracks.map((track) => (
          <div
            key={track.id}
            style={{
              marginBottom: 12,
              padding: 8,
              backgroundColor: "#fff",
              borderRadius: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong>{track.name}</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AudioManager
                src={track.src}
                loop
                onMount={(audio) => {
                  audioRefs.current.set(track.id, audio);
                }}
              />
              <Button
                color="danger"
                variant="ghost"
                size="sm"
                onClick={() => removeTrack(track.id)}
                style={{ minWidth: 30, padding: "2px 6px" }}
                title="Eliminar pista"
              >
                ❌
              </Button>
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
