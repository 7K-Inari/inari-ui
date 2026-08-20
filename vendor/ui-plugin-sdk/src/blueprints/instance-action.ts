import type { SlotContribution } from './types';
import type { ResourceInstance } from '../host/api';

export interface InstanceActionSlotProps {
  instance: ResourceInstance;
}

export interface InstanceActionProps {
  label: string;
  run: (instance: ResourceInstance) => Promise<void> | void;
}

export const InstanceActionBlueprint = (params: {
  name: string;
  label: string;
  run: (instance: ResourceInstance) => Promise<void> | void;
}): SlotContribution<'instance-action', InstanceActionProps> => ({
  kind: 'instance-action',
  name: params.name,
  props: { label: params.label, run: params.run },
});
