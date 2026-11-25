import { Money } from "../components";

const STAR = "M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z";

/** Each sparkle's colour is a class (sparkle-gold, -lilac, -white) set in the CSS. */
type Tone = "gold" | "lilac" | "white";

const Star = ({ size, tone, className }: { size: number; tone: Tone; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path className={`sparkle-${tone}`} d={STAR} />
  </svg>
);

/** The six sparkles around a Saved chip, each placed by its class (sp1–sp6). */
const SPARKLES: { size: number; tone: Tone }[] = [
  { size: 12, tone: "gold" },
  { size: 7, tone: "lilac" },
  { size: 8, tone: "lilac" },
  { size: 7, tone: "gold" },
  { size: 6, tone: "lilac" },
  { size: 5, tone: "white" },
];

/**
 * Saved as a pill on the name line. Once money is saved it is the row's most
 * eye-catching part (solid purple, a star and sparkles), to encourage
 * saving; at $0.00 it is quiet.
 */
export function SavedChip({ cents }: { cents: number }) {
  if (cents <= 0) {
    return (
      <span className="saved-chip">
        Saved <Money cents={cents} />
      </span>
    );
  }
  return (
    <span className="saved-chip sparkle">
      <Star size={15} tone="gold" className="star" />
      Saved <Money cents={cents} />
      {SPARKLES.map((star, i) => (
        <Star key={i} {...star} className={`star sp sp${i + 1}`} />
      ))}
    </span>
  );
}
