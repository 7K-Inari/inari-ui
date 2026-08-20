import type { ComponentType } from 'react';
import type { SlotContribution } from './types';
import type { CatalogItem } from '../host/api';

export interface CatalogCardSlotProps {
  catalogItem: CatalogItem;
}

export const CatalogCardBlueprint = (params: {
  name: string;
  component: ComponentType<CatalogCardSlotProps>;
}): SlotContribution<'catalog-card', CatalogCardSlotProps> => ({
  kind: 'catalog-card',
  name: params.name,
  props: {} as CatalogCardSlotProps,
  component: params.component,
});
