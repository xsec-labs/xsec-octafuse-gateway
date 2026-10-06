'use client';

import { useTranslations } from 'next-intl';
import '@/app/gateway/models/models.css';
import type { CatalogImagePricingDisplay } from '@/lib/pricing-ui';

const TOKEN_RATE_KEYS = [
	'textInput',
	'cachedText',
	'imageInput',
	'cachedImageInput',
	'imageOutput',
] as const;

type TokenRateKey = (typeof TOKEN_RATE_KEYS)[number];

type Props = {
	display: CatalogImagePricingDisplay | null;
	emptyLabel: string;
	/** 命中顺序说明；`compact` 时默认不展示 */
	resolveHint?: string;
	/** token 分项价块标题 */
	tokenRatesTitle?: string;
	/**
	 * Models 卡片等紧凑场景：省略 resolve 文案。
	 */
	compact?: boolean;
	/** 是否展示 token 分项（路由 / 只读目录） */
	showTokenRates?: boolean;
	/** token 分项布局：`grid` 横向密排；`list` 纵向列表 */
	tokenRatesLayout?: 'grid' | 'list';
};

/** 路由弹窗 / Models 卡片：Image 定价只读（token 分项或 per_image 权威单价） */
export function ReadOnlyImagePricing(props: Props) {
	const {
		display,
		emptyLabel,
		resolveHint,
		tokenRatesTitle,
		compact = false,
		showTokenRates = true,
		tokenRatesLayout = 'list',
	} = props;
	const t = useTranslations('pricing.readOnlyImage');
	const tBilling = useTranslations('pricing.imageBilling');

	if (!display) {
		return <p className="text-sm model-muted">{emptyLabel}</p>;
	}

	if (display.billingKind === 'image_per_image') {
		const inputDefault = display.perImageInputDefault;
		const policy = display.uncertainResultPolicy ?? 'requested';
		return (
			<div className="space-y-2">
				{!compact && resolveHint ? (
					<p className="text-[11px] model-muted leading-relaxed">
						{resolveHint}
					</p>
				) : null}
				<div className="overflow-hidden rounded-md border model-border model-surface">
					<p className="border-b model-border model-subtle px-3 py-1.5 text-[11px] font-medium model-muted">
						{tBilling('modePerImage')}
					</p>
					<ul className="divide-y model-divide text-sm tabular-nums">
						<li className="flex items-baseline justify-between gap-3 px-3 py-2">
							<span className="text-xs model-muted">
								{tBilling('outputDefault')}
							</span>
							<span className="font-medium model-text">
								{display.perImageDefault ?? display.defaultLine}
								<span className="ml-1 text-[10px] font-normal model-muted">
									{display.unit}
								</span>
							</span>
						</li>
						{inputDefault != null && inputDefault !== '' ? (
							<li className="flex items-baseline justify-between gap-3 px-3 py-2">
								<span className="text-xs model-muted">
									{tBilling('inputDefault')}
								</span>
								<span className="font-medium model-text">
									{inputDefault}
									<span className="ml-1 text-[10px] font-normal model-muted">
										{display.unit}
									</span>
								</span>
							</li>
						) : null}
						<li className="flex items-baseline justify-between gap-3 px-3 py-2">
							<span className="text-xs model-muted">
								{tBilling('uncertainPolicy')}
							</span>
							<span className="font-medium model-text">
								{policy === 'zero'
									? tBilling('policyZero')
									: tBilling('policyRequested')}
							</span>
						</li>
					</ul>
				</div>
			</div>
		);
	}

	const rates = display.tokenRates;
	const ratesTitle = tokenRatesTitle ?? t('tokenRatesTitle');

	if (!rates || !showTokenRates) {
		return <p className="text-sm model-muted">{emptyLabel}</p>;
	}

	return (
		<div className="space-y-2">
			{!compact && resolveHint ? (
				<p className="text-[11px] model-muted leading-relaxed">{resolveHint}</p>
			) : null}

			{tokenRatesLayout === 'grid' ? (
				<div>
					<p className="mb-1.5 text-[11px] font-medium model-muted">
						{ratesTitle}
						<span className="ml-1 font-normal model-muted">({rates.unit})</span>
					</p>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
						{TOKEN_RATE_KEYS.map((key) => (
							<div
								key={key}
								className="rounded-md border model-border model-subtle px-2.5 py-2"
								title={`${t(key)} (${rates.unit})`}
							>
								<p className="truncate text-[11px] font-medium model-muted">
									{t(key)}
								</p>
								<p className="mt-1 text-sm font-semibold tabular-nums model-text">
									{rates[key as TokenRateKey]}
								</p>
							</div>
						))}
					</div>
				</div>
			) : (
				<div className="overflow-hidden rounded-md border model-border model-surface">
					<p className="border-b model-border model-subtle px-3 py-1.5 text-[11px] font-medium model-muted">
						{ratesTitle}
						<span className="ml-1 font-normal model-muted">({rates.unit})</span>
					</p>
					<ul className="divide-y model-divide text-sm tabular-nums">
						{TOKEN_RATE_KEYS.map((key) => (
							<li
								key={key}
								className="flex items-baseline justify-between gap-3 px-3 py-2"
							>
								<span className="text-xs model-muted" title={t(`${key}Short`)}>
									{t(key)}
								</span>
								<span className="font-medium model-text">
									{rates[key as TokenRateKey]}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
