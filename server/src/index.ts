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




wss.on("connection", (ws) => {
    clients.add(ws);

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
        }

        if (message.type === "TRANSFORM_AREA") {
            const { id, size, rotation } = message.payload;
            if (areas[id]) {
                areas[id].size = size;
                areas[id].rotation = rotation;
            }
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

        if (message.type === "CLEAR_BACKGROUND_IMAGES") {
            // Limpiar todas las imágenes de fondo en el servidor
            backgroundImages = [];

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


        // Broadcast
        for (const client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
    });
});

console.log("Servidor WebSocket en puerto 3001");
