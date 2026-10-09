'use client';
import type { ReactNode } from 'react';
import { Checkbox } from '@xsec/ui-react';
import { useId } from 'react';

export function AuditFilter({label, options, selected, onChange, actions, count, disabled = false}: {
  label: string; options: readonly string[]; selected: string[]; onChange: (value: string, checked: boolean) => void;
  actions: ReactNode; count: string; disabled?: boolean;
}) {
  const id = useId();
  return <section className="audit-filter" aria-labelledby={id}>
    <div className="audit-filter-header"><h2 id={id} className="xui-label">{label}</h2><div className="audit-filter-actions">{actions}<span>{count}</span></div></div>
    <div className="audit-filter-choices">{options.map(value => {
      const checked = selected.includes(value);
      return <Checkbox key={value} label={<span className="font-mono">{value}</span>} checked={checked} disabled={disabled || (checked && selected.length === 1)} onCheckedChange={next => onChange(value, next)} className="audit-filter-choice" />;
    })}</div>
  </section>;
}
