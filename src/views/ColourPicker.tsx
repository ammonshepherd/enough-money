import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { hexToHsv, hsvToHex, normaliseHex, type Hex, type Hsv } from "../models/themeColour";

/**
 * Any colour: a square of shades (left to right more colourful, bottom to
 * top brighter) for the hue chosen on the slider under it, and a hex field.
 * The square works with a finger, a mouse or the arrow keys (Shift moves
 * further). Every change is reported at once, so the app recolours live.
 */
export function ColourPicker({ value, onChange }: { value: Hex; onChange: (hex: Hex) => void }) {
  // Kept as hue/saturation/value, so the hue survives greys and black.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [typed, setTyped] = useState<string>(value);
  const square = useRef<HTMLDivElement>(null);

  // A colour set from outside (a swatch) moves the controls. (Updating state
  // while rendering is React's way to follow a prop.)
  const [shown, setShown] = useState<Hex>(value);
  if (value !== shown) {
    setShown(value);
    setTyped(value);
    if (hsvToHex(hsv) !== value) setHsv(hexToHsv(value));
  }

  const update = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setTyped(hex);
    setShown(hex);
    if (hex !== value) onChange(hex);
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = square.current?.getBoundingClientRect();
    if (!box) return;
    const s = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - box.top) / box.height));
    update({ ...hsv, s, v });
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: hsv.s - step },
      ArrowRight: { s: hsv.s + step },
      ArrowDown: { v: hsv.v - step },
      ArrowUp: { v: hsv.v + step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = { ...hsv, ...move };
    update({ ...next, s: Math.min(1, Math.max(0, next.s)), v: Math.min(1, Math.max(0, next.v)) });
  };

  const percent = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="colour-picker">
      <div
        ref={square}
        className="colour-square"
        role="slider"
        tabIndex={0}
        aria-label="Shade"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`${percent(hsv.s)} colourful, ${percent(hsv.v)} bright`}
        // The pure hue behind the white and black shading (CSS draws those).
        style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          fromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event);
        }}
        onKeyDown={onKey}
      >
        <span
          className="colour-square-marker"
          style={{ left: percent(hsv.s), top: percent(1 - hsv.v) }}
          aria-hidden="true"
        />
      </div>
      <label className="field">
        Hue
        <input
          className="colour-hue"
          type="range"
          min={0}
          max={359}
          value={Math.round(hsv.h)}
          onChange={(e) => update({ ...hsv, h: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        Hex
        <input
          value={typed}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => {
            setTyped(e.target.value);
            const hex = normaliseHex(e.target.value);
            if (hex && e.target.value.replace("#", "").length === 6) {
              setHsv(hexToHsv(hex));
              setShown(hex);
              if (hex !== value) onChange(hex);
            }
          }}
          onBlur={() => setTyped(value)}
        />
      </label>
    </div>
  );
}
