'use client';
import { ControlButton, Dialog } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import type { MetadataPreviewState } from '../types';
export function ModelMetadataPreviewModal({
	preview,
	onClose,
}: {
	preview: MetadataPreviewState;
	onClose: () => void;
}) {
	const t = useTranslations('models.metadata'),
		common = useTranslations('common');
	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t('title')}
			description={
				(preview.model.display_name || preview.model.id) +
				' · ' +
				preview.model.id
			}
			className="model-dialog"
			footer={
				<ControlButton variant="outline" onClick={onClose}>
					{common('close')}
				</ControlButton>
			}
		>
			<pre className="model-json-preview">{preview.summary.formatted}</pre>
		</Dialog>
	);
}
