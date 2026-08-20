import type { ComponentType } from 'react';
import type { SlotContribution } from './types';
import type { Cluster } from '../host/api';

export interface ClusterTabSlotProps {
  cluster: Cluster;
}

export interface ClusterTabOptions {
  title: string;
}

export const ClusterTabBlueprint = (params: {
  name: string;
  title: string;
  component: ComponentType<ClusterTabSlotProps>;
}): SlotContribution<'cluster-tab', ClusterTabSlotProps, ClusterTabOptions> => ({
  kind: 'cluster-tab',
  name: params.name,
  props: {} as ClusterTabSlotProps,
  options: { title: params.title },
  component: params.component,
});
