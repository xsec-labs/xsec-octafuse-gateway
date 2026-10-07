'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ControlButton, Field, Input } from '@xsec/ui-react';
import { useBusinessTimezone } from '@/components/BusinessTimezoneProvider';
import { formatBusinessTimezoneLabel, utcApiToZonedInput, zonedInputToUtcApi } from '@/lib/business-timezone-client';
import { GATEWAY_CALENDAR_PRESETS, GATEWAY_TIME_RANGE_PRESETS, calendarRangeToParams, rangeToParams, type GatewayCalendarPreset, type GatewayRollingPreset, type GatewayTimeRangeValue } from '@/lib/analytics-range';
import './gateway-time-range.css';

export type GatewayDashboardStatsRange = Exclude<GatewayRollingPreset, '90d'>;
export type GatewayTimeRangePickerProps = {
 value: GatewayTimeRangeValue; onChange: (next: GatewayTimeRangeValue) => void;
 presets?: GatewayDashboardStatsRange[]; calendarPresets?: GatewayCalendarPreset[];
 label?: string; timeZone?: string; align?: 'start' | 'end'; className?: string;
};
/** Applied UTC range and business timezone define the local draft lifetime. */
export function GatewayTimeRangePicker(props: GatewayTimeRangePickerProps) {
 const context = useBusinessTimezone(), timeZone = props.timeZone ?? context;
 return <RangeFields key={`${timeZone}\n${props.value.start_date}\n${props.value.end_date}`} {...props} timeZone={timeZone}/>;
}
function RangeFields({ value, onChange, presets = [...GATEWAY_TIME_RANGE_PRESETS], calendarPresets = [...GATEWAY_CALENDAR_PRESETS], label, timeZone, align = 'start', className = '' }: GatewayTimeRangePickerProps & { timeZone: string }) {
 const t = useTranslations('timeRange'), common = useTranslations('common'), logs = useTranslations('requestLogs');
 const [start, setStart] = useState(() => utcApiToZonedInput(value.start_date,timeZone)), [end, setEnd] = useState(() => utcApiToZonedInput(value.end_date,timeZone));
 const [invalid, setInvalid] = useState(false), first = useRef<HTMLInputElement>(null);
 const resolvedLabel = label ?? t('label',{timezone:formatBusinessTimezoneLabel(timeZone)});
 const apply = () => {
  const start_date = zonedInputToUtcApi(start,timeZone), end_date = zonedInputToUtcApi(end,timeZone);
  if (!start_date || !end_date || start_date > end_date) { setInvalid(true); first.current?.focus(); return; }
  setInvalid(false); onChange({preset:'custom',start_date,end_date});
 };
 return <section className={`gateway-time-range ${className}`} data-align={align} aria-label={resolvedLabel}>
  <p className="xui-label">{resolvedLabel}</p><div className="gateway-time-range-actions">
   <div className="gateway-time-presets">{presets.map(preset=><ControlButton key={preset} variant={value.preset===preset?'secondary':'ghost'} aria-pressed={value.preset===preset} onClick={()=>onChange({preset,...rangeToParams(preset)})}>{t(`presets.${preset}`)}</ControlButton>)}</div>
   {calendarPresets.length?<div className="gateway-time-presets">{calendarPresets.map(preset=><ControlButton key={preset} variant={value.preset===preset?'secondary':'ghost'} aria-pressed={value.preset===preset} onClick={()=>onChange({preset,...calendarRangeToParams(preset,timeZone)})}>{t(`calendar.${preset}`)}</ControlButton>)}</div>:null}
   <Field label={t('start')} error={invalid?logs('feedback.invalidRange'):undefined}>{props=><Input {...props} ref={first} type="datetime-local" value={start} onChange={event=>{setStart(event.target.value);setInvalid(false);}}/>}</Field>
   <Field label={t('end')} error={invalid?logs('feedback.invalidRange'):undefined}>{props=><Input {...props} type="datetime-local" value={end} onChange={event=>{setEnd(event.target.value);setInvalid(false);}}/>}</Field>
   <ControlButton onClick={apply}>{common('apply')}</ControlButton>
  </div>
 </section>;
}
