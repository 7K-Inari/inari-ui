import Form, { type IChangeEvent } from "@rjsf/core";
import type {
  FieldTemplateProps,
  RJSFSchema,
  UiSchema,
  WidgetProps,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FieldTemplate({
  id,
  label,
  required,
  description,
  errors,
  children,
  displayLabel,
}: FieldTemplateProps) {
  return (
    <div className="space-y-1.5">
      {displayLabel && label && (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      )}
      {children}
      {description}
      {errors}
    </div>
  );
}

function TextWidget({ id, value, required, disabled, onChange, placeholder }: WidgetProps) {
  return (
    <Input
      id={id}
      value={(value as string) ?? ""}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
}

function NumberWidget({ id, value, required, disabled, onChange, schema }: WidgetProps) {
  return (
    <Input
      id={id}
      type="number"
      value={value === undefined || value === null ? "" : String(value)}
      required={required}
      disabled={disabled}
      min={schema.minimum as number | undefined}
      max={schema.maximum as number | undefined}
      onChange={(e) => {
        if (e.target.value === "") return onChange(undefined);
        const n = Number(e.target.value);
        onChange(Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}

function CheckboxWidget({ id, value, required, disabled, onChange, label }: WidgetProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-primary"
        checked={Boolean(value)}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function TextareaWidget({ id, value, required, disabled, onChange, placeholder }: WidgetProps) {
  return (
    <textarea
      id={id}
      className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      value={(value as string) ?? ""}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
}

function SelectWidget({ id, value, required, disabled, onChange, options }: WidgetProps) {
  return (
    <select
      id={id}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      value={value === undefined || value === null ? "" : String(value)}
      required={required}
      disabled={disabled}
      onChange={(e) => {
        const opt = options.enumOptions?.find((o) => String(o.value) === e.target.value);
        onChange(opt ? opt.value : undefined);
      }}
    >
      <option value="">Select…</option>
      {options.enumOptions?.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ErrorListTemplate({ errors }: { errors?: { stack: string }[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <ul className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {errors.map((e, i) => (
        <li key={i}>{e.stack}</li>
      ))}
    </ul>
  );
}

export interface SchemaFormProps {
  schema: Record<string, unknown>;
  uiSchema?: UiSchema;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  className?: string;
}

export interface SchemaFormHandle {
  validate: () => boolean;
}

export const SchemaForm = React.forwardRef<SchemaFormHandle, SchemaFormProps>(
  function SchemaForm({ schema, uiSchema, formData, onChange, className }, ref) {
    const formRef = React.useRef<Form>(null);

    React.useImperativeHandle(ref, () => ({
      validate: () => {
        formRef.current?.validateForm();
        const result = validator.validateFormData(formData, schema as RJSFSchema);
        return result.errors.length === 0;
      },
    }));

    return (
      <div className={cn("schema-form", className)}>
        <Form
          ref={formRef}
          schema={schema as RJSFSchema}
          uiSchema={uiSchema}
          formData={formData}
          validator={validator}
          widgets={{
            TextWidget,
            UpDownWidget: NumberWidget,
            CheckboxWidget,
            TextareaWidget,
            SelectWidget,
          }}
          templates={{
            FieldTemplate,
            ErrorListTemplate,
            ButtonTemplates: { SubmitButton: () => null },
          }}
          liveValidate={false}
          noHtml5Validate
          onChange={(e: IChangeEvent) => onChange((e.formData ?? {}) as Record<string, unknown>)}
          onSubmit={() => undefined}
        >
          <span />
        </Form>
      </div>
    );
  },
);
