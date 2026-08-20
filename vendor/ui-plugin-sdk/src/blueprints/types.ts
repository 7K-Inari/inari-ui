import type { ComponentType } from 'react';

export const SLOT_KINDS = [
  'nav-item',
  'catalog-card',
  'cluster-tab',
  'instance-action',
  'form-widget',
  'page',
] as const;

export type SlotKind = (typeof SLOT_KINDS)[number];

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SlotContribution<K extends SlotKind = SlotKind, P = unknown, O = unknown> {
  readonly kind: K;
  readonly name: string;
  readonly props: P;
  readonly options?: O;
  readonly component?: ComponentType<any>;
}

export type AnySlotContribution = SlotContribution<SlotKind, any, any>;

export interface InariExtension {
  readonly manifest: import('../manifest.js').ParsedExtensionManifest;
  readonly slots: readonly AnySlotContribution[];
}

export interface SlotContext {
  auth: import('../host/auth.js').AuthState;
  tenant: import('../host/tenant.js').TenantState;
}
