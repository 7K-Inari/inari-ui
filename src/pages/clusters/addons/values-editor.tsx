import * as React from "react";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import YAML from "yaml";

// Compiling a schema is the expensive part of ajv; cache validators per
// schema object so per-keystroke validation stays cheap. WeakMap keys let
// catalog refetches (new schema objects) evict naturally.
const validatorCache = new WeakMap<object, ValidateFunction>();

function validatorFor(schema: Record<string, unknown>): ValidateFunction {
  let v = validatorCache.get(schema);
  if (!v) {
    v = new Ajv({ allErrors: true, strict: false }).compile(schema);
    validatorCache.set(schema, v);
  }
  return v;
}

export interface ValuesEditorState {
  text: string;
  // Parsed values object; null while the YAML does not parse.
  values: Record<string, unknown> | null;
  errors: string[];
}

// YAML values validation for cluster addons (Feature C decision 4): parses
// YAML client-side and validates the result against the catalog item's
// values.schema.json for the selected version. No schema = lenient allow.
export function validateValuesText(
  text: string,
  schema: Record<string, unknown> | null,
): ValuesEditorState {
  let parsed: unknown;
  try {
    parsed = YAML.parse(text);
  } catch (err) {
    return {
      text,
      values: null,
      errors: [
        `Invalid YAML: ${err instanceof Error ? err.message.split("\n")[0] : "parse error"}`,
      ],
    };
  }
  if (parsed === null || parsed === undefined) parsed = {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return { text, values: null, errors: ["Values must be a YAML mapping (object)"] };
  }
  const values = parsed as Record<string, unknown>;
  if (!schema || Object.keys(schema).length === 0) {
    return { text, values, errors: [] };
  }
  const validate = validatorFor(schema);
  if (validate(values)) return { text, values, errors: [] };
  const errors = (validate.errors ?? []).map(
    (e: ErrorObject) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`,
  );
  return { text, values, errors };
}

export interface ValuesEditorProps {
  id: string;
  value: string;
  schema: Record<string, unknown> | null;
  disabled?: boolean;
  onChange: (text: string) => void;
}

// Presentational YAML editor with inline parse/schema errors. Parents compute
// validity themselves via validateValuesText(value, schema).
export function ValuesEditor({ id, value, schema, disabled, onChange }: ValuesEditorProps) {
  const { errors } = React.useMemo(() => validateValuesText(value, schema), [value, schema]);

  return (
    <div className="space-y-1.5">
      <textarea
        id={id}
        className="input font-mono w-full"
        rows={10}
        spellCheck={false}
        value={value}
        disabled={disabled}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length > 0 ? `${id}-errors` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {errors.length > 0 && (
        <ul id={`${id}-errors`} className="text-sm u-danger space-y-0.5">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
      {schema && Object.keys(schema).length > 0 && errors.length === 0 && (
        <p className="text-xs u-muted">Validated against the version&apos;s values schema.</p>
      )}
    </div>
  );
}
