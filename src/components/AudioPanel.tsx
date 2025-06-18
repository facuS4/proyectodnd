import { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react";
import AudioManager from "./AudioManager";
import { Icon } from "@iconify/react";

type Track = {
  id: string;
  name: string;
  src: string;
  isPlaying: boolean;
  volume: number;
};

type AudioPanelProps = {
  socket: WebSocket;
};

export default function AudioPanel({ socket }: AudioPanelProps) {
  const availableTracks = [
    { name: "Rain", src: "/music/rain.mp3" },
    { name: "Wind", src: "/music/wind.mp3" },
  ];

  const [activeTracks, setActiveTracks] = useState<Track[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      if (message.type === "INIT_AUDIO_TRACKS") {
        setActiveTracks(message.payload);
      }

      if (message.type === "UPDATE_AUDIO_TRACK") {
        setActiveTracks((prev) =>
          prev.map((t) =>
            t.id === message.payload.id ? { ...t, ...message.payload } : t
          )
        );
      }

      if (message.type === "ADD_AUDIO_TRACK") {
        setActiveTracks((prev) => [...prev, message.payload]);
      }

      if (message.type === "REMOVE_AUDIO_TRACK") {
        setActiveTracks((prev) => prev.filter((t) => t.id !== message.payload.id));
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  const addTrack = (track: { name: string; src: string }) => {
    const id = crypto.randomUUID();
    const newTrack: Track = {
      id,
      name: track.name,
      src: track.src,
      isPlaying: false,
      volume: 0.5,
    };
    setActiveTracks((prev) => [...prev, newTrack]);

    socket.send(
      JSON.stringify({
        type: "ADD_AUDIO_TRACK",
        payload: newTrack,
      })
    );
  };

  const removeTrack = (id: string) => {
    setActiveTracks((prev) => prev.filter((t) => t.id !== id));

    socket.send(
      JSON.stringify({
        type: "REMOVE_AUDIO_TRACK",
        payload: { id },
      })
    );
  };

  const togglePlay = (id: string, play: boolean) => {
    setActiveTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isPlaying: play } : t))
    );

    socket.send(
      JSON.stringify({
        type: "UPDATE_AUDIO_TRACK",
        payload: { id, isPlaying: play },
      })
    );
  };

  const changeVolume = (id: string, volume: number) => {
    setActiveTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume } : t))
    );
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
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <strong>{track.name}</strong>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color={track.isPlaying ? "warning" : "success"}
                  variant="solid"
                  onClick={() => togglePlay(track.id, !track.isPlaying)}
                >
                  <Icon icon={track.isPlaying ? "mdi:pause" : "mdi:play"} />
                </Button>
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

            <AudioManager
              src={track.src}
              loop
              isPlaying={track.isPlaying}
              externalVolume={track.volume}
            />

            <div className="mt-2 flex items-center gap-2">
              <Icon icon="mdi:volume-low" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={track.volume}
                onChange={(e) => changeVolume(track.id, parseFloat(e.target.value))}
                className="flex-grow accent-primary"
              />
              <Icon icon="mdi:volume-high" />
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
