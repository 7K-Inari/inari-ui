import type { ComponentType } from 'react';
import type { SlotContribution } from './types';

export interface FormWidgetSlotProps<T = unknown> {
  value: T | undefined;
  onChange: (value: T) => void;
  schema: Record<string, unknown>;
  disabled?: boolean;
}

export const FormWidgetBlueprint = <T = unknown>(params: {
  name: string;
  component: ComponentType<FormWidgetSlotProps<T>>;
  schemaType?: string;
}): SlotContribution<'form-widget', FormWidgetSlotProps<T>> => ({
  kind: 'form-widget',
  name: params.name,
  props: {} as FormWidgetSlotProps<T>,
  component: params.component as ComponentType<FormWidgetSlotProps<T>>,
});
