"use client";

import * as React from "react";
import { ColorPicker, useColor, ColorService } from "react-color-palette";
import "react-color-palette/css";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const ColorPickerInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = useColor(value);

  React.useEffect(() => {
    if (open) {
      try {
        setColor(ColorService.convert("hex", value));
      } catch {
        // ignore invalid hex
      }
    }
  }, [open, value, setColor]);

  const handleChange = React.useCallback(
    (c: { hex: string }) => {
      setColor(c);
      onChange(c.hex);
    },
    [onChange, setColor]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input bg-transparent transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
          aria-label="Pick a color"
        >
          <span
            className="block size-full rounded-[calc(0.375rem-1px)]"
            style={{ backgroundColor: value || "transparent" }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto border-border p-2" align="start">
        <ColorPicker
          height={180}
          color={color}
          onChange={handleChange}
          hideInput={["rgb", "hsv"]}
        />
      </PopoverContent>
    </Popover>
  );
};
