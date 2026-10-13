import * as React from "react";

interface PageHeaderProps {
  breadcrumb: string;
  title: React.ReactNode;
  lede?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ breadcrumb, title, lede, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <span className="mono-label page-header-breadcrumb">{breadcrumb}</span>
      <div className="page-header-row">
        <h1 className="page-header-title">{title}</h1>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {lede && <p className="page-header-lede">{lede}</p>}
    </header>
  );
}
