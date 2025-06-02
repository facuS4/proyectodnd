import { Stage, Layer, Rect, Line } from "react-konva";
import { useState, useEffect } from "react";
import { Circle } from "react-konva";

export default function GridAdaptativo() {
  const baseTileSize = 50; // Tamaño base de la casilla

  const gridWidth = 2000; // Ancho del grid
  const gridHeight = 1000; // Alto del grid

  // Estado para el usuario
  const [paintMode, setPaintMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);


  // Estado para la imagen del jugador
  const [playerImage, setPlayerImage] = useState<HTMLImageElement | null>(null);

  // Calculamos el número de columnas y filas basado en el tamaño del grid y el tamaño de la casilla
  const numCols = Math.floor(gridWidth / baseTileSize);
  const numRows = Math.floor(gridHeight / baseTileSize);

  const tileSizeW = gridWidth / numCols;
  const tileSizeH = gridHeight / numRows;
  const tileSize = Math.min(tileSizeW, tileSizeH);

  // ReSize
  const [circleRadius, setCircleRadius] = useState(tileSize / 2);

  // Cambiamos a Map<string, string> para almacenar color por casilla
  const [paintedTiles, setPaintedTiles] = useState<Map<string, string>>(new Map());
  const [isDrawing, setIsDrawing] = useState(false);

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Estado para color seleccionado
  const [selectedColor, setSelectedColor] = useState("orange");

  const posKey = (x: number, y: number) => `${x},${y}`;

  const paintTile = (x: number, y: number) => {
    if (x < 0 || x >= numCols || y < 0 || y >= numRows) return;
    setPaintedTiles((prev) => {
      const newMap = new Map(prev);
      newMap.set(posKey(x, y), selectedColor);
      return newMap;
    });
  };

  // Cambiar a moverse con el mouse
    const toggleMoveMode = () => {
      setMoveMode((prev) => {
        if (!prev) setPaintMode(false); // Al activar mover, desactiva pintar
        return !prev;
      });
    };

  // Movimiento con mouse
    const handleMouseMovePlayer = (e: any) => {
    if (!moveMode || !isDraggingPlayer) return;

    const mousePos = e.target.getStage().getPointerPosition();
    if (!mousePos) return;

    const x = Math.floor(mousePos.x / tileSize);
    const y = Math.floor(mousePos.y / tileSize);

    setCursorPos({ x, y });
  };


  // Cambiar paintMode
    const togglePaintMode = () => {
      setPaintMode((prev) => {
        if (!prev) setMoveMode(false); // Al activar pintar, desactiva mover
        return !prev;
      });
    };

  // Manejo de eventos del mouse
  // para pintar casillas
  const handleMouseDown = (e: any) => {
    if (!paintMode) return;
    setIsDrawing(true);
    const mousePos = e.target.getStage().getPointerPosition();
    if (!mousePos) return;
    const x = Math.floor(mousePos.x / tileSize);
    const y = Math.floor(mousePos.y / tileSize);
    paintTile(x, y);
  };

  const handleMouseMove = (e: any) => {
  // Si no estamos en modo pintura, no hacemos nada
    if (!paintMode) return;
    if (!isDrawing) return;
    const mousePos = e.target.getStage().getPointerPosition();
    if (!mousePos) return;
    const x = Math.floor(mousePos.x / tileSize);
    const y = Math.floor(mousePos.y / tileSize);
    paintTile(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };


  // Manejo de eventos del teclado para mover el "player"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setCursorPos(({ x, y }) => {
        if (e.key.toLowerCase() === "w") return { x, y: Math.max(0, y - 1) };
        if (e.key.toLowerCase() === "s") return { x, y: Math.min(numRows - 1, y + 1) };
        if (e.key.toLowerCase() === "a") return { x: Math.max(0, x - 1), y };
        if (e.key.toLowerCase() === "d") return { x: Math.min(numCols - 1, x + 1), y };
        return { x, y };
      });

      // Re escalar el radio del círculo según el tamaño de la casilla
      // Aumentar el radio del círculo al presionar "r"
      if (e.key.toLowerCase() === "r") {
        setCircleRadius((prevRadius) => Math.min(prevRadius + circleRadius, tileSize * 2));
      }

      // Disminuir el radio del círculo al presionar "f"
      if (e.key.toLowerCase() === "f") {
        setCircleRadius((prevRadius) => Math.max(prevRadius - circleRadius, tileSize / 2));
      }

    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numCols, numRows]);

  // Paleta básica de colores
  const colors = ["orange", "red", "blue", "green", "yellow", "purple", "black"];


  const drawGrid = () => {
    const lines = [];

    for (let i = 0; i <= numCols; i++) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i * tileSize, 0, i * tileSize, numRows * tileSize]}
          stroke="gray"
        />
      );
    }

    for (let i = 0; i <= numRows; i++) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i * tileSize, numCols * tileSize, i * tileSize]}
          stroke="gray"
        />
      );
    }

    return lines;
  };

  // calculo el tamaño del círculo según el tamaño de la casilla
  const tilesCovered = Math.round((circleRadius * 2) / tileSize);
  const centerOffset = tilesCovered % 2 === 0 ? 0.5 : 0;

  return (
    <>
      {/* Paleta */}
      <div style={{ marginBottom: 10 }}>
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            style={{
              backgroundColor: color,
              border: selectedColor === color ? "3px solid black" : "1px solid gray",
              width: 30,
              height: 30,
              marginRight: 5,
              cursor: "pointer",
            }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>


      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const img = new window.Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
              setPlayerImage(img);
            };
          }
        }}
        style={{ marginBottom: 10 }}
      />

      <button
        onClick={togglePaintMode}
        style={{
          backgroundColor: paintMode ? "lightblue" : "lightgray",
          padding: "5px 10px",
          cursor: "pointer",
        }}
        aria-label={paintMode ? "Disable paint mode" : "Enable paint mode"}
      >
        {paintMode ? "Disable Paint Mode" : "Enable Paint Mode"}
      </button>

      <button
        onClick={toggleMoveMode}
        style={{
          backgroundColor: moveMode ? "lightblue" : "lightgray",
          padding: "5px 10px",
          cursor: "pointer",
          marginLeft: 10,
        }}
        aria-label={moveMode ? "Disable move mode" : "Enable move mode"}
      >
        {moveMode ? "Disable Move Mode" : "Enable Move Mode"}
      </button>
    
      <Stage
        width={gridWidth}
        height={gridHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e);         // Para pintar (si paintMode está activo)
          handleMouseMovePlayer(e);   // Para mover el jugador (si moveMode está activo)
        }}
        onMouseUp={() => {
          handleMouseUp();            // Para dejar de pintar
          setIsDraggingPlayer(false); // Para dejar de mover el jugador
        }}
        style={{ background: "#ffffff" }}
        tabIndex={0}
      >
        
        <Layer>
          {drawGrid()}
          {/* Casillas pintadas con color */}
          {[...paintedTiles.entries()].map(([key, color]) => {
            const [x, y] = key.split(",").map(Number);
            return (
              <Rect
                key={key}
                x={x * tileSize}
                y={y * tileSize}
                width={tileSize}
                height={tileSize}
                fill={color}
                opacity={0.8}
              />
            );
          })}

          {/* Rect cursor */}

          {/* Círculo de player */}
          <Circle
            x={(cursorPos.x + 0.5 + centerOffset) * tileSize}
            y={(cursorPos.y + 0.5 + centerOffset) * tileSize}
            radius={circleRadius}
            fill="red"
            onMouseDown={() => {if (moveMode) setIsDraggingPlayer(true);}}
            stroke={"black"}
          />
        </Layer>
      </Stage>
    </>
  );
}
