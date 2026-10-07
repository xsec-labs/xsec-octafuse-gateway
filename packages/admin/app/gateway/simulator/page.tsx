'use client';

/**
 * Browser-side simulator: calls the Proxy directly (user-provided Base URL) with a real API key,
 * exercising auth, routing, billing, and request logs (unlike Playground upstream tests).
 */
import { useTranslations } from 'next-intl';
import { memo } from 'react';
import { ControlButton,ErrorState,PageHeader,Spinner } from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import './setup.css';
import './routing.css';
import { SimulatorRequestPanel } from './components/simulator-request-panel';
import { SimulatorResponsePanel as ResponsePanel } from './components/simulator-response-panel';
import { SimulatorRoutingPanel as RoutingPanel } from './components/simulator-routing-panel';
import { SimulatorSetupPanel } from './components/simulator-setup-panel';
import { useSimulatorPageState } from './use-simulator-page-state';

const SimulatorResponsePanel = memo(ResponsePanel);
const SimulatorRoutingPanel = memo(RoutingPanel);

export default function SimulatorPage() {
	const t = useTranslations('simulator');
	const tBrand = useTranslations('brand');
	const tCommon = useTranslations('common');
	const tShell = useTranslations('shell');
	const s = useSimulatorPageState();

	if(s.settingsError) {
		return <div className="simulator-read-state"><ErrorState title={t('setup.settingsFailed')} description={t(s.settingsError==='read' ? 'setup.settingsReadFailed' : 'setup.settingsWriteFailed')} errorId={s.settingsError==='read' ? 'SIMULATOR_SETTINGS_READ_FAILED' : 'SIMULATOR_SETTINGS_WRITE_FAILED'} action={<div className="simulator-settings-actions"><ControlButton variant="outline" onClick={s.retrySettings}>{tShell('retry')}</ControlButton><ControlButton variant="outline" onClick={s.resetSettings}>{t('setup.resetSettings')}</ControlButton></div>} /></div>;
	}
	if (!s.hydrated||s.loadingCatalog) {
		return (
			<div className="flex items-center justify-center h-full min-h-[240px]">
				<Spinner label={tCommon('loading')} />
			</div>
		);
	}
	if(s.catalogError) return <div className="simulator-read-state"><ShellError title={tCommon('failedToLoadModels')} failure={s.catalogError} action={<ControlButton variant="outline" onClick={s.refreshCatalog}>{tShell('retry')}</ControlButton>} /></div>;

	return (
		<div className="simulator-page min-w-0 overflow-x-hidden p-4 pb-6 sm:p-6 lg:p-8">
			<PageHeader title={t('title')} description={t('subtitle',{product:tBrand('product')})+' · '+t('usageNote')} />

			<div className="simulator-workbench overflow-hidden rounded-2xl border">
				<div className="flex min-w-0 flex-col xl:flex-row xl:items-stretch">
					<aside className="simulator-sidebar w-full shrink-0 border-b p-4 xl:w-[380px] xl:border-b-0 xl:border-r xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
						<div className="space-y-4">
							<SimulatorSetupPanel
								proxyBaseUrl={s.proxyBaseUrl}
								onProxyBaseUrlChange={s.setProxyBaseUrl}
								protocol={s.protocol}
								onProtocolChange={s.requestProtocolChange}
								lockOpenaiForImage={
									!s.isToolKind && (s.selectedModelIsImage || s.selectedModelIsAudio)
								}
								hideProtocolControls={s.isToolKind}
								geminiAction={s.geminiAction}
								onGeminiActionChange={s.setGeminiAction}
								filterKeyEmail={s.filterKeyEmail}
								onFilterKeyEmailChange={s.setFilterKeyEmail}
								loadingKeys={s.loadingKeys}
								keysError={s.keysError}
								keys={s.keys}
								keysTotal={s.keysTotal}
								onRefreshKeys={s.loadKeys}
								selectedKeyId={s.selectedKeyId}
								onSelectedKeyIdChange={s.setSelectedKeyId}
								revealedSk={s.revealedSk}
								revealLoading={s.revealLoading}
								revealError={s.revealError}
								onRetryReveal={s.retryReveal}
							/>
							<SimulatorRoutingPanel
								filterKind={s.filterKind}
								onFilterKindChange={s.setFilterKind}
								kindCounts={s.kindCounts}
								isToolKind={s.isToolKind}
								gatewayTools={s.gatewayTools}
								selectedToolId={s.selectedToolId}
								onSelectTool={s.selectTool}
								filterModel={s.filterModel}
								onFilterModelChange={s.setFilterModel}
								filteredModels={s.filteredModels}
								modelsInKindTotal={s.modelsInKind.length}
								modelIdsWithActiveRouter={s.modelIdsWithActiveRouter}
								selectedModelId={s.selectedModelId}
								onSelectModel={s.selectModel}
								routeGroup={s.routeGroup}
								onRouteGroupChange={s.setRouteGroup}
								routeGroupsForModel={s.routeGroupsForModel}
								selectedModel={s.selectedModel}
								routingSelectionError={s.routingSelectionError}
								selectedModelIsImage={s.selectedModelIsImage}
								selectedModelIsAudio={s.selectedModelIsAudio}
								modelRoutingString={s.modelRoutingString}
								matchingRoutes={s.matchingRoutes}
							/>
						</div>
					</aside>

					<section className="simulator-exchange min-w-0 flex-1 p-4 sm:p-5 space-y-4">
						<SimulatorRequestPanel
							bodyText={s.bodyText}
							onBodyTextChange={s.setBodyText}
							bodyDirty={s.bodyDirty}
							onApplyTemplate={s.applyCurrentTemplate}
							infoHint={s.infoHint}
							bodyError={s.bodyError}
							displayWire={s.displayWire}
							wireOpen={s.wireOpen}
							onWireOpenChange={s.setWireOpen}
							sending={s.sending}
							canSend={s.canSend}
							sendBlockedHint={s.sendBlockedHint}
							onSend={() => void s.send()}
							onStop={() => s.stop()}
							showImageOperation={
								s.selectedModelIsImage && !s.selectedModelIsAudio && s.protocol === 'openai'
							}
							imageOperation={s.imageOperation}
							onImageOperationChange={s.setImageOperation}
							editFiles={s.editFiles}
							onEditFilesChange={s.setEditFiles}
							showAudioTranscriptions={s.selectedModelIsAudio && s.protocol === 'openai'}
							audioFile={s.audioFile}
							onAudioFileChange={s.setAudioFile}
						/>
						<SimulatorResponsePanel
							responseMeta={s.responseMeta}
							responseText={s.responseText}
							usageHint={s.usageHint}
							imagePreviews={s.imagePreviews}
							responseTab={s.responseTab}
							onResponseTabChange={s.setResponseTab}
							mergedReasoningDisplay={s.mergedReasoningDisplay}
							mergedBodyDisplay={s.mergedBodyDisplay}
							streamEndRef={s.streamEndRef}
							mergedStreamEndRef={s.mergedStreamEndRef}
							selectedKeyId={s.selectedKeyId}
							selectedModelId={s.selectedModelId}
							routeGroup={s.routeGroup}
							protocol={s.protocol}
							isToolKind={s.isToolKind}
							selectedToolId={s.selectedToolId}
						/>
					</section>
				</div>
			</div>
		</div>
	);
}
