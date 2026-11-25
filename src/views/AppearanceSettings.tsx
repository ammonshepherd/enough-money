import { useState } from "react";
import { useThemeControl } from "../controllers/useTheme";
import { THEME_CHOICE_LABELS, THEME_CHOICES } from "../models/theme";
import { DEFAULT_BRAND, PRESETS } from "../models/themeColour";
import { ColourPicker } from "./ColourPicker";

/**
 * Manage → Appearance: light, dark or the device's setting, and the theme
 * colour (a ready-made one or any colour), both remembered on this device.
 * Changes apply at once, so the whole app is the preview.
 */
export function AppearanceSettings() {
  const theme = useThemeControl();
  const preset = PRESETS.find((p) => p.hex === theme.colour);
  // Custom stays open while picking, even when the colour lands on a preset.
  const [custom, setCustom] = useState(!preset);

  return (
    <section className="list-card stack" aria-labelledby="appearance-title">
      <div className="section-heading">
        <h2 id="appearance-title">Appearance</h2>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Theme">
        {THEME_CHOICES.map((choice) => (
          <label key={choice}>
            <input
              type="radio"
              name="theme"
              checked={theme.choice === choice}
              onChange={() => theme.choose(choice)}
            />
            {THEME_CHOICE_LABELS[choice]}
          </label>
        ))}
      </div>
      <p className="empty-state">
        {theme.choice === "system"
          ? `Follows this device’s light or dark setting (${theme.theme} now).`
          : "Kept on this device for you; other devices keep their own."}
      </p>

      <h3 className="appearance-heading" id="colour-title">
        Theme colour
      </h3>
      <div className="theme-swatches" role="radiogroup" aria-labelledby="colour-title">
        {PRESETS.map(({ name, hex }) => (
          <label key={hex} className="theme-swatch">
            <input
              type="radio"
              name="theme-colour"
              checked={!custom && theme.colour === hex}
              onChange={() => {
                setCustom(false);
                theme.chooseColour(hex);
              }}
            />
            <span
              className="theme-swatch-dot"
              style={{ backgroundColor: hex }}
              aria-hidden="true"
            />
            {name}
          </label>
        ))}
        <label className="theme-swatch">
          <input
            type="radio"
            name="theme-colour"
            checked={custom}
            onChange={() => setCustom(true)}
          />
          <span className="theme-swatch-dot custom" aria-hidden="true" />
          Custom
        </label>
      </div>

      {custom && <ColourPicker value={theme.colour} onChange={theme.chooseColour} />}

      <div className="theme-preview" aria-hidden="true">
        <div className="theme-preview-band">November</div>
        <div className="theme-preview-row">
          <span>Groceries</span>
          <span className="saved-chip sparkle">Saved $40.00</span>
        </div>
        <span className="primary-button">Save</span>
      </div>

      {theme.colours.adjusted && (
        <p className="empty-state">
          Adjusted for readability: the colour is a little darker ({theme.colours.brand}) so text on
          it can be read.
        </p>
      )}
      {theme.colours.clashes && (
        <p className="notice compact">
          Red and green also mean money out and in, so this colour may be harder to tell apart from
          them.
        </p>
      )}
      {theme.colour !== DEFAULT_BRAND && (
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setCustom(false);
            theme.chooseColour(DEFAULT_BRAND);
          }}
        >
          Back to purple
        </button>
      )}
    </section>
  );
}
