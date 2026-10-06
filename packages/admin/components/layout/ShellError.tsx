'use client';
import { ErrorState } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { ShellFailure } from '@/lib/shell-request';

export default function ShellError({ title, failure, action, uncertainWrite = false }: { title: string; failure: ShellFailure; action?: ReactNode; uncertainWrite?: boolean }) {
 const t = useTranslations('shell');
 return <ErrorState title={title} description={<>{failure.serverMessage ?? t(failure.code)}{failure.status ? <span> · HTTP {failure.status}</span> : null}{uncertainWrite ? <span className="octafuse-write-note">{t('confirmWrite')}</span> : null}</>} errorId={failure.requestId ?? failure.code} action={action} />;
}
