import { useId, useState, type KeyboardEvent } from "react";
import { MAX_PAYEE_NAME, type Payee } from "../models/payees";

/**
 * The transaction form's Payee field: free text, with the household's saved
 * payees that match what is typed dropping down under it (`suggest`, see
 * `suggestPayees`). Tap one, or use the arrow keys and Enter; Enter with
 * none highlighted saves the form as usual, and Escape closes the list.
 */
export function PayeePicker({
  value,
  onChange,
  suggest,
}: {
  value: string;
  onChange: (payee: string) => void;
  suggest: (typed: string) => Payee[];
}) {
  const id = useId();
  const listId = `${id}-list`;
  // The list shows only while typing in the field; -1 = nothing highlighted.
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = open ? suggest(value) : [];
  const shown = matches.length > 0;

  const choose = (payee: Payee) => {
    onChange(payee.name);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      if (!shown) return;
      // Steps through the matches and back to none highlighted (-1).
      const step = event.key === "ArrowDown" ? 1 : -1;
      const places = matches.length + 1;
      setActive(((active + 1 + step + places) % places) - 1);
    } else if (event.key === "Enter" && shown && matches[active]) {
      // Picks the highlighted payee (not submit the form).
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape" && shown) {
      // Closes the list only, not the dialog around it.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="field field-payee payee-picker">
      <label htmlFor={id}>Payee</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && matches[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        maxLength={MAX_PAYEE_NAME}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {shown && (
        <ul className="picker-list" id={listId} role="listbox" aria-label="Suggestions">
          {matches.map((payee, index) => (
            <li
              key={payee.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              className="picker-option"
              // Keeps focus in the field, so its blur does not close the list first.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(payee)}
            >
              <span className="picker-name">{payee.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
