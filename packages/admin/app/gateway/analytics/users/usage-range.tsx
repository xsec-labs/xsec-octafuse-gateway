'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ControlButton, Field, Input } from '@xsec/ui-react';
import { useBusinessTimezone } from '@/components/BusinessTimezoneProvider';
import { formatBusinessTimezoneLabel, utcApiToZonedInput, zonedInputToUtcApi } from '@/lib/business-timezone-client';
import { GATEWAY_CALENDAR_PRESETS, GATEWAY_TIME_RANGE_PRESETS, calendarRangeToParams, rangeToParams, type GatewayTimeRangeValue } from '@/lib/analytics-range';

/** Local drafts belong to the applied range/timezone; changing either creates a new draft scope. */
export function UsageRange({ value, onChange }: { value: GatewayTimeRangeValue; onChange: (value: GatewayTimeRangeValue) => void }) {
  const timezone = useBusinessTimezone();
  return <RangeFields key={`${timezone}\n${value.start_date}\n${value.end_date}`} value={value} onChange={onChange} timezone={timezone} />;
}
function RangeFields({ value, onChange, timezone }: { value: GatewayTimeRangeValue; onChange: (value: GatewayTimeRangeValue) => void; timezone: string }) {
  const t = useTranslations('timeRange'), common = useTranslations('common'), logs = useTranslations('analytics.userUsage');
  const [start, setStart] = useState(() => utcApiToZonedInput(value.start_date, timezone));
  const [end, setEnd] = useState(() => utcApiToZonedInput(value.end_date, timezone));
  const [invalid, setInvalid] = useState(false);
  const apply = () => {
    const start_date = zonedInputToUtcApi(start, timezone), end_date = zonedInputToUtcApi(end, timezone);
    if (!start_date || !end_date || start_date > end_date) { setInvalid(true); return; }
    setInvalid(false);
    onChange({preset: 'custom', start_date, end_date});
  };
  return <section className="user-usage-range" aria-label={t('label', {timezone: formatBusinessTimezoneLabel(timezone)})}>
    <p className="xui-label">{t('label', {timezone: formatBusinessTimezoneLabel(timezone)})}</p>
    <div className="user-usage-range-actions">
      <div className="user-usage-presets">{GATEWAY_TIME_RANGE_PRESETS.map(preset => <ControlButton key={preset} variant={value.preset === preset ? 'secondary' : 'ghost'} aria-pressed={value.preset === preset} onClick={() => onChange({preset, ...rangeToParams(preset)})}>{t(`presets.${preset}`)}</ControlButton>)}</div>
      <div className="user-usage-presets">{GATEWAY_CALENDAR_PRESETS.map(preset => <ControlButton key={preset} variant={value.preset === preset ? 'secondary' : 'ghost'} aria-pressed={value.preset === preset} onClick={() => onChange({preset, ...calendarRangeToParams(preset, timezone)})}>{t(`calendar.${preset}`)}</ControlButton>)}</div>
      <Field label={t('start')} error={invalid ? logs('feedback.invalidRange') : undefined}>{props => <Input {...props} type="datetime-local" value={start} onChange={event => setStart(event.target.value)} />}</Field>
      <Field label={t('end')} error={invalid ? logs('feedback.invalidRange') : undefined}>{props => <Input {...props} type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} />}</Field>
      <ControlButton onClick={apply}>{common('apply')}</ControlButton>
    </div>
  </section>;
}
