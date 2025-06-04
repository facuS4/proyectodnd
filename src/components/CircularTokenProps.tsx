import Konva from "konva";
import { Image as KonvaImage } from "react-konva";
import { useRef, useEffect, useState } from "react";

type CircularTokenProps = {
  image: HTMLImageElement;
  x: number;
  y: number;
  radius: number;
  onMouseDown?: (e: any) => void;
  onContextMenu?: (e: any) => void;
};

export default function CircularToken({ image, x, y, radius, onMouseDown, onContextMenu }: CircularTokenProps) {
  const imageRef = useRef<Konva.Image>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, [image]);

  return (
    loaded && (
      <KonvaImage
        ref={imageRef}
        x={x - radius}
        y={y - radius}
        width={radius * 2}
        height={radius * 2}
        image={image}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.arc(radius, radius, radius, 0, Math.PI * 2, false);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(image, 0, 0, radius * 2, radius * 2);
        }}
      />
    )
  );
}


