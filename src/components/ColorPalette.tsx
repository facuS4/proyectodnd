import React, { useState, useRef } from "react";

type Props = {
  colors: string[];
  selectedColor: string;
  onColorChange: (color: string) => void;
  setColors: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function ColorPalette({ colors, selectedColor, onColorChange, setColors }: Props) {
    const [pickerIndex, setPickerIndex] = useState<number | null>(null);
    const [pickerStyle, setPickerStyle] = useState({ top: 0, left: 0, visibility: "hidden" as "hidden" | "visible" });
    const inputRef = useRef<HTMLInputElement>(null);

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

    const handleColorClick = (color: string) => {
        onColorChange(color);
    };

    const handleContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        setPickerIndex(index);
        setPickerStyle({ left: e.clientX, top: e.clientY, visibility: "visible" });

        setTimeout(() => {
            inputRef.current?.click();
        }, 0);
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (pickerIndex === null) return;

        const newColor = hexToRgb(e.target.value);

        // Usar setColors del padre para actualizar la lista de colores
        setColors(prevColors => {
            const updated = [...prevColors];
            updated[pickerIndex] = newColor;
            return updated;
        });

        // Si el color seleccionado era el anterior, actualizarlo también
        if (colors[pickerIndex] === selectedColor) {
            onColorChange(newColor);
        }
    };

    return (
        <>
            <div style={{ marginBottom: 10 }}>
                {colors.map((color, index) => (
                    <button
                        key={index}
                        style={{
                            backgroundColor: color,
                            border: selectedColor === color ? "3px solid black" : "1px solid gray",
                            width: 30,
                            height: 30,
                            marginRight: 5,
                            cursor: "pointer",
                        }}
                        onClick={() => handleColorClick(color)}
                        onContextMenu={(e) => handleContextMenu(e, index)}
                    />
                ))}
            </div>

            <input
                ref={inputRef}
                type="color"
                value={pickerIndex !== null ? rgbToHex(colors[pickerIndex]) : "#ffffff"}
                onChange={handleColorChange}
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
                onBlur={() => {
                    setPickerIndex(null);
                    setPickerStyle((prev) => ({ ...prev, visibility: "hidden" }));
                }}
            />
        </>
    );
}
