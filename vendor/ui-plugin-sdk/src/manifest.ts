import { z } from 'zod';

const nameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'name must be kebab-case');

const slotContributionSchema = z.object({
  kind: z.enum([
    'nav-item',
    'catalog-card',
    'cluster-tab',
    'instance-action',
    'form-widget',
    'page',
  ]),
  name: nameSchema,
});

export const extensionManifestSchema = z.object({
  name: nameSchema,
  version: z.string().min(1),
  kind: z.literal('ui'),
  title: z.string().optional(),
  description: z.string().optional(),
  slots: z.array(slotContributionSchema).min(1),
});

export type ExtensionManifestInput = z.input<typeof extensionManifestSchema>;
export type ParsedExtensionManifest = z.output<typeof extensionManifestSchema>;

export function parseExtensionManifest(input: unknown): ParsedExtensionManifest {
  return extensionManifestSchema.parse(input);
}
