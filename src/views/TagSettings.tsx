import { useState, type FormEvent } from "react";
import { useAsyncAction } from "../controllers/useAsyncAction";
import type { Budget } from "../controllers/useBudget";
import { useTags } from "../controllers/useTags";
import { MAX_TAG_NAME, type Tag, type TagColor } from "../models/tags";
import type { BudgetData } from "../models/types";
import { ErrorMessage } from "./components";
import { TagChip, TagColorPicker } from "./Tags";

/** Settings card: the household's transaction tags. */
export function TagSettings({ budget, data }: { budget: Budget; data: BudgetData }) {
  const page = useTags(budget, data);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const add = useAsyncAction(page.addTag);
  const remove = useAsyncAction(page.deleteTag);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await add.run({ name, color: color ?? page.nextColor })).ok) {
      setName("");
      setColor(null);
    }
  };

  return (
    <section className="list-card" aria-labelledby="tags-title">
      <div className="section-heading">
        <h2 id="tags-title">Tags</h2>
        <span className="section-count">{page.tags.length}</span>
      </div>
      <p className="empty-state">
        Tags label transactions across envelopes, such as a trip, a project or tax-deductible
        spending. Add them here or while entering a transaction, then search for them in an account.
        They change no budget numbers.
      </p>

      {page.tags.length > 0 && (
        <ul className="item-list" aria-label="Tags">
          {page.tags.map((tag) =>
            tag.id === editingId ? (
              <li className="item tag-edit" key={tag.id}>
                <TagEditor
                  tag={tag}
                  onSave={(details) => page.updateTag(tag.id, details)}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li className="item" key={tag.id}>
                <span className="item-title">
                  <TagChip tag={tag} />
                </span>
                <span className="tag-actions">
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Edit tag ${tag.name}`}
                    onClick={() => setEditingId(tag.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button danger"
                    type="button"
                    aria-label={`Delete tag ${tag.name}`}
                    disabled={remove.pending}
                    onClick={() => {
                      const question =
                        tag.uses > 0
                          ? `Delete the tag “${tag.name}”? It comes off ${tag.uses} ${tag.uses === 1 ? "transaction" : "transactions"}; the transactions stay.`
                          : `Delete the tag “${tag.name}”?`;
                      if (window.confirm(question)) void remove.run(tag.id);
                    }}
                  >
                    Delete
                  </button>
                </span>
                <span className="item-detail">
                  {tag.uses === 0
                    ? "Not used yet"
                    : `${tag.uses} ${tag.uses === 1 ? "transaction" : "transactions"}`}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      <ErrorMessage error={remove.error} />

      <form className="form" onSubmit={submit} aria-label="Add a tag">
        <label className="field">
          New tag
          <input
            value={name}
            maxLength={MAX_TAG_NAME}
            placeholder="Beach trip"
            onChange={(e) => {
              setName(e.target.value);
              add.clearError();
            }}
          />
        </label>
        <TagColorPicker value={color ?? page.nextColor} onChange={setColor} />
        <button className="primary-button" type="submit" disabled={add.pending}>
          Add tag
        </button>
        <ErrorMessage error={add.error} />
      </form>
    </section>
  );
}

/** Renaming a tag or changing its colour, in place of its row. */
function TagEditor({
  tag,
  onSave,
  onDone,
}: {
  tag: Tag;
  onSave: (details: { name: string; color: TagColor }) => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const save = useAsyncAction(onSave);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((await save.run({ name, color })).ok) onDone();
  };

  return (
    <form className="form" onSubmit={submit} aria-label={`Edit tag ${tag.name}`}>
      <label className="field">
        Name
        <input
          value={name}
          maxLength={MAX_TAG_NAME}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            save.clearError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDone();
            }
          }}
        />
      </label>
      <TagColorPicker value={color} onChange={setColor} />
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={save.pending}>
          Save
        </button>
        <button className="secondary-button" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
      <ErrorMessage error={save.error} />
    </form>
  );
}
