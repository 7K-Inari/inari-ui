import type { ExtensionManifestInput } from './manifest';
import { parseExtensionManifest } from './manifest';
import type { AnySlotContribution, InariExtension } from './blueprints/types';

export interface CreateExtensionParams {
  manifest: Omit<ExtensionManifestInput, 'slots'>;
  slots: AnySlotContribution[];
}

export function createExtension(params: CreateExtensionParams): InariExtension {
  const slotDescriptors = params.slots.map((s) => ({ kind: s.kind, name: s.name }));
  const manifest = parseExtensionManifest({ ...params.manifest, slots: slotDescriptors });
  return { manifest, slots: params.slots };
}
