export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="stepper" aria-label="Wizard progress">
      {steps.map((label, i) => (
        <li
          key={label}
          className={`step${i === current ? " active" : ""}${i < current ? " completed" : ""}`}
          aria-current={i === current ? "step" : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}
