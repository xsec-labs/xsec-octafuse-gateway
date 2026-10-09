'use client';
import { memo } from 'react';
import { Badge, ControlButton, ControlIconButton, Switch } from '@xsec/ui-react';
import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { VendorIcon } from '@/components/model-vendor-icon';
import { ProviderProtocolIcon } from './provider-protocol-icon';
import { getProviderProtocolSummaries } from '../provider-utils';
import type { GatewayProvider } from '../types';
export const ProviderCard = memo(function ProviderCard({
	provider,
	copiedId,
	copyingId,
	writeBusy,
	writeKind,
	onMount,
	onEdit,
	onToggleStatus,
	onCopyApiKey,
}: {
	provider: GatewayProvider;
	copiedId: string | null;
	copyingId: string | null;
	writeBusy: boolean;
	writeKind: string | null;
	onMount: (id: string, element: HTMLElement | null) => void;
	onEdit: (provider: GatewayProvider) => void;
	onToggleStatus: (provider: GatewayProvider) => void;
	onCopyApiKey: (provider: GatewayProvider) => void;
}) {
	const t = useTranslations('providers.card'),
		common = useTranslations('common'),
		protocols = getProviderProtocolSummaries(provider),
		active = provider.status === 'active',
		pendingKey = provider.has_pending_key,
		noKey = !provider.api_key?.trim() || provider.api_key === '(empty)' || pendingKey;
	return (
		<article
			ref={(element) => onMount(provider.id, element)}
			className="provider-card"
			aria-busy={writeKind === provider.id}
		>
			<div className="provider-identity">
				<VendorIcon vendor={provider.vendor_key} iconKey={provider.icon_key} size="compact" />
				<div>
					<h2 aria-label={provider.name}>
						<ControlButton
							variant="ghost"
							className="provider-name"
							onClick={() => onEdit(provider)}
							disabled={writeBusy}
							aria-label={t('editProvider', { name: provider.name })}
						>
							{provider.name}
						</ControlButton>
					</h2>
					<p className="provider-id">{provider.id}</p>
					{pendingKey ? (
						<Badge tone="warning">{t('pending')}</Badge>
					) : active && noKey ? (
						<Badge tone="danger">{t('noKey')}</Badge>
					) : null}
				</div>
			</div>
			<div className="provider-protocols">
				<p className="provider-caption">{t('supportedEndpoints')}</p>
				{protocols.length ? (
					protocols.map((protocol) => (
						<span
							className="provider-protocol"
							key={protocol.key}
							title={protocol.endpoints.map((endpoint) => endpoint.url).join(' · ')}
						>
							<ProviderProtocolIcon protocol={protocol.key} />
							<strong>{protocol.label}</strong>
							<span>
								{protocol.badges.map((badge) => t('cap.' + badge)).join(' / ') ||
									t('endpointCount', { count: protocol.endpoints.length })}
							</span>
						</span>
					))
				) : (
					<span className="provider-muted">{t('noEndpoint')}</span>
				)}
			</div>
			<div className="provider-credential">
				<p className="provider-caption">{t('apiKey')}</p>
				<div>
					<code>{provider.api_key || t('noKey')}</code>
					<ControlIconButton
						label={
							copiedId === 'provider-api-key:' + provider.id ? common('copied') : t('copyApiKey')
						}
						disabled={Boolean(noKey || copyingId)}
						loading={copyingId === provider.id}
						onClick={() => onCopyApiKey(provider)}
					>
						{copiedId === 'provider-api-key:' + provider.id ? (
							<CheckIcon aria-hidden />
						) : (
							<ClipboardDocumentIcon aria-hidden />
						)}
					</ControlIconButton>
				</div>
			</div>
			<div className="provider-status">
				<Switch
					checked={active}
					disabled={writeBusy}
					onCheckedChange={() => onToggleStatus(provider)}
					label={active ? t('providerEnabled') : t('providerDisabled')}
				/>
			</div>
		</article>
	);
});
