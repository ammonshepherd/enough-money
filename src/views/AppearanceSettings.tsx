import { useThemeControl } from "../controllers/useTheme";
import { THEME_CHOICE_LABELS, THEME_CHOICES } from "../models/theme";

/** Manage → Appearance: light, dark or the device's setting, remembered on this device. */
export function AppearanceSettings() {
  const theme = useThemeControl();

  return (
    <section className="list-card" aria-labelledby="appearance-title">
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
    </section>
  );
}
