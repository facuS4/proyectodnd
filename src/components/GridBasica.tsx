import { Stage, Layer, Rect, Line } from "react-konva";
import { useRef, useState, useEffect } from "react";
import { Circle, Text, Transformer } from "react-konva";
import CircularToken from "./CircularTokenProps";
import AudioPanel from "./AudioPanel";
import { DiceRoller } from "./diceroller";
import React from "react";
import ColorPalette from "./ColorPalette";
import socket from "../utils/socket";
import { Button, ButtonGroup, Popover, PopoverContent, PopoverTrigger, Tooltip, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function GridAdaptativo() {

  //#region MODOS

  const [isDmMode, setIsDmMode] = useState(false);

  //#endregion

  //#region GRID
  const baseTileSize = 50; // Tamaño base de la casilla
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [scale, setScale] = useState(1);

  const gridWidth = 2000; // Ancho del grid
  const gridHeight = 1000; // Alto del grid

  // Calculamos el número de columnas y filas basado en el tamaño del grid y el tamaño de la casilla
  const numCols = Math.floor(gridWidth / baseTileSize);
  const numRows = Math.floor(gridHeight / baseTileSize);

  const tileSizeW = gridWidth / numCols;
  const tileSizeH = gridHeight / numRows;
  const tileSize = Math.min(tileSizeW, tileSizeH);

  // Estado para la imagen del fondo
  const [backgroundImage] = useState<HTMLImageElement | null>(null);

  //Dibujar la Grid
  const drawGrid = () => {
    const lines = [];

    const padding = 5; // cantidad de tiles extra para renderizar fuera de pantalla
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;

    const startX = Math.floor(-stagePosition.x / tileSize) - padding;
    const endX = Math.floor((-stagePosition.x + viewWidth) / tileSize) + padding;
    const startY = Math.floor(-stagePosition.y / tileSize) - padding;
    const endY = Math.floor((-stagePosition.y + viewHeight) / tileSize) + padding;

    for (let i = startX; i <= endX; i++) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i * tileSize, startY * tileSize, i * tileSize, endY * tileSize]}
          stroke="rgba(128, 128, 128, 0.5)"
          strokeWidth={0.5}
        />
      );
    }

    for (let i = startY; i <= endY; i++) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[startX * tileSize, i * tileSize, endX * tileSize, i * tileSize]}
          stroke="rgba(128, 128, 128, 0.5)"
          strokeWidth={0.5}
        />
      );
    }

    return lines;
  };

  const getWorldPos = () => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const scale = stage?.scaleX() ?? 1;
    const pos = {
      x: (pointer?.x - stage.x()) / scale,
      y: (pointer?.y - stage.y()) / scale,
    };
    return pos;
  };

  //#endregion

  //#region FOG
  const [foggedTiles, setFoggedTiles] = useState<Set<string>>(new Set());
  const [isPlacingFog, setIsPlacingFog] = useState(false);
  const [fogStart, setFogStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState({ x: 0, y: 0 });
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [hasStartedFogDraw, setHasStartedFogDraw] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) setIsCtrlDown(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey) setIsCtrlDown(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  //#endregion

  //#region TOKENS
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
    muerto?: boolean; // Indica si el token está muerto
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

  //Cambiar atributos del token
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextTokenId, setContextTokenId] = useState<string | null>(null);

  // Token Muerto
  const [deadTokenIds, setDeadTokenIds] = useState<string[]>([]);


  //Cerrar el menú del token
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

    //Enviar evento al servidor
    socket.send(JSON.stringify({
      type: "ADD_TOKEN",
      payload: {
        id,
        x: newToken.x,
        y: newToken.y,
        radius: newToken.radius,
        color: newToken.color,
        nombre: newToken.nombre,
        vida: newToken.vida,
      }
    }));
  };

  //Agrandar y Reducir el token
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTokenId) return;

      if (e.key.toLowerCase() === "r" || e.key.toLowerCase() === "f") {
        setTokens((tokens) => {
          return tokens.map((token) => {
            if (token.id !== selectedTokenId) return token;

            let newRadius = token.radius;
            if (e.key.toLowerCase() === "r") {
              newRadius = Math.min(token.radius + tokenSize, tileSize * 2);
            }
            if (e.key.toLowerCase() === "f") {
              newRadius = Math.max(token.radius - tokenSize, tileSize / 2);
            }

            const snapped = snapToGrid(token.x, token.y, newRadius);
            const updatedToken = {
              ...token,
              radius: newRadius,
              x: snapped.x,
              y: snapped.y,
            };

            // Emitimos por WebSocket
            socket.send(
              JSON.stringify({
                type: "RESIZE_TOKEN",
                payload: {
                  id: updatedToken.id,
                  x: updatedToken.x,
                  y: updatedToken.y,
                  radius: updatedToken.radius,
                },
              })
            );

            return updatedToken;
          });
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTokenId, tileSize]);

  // Manejo de calavera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "x") {
        setDeadTokenIds(prev => {
          const affectedIds = multiSelectedIds.length > 0
            ? multiSelectedIds
            : selectedTokenId
              ? [selectedTokenId]
              : [];

          return prev.includes(affectedIds[0])
            ? prev.filter(id => !affectedIds.includes(id)) // remover (revivir)
            : [...prev, ...affectedIds]; // agregar (matar)
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTokenId, multiSelectedIds]);

  // useEffect para enviar muerto y revivir tokens
  const skipNextUpdateRef = useRef(false);
  useEffect(() => {
    if (skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false; // Reseteamos el flag y no enviamos nada esta vez
      return;
    }

    if (!socket) return;

    // Mandar mensajes solo si es un cambio local
    deadTokenIds.forEach(id => {
      socket.send(JSON.stringify({
        type: "UPDATE_TOKEN_DEAD_STATUS",
        payload: { id, muerto: true }
      }));
    });

    tokens.forEach(token => {
      if (!deadTokenIds.includes(token.id)) {
        socket.send(JSON.stringify({
          type: "UPDATE_TOKEN_DEAD_STATUS",
          payload: { id: token.id, muerto: false }
        }));
      }
    });
  }, [deadTokenIds, tokens, socket]);


  //#endregion

  //#region PALETA
  const [selectedColor, setSelectedColor] = useState("orange");

  const [paletteColors, setPaletteColors] = useState([
    "rgb(255, 255, 255)", "rgb(0, 0, 0)", "rgb(255, 76, 76)", "rgb(255, 0, 0)",
    "rgb(178, 0, 0)", "rgb(255, 255, 76)", "rgb(255, 255, 0)", "rgb(178, 178, 0)",
    "rgb(76, 76, 255)", "rgb(0, 0, 255)", "rgb(0, 0, 178)", "rgb(76, 166, 76)",
    "rgb(0, 128, 0)", "rgb(0, 89, 0)", "rgb(255, 190, 76)", "rgb(255, 165, 0)",
    "rgb(178, 115, 0)", "rgb(166, 76, 166)", "rgb(128, 0, 128)", "rgb(89, 0, 89)",
  ]);

  const rgbToHex = (rgb: string): string => {
    const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
    if (!result) return "#000000";
    const r = parseInt(result[1]).toString(16).padStart(2, "0");
    const g = parseInt(result[2]).toString(16).padStart(2, "0");
    const b = parseInt(result[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  };

  const hexToRgb = (hex: string): string => {
    const parsedHex = hex.replace("#", "");
    const bigint = parseInt(parsedHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgb(${r}, ${g}, ${b})`;
  };

  //#endregion

  //#region PINTAR

  //Pintar lineas
  const [paintedEdges, setPaintedEdges] = useState<Map<string, string>>(new Map());
  const [paintEdgesMode, setPaintEdgesMode] = useState(false);
  const [isDrawingEdge, setIsDrawingEdge] = useState(false);
  const [rectEdgePaintStart, setRectEdgePaintStart] = useState<{ x: number; y: number } | null>(null);

  // Cambiamos a Map<string, string> para almacenar color por casilla
  const [paintedTiles, setPaintedTiles] = useState<Map<string, string>>(new Map());
  const [isDrawing, setIsDrawing] = useState(false);

  //Pintar en area
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [rectPaintStart, setRectPaintStart] = useState<{ x: number; y: number } | null>(null);
  const posKey = (x: number, y: number) => `${x},${y}`;

  const paintTile = (x: number, y: number) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;

    const key = posKey(x, y);

    setPaintedTiles((prev) => {
      const newMap = new Map(prev);

      if (selectedColor === "rgb(255, 255, 255)") {
        newMap.delete(key);
      } else {
        newMap.set(key, selectedColor);
      }

      return newMap;
    });

    socket.send(
      JSON.stringify({
        type: "PAINT_TILE",
        payload: { x, y, color: selectedColor },
      })
    );
  };

  const paintEdge = (x: number, y: number, edge: string) => {
    const key = `${x},${y}-${edge}`;
    const updates: [string, string][] = [[key, edge]];

    // Borde espejo
    let mirrorKey = null;
    let mirrorX = x;
    let mirrorY = y;
    let mirrorEdge = "";

    switch (edge) {
      case "top":
        mirrorY = y - 1;
        mirrorEdge = "bottom";
        break;
      case "bottom":
        mirrorY = y + 1;
        mirrorEdge = "top";
        break;
      case "left":
        mirrorX = x - 1;
        mirrorEdge = "right";
        break;
      case "right":
        mirrorX = x + 1;
        mirrorEdge = "left";
        break;
    }

    if (mirrorX >= 0 && mirrorX < numCols && mirrorY >= 0 && mirrorY < numRows) {
      mirrorKey = `${mirrorX},${mirrorY}-${mirrorEdge}`;
      updates.push([mirrorKey, mirrorEdge]);
    }

    setPaintedEdges((prev) => {
      const newMap = new Map(prev);
      for (const [key] of updates) {
        if (selectedColor === "rgb(255, 255, 255)") {
          newMap.delete(key); // borrar
        } else {
          newMap.set(key, selectedColor); // pintar
        }
      }
      return newMap;
    });

    socket.send(JSON.stringify({
      type: "PAINT_EDGE",
      payload: {
        updates: updates.map(([key]) => ({ key, color: selectedColor })),
      },
    }));
  };

  function sendTokenUpdate(id: string, updates: Partial<Token>) {
    const { vida, ...filteredUpdates } = updates;

    socket.send(JSON.stringify({
      type: "UPDATE_TOKEN",
      payload: {
        id,
        updates: isDmMode ? updates : filteredUpdates,
      },
    }));
  }

  //#endregion

  //#region BACKGROUND IMAGES

  type ImageShape = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    image: HTMLImageElement;
  };

  const [imageShapes, setImageShapes] = useState<ImageShape[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const imageTransformerRef = useRef<any>(null);
  const imageShapeRefs = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const transformer = imageTransformerRef.current;
    if (!transformer) return;

    const node = selectedImageId ? imageShapeRefs.current.get(selectedImageId) : null;
    if (node) {
      transformer.nodes([node]);
    } else {
      transformer.nodes([]);
    }

    transformer.getLayer()?.batchDraw();
  }, [selectedImageId, imageShapes]);

  //#endregion

  //#region LASER

  //Laser
  const [myId] = useState(() => crypto.randomUUID());
  const [laserMode, setLaserMode] = useState(false);
  const [laserColor, setLaserColor] = useState("red");
  const [laserPath, setLaserPath] = useState<{ x: number; y: number; time: number }[]>([]);
  const [remoteLaserPath, setRemoteLaserPath] = useState<{ x: number; y: number; time: number; userId: string }[]>([]);
  const [remoteLaserColors, setRemoteLaserColors] = useState<Record<string, string>>({});
  const [remoteLaserUserId, setRemoteLaserUserId] = useState<string | null>(null);

  // Manejo de popover de color del laser
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);


  useEffect(() => {
    if (!laserMode) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setLaserPath((prev) => prev.filter((p) => now - p.time < 500));
    }, 50);

    return () => clearInterval(interval);
  }, [laserMode]);


  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteLaserPath((prev) => prev.filter((p) => now - p.time < 500));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  //#endregion

  //#region AREAS

  //AREAS
  const transformerRef = useRef<any>(null);
  const shapeRefs = useRef<Map<string, any>>(new Map());
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [clickedOnInteractiveNode, setClickedOnInteractiveNode] = useState(false);

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
    setTimeout(() => {
      const transformer = transformerRef.current;
      if (!transformer) return;

      const node = selectedAreaId ? shapeRefs.current.get(selectedAreaId) : null;
      if (node) {
        transformer.nodes([node]);
      } else {
        transformer.nodes([]);
      }

      transformer.getLayer()?.batchDraw();
    }, 0);
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

  //#endregion

  //#region REGLA

  //Estados regla
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  const [sharedMeasureStart, setSharedMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [sharedMeasureEnd, setSharedMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  const effectiveStart = measureStart ?? sharedMeasureStart;
  const effectiveEnd = measureEnd ?? sharedMeasureEnd;


  //#endregion

  //#region EVENTOS

  const handleClickStage = (e: any) => {
    // Si se hace clic en el fondo del Stage (no sobre ningún objeto interactivo)
    if (e.target === e.target.getStage()) {
      if (selectedImageId) setSelectedImageId(null);
      if (selectedAreaId) setSelectedAreaId(null);
      if (selectedTokenId) setSelectedTokenId(null);
    }
  };

  //Apretar el shift
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) setIsShiftDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) {
        setIsShiftDown(false);
        setRectPaintStart(null);
        setSelectionRect(null);
        setSelectionStart(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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

          // Emitimos el movimiento
          socket.send(JSON.stringify({
            type: "MOVE_TOKEN",
            payload: {
              id: token.id,
              x: snapped.x,
              y: snapped.y,
            },
          }));

          return { ...token, x: snapped.x, y: snapped.y };
        }
        return token;
      })
    );
  };

  // Manejo de eventos del mouse
  const handleMouseDown = (e: any) => {
    if (isPlacingFog) {
      requestAnimationFrame(() => {
        const world = getWorldPos();
        setFogStart(world);
        setHasStartedFogDraw(false);
      });
    }

    //Utilizar la regla
    if (measureMode) {
      const { x: worldX, y: worldY } = getWorldPos();
      const x = Math.floor(worldX / tileSize);
      const y = Math.floor(worldY / tileSize);
      setMeasureStart({ x, y });
      setMeasureEnd({ x, y });

      socket.send(JSON.stringify({
        type: "MEASURE",
        payload: {
          start: { x, y },
          end: { x, y },
        },
      }));

      return;
    }

    //Area para seleccionar multiples tokens
    const world = getWorldPos();
    if (!world) return;

    // Colocar nueva área
    if (areaMode) {
      const snapped = snapToGrid(world.x, world.y, tileSize);
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

      socket.send(JSON.stringify({
        type: "ADD_AREA",
        payload: baseShape
      }));

      return;
    }

    // Iniciar selección múltiple si estamos en moveMode y Shift está presionado
    if (moveMode && isShiftDown) {
      setSelectionStart({ x: world.x, y: world.y });
      setSelectionRect({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    // Pintar bordes de las celdas
    if (paintEdgesMode) {
      const { x: worldX, y: worldY } = getWorldPos();
      const x = Math.floor(worldX / tileSize);
      const y = Math.floor(worldY / tileSize);

      if (isShiftDown) {
        setRectEdgePaintStart({ x, y });
        setIsDrawingEdge(true);
        return;
      }

      const localX = worldX % tileSize;
      const localY = worldY % tileSize;

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

        // Enviar al servidor también si corresponde
        socket.send(JSON.stringify({
          type: "PAINT_EDGE",
          payload: {
            updates: [{ key, color: selectedColor }],
          },
        }));
      }

      setIsDrawingEdge(true);
      return;
    }

    //Pintar si estamos en paintMode
    if (paintMode) {
      setIsDrawing(true);
      const { x, y } = getWorldPos();
      const gridX = Math.floor(x / tileSize);
      const gridY = Math.floor(y / tileSize);
      if (isShiftDown) {
        setRectPaintStart({ x: gridX, y: gridY });
      } else {
        paintTile(gridX, gridY);
      }
      return;
    }
  };

  //Eventos al mover el cursor
  const handleMouseMove = (e: any) => {
    if (isPlacingFog && fogStart && !hasStartedFogDraw) {
      setHasStartedFogDraw(true);
    }

    //Utilizar el laser
    if (laserMode) {
      const pos = getWorldPos();
      const now = Date.now();
      const point = { x: pos.x, y: pos.y, time: now };

      setLaserPath((prev) => [...prev, point]);

      socket.send(JSON.stringify({
        type: "LASER_PATH",
        payload: {
          userId: myId,
          color: laserColor,
          path: [...laserPath, point], // también podrías enviar solo el nuevo punto
        },
      }));

      return;
    }



    // Pintar los bordes de las celdas
    if (paintEdgesMode && isDrawingEdge) {
      const { x: worldX, y: worldY } = getWorldPos();

      const x = Math.floor(worldX / tileSize);
      const y = Math.floor(worldY / tileSize);

      if (isShiftDown && rectEdgePaintStart) {
        // 🟦 Shift + arrastre => pintar bordes del rectángulo
        const x1 = rectEdgePaintStart.x;
        const y1 = rectEdgePaintStart.y;

        const x2 = x;
        const y2 = y;

        for (let i = Math.min(x1, x2); i <= Math.max(x1, x2); i++) {
          for (let j = Math.min(y1, y2); j <= Math.max(y1, y2); j++) {
            if (i === Math.min(x1, x2)) paintEdge(i, j, "left");
            if (i === Math.max(x1, x2)) paintEdge(i, j, "right");
            if (j === Math.min(y1, y2)) paintEdge(i, j, "top");
            if (j === Math.max(y1, y2)) paintEdge(i, j, "bottom");
          }
        }
      } else {
        // 🖱️ Pintado normal con el mouse sobre un borde
        const localX = worldX % tileSize;
        const localY = worldY % tileSize;

        const margin = 6;
        let edge = null;

        if (localY < margin) edge = "top";
        else if (localY > tileSize - margin) edge = "bottom";
        else if (localX < margin) edge = "left";
        else if (localX > tileSize - margin) edge = "right";

        if (edge) {
          paintEdge(x, y, edge);
        }
      }

      return;
    }

    //Mover multiples tokens seleccionados
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

    //Mover la regla
    if (measureMode && measureStart) {
      const { x: worldX, y: worldY } = getWorldPos();
      const x = Math.floor(worldX / tileSize);
      const y = Math.floor(worldY / tileSize);
      setMeasureEnd({ x, y });

      socket.send(JSON.stringify({
        type: "MEASURE",
        payload: {
          start: measureStart,
          end: { x, y },
        },
      }));
    }

    if (!paintMode) return;
    if (!isDrawing) return;
    const mousePos = e.target.getStage().getPointerPosition();
    if (!mousePos) return;

    //Pintar multiples casillas 
    const { x: worldX, y: worldY } = getWorldPos();
    const x = Math.floor(worldX / tileSize);
    const y = Math.floor(worldY / tileSize);

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

  //Finalizar eventos al soltar el cursor
  const handleMouseUp = (e: any) => {
    if (isPlacingFog && fogStart) {
      const { x: worldX, y: worldY } = getWorldPos();

      const x1 = Math.floor(fogStart.x / tileSize);
      const y1 = Math.floor(fogStart.y / tileSize);
      const x2 = Math.floor(worldX / tileSize);
      const y2 = Math.floor(worldY / tileSize);

      const xStart = Math.min(x1, x2);
      const xEnd = Math.max(x1, x2);
      const yStart = Math.min(y1, y2);
      const yEnd = Math.max(y1, y2);

      const affectedTiles = new Set<string>();
      for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
          affectedTiles.add(`${x},${y}`);
        }
      }

      const isRemovingFog = e.evt.ctrlKey; // ← aquí detectamos si Ctrl está presionado

      setFoggedTiles((prev) => {
        const updated = new Set(prev);
        if (isRemovingFog) {
          affectedTiles.forEach((key) => updated.delete(key));
        } else {
          affectedTiles.forEach((key) => updated.add(key));
        }
        return updated;
      });

      setFogStart(null);

      socket.send(JSON.stringify({
        type: isRemovingFog ? "FOG_REMOVE_TILES" : "FOG_ADD_TILES",
        payload: Array.from(affectedTiles),
      }));

      return
    }

    //Terminar de pintar los bordes de las casillas
    if (paintEdgesMode) {
      setIsDrawingEdge(false);
      setRectEdgePaintStart(null);
    }

    //Selecciona todos los tokens completamente contenidos dentro del rectángulo de selección
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

    //Termina de pintar
    setIsDrawing(false);

    //Terminar de medir
    if (measureMode && measureStart && measureEnd) {
      setMeasureStart(null);
      setMeasureEnd(null);

      socket.send(JSON.stringify({
        type: "MEASURE",
        payload: {
          start: null,
          end: null,
        }
      }));

      return;
    }

    setRectPaintStart(null);
  };

  //#endregion

  //#region ESTADOS

  const [paintMode, setPaintMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);

  const setActiveTool = (tool: "paint" | "move" | "measure" | "laser" | "edges" | "circle" | "square" | "cone" | "fog" | false) => {
    setPaintMode(tool === "paint");
    setMoveMode(tool === "move");
    setMeasureMode(tool === "measure");
    setLaserMode(tool === "laser");
    setPaintEdgesMode(tool === "edges");
    setAreaMode(tool === "circle" || tool === "square" || tool === "cone" ? tool : false);
    setIsPlacingFog(tool === "fog");
  };

  //#endregion

  //#region SOCKETS

  useEffect(() => {
    socket.onmessage = async (event) => {
      try {
        const text = await (event.data instanceof Blob ? event.data.text() : event.data);
        const data = JSON.parse(text);

        switch (data.type) {
          case "INIT_STATE":
            setPaintedTiles(() => {
              const newMap = new Map<string, string>();
              for (const key in data.payload.paintedTiles) {
                newMap.set(key, data.payload.paintedTiles[key]);
              }
              return newMap;
            });
            break;


          case "INIT_TOKENS":
            setTokens(() => Object.values(data.payload).map((t: any) => ({
              ...t,
              image: null // las imágenes siguen siendo locales
            })));
            break;

          case "INIT_EDGES":
            setPaintedEdges(() => {
              const newMap = new Map<string, string>();
              for (const key in data.payload) {
                newMap.set(key, data.payload[key]);
              }
              return newMap;
            });
            break;

          case "INIT_AREAS":
            setAreaShapes(Object.values(data.payload));
            break;

          case "INIT_BACKGROUND_IMAGES": {
            const images = data.payload;

            for (const imgData of images) {
              const img = new window.Image();
              img.src = imgData.src;

              img.onload = () => {
                setImageShapes((prev) => [
                  ...prev,
                  {
                    id: imgData.id,
                    x: imgData.x,
                    y: imgData.y,
                    width: imgData.width,
                    height: imgData.height,
                    image: img,
                  },
                ]);
              };
            }

            break;
          }

          case "INIT_FOG":
            setFoggedTiles(new Set(data.payload));
            break;

          case "PAINT_TILE":
            const { x, y, color } = data.payload;
            setPaintedTiles((prev) => {
              const newMap = new Map(prev);
              const key = `${x},${y}`;
              if (color === "rgb(255, 255, 255)") {
                newMap.delete(key);
              } else {
                newMap.set(key, color);
              }
              return newMap;
            });
            break;

          case "PAINT_EDGE":
            setPaintedEdges((prev) => {
              const newMap = new Map(prev);
              for (const { key, color } of data.payload.updates) {
                if (color === "rgb(255, 255, 255)") {
                  newMap.delete(key);
                } else {
                  newMap.set(key, color);
                }
              }
              return newMap;
            });
            break;

          case "FOG_ADD_TILES":
            setFoggedTiles((prev) => {
              const updated = new Set(prev);
              data.payload.forEach((tile: string) => updated.add(tile));
              return updated;
            });
            break;

          case "FOG_REMOVE_TILES":
            setFoggedTiles((prev) => {
              const updated = new Set(prev);
              data.payload.forEach((tile: string) => updated.delete(tile));
              return updated;
            });
            break;

          case "ADD_TOKEN":
            setTokens((prev) => {
              // Evitar duplicados
              if (prev.some(t => t.id === data.payload.id)) return prev;

              return [
                ...prev,
                {
                  id: data.payload.id,
                  x: data.payload.x,
                  y: data.payload.y,
                  radius: data.payload.radius,
                  color: data.payload.color,
                  nombre: data.payload.nombre,
                  vida: data.payload.vida,
                  image: null // 🔸 Las imágenes no se comparten por WebSocket, al menos no por ahora
                }
              ];
            });
            break;

          case "MOVE_TOKEN":
            setTokens((prev) =>
              prev.map((t) =>
                t.id === data.payload.id
                  ? { ...t, x: data.payload.x, y: data.payload.y }
                  : t
              )
            );
            break;


          case "RESIZE_TOKEN":
            setTokens((prev) =>
              prev.map((t) =>
                t.id === data.payload.id
                  ? {
                    ...t,
                    x: data.payload.x,
                    y: data.payload.y,
                    radius: data.payload.radius,
                  }
                  : t
              )
            );
            break;

          case "DELETE_TOKEN":
            setTokens((prev) => prev.filter((t) => t.id !== data.payload.id));
            break;

          case "ADD_AREA":
            setAreaShapes(prev => {
              if (prev.some(a => a.id === data.payload.id)) return prev;
              return [...prev, data.payload];
            });
            break;

          case "MOVE_AREA":
            setAreaShapes(prev =>
              prev.map((s) =>
                s.id === data.payload.id
                  ? { ...s, x: data.payload.x, y: data.payload.y }
                  : s
              )
            );
            break;

          case "TRANSFORM_AREA":
            setAreaShapes(prev =>
              prev.map((s) =>
                s.id === data.payload.id
                  ? {
                    ...s,
                    size: data.payload.size,
                    rotation: data.payload.rotation
                  }
                  : s
              )
            );
            break;

          case "DELETE_AREA":
            setAreaShapes(prev => prev.filter(a => a.id !== data.payload.id));
            break;

          case "MEASURE":
            setSharedMeasureStart(data.payload.start);
            setSharedMeasureEnd(data.payload.end);
            break;


          case "LASER_PATH": {
            const { userId, color, path } = data.payload;

            setRemoteLaserUserId(userId); // ← este es el que usás después
            setRemoteLaserColors((prev) => ({
              ...prev,
              [userId]: color || "red",
            }));

            setRemoteLaserPath(path);
            break;
          }

          case "SET_LASER_COLOR": {
            const { userId, color } = data.payload;
            setRemoteLaserColors(prev => ({
              ...prev,
              [userId]: color,
            }));
            break;
          }

          case "ADD_BACKGROUND_IMAGE": {
            const { id, src, x, y, width, height } = data.payload;

            const img = new window.Image();
            img.src = src;
            img.onload = () => {
              setImageShapes(prev => [
                ...prev,
                {
                  id,
                  x,
                  y,
                  width,
                  height,
                  image: img, // ahora sí es un HTMLImageElement
                },
              ]);
            };
            break;
          }

          case "DELETE_BACKGROUND_IMAGE":
            const { id: deletedId } = data.payload;
            setImageShapes(prev => prev.filter(img => img.id !== deletedId));
            break;

          case "CLEAR_BACKGROUND_IMAGES":
            setImageShapes([]);
            setSelectedImageId(null);
            break;

          case "MOVE_BACKGROUND_IMAGE": {
            const { id, x, y, width, height } = data.payload;
            setImageShapes((prev) =>
              prev.map((img) =>
                img.id === id ? { ...img, x, y, width, height } : img
              )
            );
            break;
          }

          case "TOKEN_IMAGE":
            const { id, base64 } = data.payload;
            const img = new window.Image();
            img.src = base64;
            img.onload = () => {
              setTokens((tokens) =>
                tokens.map((t) =>
                  t.id === id ? { ...t, image: img } : t
                )
              );
            };
            break;


          case "UPDATE_TOKEN_DEAD_STATUS": {
            const { id, muerto } = data.payload;
            setTokens(prev => prev.map(t =>
              t.id === id ? { ...t, muerto } : t
            ));

            skipNextUpdateRef.current = true; // <-- Indicamos que el siguiente cambio no debe enviarse

            setDeadTokenIds(prev => {
              if (muerto) {
                return prev.includes(id) ? prev : [...prev, id];
              } else {
                return prev.filter(did => did !== id);
              }
            });
            break;
          }

          case "UPDATE_TOKEN": {
            const { id, updates } = data.payload;
            setTokens((tokens) =>
              tokens.map((t) => (t.id === id ? { ...t, ...updates } : t))
            );
            break;
          }
        }

      } catch (err) {
        console.error("Error al parsear mensaje WebSocket:", err);
      }
    };
  }, []);

  //#endregion



  return (
    <div className="flex flex-col h-screen bg-content1">
      {/* Top Bar */}
      {isDmMode && (
        <>
          <div className="flex flex-wrap items-center p-3 bg-content2 border-b border-default-200 gap-3 shadow-sm">
            {/* Color Picker */}
            <div className="flex items-center">
              <ColorPalette
                colors={paletteColors}
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                setColors={setPaletteColors}
              />
            </div>

            <Divider orientation="vertical" className="h-8 mx-2" />

            {/* Audio Panel */}
            <div className="flex items-center">
              <AudioPanel />
            </div>

            <Divider orientation="vertical" className="h-8 mx-2" />

            {/* Hidden Image Upload */}
            <input
              type="file"
              accept="image/*"
              id="bg-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = reader.result as string;

                    const img = new window.Image();
                    img.src = base64;
                    img.onload = () => {
                      const id = crypto.randomUUID();
                      const newImage = {
                        id,
                        x: gridWidth / 2 - img.width / 2,
                        y: gridHeight / 2 - img.height / 2,
                        width: img.width,
                        height: img.height,
                        image: img,
                      };

                      // Mostrar en este cliente
                      setImageShapes(prev => [...prev, newImage]);

                      // Enviar a otros
                      socket.send(JSON.stringify({
                        type: "ADD_BACKGROUND_IMAGE",
                        payload: {
                          id,
                          src: base64,
                          x: newImage.x,
                          y: newImage.y,
                          width: newImage.width,
                          height: newImage.height,
                        },
                      }));
                    };
                  };
                  reader.readAsDataURL(file);
                }

                e.target.value = "";
              }}

            />


            {/* Background Button */}
            <Tooltip content="Upload background image">
              <Button
                color="default"
                variant="flat"
                startContent={<Icon icon="lucide:image" />}
                onClick={() => document.getElementById("bg-upload")?.click()}
              >
                Background
              </Button>
            </Tooltip>

            <Tooltip content="Remove background image">
              <Button
                color="danger"
                variant="flat"
                startContent={<Icon icon="lucide:trash" />}
                onClick={() => {
                  if (!selectedImageId) return;

                  // Eliminar localmente
                  setImageShapes(prev => prev.filter(img => img.id !== selectedImageId));
                  setSelectedImageId(null);

                  // Enviar al servidor
                  socket.send(JSON.stringify({
                    type: "DELETE_BACKGROUND_IMAGE",
                    payload: { id: selectedImageId },
                  }));
                }}
              >
                Remove Background
              </Button>
            </Tooltip>

            <Tooltip content="Clear background image">
              <Button
                color="default"
                variant="flat"
                startContent={<Icon icon="lucide:trash" />}
                onClick={() => {
                  setImageShapes([]);
                  setSelectedImageId(null);

                  socket.send(JSON.stringify({
                    type: "CLEAR_BACKGROUND_IMAGES",
                  }));

                }}
              >
                Clear Background
              </Button>
            </Tooltip>

            {/* Spacer + Add Token */}
            <div className="ml-auto">
              <Button
                color="success"
                startContent={<Icon icon="lucide:plus-circle" />}
                onClick={addNewToken}
                className="font-medium"
              >
                Add Token
              </Button>
            </div>

          </div>
        </>
      )}


      {/* Tool Buttons Row - Moved from sides to top */}
      <div className="flex justify-between items-center p-2 bg-content1 border-b border-default-200">
        {/* Left Tool Buttons - Now at top */}
        <div className="flex">
          <ButtonGroup className="shadow-sm rounded-lg overflow-hidden">
            {isDmMode && (
              <Tooltip content="Paint tiles" placement="bottom">
                <Button
                  color={paintMode ? "primary" : "default"}
                  onClick={() => setActiveTool("paint")}
                  startContent={<Icon icon="lucide:paintbrush" width={20} />}
                  className="px-3 py-2"
                  size="sm"
                >
                  Paint
                </Button>
              </Tooltip>
            )}

            {isDmMode && (
              <Tooltip content="Paint tiles" placement="bottom">
                <Button
                  onClick={() => setActiveTool("fog")}
                  color={isPlacingFog ? "primary" : "default"}
                  startContent={<Icon icon="lucide:cloud-fog" width={20} />}
                  className="px-3 py-2"
                  size="sm"
                >
                  {isCtrlDown ? "🟥 Revelando niebla" : "⬛ Colocando niebla"}
                </Button>
              </Tooltip>
            )}

            {isDmMode && (
              <Tooltip content="Paint edges" placement="bottom">
                <Button
                  color={paintEdgesMode ? "primary" : "default"}
                  onClick={() => setActiveTool("edges")}
                  startContent={<Icon icon="lucide:square" width={20} />}
                  className="px-3 py-2"
                  size="sm"
                >
                  Edges
                </Button>
              </Tooltip>
            )}
            <Tooltip content="Move tokens" placement="bottom">
              <Button
                color={moveMode ? "primary" : "default"}
                onClick={() => setActiveTool("move")}
                startContent={<Icon icon="lucide:move" width={20} />}
                className="px-3 py-2"
                size="sm"
              >
                Move
              </Button>
            </Tooltip>
            <Tooltip content="Measure distance" placement="bottom">
              <Button
                color={measureMode ? "primary" : "default"}
                onClick={() => setActiveTool("measure")}
                startContent={<Icon icon="lucide:ruler" width={20} />}
                className="px-3 py-2"
                size="sm"
              >
                Measure
              </Button>
            </Tooltip>
            {/* Botón para activar el modo láser */}
            <Button
              color={laserMode ? "primary" : "default"}
              onClick={() => setActiveTool("laser")}
              startContent={<Icon icon="lucide:zap" width={20} />}
              className="px-3 py-2"
              size="sm"
            >
              Laser
            </Button>

            <Popover isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen} placement="bottom">
              <PopoverTrigger>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                // ✅ Elimina el onClick de acá
                >
                  <Icon icon="lucide:settings" width={20} />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="p-4 w-40">
                <label className="block text-sm font-medium mb-2">Color del Láser:</label>
                <input
                  type="color"
                  value={laserColor}
                  onChange={(e) => {
                    const newColor = e.target.value;
                    setLaserColor(newColor);

                    socket.send(
                      JSON.stringify({
                        type: "SET_LASER_COLOR",
                        payload: {
                          userId: myId,
                          color: newColor,
                        },
                      })
                    );
                  }}
                  className="w-full h-10 cursor-pointer border border-default-200 rounded"
                />
              </PopoverContent>
            </Popover>
          </ButtonGroup>

          <Button
            color={isDmMode ? "primary" : "default"}
            variant="flat"
            onClick={() => setIsDmMode(prev => !prev)}
          >
            {isDmMode ? "Leave DM mode" : "Join as DM"}
          </Button>
        </div>

        {/* Right Tool Buttons - Now at top */}
        <div className="flex">
          <ButtonGroup className="shadow-sm rounded-lg overflow-hidden">
            <Tooltip content="Add circle area" placement="bottom">
              <Button
                color={areaMode === "circle" ? "primary" : "default"}
                onClick={() => setActiveTool("circle")}
                startContent={<Icon icon="lucide:circle" width={20} />}
                className="px-3 py-2"
                size="sm"
              >
                Circle
              </Button>
            </Tooltip>
            <Tooltip content="Add square area" placement="bottom">
              <Button
                color={areaMode === "square" ? "primary" : "default"}
                onClick={() => setActiveTool("square")}
                startContent={<Icon icon="lucide:square" width={20} />}
                className="px-3 py-2"
                size="sm"
              >
                Square
              </Button>
            </Tooltip>
            <Tooltip content="Add cone area" placement="bottom">
              <Button
                color={areaMode === "cone" ? "primary" : "default"}
                onClick={() => setActiveTool("cone")}
                startContent={<Icon icon="lucide:triangle" width={20} />}
                className="px-3 py-2"
                size="sm"
              >
                Cone
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        {/* Canvas Container */}
        <div className="w-full h-full bg-gray-100">
          {/* Stage */}
          <Stage
            width={window.innerWidth}
            height={window.innerHeight}
            ref={stageRef}
            scaleX={scale}
            scaleY={scale}
            x={stagePosition.x}
            y={stagePosition.y}
            draggable={false}
            onWheel={(e) => {
              e.evt.preventDefault();

              const scaleBy = 1.05;
              const stage = stageRef.current;
              const oldScale = scale;

              const mousePointTo = {
                x: (e.evt.offsetX - stage.x()) / oldScale,
                y: (e.evt.offsetY - stage.y()) / oldScale,
              };

              const direction = e.evt.deltaY > 0 ? -1 : 1;
              const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

              setScale(newScale);

              const newPos = {
                x: e.evt.offsetX - mousePointTo.x * newScale,
                y: e.evt.offsetY - mousePointTo.y * newScale,
              };

              stage.position(newPos);
              setStagePosition(newPos);
              stage.batchDraw();
            }}
            onDragStart={(e) => {
              if (e.target === stageRef.current) {
                if (e.evt.button !== 1) {
                  e.cancelBubble = true;
                  e.target.stopDrag();
                }
              }
            }}
            onDragEnd={(e) => {
              const pos = e.target.position();
              setStagePosition(pos);
            }}
            onMouseDown={(e) => {
              const className = e.target.getClassName?.();
              const isNonInteractiveBackground =
                className === "Stage" || className === "Rect" || className === "Line";

              if (e.evt.button === 1 && isNonInteractiveBackground) {
                setIsPanning(true);
              }

              if (!isNonInteractiveBackground) return;

              handleMouseDown(e);
              handleClickStage(e);

              if (isPlacingFog) {
                const pos = e.target.getStage()?.getPointerPosition();
                if (pos) setFogStart(pos);
              }
            }}
            onMouseMove={(e) => {
              if (isPanning && stageRef.current) {
                const dx = e.evt.movementX;
                const dy = e.evt.movementY;
                const stage = stageRef.current;
                const newPos = {
                  x: stage.x() + dx,
                  y: stage.y() + dy,
                };
                stage.position(newPos);
                setStagePosition(newPos);
                stage.batchDraw();
                return;
              }

              handleMouseMove(e);
              handleMouseMovePlayer(e);

              if (isPlacingFog) {
                const pos = e.target.getStage()?.getPointerPosition();
                if (pos) setCurrentMousePos(pos);
              }
            }}
            onMouseUp={(e) => {
              setIsPanning(false);
              setIsDraggingNode(false);
              handleMouseUp(e);
              setIsDraggingPlayer(false);
              setDragOffsets({});
              if (!isPlacingFog || !fogStart || !currentMousePos) return;

              const tileSize = 32;

              const x1 = Math.floor(fogStart.x / tileSize);
              const y1 = Math.floor(fogStart.y / tileSize);
              const x2 = Math.floor(currentMousePos.x / tileSize);
              const y2 = Math.floor(currentMousePos.y / tileSize);

              const xStart = Math.min(x1, x2);
              const xEnd = Math.max(x1, x2);
              const yStart = Math.min(y1, y2);
              const yEnd = Math.max(y1, y2);

              const affectedTiles: string[] = [];
              for (let x = xStart; x <= xEnd; x++) {
                for (let y = yStart; y <= yEnd; y++) {
                  affectedTiles.push(`${x},${y}`);
                }
              }

              console.log("Tiles a ocultar:", affectedTiles);
              setFogStart(null);
              //setCurrentMousePos(null);
            }}
            style={{
              backgroundImage: backgroundImage ? `url(${backgroundImage.src})` : "none",
              backgroundSize: "cover",
              cursor: isPanning ? "grabbing" : "default",
              backgroundPosition: "center",
            }}
            tabIndex={0}
          >
            <Layer>
              {drawGrid()}

              {imageShapes.map((shape) => (
                <Rect
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  fillPatternImage={shape.image}
                  fillPatternScale={{
                    x: shape.width / (shape.image?.width || 1),
                    y: shape.height / (shape.image?.height || 1),
                  }}
                  offsetX={0}
                  offsetY={0}
                  stroke="black"
                  strokeWidth={selectedImageId === shape.id ? 2 : 0}
                  draggable
                  onClick={() => setSelectedImageId(shape.id)}
                  onDragStart={() => {
                    setIsDraggingNode(true);
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true; // esto evita pan del Stage
                  }}
                  onDragEnd={(e) => {
                    setIsDraggingNode(false);
                    const node = e.target;
                    const newX = node.x();
                    const newY = node.y();

                    setImageShapes((prev) =>
                      prev.map((s) =>
                        s.id === shape.id ? { ...s, x: newX, y: newY } : s
                      )
                    );

                    socket.send(
                      JSON.stringify({
                        type: "MOVE_BACKGROUND_IMAGE",
                        payload: {
                          id: shape.id,
                          x: newX,
                          y: newY,
                          width: shape.width,
                          height: shape.height,
                        },
                      })
                    );
                  }}
                />


              ))}

              <Transformer
                ref={imageTransformerRef}
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                rotateEnabled={false}
              />

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

                // No pintar si está bajo niebla (solo para jugadores)
                if (!isDmMode && foggedTiles.has(`${x},${y}`)) return null;

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

              {effectiveStart && effectiveEnd && (
                <>
                  <Line
                    points={[
                      effectiveStart.x * tileSize + tileSize / 2,
                      effectiveStart.y * tileSize + tileSize / 2,
                      effectiveEnd.x * tileSize + tileSize / 2,
                      effectiveEnd.y * tileSize + tileSize / 2,
                    ]}
                    stroke="black"
                    strokeWidth={2}
                    dash={[10, 5]}
                  />
                  <Text
                    x={((effectiveStart.x + effectiveEnd.x) / 2) * tileSize}
                    y={((effectiveStart.y + effectiveEnd.y) / 2) * tileSize}
                    text={`${Math.round(
                      Math.sqrt(
                        Math.pow(effectiveEnd.x - effectiveStart.x, 2) +
                        Math.pow(effectiveEnd.y - effectiveStart.y, 2)
                      ) * 5
                    )} pies`}
                    fontSize={14}
                    fill="black"
                    fontStyle="bold"
                  />
                  <Circle
                    x={effectiveStart.x * tileSize + tileSize / 2}
                    y={effectiveStart.y * tileSize + tileSize / 2}
                    radius={
                      Math.sqrt(
                        Math.pow(effectiveEnd.x - effectiveStart.x, 2) +
                        Math.pow(effectiveEnd.y - effectiveStart.y, 2)
                      ) * tileSize
                    }
                    stroke="black"
                    strokeWidth={1}
                    dash={[5, 5]}
                    opacity={0.5}
                  />
                </>
              )}

              {/* Círculo de player */}
              {tokens.map((token) => (
                <React.Fragment key={token.id}>
                  {deadTokenIds.includes(token.id) ? (
                    <Text
                      x={token.x - token.radius}
                      y={token.y - token.radius - 18}
                      width={token.radius * 2}
                      align="center"
                      text="💀"
                      fontSize={12}
                      fill="black"
                      fontStyle="bold"
                    />
                  ) : (
                    <>
                      {/* Mostrar vida localmente si sos dm */}
                      {isDmMode && (
                        <Text
                          x={token.x - token.radius}
                          y={token.y - token.radius - 18}
                          width={token.radius * 2}
                          align="center"
                          text={token.vida}
                          fontSize={12}
                          fill="black"
                          fontStyle="bold"
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
                        fontStyle="bold"
                      />
                    </>
                  )}
                  {token.image ? (
                    <CircularToken
                      image={token.image}
                      x={token.x}
                      y={token.y}
                      radius={token.radius}
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
                        if (!isDmMode) return;
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
                        if (!isDmMode) return;
                        e.evt.preventDefault();
                        setContextTokenId(token.id);
                        setContextMenuPosition({ x: e.evt.clientX, y: e.evt.clientY });
                        setContextMenuVisible(true);
                      }}
                    />
                  )}
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
                    const node = e.target;
                    const offsetX = node.offsetX();
                    const offsetY = node.offsetY();

                    const newX = node.x() + offsetX;
                    const newY = node.y() + offsetY;

                    setAreaShapes(prev =>
                      prev.map(s =>
                        s.id === shape.id ? { ...s, x: newX, y: newY } : s
                      )
                    );

                    socket.send(JSON.stringify({
                      type: "MOVE_AREA",
                      payload: {
                        id: shape.id,
                        x: newX,
                        y: newY
                      }
                    }));
                  },
                  onTransformEnd: (e: any) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const rotation = node.rotation();

                    // Restaurar escala a 1 para no acumular transformaciones
                    node.scaleX(1);
                    node.scaleY(1);

                    const oldSize = shape.size;
                    const newSize = oldSize * scaleX;

                    setAreaShapes(prev =>
                      prev.map(s =>
                        s.id === shape.id
                          ? { ...s, size: newSize, rotation }
                          : s
                      )
                    );

                    socket.send(JSON.stringify({
                      type: "TRANSFORM_AREA",
                      payload: {
                        id: shape.id,
                        size: newSize,
                        rotation
                      }
                    }));
                  },
                  onContextMenu: (e: any) => {
                    e.evt.preventDefault();
                    setAreaShapes(prev => prev.filter(s => s.id !== shape.id));
                    if (selectedAreaId === shape.id) setSelectedAreaId(null);

                    socket.send(JSON.stringify({
                      type: "DELETE_AREA",
                      payload: { id: shape.id }
                    }));
                  },
                };

                if (shape.type === "circle") {
                  return <Circle key={shape.id} {...commonProps} radius={shape.size / 2} onDragStart={() => setIsDraggingNode(true)} onDragMove={(e) => { e.cancelBubble = true; }} onDragEnd={() => setIsDraggingNode(false)} />;
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
                      onDragStart={() => setIsDraggingNode(true)}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                      }}
                      onDragEnd={() => setIsDraggingNode(false)}
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
                      onDragStart={() => setIsDraggingNode(true)}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                      }}
                      onDragEnd={() => setIsDraggingNode(false)}
                    />
                  );
                }

                return null;
              })}

              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              />

              {laserMode && laserPath.length > 1 && (
                <Line
                  points={laserPath.flatMap((p) => [p.x, p.y])}
                  stroke={laserColor}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.4}
                  opacity={0.5}
                  shadowColor="red"
                  shadowBlur={20}
                  shadowOpacity={0.6}
                />
              )}

              {remoteLaserPath.length > 1 && remoteLaserUserId && (
                <Line
                  points={remoteLaserPath.flatMap((p) => [p.x, p.y])}
                  stroke={remoteLaserColors[remoteLaserUserId] || "red"}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.4}
                  opacity={0.5}
                  shadowColor={remoteLaserColors[remoteLaserUserId] || "red"}
                  shadowBlur={20}
                  shadowOpacity={0.6}
                />
              )}

              {isPlacingFog && fogStart && hasStartedFogDraw && (() => {
                const { x, y } = getWorldPos();
                return (
                  <Rect
                    x={Math.min(fogStart.x, x)}
                    y={Math.min(fogStart.y, y)}
                    width={Math.abs(x - fogStart.x)}
                    height={Math.abs(y - fogStart.y)}
                    fill="gray"
                    opacity={0.3}
                    listening={false}
                  />
                );
              })()}

              {isDmMode &&
                [...foggedTiles].map((key) => {
                  const [x, y] = key.split(",").map(Number);
                  return (
                    <Rect
                      key={`fog-preview-${key}`}
                      x={x * tileSize}
                      y={y * tileSize}
                      width={tileSize}
                      height={tileSize}
                      fill="black"
                      opacity={0.25}
                      listening={false}
                      dash={[4, 4]}
                    />
                  );
                })}
            </Layer>

            <Layer >

            </Layer>
          </Stage>

          {/* Token Context Menu */}
          {contextMenuVisible && contextTokenId && (
            <div
              id="token-context-menu"
              className="fixed bg-content1 border border-default-200 shadow-md rounded-lg p-4 z-50 w-64"
              style={{
                top: contextMenuPosition.y,
                left: contextMenuPosition.x,
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Color:</label>
                  <input
                    type="color"
                    className="w-full h-8 rounded cursor-pointer"
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
                      sendTokenUpdate(contextTokenId, { color: newColor });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nombre:</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-default-300 rounded"
                    value={tokens.find((t) => t.id === contextTokenId)?.nombre || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTokens((tokens) =>
                        tokens.map((t) =>
                          t.id === contextTokenId ? { ...t, nombre: value } : t
                        )
                      );
                      sendTokenUpdate(contextTokenId, { nombre: value });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Vida:</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-default-300 rounded"
                    value={tokens.find((t) => t.id === contextTokenId)?.vida || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTokens((tokens) =>
                        tokens.map((t) =>
                          t.id === contextTokenId ? { ...t, vida: value } : t
                        )
                      );
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Imagen:</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary-600"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !contextTokenId) return;

                      const reader = new FileReader();

                      reader.onload = () => {
                        const base64 = reader.result as string;

                        const img = new window.Image();
                        img.src = base64;
                        img.onload = () => {
                          // 🧠 1. Mostrar localmente
                          setTokens((tokens) =>
                            tokens.map((t) =>
                              t.id === contextTokenId ? { ...t, image: img } : t
                            )
                          );

                          // 📡 2. Enviar al servidor
                          socket.send(JSON.stringify({
                            type: "TOKEN_IMAGE",
                            payload: {
                              id: contextTokenId,
                              base64
                            }
                          }));
                        };
                      };

                      reader.readAsDataURL(file);
                    }}
                  />
                </div>

                <Divider className="my-3" />

                <Button
                  color="danger"
                  variant="solid"
                  className="w-full"
                  startContent={<Icon icon="lucide:trash-2" />}
                  onClick={() => {
                    setTokens(tokens => tokens.filter(t => t.id !== contextTokenId));
                    setContextTokenId(null);
                    setContextMenuVisible(false);

                    socket.send(JSON.stringify({
                      type: "DELETE_TOKEN",
                      payload: { id: contextTokenId }
                    }));

                  }}
                >
                  Eliminar Token
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dice Roller */}
      <div className="absolute bottom-4 right-4 z-10">
        <Popover placement="top">
          <PopoverTrigger>
            <Button
              isIconOnly
              variant="shadow"
              color="primary"
              className="w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-transform duration-200"
              aria-label="Lanzar dado"
            >
              <Icon icon="fa-solid:dice-d20" width={24} height={24} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]">
            <DiceRoller
              onRollComplete={(value, diceType, modifier, total) => {
                console.log(
                  `Roll result: ${value} ${diceType} ${modifier > 0 ? '+' : ''}${modifier} = ${total}`
                );
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="absolute bottom-4 left-4 z-10">
        <Popover placement="top">
          <PopoverTrigger>
            <Button
              variant="flat"
              color="default"
              startContent={<Icon icon="lucide:keyboard" width={18} />}
              size="sm"
            >
              Shortcuts
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="p-2 space-y-2">
              <h3 className="text-medium font-semibold">Keyboard Shortcuts</h3>
              <div className="text-small space-y-1">
                <p><span className="font-medium">Shift + Click/Drag:</span> Select multiple tokens</p>
                <p><span className="font-medium">R:</span> Increase token size</p>
                <p><span className="font-medium">F:</span> Decrease token size</p>
                <p><span className="font-medium">Right Click:</span> Delete Square, Cone and Circle</p>
                <p><span className="font-medium">X:</span> Mark Selected Token As Dead</p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}