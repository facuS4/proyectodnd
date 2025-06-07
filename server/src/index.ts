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
