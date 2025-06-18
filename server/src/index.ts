import WebSocket, { WebSocketServer } from "ws";

const port = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: Number(port) });
console.log(`Servidor WebSocket escuchando en puerto ${port}`);


const clients = new Set<WebSocket>();

// Estado compartido del grid
let paintedTiles: Record<string, string> = {};
let tokens: Record<string, {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    nombre: string;
    vida: string;
    imageBase64?: string; // <-- ✅ permitido
    muerto?: boolean; // Indica si el token está muerto
}> = {};

let paintedEdges: Record<string, string> = {};
let areas: Record<string, {
    id: string;
    x: number;
    y: number;
    size: number;
    type: "circle" | "square" | "cone";
    rotation?: number;
}> = {};
let currentMeasurement: { start: { x: number, y: number }, end: { x: number, y: number } } | null = null;
let foggedTiles: Set<string> = new Set();

// Estado del Laser 
let laserColors: Record<string, string> = {};

// Estado Compartido Imagenes
let backgroundImages: {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
}[] = [];

let imageShapes: Record<string, {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
}> = {};

// Estado musica
type Track = {
    id: string;
    name: string;
    src: string;
    isPlaying: boolean;
    volume: number;
};

let activeAudioTracks: Track[] = [];

function broadcastExcept(sender: WebSocket, msg: any) {
    const raw = JSON.stringify(msg);
    wss.clients.forEach((client) => {
        if (client !== sender && client.readyState === client.OPEN) {
            client.send(raw);
        }
    });
}


