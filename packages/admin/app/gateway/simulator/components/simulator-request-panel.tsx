'use client';
import { useId } from 'react';
import { PaperAirplaneIcon, StopIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { ControlButton, Field, Input, RadioGroup, Section, Textarea } from '@xsec/ui-react';
import { validateAudioTranscriptionFile } from '@/lib/audio-transcriptions';
import { IMAGE_MAX_REFERENCE_COUNT, validateEditImageFiles, type ImageOperation } from '@/lib/image-generations';
import { prettyJsonBody } from '../simulator-utils';
import type { WirePreview } from '../types';

type Props = {
 bodyText: string; onBodyTextChange: (value: string) => void; bodyDirty: boolean; onApplyTemplate: () => void;
 infoHint: string | null; bodyError: string | null; sendErrorCode: string | null;
 displayWire: WirePreview | null; wireOpen: boolean; onWireOpenChange: (open: boolean) => void;
 sending: boolean; canSend: boolean; sendBlockedHint: string | null; onSend: () => void; onStop: () => void;
 timeoutSeconds: string; onTimeoutChange: (value: string) => void; timeoutError: string | null;
 showImageOperation?: boolean; imageOperation?: ImageOperation; onImageOperationChange?: (operation: ImageOperation) => void;
 editFiles?: File[]; onEditFilesChange?: (files: File[]) => void;
 showAudioTranscriptions?: boolean; audioFile?: File | null; onAudioFileChange?: (file: File | null) => void;
};

export function SimulatorRequestPanel({
 bodyText, onBodyTextChange, bodyDirty, onApplyTemplate, infoHint, bodyError, sendErrorCode,
 displayWire, wireOpen, onWireOpenChange, sending, canSend, sendBlockedHint, onSend, onStop,
 timeoutSeconds, onTimeoutChange, timeoutError,
 showImageOperation = false, imageOperation = 'generations', onImageOperationChange,
 editFiles = [], onEditFilesChange, showAudioTranscriptions = false, audioFile = null, onAudioFileChange,
}: Props) {
 const t = useTranslations('simulator'), common = useTranslations('common'), wireId = useId();
 const audioValidation = audioFile ? validateAudioTranscriptionFile(audioFile) : null;
 const imagesValidation = editFiles.length ? validateEditImageFiles(editFiles) : null;
 return <Section title={t('requestBody')} className="simulator-request-panel">
  <div className="simulator-panel-actions">
   <ControlButton variant="outline" size="sm" onClick={onApplyTemplate} disabled={!bodyDirty || sending}>{t('applyTemplate')}</ControlButton>
   {sending
    ? <ControlButton variant="danger" size="sm" onClick={onStop}><StopIcon aria-hidden="true" />{common('stop')}</ControlButton>
    : <ControlButton size="sm" onClick={onSend} disabled={!canSend || Boolean(timeoutError)} title={sendBlockedHint ?? undefined}><PaperAirplaneIcon aria-hidden="true" />{common('send')}</ControlButton>}
  </div>
  {sendBlockedHint && !sending ? <p className="simulator-exchange-hint">{sendBlockedHint}</p> : null}
  {infoHint ? <p role="status" className="simulator-exchange-notice">{infoHint}</p> : null}
  <div className="simulator-target-url"><span className="xui-label">{t('requestTargetUrl')}</span><p>{displayWire ? <><strong>{displayWire.method}</strong> <code>{displayWire.url}</code></> : t('requestTargetUrlEmpty')}</p></div>
  <Field label={t('exchange.timeoutLabel')} hint={t('exchange.timeoutHint')} error={timeoutError}>
   {field => <Input {...field} type="number" min={1} max={3600} step={1} disabled={sending} value={timeoutSeconds} onChange={event => onTimeoutChange(event.target.value)} />}
  </Field>
  {showAudioTranscriptions ? <>
   <p className="simulator-exchange-hint">{t('audioTranscriptionsHint')}</p>
   <Field label={t('audioFile')} hint={t('audioFileHint')} error={audioValidation && !audioValidation.ok ? audioValidation.error : !audioFile ? t('audioFileRequired') : undefined}>
    {field => <Input {...field} type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac" disabled={sending} onChange={event => onAudioFileChange?.(event.target.files?.[0] ?? null)} />}
   </Field>
   {audioFile ? <p className="simulator-exchange-hint">{audioFile.name} ({audioFile.size} bytes)</p> : null}
  </> : null}
  {showImageOperation ? <>
   <fieldset className="simulator-image-operation"><legend className="xui-label">{t('imageOperation')}</legend>
    <RadioGroup name="simulatorImageOperation" aria-label={t('imageOperation')} value={imageOperation} disabled={sending}
     options={[{value:'generations', label:'generations'}, {value:'edits', label:'edits'}]}
     onValueChange={value => { if(value !== 'generations' && value !== 'edits') throw new TypeError('Invalid image operation'); onImageOperationChange?.(value); }} />
   </fieldset>
   <p className="simulator-exchange-hint">{t(imageOperation === 'generations' ? 'imageGenerationsHint' : 'imageEditsHint')}</p>
   {imageOperation === 'edits' ? <>
    <Field label={t('referenceImages')} hint={t('referenceImagesHint',{max:IMAGE_MAX_REFERENCE_COUNT})} error={imagesValidation && !imagesValidation.ok ? imagesValidation.error : !editFiles.length ? t('referenceImagesRequired') : undefined}>
     {field => <Input {...field} type="file" accept="image/png,image/jpeg,image/webp,image/*" multiple disabled={sending} onChange={event => onEditFilesChange?.(Array.from(event.target.files ?? []).slice(0, IMAGE_MAX_REFERENCE_COUNT))} />}
    </Field>
    {editFiles.length ? <><p className="simulator-exchange-hint">{t('referenceImagesSelected',{count:editFiles.length})}</p><ul className="simulator-upload-list">{editFiles.map(file => <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name} ({file.size} bytes)</li>)}</ul></> : null}
   </> : null}
  </> : null}
  <Field label="JSON">{field => <Textarea {...field} value={bodyText} onChange={event => onBodyTextChange(event.target.value)} rows={12} spellCheck={false} disabled={sending} className="simulator-json-input" />}</Field>
  {bodyError ? <div role="alert" className="simulator-exchange-error"><p>{bodyError}</p>{sendErrorCode ? <code>{sendErrorCode}</code> : null}</div> : null}
  <div className="simulator-wire">
   <ControlButton variant="ghost" className="simulator-wire-toggle" aria-expanded={wireOpen} aria-controls={wireId} onClick={() => onWireOpenChange(!wireOpen)}>{t('wirePreview')}<ChevronDownIcon aria-hidden="true" data-open={wireOpen} /></ControlButton>
   {wireOpen ? <div id={wireId} className="simulator-wire-content">{displayWire ? <>
    <p className="simulator-wire-url"><strong>{displayWire.method}</strong> <code>{displayWire.url}</code></p>
    <div><h3>{t('wireHeaders')}</h3><pre className="simulator-code-block">{Object.entries(displayWire.headers).map(([key,value])=>`${key}: ${value}`).join('\n')}</pre></div>
    <div><h3>{t('wireBody')}</h3><pre className="simulator-code-block">{displayWire.isMultipart ? displayWire.bodyText : prettyJsonBody(displayWire.bodyText)}</pre></div>
   </> : <p className="simulator-exchange-hint">{t('wirePreviewEmpty')}</p>}</div> : null}
  </div>
 </Section>;
}
