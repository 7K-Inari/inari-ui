import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { WidgetProps } from "@rjsf/utils";
import type {
  ClusterTabOptions,
  FormWidgetSlotProps,
  InstanceActionProps,
  NavItemProps,
  PageOptions,
  PageSlotProps,
  SlotContext,
} from "@7k-inari/ui-plugin-sdk";

import type { CatalogItemSummary, ResourceInstanceSummary } from "@/api/types";
import { Button, Spinner } from "7k-design-system/react";
import { SlotBoundary } from "@/ext/slot-boundary";
import { toSdkCatalogItem, toSdkResourceInstance } from "@/ext/mappers";
import { useSlots, type SlotBinding } from "@/ext/registry";
import { tenantLink } from "@/tenant/tenant-link";

// Slot host components: render typed blueprint contributions (§8.4) from ready
// extensions, each wrapped in a SlotBoundary so a failing remote degrades
// gracefully.

export function slotId(binding: SlotBinding): string {
  return `${binding.extensionName}:${binding.slot.name}`;
}

/* NavItem slot ----------------------------------------------------------- */

export function ExtensionNavItems({ tenant, onNavigate }: { tenant: string; onNavigate?: () => void }) {
  const items = useSlots("nav-item");
  if (items.length === 0) return null;
  return (
    <ul>
      {items.map((binding) => {
        const props = binding.slot.props as NavItemProps;
        const Icon = props.icon as React.ComponentType<{ size?: number; className?: string }> | undefined;
        return (
          <li key={slotId(binding)}>
            <NavLink
              to={tenantLink(tenant, `ext/${props.path}`)}
              onClick={onNavigate}
              className={({ isActive }) =>
                `nav-item nav-item-accent${isActive ? " active" : ""}`
              }
            >
              {Icon ? <Icon size={16} aria-hidden="true" /> : null}
              <span className="sidebar-item-label">{props.title}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

/* Page slot -------------------------------------------------------------- */

export function ExtensionPageHost({ context }: { context: SlotContext }) {
  const pages = useSlots("page");
  const { pathname } = useLocation();
  const match = pages.find((binding) => {
    const options = binding.slot.options as PageOptions;
    return pathname.endsWith(`/ext/${options.path}`);
  });
  if (!match) {
    return (
      <p className="text-sm u-muted">
        No extension page is registered for this path.
      </p>
    );
  }
  const Component = match.slot.component;
  return (
    <SlotBoundary extensionName={match.extensionName}>
      {Component ? <Component context={context} /> : null}
    </SlotBoundary>
  );
}

/* CatalogCard slot -------------------------------------------------------- */

export function CatalogCardSlots({ item }: { item: CatalogItemSummary }) {
  const cards = useSlots("catalog-card");
  if (cards.length === 0) return null;
  const sdkItem = toSdkCatalogItem(item);
  return (
    <>
      {cards.map((binding) => {
        const Component = binding.slot.component;
        return (
          <SlotBoundary key={slotId(binding)} extensionName={binding.extensionName}>
            {Component ? <Component catalogItem={sdkItem} /> : null}
          </SlotBoundary>
        );
      })}
    </>
  );
}

/* ClusterTab slot --------------------------------------------------------- */

export interface ClusterTabContribution {
  id: string;
  title: string;
  extensionName: string;
  component: React.ComponentType<Record<string, unknown>>;
}

export function useClusterTabSlots(): ClusterTabContribution[] {
  const tabs = useSlots("cluster-tab");
  return tabs.map((binding) => ({
    id: slotId(binding),
    title: (binding.slot.options as ClusterTabOptions).title,
    extensionName: binding.extensionName,
    component: binding.slot.component as React.ComponentType<Record<string, unknown>>,
  }));
}

/* InstanceAction slot ------------------------------------------------------ */

export function InstanceActionButtons({
  instance,
}: {
  instance: ResourceInstanceSummary;
}) {
  const actions = useSlots("instance-action");
  const [running, setRunning] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  if (actions.length === 0) {
    return <p className="px-1 py-2 u-muted">No extension actions available.</p>;
  }
  const sdkInstance = toSdkResourceInstance(instance);

  return (
    <div className="flex flex-col gap-1">
      {actions.map((binding) => {
        const props = binding.slot.props as InstanceActionProps;
        const id = slotId(binding);
        return (
          <div key={id}>
            <Button
              variant="ghost"
              size="sm"
              className="instance-action-btn"
              disabled={running !== null}
              onClick={async () => {
                setRunning(id);
                setErrors((prev) => ({ ...prev, [id]: "" }));
                try {
                  await props.run(sdkInstance);
                } catch (err) {
                  setErrors((prev) => ({
                    ...prev,
                    [id]: err instanceof Error ? err.message : "Action failed",
                  }));
                } finally {
                  setRunning(null);
                }
              }}
            >
              {running === id ? <Spinner size="sm" /> : null}{running === id ? " Running…" : props.label}
            </Button>
            {errors[id] ? (
              <p className="px-3 text-xs u-danger" role="alert">
                {errors[id]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* FormWidget slot ---------------------------------------------------------- */

// Extension form widgets adapt the SDK widget contract onto RJSF's WidgetProps.
export function useExtensionFormWidgets(): Record<string, React.ComponentType<WidgetProps>> {
  const widgets = useSlots("form-widget");
  return React.useMemo(() => {
    const map: Record<string, React.ComponentType<WidgetProps>> = {};
    for (const binding of widgets) {
      const Component = binding.slot.component;
      if (!Component) continue;
      map[binding.slot.name] = function ExtensionWidgetAdapter(props: WidgetProps) {
        const slotProps: FormWidgetSlotProps = {
          value: props.value,
          onChange: props.onChange,
          schema: props.schema as Record<string, unknown>,
          disabled: props.disabled,
        };
        return (
          <SlotBoundary extensionName={binding.extensionName}>
            <Component {...slotProps} />
          </SlotBoundary>
        );
      };
    }
    return map;
  }, [widgets]);
}

export type { PageSlotProps };
