'use client';
import { Input, ControlIconButton, Toolbar } from '@xsec/ui-react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
export function ProviderToolbar({
	providerSearch,
	filteredCount,
	totalCount,
	onSearchChange,
}: {
	providerSearch: string;
	filteredCount: number;
	totalCount: number;
	onSearchChange: (value: string) => void;
}) {
	const t = useTranslations('providers'),
		common = useTranslations('common');
	return (
		<Toolbar className="provider-toolbar">
			<div className="provider-search">
				<MagnifyingGlassIcon aria-hidden />
				<Input
					type="search"
					value={providerSearch}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder={t('searchPlaceholder')}
					aria-label={t('searchPlaceholder')}
					autoComplete="off"
				/>
				{providerSearch ? (
					<ControlIconButton label={t('clearSearch')} onClick={() => onSearchChange('')}>
						<XMarkIcon aria-hidden />
					</ControlIconButton>
				) : null}
			</div>
			<p role="status">{common('showing', { filtered: filteredCount, total: totalCount })}</p>
		</Toolbar>
	);
}
