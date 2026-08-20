import type { ComponentType } from 'react';
import type { SlotContribution } from './types';

export interface NavItemProps {
  title: string;
  path: string;
  icon?: ComponentType;
}

export const NavItemBlueprint = (params: { name: string } & NavItemProps): SlotContribution<'nav-item', NavItemProps> => ({
  kind: 'nav-item',
  name: params.name,
  props: { title: params.title, path: params.path, icon: params.icon },
});
