import * as React from "react";

interface PageHeaderProps {
  breadcrumb: string;
  title: React.ReactNode;
  lede?: string;
  actions?: React.ReactNode;
  stackActionsOnMobile?: boolean;
}

export function PageHeader({ breadcrumb, title, lede, actions, stackActionsOnMobile }: PageHeaderProps) {
  return (
    <header className="page-header">
      <span className="mono-label page-header-breadcrumb">{breadcrumb}</span>
      <div className={`page-header-row${stackActionsOnMobile ? " flex-wrap" : ""}`}>
        <h1 className="page-header-title">{title}</h1>
        {actions && <div className={`page-header-actions${stackActionsOnMobile ? " w-full sm:w-auto" : ""}`}>{actions}</div>}
      </div>
      {lede && <p className="page-header-lede">{lede}</p>}
    </header>
  );
}
