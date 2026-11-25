import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

type Option = { value: string; label: string };

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="segmented-control">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            className="sr-only"
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Tabs({
  label,
  items,
}: {
  label: string;
  items: readonly [
    { label: string; content: ReactNode },
    ...{ label: string; content: ReactNode }[],
  ];
}) {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = index === 0 ? last : index - 1;
        break;
      case "ArrowRight":
        next = index === last ? 0 : index + 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="tab-list">
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            ref={(button) => {
              buttons.current[index] = button;
            }}
            id={baseId + "-tab-" + index}
            role="tab"
            aria-controls={baseId + "-panel-" + index}
            aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => handleKey(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.label}
          id={baseId + "-panel-" + index}
          role="tabpanel"
          aria-labelledby={baseId + "-tab-" + index}
          tabIndex={0}
          hidden={selected !== index}
          className="tab-panel"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
