'use client';
import { ControlButton, Dialog, Field, Select } from '@xsec/ui-react';

import ShellError from '@/components/layout/ShellError';
import type { useRoutesPageState } from '../use-routes-page-state';
import '../routes.css';
import { ROUTE_STRATEGY_NAMES } from '@octafuse/core/db/model-route-policy';
import { useTranslations } from 'next-intl';
import { CAPABILITIES_BY_PROTOCOL, isPromptCacheSensitiveCapability } from '../route-utils';
import type { RoutePolicyDialogState, RoutePolicyFormState } from '../types';

type Props = {
	dialog: RoutePolicyDialogState;
	feedback: Pick<ReturnType<typeof useRoutesPageState>, 'actionFailure' | 'strategyReturnFocus'>;
	form: RoutePolicyFormState;
	error: string;
	saving: boolean;
	onClose: () => void;
	onFormChange: (form: RoutePolicyFormState) => void;
	onSave: () => void;
};

const STRATEGY_OPTIONS = ['', ...ROUTE_STRATEGY_NAMES] as const;

export function RoutePolicyDialog(props: Props) {
	const { dialog, form, error, saving, onClose, onFormChange, onSave, feedback } = props;
	const t = useTranslations('routes.strategy');
	const tCommon = useTranslations('common');
	const capabilities = dialog.poolId ? [] : CAPABILITIES_BY_PROTOCOL[dialog.protocol] ?? [];
	const effectiveStrategy = form.protocolStrategy || dialog.inheritedStrategy;
	const activeTargets = dialog.targets.filter((target) => target.active);
	const activePriorities = [...new Set(activeTargets.map((target) => target.priority))].sort(
		(a, b) => b - a
	);

	const strategyLabel = (value: string) => {
		if (!value) return `${t('inherit')} → ${dialog.inheritedStrategy}`;
		if (value === 'affinity') return t('affinity');
		if (value === 'weighted_random') return t('weighted_random');
		if (value === 'strict') return t('strict');
		if (value === 'round_robin') return t('round_robin');
		return value;
	};
	const strategyDescription = (strategy: string) => ({
		summary: t(`description.${strategy}.summary`),
		bestFor: t(`description.${strategy}.bestFor`),
		tradeoff: t(`description.${strategy}.tradeoff`),
	});

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next && !saving) onClose();
			}}
			title={t('title')}
			description={
				dialog.modelTitle +
				' · ' +
				dialog.protocolLabel +
				' · ' +
				(dialog.requestOperation ?? dialog.group)
			}
			preventOutsideDismissal={saving}
			finalFocus={feedback.strategyReturnFocus}
			className="route-dialog route-policy"
			footer={
				<>
					<ControlButton variant="outline" disabled={saving} onClick={onClose}>
						{tCommon('cancel')}
					</ControlButton>
					<ControlButton disabled={saving} loading={saving} onClick={onSave}>
						{tCommon('save')}
					</ControlButton>
				</>
			}
		>
			{feedback.actionFailure ? (
				<ShellError
					title={feedback.actionFailure.title}
					failure={feedback.actionFailure.failure}
					uncertainWrite={feedback.actionFailure.uncertain}
				/>
			) : null}
			<fieldset disabled={saving} className="space-y-4">
				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
						{error}
					</div>
				)}
				{capabilities.length > 0 ? (
					<div>
						<div className="mb-2 text-sm font-medium route-text">{t('capabilityLevel')}</div>
						<p className="mb-3 text-xs leading-relaxed route-muted">{t('capabilityHint')}</p>
						<div className="space-y-3">
							{capabilities.map((cap) => (
								<div key={cap}>
									<Field label={<> {cap} </>}>
										{(field) => (
											<Select
												{...field}
												disabled={saving}
												value={form.capabilityStrategies[cap] ?? ''}
												options={STRATEGY_OPTIONS.map((value) => ({
													value,
													label: strategyLabel(value),
												}))}
												onValueChange={(value) =>
													onFormChange({
														...form,
														capabilityStrategies: {
															...form.capabilityStrategies,
															[cap]: value ?? '',
														},
													})
												}
											/>
										)}
									</Field>
									<p className="mt-1 text-[11px] leading-relaxed route-muted">
										{isPromptCacheSensitiveCapability(cap) ? t('hintCache') : t('hintNoCache')}
									</p>
								</div>
							))}
						</div>
					</div>
				) : null}

				<div>
					<div className="flex items-end justify-between gap-3">
						<div>
							<h3 className="text-sm font-semibold route-text">{t('guideTitle')}</h3>
							<p className="mt-0.5 text-xs route-muted">{t('guideHint')}</p>
						</div>
						<ControlButton
							variant="outline"
							type="button"
							onClick={() => onFormChange({ ...form, protocolStrategy: '' })}
							aria-pressed={!form.protocolStrategy}
							className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
								!form.protocolStrategy
									? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
									: 'route-surface route-muted ring-gray-200 hover:bg-gray-50 hover:text-indigo-700'
							}`}
						>
							{t('inherit')}
						</ControlButton>
					</div>
					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						{ROUTE_STRATEGY_NAMES.map((strategy) => {
							const description = strategyDescription(strategy);
							const selected = effectiveStrategy === strategy;
							return (
								<ControlButton
									variant="outline"
									key={strategy}
									type="button"
									onClick={() => onFormChange({ ...form, protocolStrategy: strategy })}
									aria-pressed={selected}
									data-selected={selected}
									className={`route-policy-choice rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
										selected
											? 'border-indigo-300 bg-indigo-50 ring-1 ring-inset ring-indigo-200'
											: 'route-border route-surface hover:border-indigo-200 hover:bg-slate-50'
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<span className="font-mono text-xs font-semibold route-text">
											{strategyLabel(strategy)}
										</span>
										{selected ? (
											<span className="flex shrink-0 items-center gap-1">
												{!form.protocolStrategy ? (
													<span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
														{t('inherit')}
													</span>
												) : null}
												<span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
													{t('effective')}
												</span>
											</span>
										) : null}
									</div>
									<p className="mt-1.5 text-xs leading-relaxed route-muted">
										{description.summary}
									</p>
									<p className="mt-1 text-[11px] leading-relaxed route-muted">
										<span className="font-medium route-muted">{t('bestFor')}：</span>
										{description.bestFor}
									</p>
									<p className="mt-0.5 text-[11px] leading-relaxed route-muted">
										<span className="font-medium route-muted">{t('tradeoff')}：</span>
										{description.tradeoff}
									</p>
								</ControlButton>
							);
						})}
					</div>
				</div>

				<div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3.5">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h3 className="text-sm font-semibold route-text">{t('effectTitle')}</h3>
							<p className="mt-0.5 text-xs route-muted">{t('effectHint')}</p>
						</div>
						<span className="rounded-md route-surface px-2 py-1 font-mono text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
							{effectiveStrategy}
						</span>
					</div>
					<p className="mt-3 text-xs leading-relaxed route-text">
						{t(`effect.${effectiveStrategy}`)}
					</p>
					<p className="mt-1.5 text-[11px] leading-relaxed route-muted">{t('priorityFirst')}</p>
					<p className="mt-1 text-[11px] leading-relaxed route-muted">{t('runtimeHealthHint')}</p>
					{activeTargets.length <= 1 ? (
						<p className="mt-2 rounded-md route-surface px-2.5 py-2 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
							{t('singleTargetEffect', { count: activeTargets.length })}
						</p>
					) : null}
					{activePriorities.length > 0 ? (
						<div className="mt-3 space-y-2">
							{activePriorities.map((priority, index) => {
								const layer = activeTargets
									.filter((target) => target.priority === priority)
									.sort((a, b) =>
										effectiveStrategy === 'strict'
											? b.weight - a.weight || a.providerId.localeCompare(b.providerId)
											: a.providerName.localeCompare(b.providerName)
									);
								const totalWeight = layer.reduce(
									(sum, target) => sum + Math.max(1, target.weight),
									0
								);
								return (
									<div
										key={priority}
										className="rounded-md border border-emerald-100 route-surface p-2.5"
									>
										<div className="mb-2 flex items-center gap-2">
											<span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
												P{priority}
											</span>
											<span className="text-[10px] font-medium route-muted">
												{index === 0 ? t('firstAttemptLayer') : t('fallbackLayer')}
											</span>
										</div>
										<div className="space-y-1.5">
											{layer.map((target, targetIndex) => (
												<div key={target.id} className="flex min-w-0 items-center gap-2 text-xs">
													<span className="w-4 shrink-0 text-right font-mono text-[10px] route-muted">
														{effectiveStrategy === 'strict' ? targetIndex + 1 : '•'}
													</span>
													<span className="min-w-0 flex-1 truncate font-medium route-text">
														{target.providerName}
													</span>
													<span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-700">
														W{target.weight}
													</span>
													{effectiveStrategy === 'weighted_random' ? (
														<span className="w-12 shrink-0 text-right font-mono text-[10px] text-emerald-700">
															{Math.round((Math.max(1, target.weight) / totalWeight) * 100)}%
														</span>
													) : null}
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					) : null}
					{dialog.targets.some((target) => !target.active) ? (
						<p className="mt-2 text-[11px] route-muted">{t('inactiveExcluded')}</p>
					) : null}
				</div>
			</fieldset>
		</Dialog>
	);
}
