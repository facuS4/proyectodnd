import { Stage, Layer, Rect, Line } from "react-konva";
import { useRef, useState, useEffect } from "react";
import { Circle, Text, Image } from "react-konva";
import CircularToken from "./CircularTokenProps";
import AudioPanel from "./AudioPanel";
import { DiceRoller } from "./diceroller";

export default function GridAdaptativo() {
  const baseTileSize = 50; // Tamaño base de la casilla

  const gridWidth = 2000; // Ancho del grid
  const gridHeight = 1000; // Alto del grid

  // Token
  type Token = {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string; // opcional para identificarlo visualmente
    nombre: string;
    vida: string;
    image?: HTMLImageElement | null;
  };

  // Estado para los tokens
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const tokenSize = baseTileSize / 2; // Tamaño del token


  // Estado para el usuario
  const [paintMode, setPaintMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);

  //Estados regla
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);


  //Cambiar cosas del token
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextTokenId, setContextTokenId] = useState<string | null>(null);

  // Estado para la imagen del fondo
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

  // Calculamos el número de columnas y filas basado en el tamaño del grid y el tamaño de la casilla
  const numCols = Math.floor(gridWidth / baseTileSize);
  const numRows = Math.floor(gridHeight / baseTileSize);

  const tileSizeW = gridWidth / numCols;
  const tileSizeH = gridHeight / numRows;
  const tileSize = Math.min(tileSizeW, tileSizeH);


  // Cambiamos a Map<string, string> para almacenar color por casilla
  const [paintedTiles, setPaintedTiles] = useState<Map<string, string>>(new Map());
  const [isDrawing, setIsDrawing] = useState(false);

  // refs para cada input color
  const [selectedColor, setSelectedColor] = useState("orange");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0, visibility: "hidden" as "hidden" | "visible" });

  const posKey = (x: number, y: number) => `${x},${y}`;

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setPickerIndex(index);
    setPickerStyle({ left: x, top: y, visibility: "visible" });

    setTimeout(() => {
      inputRef.current?.click();
    }, 0);
  };

  //cerrar el menú del token
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuVisible(false);
      setContextTokenId(null);
    };

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Funcion para Snapear el tamaño del círculo al tamaño de la casilla
  const snapToGrid = (x: number, y: number, radius: number) => {
    const tilesCovered = Math.round((radius * 2) / tileSize);
    const offset = tilesCovered % 2 === 0 ? 0 : 0.5;

    const snappedX = (Math.floor(x / tileSize) + offset) * tileSize;
    const snappedY = (Math.floor(y / tileSize) + offset) * tileSize;

    return { x: snappedX, y: snappedY };
  };

  // Funcion para agregar tokens
  const addNewToken = () => {
    const id = crypto.randomUUID(); // Genera un ID único (compatible con navegadores modernos)
    const newToken: Token = {
      id,
      x: 0.5 * tileSize,
      y: 0.5 * tileSize,
      radius: tileSize / 2,
      color: "red", // Podés cambiar esto más adelante
      nombre: "",
      vida: "",
      image: null,
    };
    setTokens(prev => [...prev, newToken]);
  };



  const paintTile = (x: number, y: number) => {
    if (x < 0 || x >= numCols || y < 0 || y >= numRows) return;

    setPaintedTiles((prev) => {
      const newMap = new Map(prev);
      const key = posKey(x, y);

      if (selectedColor === "rgb(255, 255, 255)") {
        newMap.delete(key); // Elimina la casilla si se pinta con blanco
      } else {
        newMap.set(key, selectedColor); // Si no es blanco, pinta normalmente
      }

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
    if (!moveMode || !isDraggingPlayer || !selectedTokenId) return;

    const stage = e.target.getStage();
    const mousePos = stage?.getPointerPosition();
    if (!mousePos) return;

    const selectedToken = tokens.find(t => t.id === selectedTokenId);
    if (!selectedToken) return;

    const { x, y } = snapToGrid(mousePos.x, mousePos.y, selectedToken.radius);

    const updatedTokens = tokens.map(token =>
      token.id === selectedTokenId
        ? { ...token, x, y }
        : token
    );
    setTokens(updatedTokens);
  };


  //Funcion para cambiar de color
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (pickerIndex === null) return;
    const newColors = [...colors];
    newColors[pickerIndex] = hexToRgb(e.target.value); // Convertimos HEX a RGB
    setColors(newColors);
  };

  //transformar de hex a rgb
  function rgbToHex(rgb: string): string {
    const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
    if (!result) return "#000000";
    const r = parseInt(result[1]).toString(16).padStart(2, "0");
    const g = parseInt(result[2]).toString(16).padStart(2, "0");
    const b = parseInt(result[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  function hexToRgb(hex: string): string {
    const parsedHex = hex.replace("#", "");
    const bigint = parseInt(parsedHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgb(${r}, ${g}, ${b})`;
  }

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
    if (measureMode) {
      const mousePos = e.target.getStage().getPointerPosition();
      if (mousePos) {
        const x = Math.floor(mousePos.x / tileSize);
        const y = Math.floor(mousePos.y / tileSize);
        setMeasureStart({ x, y });
        setMeasureEnd({ x, y });
      }
      return;
    }

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
    if (measureMode && measureStart) {
      const mousePos = e.target.getStage().getPointerPosition();
      if (mousePos) {
        const x = Math.floor(mousePos.x / tileSize);
        const y = Math.floor(mousePos.y / tileSize);
        setMeasureEnd({ x, y });
      }
    }
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
    if (measureMode && measureStart && measureEnd) {
      // Mantiene la línea dibujada o limpia si preferís
      setMeasureStart(null);
      setMeasureEnd(null);
      return;
    }
  };


  // Manejo de eventos del teclado para mover el "player"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTokenId) return;

      setTokens((prevTokens) =>
        prevTokens.map((token) => {
          if (token.id !== selectedTokenId) return token;


          if (selectedTokenId) {
            if (e.key.toLowerCase() === "r") {
              setTokens(tokens =>
                tokens.map(token => {
                  if (token.id === selectedTokenId) {
                    const newRadius = Math.min(token.radius + tokenSize, tileSize * 2);
                    const snapped = snapToGrid(token.x, token.y, newRadius);
                    return { ...token, radius: newRadius, x: snapped.x, y: snapped.y };
                  }
                  return token;
                })
              );
            }

            if (e.key.toLowerCase() === "f") {
              setTokens(tokens =>
                tokens.map(token => {
                  if (token.id === selectedTokenId) {
                    const newRadius = Math.max(token.radius - tokenSize, tileSize / 2);
                    const snapped = snapToGrid(token.x, token.y, newRadius);
                    return { ...token, radius: newRadius, x: snapped.x, y: snapped.y };
                  }
                  return token;
                })
              );
            }
          } // cierre de if selectedTokenId

          return token; // Retorna el token sin cambios si no es el seleccionado
        })
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTokenId, numCols, numRows, tileSize]);


  // Paleta básica de colores
  const [colors, setColors] = useState([
    "rgb(255, 255, 255)",  // white
    "rgb(0, 0, 0)",        // black
    "rgb(255, 76, 76)",   // light red
    "rgb(255, 0, 0)",     // red
    "rgb(178, 0, 0)",     // dark red
    "rgb(255, 255, 76)",  // ight yellow
    "rgb(255, 255, 0)",   // yellow
    "rgb(178, 178, 0)",   // dark yellow
    "rgb(76, 76, 255)",   // light blue
    "rgb(0, 0, 255)",     // blue
    "rgb(0, 0, 178)",     // dark blue
    "rgb(76, 166, 76)",   // light green
    "rgb(0, 128, 0)",     // green
    "rgb(0, 89, 0)",      // dark green
    "rgb(255, 190, 76)",  // light orange
    "rgb(255, 165, 0)",   // orange
    "rgb(178, 115, 0)",   // dark orange
    "rgb(166, 76, 166)",  // light purple
    "rgb(128, 0, 128)",   // purple
    "rgb(89, 0, 89)",     // dark purple

  ]);


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


  return (
    <>
      {/* Paleta */}
      <div style={{ marginBottom: 10 }}>
        {colors.map((color, index) => (
          <button
            key={index}
            onClick={() => setSelectedColor(color)}
            onContextMenu={(e) => handleContextMenu(e, index)}
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

      {/* Picker oculto pero posicionado */}
      <input
        ref={inputRef}
        type="color"
        style={{
          position: "fixed",
          zIndex: 1000,
          left: pickerStyle.left,
          top: pickerStyle.top,
          opacity: 0,
          width: 30,
          height: 30,
          border: "none",
          visibility: pickerStyle.visibility,
        }}
        value={pickerIndex !== null ? rgbToHex(colors[pickerIndex]) : "#ffffff"}
        onChange={handleColorChange}
        onBlur={() => {
          setPickerIndex(null);
          setPickerStyle((prev) => ({ ...prev, visibility: "hidden" }));
        }}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const img = new window.Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
              // Crear un canvas auxiliar para rotar la imagen
              const canvas = document.createElement("canvas");
              canvas.width = img.height;
              canvas.height = img.width;
              const ctx = canvas.getContext("2d");

              if (ctx) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-Math.PI / 2); // rotar 90° antihorario
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
              }

              const rotatedImg = new window.Image();
              rotatedImg.src = canvas.toDataURL();
              rotatedImg.onload = () => {
                setBackgroundImage(rotatedImg); // establecer la imagen ya rotada
              };
            };
          }
        }}
        style={{ marginBottom: 10 }}
      />

      <AudioPanel></AudioPanel>

      <button
        onClick={togglePaintMode}
        style={{
          backgroundColor: paintMode ? "lightblue" : "lightgray",
          padding: "5px 10px",
          cursor: "pointer",
          marginLeft: 10,
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

      <button
        onClick={addNewToken}
        style={{
          backgroundColor: "lightgreen",
          padding: "5px 10px",
          cursor: "pointer",
          marginBottom: 10,
          marginLeft: 10,
        }}
      >
        Agregar Token
      </button>

      <button
        onClick={() => {
          setMeasureMode((prev) => !prev);
          setMeasureStart(null);
          setMeasureEnd(null);
          setPaintMode(false); // desactiva pintar
          setMoveMode(false); // desactiva mover
        }}
        style={{
          backgroundColor: measureMode ? "lightblue" : "lightgray",
          padding: "5px 10px",
          cursor: "pointer",
          marginLeft: 10,
        }}
      >
        {measureMode ? "Desactivar Medición" : "Medir Distancia"}
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
          {backgroundImage && (
            <Image
              image={backgroundImage}
              x={(gridWidth - backgroundImage.width) / 2}
              y={(gridHeight - backgroundImage.height) / 2}
              width={backgroundImage.width}
              height={backgroundImage.height}
            />
          )}

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

          {/* Regla */}
          {measureMode && measureStart && measureEnd && (
            <>
              <Line
                points={[
                  measureStart.x * tileSize + tileSize / 2,
                  measureStart.y * tileSize + tileSize / 2,
                  measureEnd.x * tileSize + tileSize / 2,
                  measureEnd.y * tileSize + tileSize / 2,
                ]}
                stroke="black"
                strokeWidth={2}
                dash={[10, 5]}
              />
              <Text
                x={((measureStart.x + measureEnd.x) / 2) * tileSize}
                y={((measureStart.y + measureEnd.y) / 2) * tileSize}
                text={`${Math.round(
                  Math.sqrt(
                    Math.pow(measureEnd.x - measureStart.x, 2) +
                    Math.pow(measureEnd.y - measureStart.y, 2)
                  ) * 5
                )} pies`}
                fontSize={14}
                fill="black"
              />
              {/* Circunferencia de radio igual a la distancia */}
              <Circle
                x={measureStart.x * tileSize + tileSize / 2}
                y={measureStart.y * tileSize + tileSize / 2}
                radius={
                  Math.sqrt(
                    Math.pow(measureEnd.x - measureStart.x, 2) +
                    Math.pow(measureEnd.y - measureStart.y, 2)
                  ) * tileSize
                }
                stroke="black"
                strokeWidth={1}
                dash={[5, 5]}
                opacity={0.5}
              />
            </>
          )}

          {/* Rect cursor */}

          {/* Círculo de player */}
          {tokens.map((token) => (
            <>
              {/* Vida arriba */}
              <Text
                key={`vida-${token.id}`}
                x={token.x - token.radius}
                y={token.y - token.radius - 18}
                width={token.radius * 2}
                align="center"
                text={token.vida}
                fontSize={12}
                fill="black"
              />

              {/* Token: Imagen si hay, sino círculo */}
              {token.image ? (
                <CircularToken
                  key={token.id}
                  image={token.image}
                  x={token.x}
                  y={token.y}
                  radius={token.radius}
                  onMouseDown={() => {
                    if (moveMode) {
                      setSelectedTokenId(token.id);
                      setIsDraggingPlayer(true);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    setContextTokenId(token.id);
                    setContextMenuPosition({ x: e.evt.clientX, y: e.evt.clientY });
                    setContextMenuVisible(true);
                  }}
                />
              ) : (
                <Circle
                  key={token.id}
                  x={token.x}
                  y={token.y}
                  radius={token.radius}
                  fill={token.color}
                  stroke={token.id === selectedTokenId ? "black" : undefined}
                  strokeWidth={token.id === selectedTokenId ? 2 : 0}
                  onMouseDown={() => {
                    if (moveMode) {
                      setSelectedTokenId(token.id);
                      setIsDraggingPlayer(true);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.evt.preventDefault();
                    setContextTokenId(token.id);
                    setContextMenuPosition({ x: e.evt.clientX, y: e.evt.clientY });
                    setContextMenuVisible(true);
                  }}
                />
              )}

              {/* Nombre abajo */}
              <Text
                key={`nombre-${token.id}`}
                x={token.x - token.radius}
                y={token.y + token.radius + 2}
                width={token.radius * 2}
                align="center"
                text={token.nombre}
                fontSize={12}
                fill="black"
              />
            </>
          ))}

        </Layer>
      </Stage>

      {contextMenuVisible && contextTokenId && (
        <div
          style={{
            position: "fixed",
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            backgroundColor: "white",
            border: "1px solid #ccc",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            zIndex: 1000,
            padding: 8,
          }}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <label style={{ fontSize: 14 }}>Color:</label>
          <input
            type="color"
            value={
              contextTokenId
                ? rgbToHex(tokens.find((t) => t.id === contextTokenId)?.color || "rgb(0, 0, 0)")
                : "#000000"
            }
            onChange={(e) => {
              const newColor = hexToRgb(e.target.value);
              setTokens((tokens) =>
                tokens.map((t) =>
                  t.id === contextTokenId ? { ...t, color: newColor } : t
                )
              );
            }}
            style={{ display: "block", marginBottom: 8 }}
          />

          <label>Nombre:</label>
          <input
            type="text"
            value={tokens.find((t) => t.id === contextTokenId)?.nombre || ""}
            onChange={(e) => {
              const value = e.target.value;
              setTokens((tokens) =>
                tokens.map((t) =>
                  t.id === contextTokenId ? { ...t, nombre: value } : t
                )
              );
            }}
            style={{ display: "block", marginBottom: 8, width: "100%" }}
          />

          <label>Vida:</label>
          <input
            type="text"
            value={tokens.find((t) => t.id === contextTokenId)?.vida || ""}
            onChange={(e) => {
              const value = e.target.value;
              setTokens((tokens) =>
                tokens.map((t) =>
                  t.id === contextTokenId ? { ...t, vida: value } : t
                )
              );
            }}
            style={{ display: "block", width: "100%" }}
          />

          <label>Imagen:</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || !contextTokenId) return;

              const img = new window.Image();
              img.src = URL.createObjectURL(file);
              img.onload = () => {
                setTokens((tokens) =>
                  tokens.map((t) =>
                    t.id === contextTokenId ? { ...t, image: img } : t
                  )
                );
              };
            }}
            style={{ display: "block", marginBottom: 8 }}
          />
        </div>

      )}
      <DiceRoller></DiceRoller>
    </>
  );
}
