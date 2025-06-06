import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });

const clients = new Set<WebSocket>();

// Estado compartido del grid
let paintedTiles: Record<string, string> = {};

wss.on("connection", (ws) => {
  clients.add(ws);

  // Enviar estado inicial
  ws.send(
    JSON.stringify({
      type: "INIT_STATE",
      payload: {
        paintedTiles,
      },
    })
  );

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
