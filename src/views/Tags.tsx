import { useId, useRef, useState, type KeyboardEvent } from "react";
import { messageOf } from "../controllers/errors";
import { ErrorMessage } from "./components";
import {
  MAX_TAGS_PER_TRANSACTION,
  TAG_COLORS,
  exactTag,
  matchTags,
  sortTags,
  type Tag,
  type TagColor,
} from "../models/tags";

/** One tag as a small coloured pill; with onRemove it has a × button. */
export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span className={`tag-chip tag-${tag.color}`}>
      <span className="tag-name">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          className="tag-remove"
          aria-label={`Remove tag ${tag.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}

/** A transaction's tags in a row (nothing when it has none). */
export function TagChips({ tags, className = "" }: { tags: Tag[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={`tag-chips ${className}`} aria-label="Tags">
      {tags.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
    </span>
  );
}

/** Choosing a tag's colour: a row of round swatches (radio buttons). */
export function TagColorPicker({
  value,
  onChange,
  label = "Colour",
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  label?: string;
}) {
  const name = useId();
  return (
    <fieldset className="tag-colors">
      <legend>{label}</legend>
      {TAG_COLORS.map((color) => (
        <label key={color} className={`tag-swatch tag-${color}`} title={color}>
          <input
            type="radio"
            name={name}
            value={color}
            checked={value === color}
            aria-label={color}
            onChange={() => onChange(color)}
          />
        </label>
      ))}
    </fieldset>
  );
}

type Choice = { kind: "tag"; tag: Tag } | { kind: "create"; name: string };

/**
 * Choosing tags by typing: chosen tags show as chips, and the field's
 * matches drop down under it. Typing a name no tag has offers to create it
 * (onCreate saves it and resolves to its id); the list closes after each
 * pick. Backspace in an empty field takes the last tag off.
 */
export function TagPicker({
  label = "Tags",
  tags,
  value,
  onChange,
  onCreate,
}: {
  label?: string;
  tags: Tag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
  onCreate?: (name: string) => Promise<string>;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const open = typed !== null;
  const chosen = sortTags(tags.filter((t) => value.includes(t.id)));
  const full = value.length >= MAX_TAGS_PER_TRANSACTION;

  const text = typed?.trim() ?? "";
  const choices: Choice[] = open
    ? [
        ...matchTags(tags, typed, value).map((tag) => ({ kind: "tag" as const, tag })),
        ...(onCreate && text && !exactTag(tags, text)
          ? [{ kind: "create" as const, name: text }]
          : []),
      ]
    : [];
  const activeChoice = choices[active];

  const pick = async (choice: Choice | undefined) => {
    if (!choice || creating) return;
    setError(null);
    if (choice.kind === "tag") {
      onChange([...value, choice.tag.id]);
    } else {
      setCreating(true);
      try {
        const newId = await onCreate!(choice.name);
        onChange([...value, newId]);
      } catch (e) {
        setError(messageOf(e));
        return;
      } finally {
        setCreating(false);
      }
    }
    // Closed after each pick, so the list never covers the form's buttons;
    // typing again (or the arrow keys) opens it for another tag.
    setTyped(null);
    setActive(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setTyped("");
      if (choices.length > 0) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((active + step + choices.length) % choices.length);
      }
    } else if (event.key === "Enter" && open) {
      // Adds the typed or highlighted tag (does not submit the form).
      event.preventDefault();
      const exact = exactTag(tags, text);
      if (exact && value.includes(exact.id)) return setTyped(null);
      void pick(exact ? { kind: "tag", tag: exact } : activeChoice);
    } else if (event.key === "Escape" && open) {
      // Closes the list only, not the dialog around it.
      event.preventDefault();
      event.stopPropagation();
      setTyped(null);
    } else if (event.key === "Backspace" && !typed && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="field tag-picker">
      <label htmlFor={id}>{label}</label>
      <div
        className="tag-box"
        // A tap on the box (not on a chip's ×) goes to the typing field.
        onClick={(event) => event.target === event.currentTarget && input.current?.focus()}
      >
        {chosen.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            onRemove={() => onChange(value.filter((t) => t !== tag.id))}
          />
        ))}
        {!full && (
          <input
            ref={input}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && activeChoice ? `${id}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={chosen.length ? "" : onCreate ? "Type to find or add a tag" : "Type a tag"}
            value={typed ?? ""}
            disabled={creating}
            onFocus={() => setTyped((t) => t ?? "")}
            onChange={(event) => {
              setTyped(event.target.value);
              setActive(0);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setTyped(null)}
          />
        )}
      </div>
      {open && (choices.length > 0 || text) && (
        <ul className="picker-list" id={listId} role="listbox" aria-label="Tags to add">
          {choices.length === 0 && <li className="picker-empty">No tag matches “{text}”</li>}
          {choices.map((choice, index) => (
            <li
              key={choice.kind === "tag" ? choice.tag.id : "create"}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              className="picker-option"
              // Keeps focus in the field, so the list stays open for another tag.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => void pick(choice)}
            >
              {choice.kind === "tag" ? (
                <TagChip tag={choice.tag} />
              ) : (
                <span className="picker-name">Add tag “{choice.name}”</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