wss.on("connection", (ws) => {
    clients.add(ws);

    // Musica
    ws.send(
        JSON.stringify({
            type: "INIT_AUDIO_TRACKS",
            payload: activeAudioTracks,
        })
    );


    // Enviar estado inicial de tiles 
    ws.send(
        JSON.stringify({
            type: "INIT_STATE",
            payload: {
                paintedTiles,
            },
        })
    );

    // Enviar estado inicial de bordes pintados
    ws.send(
        JSON.stringify({
            type: "INIT_EDGES",
            payload: paintedEdges,
        })
    );

    ws.send(
        JSON.stringify({
            type: "INIT_FOG",
            payload: Array.from(foggedTiles), // asegúrate que sea un array
        })
    );

    // Enviar estado inicial de tokens
    ws.send(
        JSON.stringify({
            type: "INIT_TOKENS",
            payload: tokens, // ahora tiene toda la info
        })
    );

    //Enviar estado inicial de areas
    ws.send(JSON.stringify({
        type: "INIT_AREAS",
        payload: areas,
    }));

    ws.send(JSON.stringify({
        type: "INIT_BACKGROUND_IMAGES",
        payload: backgroundImages,
    }));

    ws.on("message", (data) => {
        const message = JSON.parse(data.toString());

        // Guardar tile pintado
        if (message.type === "PAINT_TILE") {
            const { x, y, color } = message.payload;
            const key = `${x},${y}`;
            if (color === "rgb(255, 255, 255)") {
                delete paintedTiles[key];
            } else {
                paintedTiles[key] = color;
            }
        }

        if (message.type === "PAINT_EDGE") {
            for (const { key, color } of message.payload.updates) {
                if (color === "rgb(255, 255, 255)") {
                    delete paintedEdges[key];
                } else {
                    paintedEdges[key] = color;
                }
            }
        }

        if (message.type === "ADD_TOKEN") {
            const { id, x, y, radius, color, nombre, vida } = message.payload;

            // Guardar todos los datos del token
            tokens[id] = { id, x, y, radius, color, nombre, vida };
        }

        if (message.type === "MOVE_TOKEN") {
            const { id, x, y } = message.payload;

            if (tokens[id]) {
                tokens[id].x = x;
                tokens[id].y = y;
            }
        }

        if (message.type === "RESIZE_TOKEN") {
            const { id, x, y, radius } = message.payload;
            if (tokens[id]) {
                tokens[id].x = x;
                tokens[id].y = y;
                tokens[id].radius = radius;
            }
        }

        if (message.type === "DELETE_TOKEN") {
            const { id } = message.payload;
            delete tokens[id];

            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return;
        }

        if (message.type === "ADD_AREA") {
            const area = message.payload;
            areas[area.id] = area;
        }

        if (message.type === "MOVE_AREA") {
            const { id, x, y } = message.payload;
            if (areas[id]) {
                areas[id].x = x;
                areas[id].y = y;
            }

            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return;
        }

        if (message.type === "TRANSFORM_AREA") {
            const { id, size, rotation } = message.payload;
            if (areas[id]) {
                areas[id].size = size;
                areas[id].rotation = rotation;
            }

            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return;
        }

        if (message.type === "DELETE_AREA") {
            const { id } = message.payload;
            delete areas[id];
        }

        if (message.type === "MEASURE") {
            currentMeasurement = {
                start: message.payload.start,
                end: message.payload.end,
            };
        } else {
            currentMeasurement = null;
        }

        if (message.type === "LASER_PATH") {
            const { userId, color } = message.payload;

            // Guardar el color por usuario
            if (userId && color) {
                laserColors[userId] = color;
            }

            // Retransmitir a otros
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return; // ⚠️ importante
        }


        if (message.type === "SET_LASER_COLOR") {
            const { userId, color } = message.payload;
            laserColors[userId] = color;

            // Reenviar a todos (menos el que envió)
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }
            return;
        }

        if (message.type === "ADD_BACKGROUND_IMAGE") {
            const { id, src, x, y, width, height } = message.payload;

            // Guardar en el estado compartido
            backgroundImages.push({ id, src, x, y, width, height });

            // Broadcast a los demás
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }
            return; // Evitamos que el mensaje se retransmita de nuevo más abajo
        }

        if (message.type === "DELETE_BACKGROUND_IMAGE") {
            const { id } = message.payload;

            // Eliminar del estado compartido
            backgroundImages = backgroundImages.filter((img) => img.id !== id);

            // Reenviar a los demás
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return;
        }

        if (message.type === "MOVE_BACKGROUND_IMAGE") {
            const { id, x, y, width, height } = message.payload;

            // Actualizar la posición en el servidor
            const image = backgroundImages.find((img) => img.id === id);
            if (image) {
                image.x = x;
                image.y = y;
                image.width = width;
                image.height = height;
            }

            // Reenviar a todos los demás
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return;
        }

        if (message.type === "RESIZE_BACKGROUND_IMAGE") {
            const { id, width, height } = message.payload;

            // Buscar la imagen y actualizar su tamaño
            const image = backgroundImages.find((img) => img.id === id);
            if (image) {
                image.width = width;
                image.height = height;
            }

            // Reenviar a todos los demás clientes
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return;
        }



        if (message.type === "FOG_ADD_TILES") {
            if (Array.isArray(message.payload)) {
                message.payload.forEach((tile: string) => foggedTiles.add(tile));
            }

            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }
            return;
        }

        if (message.type === "FOG_REMOVE_TILES") {
            if (Array.isArray(message.payload)) {
                message.payload.forEach((tile: string) => foggedTiles.delete(tile));
            }

            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }
            return;
        }

        if (message.type === "TOKEN_IMAGE") {
            const { id, base64 } = message.payload;
            if (tokens[id]) {
                tokens[id].imageBase64 = base64;
            }
        }

        if (message.type === "UPDATE_TOKEN_DEAD_STATUS") {
            const { id, muerto } = message.payload;
            if (tokens[id]) {
                tokens[id].muerto = muerto;
            }

            // Reenviar este cambio a todos menos al que lo envió
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return; // Para no hacer el broadcast general luego
        }

        if (message.type === "UPDATE_TOKEN") {
            const { id, updates } = message.payload;
            if (tokens[id]) {
                Object.assign(tokens[id], updates);
            }

            // Reenviar a los demás
            for (const client of clients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }

            return; // evitar broadcast duplicado
        }

        // Musica
        switch (message.type) {
            case "ADD_AUDIO_TRACK": {
                const newTrack = message.payload;
                activeAudioTracks.push(newTrack);

                broadcastExcept(ws, {
                    type: "ADD_AUDIO_TRACK",
                    payload: newTrack,
                });
                break;
            }

            case "REMOVE_AUDIO_TRACK": {
                const { id } = message.payload;
                activeAudioTracks = activeAudioTracks.filter((t) => t.id !== id);

                broadcastExcept(ws, {
                    type: "REMOVE_AUDIO_TRACK",
                    payload: { id },
                });
                break;
            }

            case "UPDATE_AUDIO_TRACK": {
                const { id, isPlaying, volume } = message.payload;

                if (isPlaying === true) {
                    // Si se quiere reproducir una pista, detener todas las demás
                    activeAudioTracks = activeAudioTracks.map((track) =>
                        track.id === id
                            ? { ...track, isPlaying: true, volume: volume ?? track.volume }
                            : { ...track, isPlaying: false }
                    );
                } else {
                    // Si se está pausando una pista o actualizando solo el volumen
                    activeAudioTracks = activeAudioTracks.map((track) =>
                        track.id === id
                            ? {
                                ...track,
                                isPlaying: isPlaying ?? track.isPlaying,
                                volume: volume ?? track.volume,
                            }
                            : track
                    );
                }

                // Enviar el estado completo a todos los clientes
                const fullUpdate = {
                    type: "SYNC_AUDIO_TRACKS",
                    payload: activeAudioTracks,
                };

                for (const client of clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(fullUpdate));
                    }
                }

                break;
            }
            default: {
                // Broadcast
                for (const client of clients) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(message));
                    }
                }
                break;
            }
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
    });
});

console.log("Servidor WebSocket en puerto 3001");
