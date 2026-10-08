import Form, { type IChangeEvent } from "@rjsf/core";
import type {
  FieldTemplateProps,
  RJSFSchema,
  UiSchema,
  WidgetProps,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import * as React from "react";

import { Checkbox, Input } from "7k-design-system/react";

import { SlotBoundary } from "@/ext/slot-boundary";
import { useExtensionFormWidgets } from "@/ext/slots";
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
    <div className="form-group">
      {displayLabel && label && (
        <label htmlFor={id} className="form-label">
          {label}
          {required ? <span className="field-required"> *</span> : null}
        </label>
      )}
      {children}
      {description}
      {errors}
    </div>
  );
}

function TextWidget({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  placeholder,
}: WidgetProps) {
  return (
    <Input
      id={id}
      value={(value as string) ?? ""}
      required={required}
      disabled={disabled || readonly}
      placeholder={placeholder}
      onChange={(v) => onChange(v === "" ? undefined : v)}
    />
  );
}

function NumberWidget({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  schema,
}: WidgetProps) {
  return (
    <Input
      id={id}
      type="number"
      value={value === undefined || value === null ? "" : String(value)}
      required={required}
      disabled={disabled || readonly}
      min={schema.minimum as number | undefined}
      max={schema.maximum as number | undefined}
      onChange={(v) => {
        if (v === "") return onChange(undefined);
        const n = Number(v);
        onChange(Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}

function CheckboxWidget({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  label,
}: WidgetProps) {
  return (
    <Checkbox
      id={id}
      checked={Boolean(value)}
      required={required}
      disabled={disabled || readonly}
      onChange={(e) => onChange(e.target.checked)}
      label={label}
    />
  );
}

function TextareaWidget({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  placeholder,
}: WidgetProps) {
  return (
    <textarea
      id={id}
      className="textarea"
      value={(value as string) ?? ""}
      required={required}
      disabled={disabled || readonly}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : e.target.value)
      }
    />
  );
}

function SelectWidget({
  id,
  value,
  required,
  disabled,
  readonly,
  onChange,
  options,
}: WidgetProps) {
  return (
    <select
      id={id}
      className="select-native"
      value={value === undefined || value === null ? "" : String(value)}
      required={required}
      disabled={disabled || readonly}
      onChange={(e) => {
        const opt = options.enumOptions?.find(
          (o) => String(o.value) === e.target.value,
        );
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
    <ul className="alert alert-danger schema-form-errors">
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
  disabled?: boolean;
  className?: string;
}

export interface SchemaFormHandle {
  validate: () => boolean;
}

export const SchemaForm = React.forwardRef<SchemaFormHandle, SchemaFormProps>(
  function SchemaForm(
    { schema, uiSchema, formData, onChange, disabled, className },
    ref,
  ) {
    const formRef = React.useRef<Form>(null);
    const extensionWidgets = useExtensionFormWidgets();

    React.useImperativeHandle(ref, () => ({
      validate: () => {
        formRef.current?.validateForm();
        const result = validator.validateFormData(
          formData,
          schema as RJSFSchema,
        );
        return result.errors.length === 0;
      },
    }));

    // Extension widgets load asynchronously; RJSF throws when a ui:widget name
    // is unknown, so wrap the form in a boundary keyed on the widget map — a
    // crash remounts and retries once the extension widgets arrive instead of
    // taking down the page.
    const widgetKey = Object.keys(extensionWidgets).sort().join(",");

    return (
      <div className={cn("schema-form", className)}>
        <SlotBoundary key={widgetKey}>
          <Form
            ref={formRef}
            schema={schema as RJSFSchema}
            uiSchema={uiSchema}
            formData={formData}
            disabled={disabled}
            validator={validator}
            widgets={{
              TextWidget,
              UpDownWidget: NumberWidget,
              CheckboxWidget,
              TextareaWidget,
              SelectWidget,
              ...extensionWidgets,
            }}
            templates={{
              FieldTemplate,
              ErrorListTemplate,
              ButtonTemplates: { SubmitButton: () => null },
            }}
            liveValidate={false}
            noHtml5Validate
            onChange={(e: IChangeEvent) =>
              onChange((e.formData ?? {}) as Record<string, unknown>)
            }
            onSubmit={() => undefined}
          >
            <span />
          </Form>
        </SlotBoundary>
      </div>
    );
  },
);
