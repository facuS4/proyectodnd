import { Stage, Layer, Rect, Line } from "react-konva";
import { useRef, useState, useEffect } from "react";
import { Circle, Text, Image, Transformer } from "react-konva";
import CircularToken from "./CircularTokenProps";
import AudioPanel from "./AudioPanel";
import { DiceRoller } from "./diceroller";
import React from "react";

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
  const [dragOffsets, setDragOffsets] = useState<{ [id: string]: { dx: number; dy: number } }>({});

  //Area de selección de multiples tokens
  const [selectionRect, setSelectionRect] = useState<null | { x: number; y: number; width: number; height: number }>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);

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

  //Pintar lineas
  const [paintedEdges, setPaintedEdges] = useState<Map<string, string>>(new Map());
  const [paintEdgesMode, setPaintEdgesMode] = useState(false);
  const [isDrawingEdge, setIsDrawingEdge] = useState(false);

  // Cambiamos a Map<string, string> para almacenar color por casilla
  const [paintedTiles, setPaintedTiles] = useState<Map<string, string>>(new Map());
  const [isDrawing, setIsDrawing] = useState(false);

  // refs para cada input color
  const [selectedColor, setSelectedColor] = useState("orange");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0, visibility: "hidden" as "hidden" | "visible" });

  //Pintar en area
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [rectPaintStart, setRectPaintStart] = useState<{ x: number; y: number } | null>(null);

  const posKey = (x: number, y: number) => `${x},${y}`;

  //AREAS
  const transformerRef = useRef<any>(null);
  const shapeRefs = useRef<Map<string, any>>(new Map());

  type AreaShape = {
    id: string;
    x: number;
    y: number;
    size: number;
    type: "circle" | "square" | "cone";
    rotation?: number; // Para el cono
  };

  const [areaMode, setAreaMode] = useState<"circle" | "square" | "cone" | false>(false);
  const [areaShapes, setAreaShapes] = useState<AreaShape[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);


  useEffect(() => {
    const transformer = transformerRef.current;

    if (!transformer) return;

    if (selectedAreaId) {
      const node = shapeRefs.current.get(selectedAreaId);
      if (node) {
        transformer.nodes([node]);
        transformer.getLayer()?.batchDraw();
      } else {
        transformer.nodes([]);
        transformer.getLayer()?.batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedAreaId, areaShapes]);

  useEffect(() => {
    if (!selectedAreaId) return;

    const stillExists = areaShapes.some(circle => circle.id === selectedAreaId);

    if (!stillExists) {
      setSelectedAreaId(null);
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [areaShapes, selectedAreaId]);


  //Apretar el shift
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) setIsShiftDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) {
        setIsShiftDown(false);
        setRectPaintStart(null);
        setSelectionRect(null);     // 👈 Cancela el rectángulo de selección si estaba activo
        setSelectionStart(null);    // 👈 Cancela el inicio también
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);


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
    if (!moveMode || !isDraggingPlayer || Object.keys(dragOffsets).length === 0)
      return;

    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    setTokens((tokens) =>
      tokens.map((token) => {
        if (dragOffsets[token.id]) {
          const { dx, dy } = dragOffsets[token.id];
          const newX = pos.x + dx;
          const newY = pos.y + dy;
          const snapped = snapToGrid(newX, newY, token.radius);
          return { ...token, x: snapped.x, y: snapped.y };
        }
        return token;
      })
    );
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
    if (moveMode && isShiftDown) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) {
        setSelectionStart(pos);
        setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
    }

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

    if (areaMode) {
      const mousePos = e.target.getStage().getPointerPosition();
      if (!mousePos) return;

      const snapped = snapToGrid(mousePos.x, mousePos.y, tileSize);
      const id = crypto.randomUUID();
      const baseShape: AreaShape = {
        id,
        x: snapped.x,
        y: snapped.y,
        size: tileSize * 2,
        type: areaMode,
        rotation: 0,
      };

      setAreaShapes(prev => [...prev, baseShape]);
      setSelectedAreaId(id);
      setAreaMode(false); // Desactiva modo después de colocar
      return;
    }

    if (paintEdgesMode) {
      const mousePos = e.target.getStage().getPointerPosition();
      if (!mousePos) return;

      const x = Math.floor(mousePos.x / tileSize);
      const y = Math.floor(mousePos.y / tileSize);
      const localX = mousePos.x % tileSize;
      const localY = mousePos.y % tileSize;

      const margin = 6;
      let edge = null;

      if (localY < margin) edge = "top";
      else if (localY > tileSize - margin) edge = "bottom";
      else if (localX < margin) edge = "left";
      else if (localX > tileSize - margin) edge = "right";

      if (edge) {
        const key = `${x},${y}-${edge}`;
        setPaintedEdges((prev) => {
          const newMap = new Map(prev);
          if (selectedColor === "rgb(255, 255, 255)") {
            newMap.delete(key);
          } else {
            newMap.set(key, selectedColor);
          }
          return newMap;
        });
      }

      setIsDrawingEdge(true); // ✅ Empezamos a pintar
      return;
    }


    if (!paintMode) return;

    setIsDrawing(true);
    const mousePos = e.target.getStage().getPointerPosition();
    if (!mousePos) return;
    const x = Math.floor(mousePos.x / tileSize);
    const y = Math.floor(mousePos.y / tileSize);
    if (isShiftDown) {
      setRectPaintStart({ x, y });
    } else {
      paintTile(x, y);
    }
  };

  const handleMouseMove = (e: any) => {
    if (paintEdgesMode && isDrawingEdge) {
      const mousePos = e.target.getStage().getPointerPosition();
      if (!mousePos) return;

      const x = Math.floor(mousePos.x / tileSize);
      const y = Math.floor(mousePos.y / tileSize);
      const localX = mousePos.x % tileSize;
      const localY = mousePos.y % tileSize;

      const margin = 6;
      let edge = null;

      if (localY < margin) edge = "top";
      else if (localY > tileSize - margin) edge = "bottom";
      else if (localX < margin) edge = "left";
      else if (localX > tileSize - margin) edge = "right";

      if (edge) {
        const key = `${x},${y}-${edge}`;
        setPaintedEdges((prev) => {
          const newMap = new Map(prev);
          if (selectedColor === "rgb(255, 255, 255)") {
            newMap.delete(key); // 🧽 Borrar línea si es blanco
          } else {
            newMap.set(key, selectedColor); // 🎨 Pintar línea
          }
          return newMap;
        });
      }

      return;
    }

    if (moveMode && isShiftDown && selectionStart) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (pos) {
        const x = Math.min(selectionStart.x, pos.x);
        const y = Math.min(selectionStart.y, pos.y);
        const width = Math.abs(pos.x - selectionStart.x);
        const height = Math.abs(pos.y - selectionStart.y);
        setSelectionRect({ x, y, width, height });
      }
    }

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

    if (isShiftDown && rectPaintStart) {
      const x1 = Math.min(rectPaintStart.x, x);
      const x2 = Math.max(rectPaintStart.x, x);
      const y1 = Math.min(rectPaintStart.y, y);
      const y2 = Math.max(rectPaintStart.y, y);
      for (let i = x1; i <= x2; i++) {
        for (let j = y1; j <= y2; j++) {
          paintTile(i, j);
        }
      }
    } else {
      paintTile(x, y);
    }
  };

  const handleMouseUp = () => {
    if (paintEdgesMode) {
      setIsDrawingEdge(false);
    }

    if (moveMode && isShiftDown && selectionRect) {
      const selected = tokens.filter(token => {
        const tokenLeft = token.x - token.radius;
        const tokenRight = token.x + token.radius;
        const tokenTop = token.y - token.radius;
        const tokenBottom = token.y + token.radius;

        return (
          tokenLeft >= selectionRect.x &&
          tokenRight <= selectionRect.x + selectionRect.width &&
          tokenTop >= selectionRect.y &&
          tokenBottom <= selectionRect.y + selectionRect.height
        );
      }).map(t => t.id);

      setMultiSelectedIds(selected);
      setSelectionRect(null);
      setSelectionStart(null);
    }

    setIsDrawing(false);

    if (measureMode && measureStart && measureEnd) {
      setMeasureStart(null);
      setMeasureEnd(null);
      return;
    }

    setRectPaintStart(null);
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
        onClick={() => {
          setPaintEdgesMode((prev) => {
            if (!prev) {
              setPaintMode(false);
              setMoveMode(false);
              setMeasureMode(false);
              setAreaMode(false);
            }
            return !prev;
          });
        }}
        style={{
          backgroundColor: paintEdgesMode ? "lightblue" : "lightgray",
          padding: "5px 10px",
          marginLeft: 10,
        }}
      >
        {paintEdgesMode ? "Desactivar Pintar Bordes" : "Pintar Bordes"}
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

      <button
        onClick={() => {
          setAreaMode("circle");
          setPaintMode(false);
          setMoveMode(false);
          setMeasureMode(false);
        }}
        style={{
          backgroundColor: areaMode === "circle" ? "lightblue" : "lightgray",
          padding: "5px 10px",
          marginLeft: 10,
        }}
      >
        Colocar Círculo
      </button>

      <button
        onClick={() => {
          setAreaMode("square");
          setPaintMode(false);
          setMoveMode(false);
          setMeasureMode(false);
        }}
        style={{
          backgroundColor: areaMode === "square" ? "lightblue" : "lightgray",
          padding: "5px 10px",
          marginLeft: 10,
        }}
      >
        Colocar Cuadrado
      </button>

      <button
        onClick={() => {
          setAreaMode("cone");
          setPaintMode(false);
          setMoveMode(false);
          setMeasureMode(false);
        }}
        style={{
          backgroundColor: areaMode === "cone" ? "lightblue" : "lightgray",
          padding: "5px 10px",
          marginLeft: 10,
        }}
      >
        Colocar Cono
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
          handleMouseUp();
          setIsDraggingPlayer(false);
          setDragOffsets({});
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

          {/* Area de Selección */}
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              stroke="blue"
              dash={[4, 4]}
              fill="rgba(0, 0, 255, 0.1)"
            />
          )}

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

          {/* Pintar Lineas */}
          {[...paintedEdges.entries()].map(([key, color]) => {
            const [cell, edge] = key.split("-");
            const [x, y] = cell.split(",").map(Number);

            let points: number[] = [];
            const startX = x * tileSize;
            const startY = y * tileSize;

            switch (edge) {
              case "top":
                points = [startX, startY, startX + tileSize, startY];
                break;
              case "bottom":
                points = [startX, startY + tileSize, startX + tileSize, startY + tileSize];
                break;
              case "left":
                points = [startX, startY, startX, startY + tileSize];
                break;
              case "right":
                points = [startX + tileSize, startY, startX + tileSize, startY + tileSize];
                break;
            }

            return (
              <Line
                key={key}
                points={points}
                stroke={color}
                strokeWidth={4}
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
            <React.Fragment key={token.id}>
              <Text
                x={token.x - token.radius}
                y={token.y - token.radius - 18}
                width={token.radius * 2}
                align="center"
                text={token.vida}
                fontSize={12}
                fill="black"
              />

              {token.image ? (
                <CircularToken
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
                  x={token.x}
                  y={token.y}
                  radius={token.radius}
                  fill={token.color}
                  stroke={
                    token.id === selectedTokenId || multiSelectedIds.includes(token.id)
                      ? "black"
                      : undefined
                  }
                  strokeWidth={
                    token.id === selectedTokenId || multiSelectedIds.includes(token.id)
                      ? 2
                      : 0
                  }
                  onMouseDown={(e) => {
                    if (moveMode) {
                      const stage = e.target.getStage();
                      const pos = stage?.getPointerPosition();
                      const offsets: { [id: string]: { dx: number; dy: number } } = {};
                      if (!pos) return;

                      setSelectedTokenId(token.id);
                      if (multiSelectedIds.length > 1 || (multiSelectedIds.length === 1 && multiSelectedIds[0] !== token.id)) {
                        setMultiSelectedIds([token.id]);
                      }
                      setIsDraggingPlayer(true);
                      setDragOffsets(offsets);



                      // Obtener tokens a mover (el seleccionado o todos los múltiples)
                      const movingIds = multiSelectedIds.length > 0
                        ? multiSelectedIds.includes(token.id)
                          ? multiSelectedIds
                          : [token.id]
                        : [token.id];

                      for (const t of tokens) {
                        if (movingIds.includes(t.id)) {
                          offsets[t.id] = {
                            dx: t.x - pos.x,
                            dy: t.y - pos.y,
                          };
                        }
                      }

                      setDragOffsets(offsets);
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

              <Text
                x={token.x - token.radius}
                y={token.y + token.radius + 2}
                width={token.radius * 2}
                align="center"
                text={token.nombre}
                fontSize={12}
                fill="black"
              />
            </React.Fragment>
          ))}

          {areaShapes.map((shape) => {
            const commonProps = {
              x: shape.x,
              y: shape.y,
              fill: "rgba(255, 0, 0, 0.3)",
              stroke: "red",
              strokeWidth: 2,
              draggable: true,
              ref: (node: any) => {
                if (node) shapeRefs.current.set(shape.id, node);
              },
              onClick: () => setSelectedAreaId(shape.id),
              onTap: () => setSelectedAreaId(shape.id),
              onDragEnd: (e: any) => {
                const { x, y } = e.target.position();
                setAreaShapes(prev =>
                  prev.map(s =>
                    s.id === shape.id ? { ...s, x, y } : s
                  )
                );
              },
              onTransformEnd: (e: any) => {
                const node = e.target;
                const scale = node.scaleX();
                node.scaleX(1);
                node.scaleY(1);
                const rotation = node.rotation();

                setAreaShapes(prev =>
                  prev.map(s =>
                    s.id === shape.id
                      ? {
                        ...s,
                        size: s.size * scale,
                        rotation,
                      }
                      : s
                  )
                );
              },
              onContextMenu: (e: any) => {
                e.evt.preventDefault();
                setAreaShapes(prev => prev.filter(s => s.id !== shape.id));
                if (selectedAreaId === shape.id) setSelectedAreaId(null);
              },
            };

            if (shape.type === "circle") {
              return <Circle key={shape.id} {...commonProps} radius={shape.size / 2} />;
            }

            if (shape.type === "square") {
              return (
                <Rect
                  key={shape.id}
                  {...commonProps}
                  width={shape.size}
                  height={shape.size}
                  offsetX={shape.size / 2}
                  offsetY={shape.size / 2}
                />
              );
            }

            if (shape.type === "cone") {
              const points = [
                0, 0,
                shape.size, -shape.size / 2,
                shape.size, shape.size / 2,
              ];
              return (
                <Line
                  key={shape.id}
                  {...commonProps}
                  points={points}
                  closed
                  offsetX={0}
                  offsetY={0}
                  rotation={shape.rotation || 0}
                />
              );
            }

            return null;
          })}

          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            boundBoxFunc={(oldBox, newBox) => {
              const size = Math.max(newBox.width, newBox.height);
              return {
                x: newBox.x,
                y: newBox.y,
                width: size,
                height: size,
                rotation: newBox.rotation, // necesario si rotás
              };
            }}
          />

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

          <hr style={{ margin: "8px 0" }} />
          <button
            onClick={() => {
              setTokens(tokens => tokens.filter(t => t.id !== contextTokenId));
              setContextTokenId(null);
              setContextMenuVisible(false);
            }}
            style={{
              backgroundColor: "crimson",
              color: "white",
              border: "none",
              padding: "6px 12px",
              cursor: "pointer",
              width: "100%",
              fontWeight: "bold",
            }}
          >
            🗑 Eliminar Token
          </button>
        </div>

      )}
      <DiceRoller></DiceRoller>
    </>
  );
}
