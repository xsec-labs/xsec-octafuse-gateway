'use client';
import { memo, useRef, useState, type RefObject } from 'react';
import { Badge, ControlButton, Dialog } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import { WEB_SEARCH_PROVIDER_DOCS_URL, WEB_SEARCH_PROVIDERS, type WebSearchProvider } from '@/lib/web-search-options';

/** The guide owns its open state; form edits and dialog transitions have independent render scopes. */
export const WebSearchProviderGuideAction = memo(function WebSearchProviderGuideAction({ activeProvider }: { activeProvider: WebSearchProvider }) {
    const t = useTranslations('tools.webSearch'), [open, setOpen] = useState(false), button = useRef<HTMLButtonElement>(null);
    return <><ControlButton ref={button} variant="outline" onClick={() => setOpen(true)}>{t('providerGuideLink')}</ControlButton>
        <WebSearchProviderGuideModal open={open} activeProvider={activeProvider} onClose={() => setOpen(false)} finalFocus={button}/></>;
});

export function WebSearchProviderGuideModal({ open, activeProvider, onClose, finalFocus }: {
    open: boolean;
    activeProvider: WebSearchProvider;
    onClose: () => void;
    finalFocus: RefObject<HTMLButtonElement>;
}) {
    const t = useTranslations('tools.webSearch.providerGuide'), providers = useTranslations('tools.webSearch.providers'), common = useTranslations('common');
    return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }} title={t('title')} description={t('subtitle')} finalFocus={finalFocus} className="tools-guide-dialog" footer={<ControlButton onClick={onClose}>{common('close')}</ControlButton>}>
        <p className="tools-guide-disclaimer">{t('disclaimer')}</p>
        <div className="tools-guide-items">{WEB_SEARCH_PROVIDERS.map(provider => <section key={provider} className="tools-guide-item" data-active={provider === activeProvider}>
            <div className="tools-guide-heading"><h3>{providers(provider)}</h3>{t(`items.${provider}.badge`) ? <Badge>{t(`items.${provider}.badge`)}</Badge> : null}{provider === activeProvider ? <Badge>{t('selected')}</Badge> : null}</div>
            <p>{t(`items.${provider}.summary`)}</p><dl><dt>{t('labels.sources')}</dt><dd>{t(`items.${provider}.sources`)}</dd><dt>{t('labels.bestFor')}</dt><dd>{t(`items.${provider}.bestFor`)}</dd></dl>
            <a href={WEB_SEARCH_PROVIDER_DOCS_URL[provider]} target="_blank" rel="noopener noreferrer" className="tools-link">{t('docsLink')}</a>
        </section>)}</div>
    </Dialog>;
}
