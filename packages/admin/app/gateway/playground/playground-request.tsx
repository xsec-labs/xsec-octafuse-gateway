'use client';
import { ControlButton, ErrorState, Field, Input, RadioGroup, Section, Textarea } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import type { ImageOperation } from '@/lib/image-generations';

export type PlaygroundRequestFailure = { message: string; field: 'body' | 'timeout' | 'send' };
type Props = {
 body: string; failure: PlaygroundRequestFailure | null; sending: boolean; sendDisabled: boolean;
 onBody: (value: string) => void; onSend: () => void; onCancel: () => void;
 timeoutSeconds: string; onTimeout: (value: string) => void; notice: string | null;
 targetUrl: string | null; selected: boolean; wireBody: string | null;
 isImage: boolean; isAudio: boolean; imageBlocked: boolean; audioBlocked: boolean;
 imageOperation: ImageOperation; onImageOperation: (value: ImageOperation) => void;
 editFiles: File[]; onEditFiles: (files: File[]) => void; editError?: string; maxReferences: number;
 audioFile: File | null; onAudioFile: (file: File | null) => void; audioError?: string;
 gemini: boolean; geminiAction: 'generateContent' | 'streamGenerateContent';
 onGeminiAction: (value: 'generateContent' | 'streamGenerateContent') => void;
};
export function PlaygroundRequest(props: Props) {
 const t=useTranslations('playground'),common=useTranslations('common');
 return <Section className="playground-exchange-panel playground-request" title={t('requestBody')}><div className="playground-send-actions">
  {props.sending ? <ControlButton variant="outline" onClick={props.onCancel}>{common('cancel')}</ControlButton> : null}
  <ControlButton disabled={props.sendDisabled} onClick={props.onSend}>{props.sending ? common('sending') : common('send')}</ControlButton>
 </div>
  {props.failure?.field==='send' ? <ErrorState title={common('requestFailed')} description={props.failure.message} /> : null}
  <Field label={t('sendState.timeoutLabel')} hint={t('sendState.timeoutHint')} error={props.failure?.field==='timeout' ? props.failure.message : undefined}>
   {field=><Input {...field} type="number" min={1} max={3600} step={1} disabled={props.sending} value={props.timeoutSeconds} onChange={event=>props.onTimeout(event.target.value)} />}
  </Field>
  {props.notice ? <p className="playground-operation-notice" role="status">{props.notice}</p> : null}
  {props.imageBlocked ? <p className="playground-operation-warning" role="status">{t('imageOpenaiOnly')}</p> : null}
  {props.audioBlocked ? <p className="playground-operation-warning" role="status">{t('audioOpenaiOnly')}</p> : null}
  <div className="playground-target">
   <h3>{t('requestTargetUrl')}</h3>
   {props.targetUrl ? <code>POST {props.targetUrl}</code> : <p>{t('requestTargetUrlEmpty')}</p>}
   {props.selected ? <p>{t('requestTargetUrlHint')}</p> : null}
  </div>
  {props.isAudio && !props.audioBlocked ? <>
   <p className="playground-editor-hint">{t('audioTranscriptionsHint')}</p>
   <Field label={t('audioFile')} hint={t('audioFileHint')} error={props.audioError}>
    {field=><Input {...field} type="file" accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac" disabled={props.sending} onChange={event=>props.onAudioFile(event.target.files?.[0] ?? null)} />}
   </Field>
   {props.audioFile ? <p className="playground-file-name">{props.audioFile.name} ({props.audioFile.size} bytes)</p> : null}
  </> : null}
  {props.isImage && !props.isAudio && !props.imageBlocked ? <>
   <Field label={t('imageOperation')}>{field=><RadioGroup {...field} aria-label={t('imageOperation')} disabled={props.sending} value={props.imageOperation}
    onValueChange={value=>props.onImageOperation(value as ImageOperation)} options={[{value:'generations',label:'generations'},{value:'edits',label:'edits'}]} />}</Field>
   <p className="playground-editor-hint">{props.imageOperation==='edits' ? t('imageEditsHint') : t('imageGenerationsHint')}</p>
   {props.imageOperation==='edits' ? <>
    <Field label={t('referenceImages')} hint={t('referenceImagesHint',{max:props.maxReferences})} error={props.editError}>
     {field=><Input {...field} type="file" accept="image/png,image/jpeg,image/webp,image/*" multiple disabled={props.sending} onChange={event=>props.onEditFiles(Array.from(event.target.files ?? []))} />}
    </Field>
    {props.editFiles.length ? <><p className="playground-editor-hint">{t('referenceImagesSelected',{count:props.editFiles.length})}</p><ul className="playground-file-list">
     {props.editFiles.map((file,index)=><li key={index}>{file.name} ({file.size} bytes)</li>)}
    </ul></> : null}
   </> : null}
  </> : null}
  {props.gemini && !props.isImage && !props.isAudio ? <Field label={t('geminiAction')}>{field=><RadioGroup {...field} aria-label={t('geminiAction')} disabled={props.sending} value={props.geminiAction}
   onValueChange={value=>props.onGeminiAction(value as Props['geminiAction'])} options={[{value:'generateContent',label:'generateContent'},{value:'streamGenerateContent',label:'streamGenerateContent'}]} />}</Field> : null}
  <Field label="JSON" error={props.failure?.field==='body' ? props.failure.message : undefined}>{field=><Textarea {...field} value={props.body} disabled={props.sending} onChange={event=>props.onBody(event.target.value)} rows={10} spellCheck={false} />}</Field>
  {props.wireBody ? <div className="playground-wire-body"><h3>{t('sentBody')}</h3><p className="playground-editor-hint">{t('sentBodyHint')}</p><pre tabIndex={0} aria-label={t('sentBody')}>{props.wireBody}</pre></div> : null}
 </Section>;
}
