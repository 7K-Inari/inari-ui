import type { ComponentType } from 'react';
import {
  CatalogCardBlueprint,
  ClusterTabBlueprint,
  createExtension,
  FormWidgetBlueprint,
  InstanceActionBlueprint,
  NavItemBlueprint,
  PageBlueprint,
} from '@7k-inari/ui-plugin-sdk';

const Slot: ComponentType<{ name: string }> = ({ name }) => (
  <div data-inari-slot={name}>Compatible {name}</div>
);

export default createExtension({
  manifest: {
    name: 'contract-fixture',
    version: '0.1.0',
    kind: 'ui',
    title: 'Contract fixture',
  },
  slots: [
    NavItemBlueprint({ name: 'contract-nav', title: 'Contract', path: 'contract' }),
    CatalogCardBlueprint({ name: 'contract-card', component: () => <Slot name="contract-card" /> }),
    ClusterTabBlueprint({ name: 'contract-tab', title: 'Contract', component: () => <Slot name="contract-tab" /> }),
    InstanceActionBlueprint({ name: 'contract-action', label: 'Contract action', run: () => {} }),
    FormWidgetBlueprint({ name: 'contract-picker', component: () => <Slot name="contract-picker" /> }),
    PageBlueprint({ name: 'contract-page', path: 'contract', component: () => <Slot name="contract-page" /> }),
  ],
});
