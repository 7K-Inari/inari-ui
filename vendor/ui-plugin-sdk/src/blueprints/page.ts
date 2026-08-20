import type { ComponentType } from 'react';
import type { SlotContribution, SlotContext } from './types';

export interface PageSlotProps {
  context: SlotContext;
}

export interface PageOptions {
  path: string;
  title?: string;
}

export const PageBlueprint = (params: {
  name: string;
  path: string;
  title?: string;
  component: ComponentType<PageSlotProps>;
}): SlotContribution<'page', PageSlotProps, PageOptions> => ({
  kind: 'page',
  name: params.name,
  props: {} as PageSlotProps,
  options: { path: params.path, title: params.title },
  component: params.component,
});
