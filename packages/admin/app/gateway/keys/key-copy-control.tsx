'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ControlIconButton } from '@xsec/ui-react';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
/** Clipboard ownership is local to the control; secret values never enter feedback. */
export function CopyControl({
	value,
	label,
}: {
	value: string;
	label: string;
}) {
	const common = useTranslations('common'),
		t = useTranslations('keysPage.feedback');
	const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
	const owner = useRef<{
		active: boolean;
		busy: boolean;
		timer?: ReturnType<typeof setTimeout>;
	} | null>(null);
	useEffect(() => {
		const operation = { active: true, busy: false } as NonNullable<
			typeof owner.current
		>;
		owner.current = operation;
		return () => {
			operation.active = false;
			if (operation.timer) clearTimeout(operation.timer);
		};
	}, [value]);
	const copy = async () => {
		const operation = owner.current;
		if (!operation?.active || operation.busy) return;
		operation.busy = true;
		if (operation.timer) clearTimeout(operation.timer);
		try {
			await navigator.clipboard.writeText(value);
			if (operation.active) {
				setStatus('copied');
				operation.timer = setTimeout(() => setStatus('idle'), 2000);
			}
		} catch {
			if (operation.active) setStatus('error');
		} finally {
			operation.busy = false;
		}
	};
	return (
		<span className="key-copy">
			<ControlIconButton
				label={label}
				title={label}
				onClick={() => void copy()}
			>
				<ClipboardDocumentIcon className="h-4 w-4" aria-hidden />
			</ControlIconButton>
			{status === 'copied' ? (
				<span role="status">{common('copied')}</span>
			) : status === 'error' ? (
				<span role="alert">{t('copyFailed')}</span>
			) : null}
		</span>
	);
}
