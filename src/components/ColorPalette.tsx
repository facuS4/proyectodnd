import React, { useState, useRef } from "react";
import { Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

type Props = {
  colors: string[];
  selectedColor: string;
  onColorChange: (color: string) => void;
  setColors: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function ColorPalette({ colors, selectedColor, onColorChange, setColors }: Props) {
  const [isOpen, setIsOpen] = useState(false);
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

    setColors((prevColors) => {
      const updated = [...prevColors];
      updated[pickerIndex] = newColor;
      return updated;
    });

    if (colors[pickerIndex] === selectedColor) {
      onColorChange(newColor);
    }
  };

  return (
    <>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom">
        <PopoverTrigger>
          <Button
            color="default"
            variant="bordered"
            className="flex items-center gap-2"
            startContent={<Icon icon="lucide:palette" />}
          >
            <div
              className="w-5 h-5 rounded-full border border-default-300"
              style={{ backgroundColor: selectedColor }}
            />
            Color
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-72">
          <div className="grid grid-cols-5 gap-2">
            {colors.map((color, index) => (
              <div
                key={index}
                className={`w-10 h-10 rounded-full cursor-pointer border-2 flex items-center justify-center transition-all duration-150 ${
                  color === selectedColor ? "border-primary" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorClick(color)}
                onContextMenu={(e) => handleContextMenu(e, index)}
              >
                {color === selectedColor && (
                  <Icon icon="lucide:check" className="text-white drop-shadow-md" />
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

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
