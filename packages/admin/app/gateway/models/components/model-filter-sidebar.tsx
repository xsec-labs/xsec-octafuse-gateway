'use client';
import { ControlButton, RadioGroup, Badge } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import { getModelVendorLabel } from '@/lib/model-vendor';
import { ALL_VENDORS_KEY, type ModelKindFilter } from '../types';
type Props = {
	modelCount: number;
	hasActiveFilter: boolean;
	selectedVendorItemsCount: number;
	isAllVendors: boolean;
	selectedVendor: string;
	modelsByVendor: [string, unknown[]][];
	selectedKind: ModelKindFilter;
	kindCounts: { llm: number; image: number; audio: number };
	onSelectVendor: (vendor: string) => void;
	onSelectKind: (kind: ModelKindFilter) => void;
	onClearFilter: () => void;
};

export function ModelFilterSidebar(p: Props) {
	const t = useTranslations('models.filter'),
		filter = useTranslations('filter');
	return (
		<aside className="model-filters">
			<RadioGroup
				aria-label={t('kindAria')}
				value={p.selectedKind}
				options={(['llm', 'image', 'audio'] as const).map((value) => ({
					value,
					label: (
						<>
							{t(
								value === 'llm'
									? 'kindLlm'
									: value === 'image'
									? 'kindImage'
									: 'kindAudio'
							)}{' '}
							<Badge>{p.kindCounts[value]}</Badge>
						</>
					),
				}))}
				onValueChange={(value) => {
					if (value === 'llm' || value === 'image' || value === 'audio')
						p.onSelectKind(value);
				}}
			/>
			<nav aria-label={t('vendorAria')} className="model-vendors">
				<ControlButton
					variant={p.isAllVendors ? 'secondary' : 'ghost'}
					aria-pressed={p.isAllVendors}
					onClick={() => p.onSelectVendor(ALL_VENDORS_KEY)}
				>
					{filter('all')}
				</ControlButton>
				{p.modelsByVendor.map(([vendor, items]) => (
					<ControlButton
						key={vendor}
						variant={p.selectedVendor === vendor ? 'secondary' : 'ghost'}
						aria-pressed={p.selectedVendor === vendor}
						onClick={() => p.onSelectVendor(vendor)}
					>
						{getModelVendorLabel(vendor)} <Badge>{items.length}</Badge>
					</ControlButton>
				))}
				{p.hasActiveFilter ? (
					<ControlButton variant="ghost" onClick={p.onClearFilter}>
						{filter('clear')}
					</ControlButton>
				) : null}
			</nav>
		</aside>
	);
}
