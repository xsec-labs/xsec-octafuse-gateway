'use client';
import { ControlButton, Field, Input } from '@xsec/ui-react';

import type { RouteScheduleFormSide, RouteScheduleFormWindow } from '../types';

type Props = {
	windows: RouteScheduleFormSide;
	onChange: (windows: RouteScheduleFormSide) => void;
	addLabel: string;
	emptyLabel: string;
	startLabel: string;
	endLabel: string;
	factorLabel: string;
	removeLabel: string;
};

export function DailyScheduleEditor(props: Props) {
	const {
		windows,
		onChange,
		addLabel,
		emptyLabel,
		startLabel,
		endLabel,
		factorLabel,
		removeLabel,
	} = props;

	const updateRow = (index: number, patch: Partial<RouteScheduleFormWindow>) => {
		onChange(windows.map((w, i) => (i === index ? { ...w, ...patch } : w)));
	};

	return (
		<div className="space-y-2">
			{windows.length === 0 ? (
				<p className="text-xs route-muted">{emptyLabel}</p>
			) : (
				<ul className="space-y-2">
					{windows.map((w, i) => (
						<li
							key={i}
							className="flex flex-wrap items-end gap-2 rounded-md border route-border route-surface p-2"
						>
							<div>
								<Field label={<> {startLabel} </>}>
									{(field) => (
										<Input
											{...field}
											type="text"
											required
											inputMode="numeric"
											placeholder="00:00"
											value={w.start}
											onChange={(e) => updateRow(i, { start: e.target.value })}
										/>
									)}
								</Field>
							</div>
							<div>
								<Field label={<> {endLabel} </>}>
									{(field) => (
										<Input
											{...field}
											type="text"
											required
											inputMode="numeric"
											placeholder="08:00"
											value={w.end}
											onChange={(e) => updateRow(i, { end: e.target.value })}
										/>
									)}
								</Field>
							</div>
							<div>
								<Field label={<> {factorLabel} </>}>
									{(field) => (
										<Input
											{...field}
											type="text"
											required
											inputMode="decimal"
											placeholder="1"
											value={w.factor}
											onChange={(e) => updateRow(i, { factor: e.target.value })}
										/>
									)}
								</Field>
							</div>
							<ControlButton
								variant="outline"
								size="sm"
								type="button"
								onClick={() => onChange(windows.filter((_, j) => j !== i))}
							>
								{removeLabel}
							</ControlButton>
						</li>
					))}
				</ul>
			)}
			<ControlButton
				variant="outline"
				size="sm"
				type="button"
				onClick={() => onChange([...windows, { start: '00:00', end: '08:00', factor: '1' }])}
			>
				{addLabel}
			</ControlButton>
		</div>
	);
}
