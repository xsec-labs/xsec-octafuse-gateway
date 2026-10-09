'use client';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
} from 'react';
import { useTranslations } from 'next-intl';
import {
	useShellRequest,
	parseShellSuccess,
	type ShellFailure,
} from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import {
	isAudioTranscriptionModel,
	isImageGenerationModel,
	parseModelModalitiesJson,
} from '@octafuse/core/db/model-modalities';
import {
	createDefaultAudioPricingDraft,
	createDefaultAudioTokenPricingDraft,
	createDefaultImagePerImageDraft,
	createDefaultImageTokenTierRow,
	createDefaultNewModelTierRow,
	draftRowsHaveImageTokenPrices,
	draftRowsLookLikeImageOnly,
	profileJsonToAudioDraftState,
	profileJsonToDraftState,
	type AudioPricingDraftState,
	type ImageBillingModeDraft,
	type ImagePerImageDraft,
	type ImagePricingDraftState,
	type PricingTierDraftRow,
} from '@/lib/pricing-tiers-draft';
import { normalizeModelVendorInput } from '@/lib/model-vendor';

import { modelWrite, parseModel, parseModelCurrency } from './model-api';
import { formatMetadataForEditor } from './model-utils';
import {
	EMPTY_MODEL_FORM,
	EMPTY_IMAGE_MODEL_FORM,
	EMPTY_AUDIO_MODEL_FORM,
	type ModelFormData,
	type ModelFormKind,
	type ModelListItem,
} from './types';
export type ModelActionFailure = {
	title: string;
	failure: ShellFailure;
	uncertain: boolean;
};
export type ModelReadState<T> =
	| { status: 'loading' }
	| { status: 'error'; failure: ShellFailure }
	| { status: 'ready'; value: T };
export function useModelEditModal(options?: {
	onChanged?: () => void | Promise<void>;
	successFocus?: RefObject<HTMLElement | null>;
}) {
	const t = useTranslations('models.feedback');
	const onChanged = options?.onChanged;
	const successFocus = options?.successFocus;
	const [showModal, setShowModal] = useState(false);
	const [editingModel, setEditingModel] = useState<ModelListItem | null>(null);
	const [formData, setFormData] = useState<ModelFormData>(EMPTY_MODEL_FORM);
	const [formKind, setFormKind] = useState<ModelFormKind>('llm');
	const [pricingTierRows, setPricingTierRows] = useState<PricingTierDraftRow[]>(
		[]
	);
	const [imageBillingMode, setImageBillingMode] =
		useState<ImageBillingModeDraft>('token');
	const [imagePerImageDraft, setImagePerImageDraft] =
		useState<ImagePerImageDraft>(createDefaultImagePerImageDraft());
	const [audioPricingDraft, setAudioPricingDraft] =
		useState<AudioPricingDraftState>(createDefaultAudioPricingDraft());
	const [tagInput, setTagInput] = useState('');
	const [saveError, setSaveError] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const [editorStatus, setEditorStatus] = useState<
			'loading' | 'ready' | 'error'
		>('ready'),
		[actionFailure, setActionFailure] = useState<ModelActionFailure | null>(
			null
		),
		[showDelete, setShowDelete] = useState(false);
	const [currencyState, setCurrencyState] = useState<ModelReadState<string>>({
		status: 'loading',
	});
	const deleteReturnFocus = useRef<HTMLElement | null>(null);
	const changeDeleteConfirmation = useCallback((open: boolean) => {
		if (open) deleteReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		setShowDelete(open);
	}, []);
	const returnFocus = useRef<HTMLElement | null>(null),
		writeBusy = useRef(false);
	const { run: readDetail, cancel: cancelDetail } = useShellRequest(),
		{ run: readCurrency } = useShellRequest(),
		{ run: write } = useShellRequest();
	const authorizedFailure = useCallback(
		(failure: ShellFailure, record: () => void) => {
			if (failure.status === 401) notifyAdminSessionExpired();
			else record();
		},
		[]
	);
	const readModelCurrency = useCallback(async () => {
		await readCurrency(
			'/api/admin/config',
			{},
			parseModelCurrency,
			(value) => setCurrencyState({ status: 'ready', value }),
			(failure) =>
				authorizedFailure(failure, () =>
					setCurrencyState({ status: 'error', failure })
				)
		);
	}, [readCurrency, authorizedFailure]);
	useEffect(() => {
		void readModelCurrency();
	}, [readModelCurrency]);
	const loadCurrency = useCallback(async () => {
		setCurrencyState({ status: 'loading' });
		await readModelCurrency();
	}, [readModelCurrency]);
	const captureFocus = useCallback(() => {
		returnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
	}, []);
	const applyImagePricingDraft = useCallback(
		(draft: ImagePricingDraftState) => {
			setImageBillingMode(draft.mode);
			setPricingTierRows(draft.tiers);
			setImagePerImageDraft(draft.perImage);
		},
		[]
	);

	const fillFormFromModel = useCallback(
		(model: ModelListItem) => {
			const listTags = model.tags;
			const imageModel = isImageGenerationModel(model),
				audioModel = isAudioTranscriptionModel(model);
			const outputMods =
				parseModelModalitiesJson(model.output_modalities) ??
				(imageModel ? ['image'] : ['text']);
			const kind: ModelFormKind = audioModel
				? 'audio'
				: imageModel
				? 'image'
				: 'llm';
			setFormKind(kind);
			setFormData({
				id: model.id,
				display_name: model.display_name || '',
				vendor: normalizeModelVendorInput(model.vendor),
				context_window:
					imageModel || audioModel
						? ''
						: model.context_window?.toString() || '',
				max_tokens:
					imageModel || audioModel
						? ''
						: model.max_tokens?.toString() || '4096',
				input_modalities:
					parseModelModalitiesJson(model.input_modalities) ??
					(audioModel ? ['audio'] : ['text']),
				output_modalities: outputMods,
				released_at: model.released_at ?? '',
				tags: listTags,
				description: model.description ?? '',
				metadata: formatMetadataForEditor(model.metadata),
			});
			if (audioModel) {
				setAudioPricingDraft(
					profileJsonToAudioDraftState(model.pricing_profile)
				);
				setPricingTierRows([]);
			} else {
				applyImagePricingDraft(profileJsonToDraftState(model.pricing_profile));
			}
		},
		[applyImagePricingDraft]
	);

	const handleImageBillingModeChange = useCallback(
		(mode: ImageBillingModeDraft) => {
			setImageBillingMode(mode);
			if (mode === 'per_image') {
				setPricingTierRows([]);
				return;
			}
			setPricingTierRows((rows) =>
				draftRowsHaveImageTokenPrices(rows)
					? rows
					: [createDefaultImageTokenTierRow()]
			);
		},
		[]
	);

	const handleCreate = useCallback(
		(presetVendorKey?: string, kind: ModelFormKind = 'llm') => {
			cancelDetail();
			captureFocus();
			setEditorStatus('ready');
			setActionFailure(null);
			setShowDelete(false);
			setTagInput('');
			setEditingModel(null);
			setFormKind(kind);
			setImageBillingMode('token');
			setImagePerImageDraft(createDefaultImagePerImageDraft());
			setAudioPricingDraft(createDefaultAudioPricingDraft());
			const vendor =
				presetVendorKey !== undefined
					? presetVendorKey
					: EMPTY_MODEL_FORM.vendor;
			if (kind === 'image') {
				setFormData({
					...EMPTY_IMAGE_MODEL_FORM,
					vendor,
				});
				applyImagePricingDraft({
					mode: 'token',
					tiers: [createDefaultImageTokenTierRow()],
					perImage: createDefaultImagePerImageDraft(),
				});
			} else if (kind === 'audio') {
				setFormData({
					...EMPTY_AUDIO_MODEL_FORM,
					vendor,
				});
				setAudioPricingDraft(createDefaultAudioPricingDraft());
				setPricingTierRows([]);
			} else {
				setFormData({
					...EMPTY_MODEL_FORM,
					vendor,
				});
				setPricingTierRows([createDefaultNewModelTierRow()]);
			}
			setShowModal(true);
			setSaveError('');
		},
		[applyImagePricingDraft, cancelDetail, captureFocus]
	);

	const applyFormKind = useCallback(
		(kind: ModelFormKind) => {
			if (writeBusy.current) return;
			setFormKind(kind);
			if (kind === 'image') {
				setFormData((prev) => ({
					...prev,
					input_modalities: prev.input_modalities.includes('image')
						? prev.input_modalities
						: [...prev.input_modalities, 'image'],
					output_modalities: ['image'],
					context_window: '',
					max_tokens: '',
				}));
				setPricingTierRows((rows) =>
					imageBillingMode === 'per_image'
						? []
						: draftRowsHaveImageTokenPrices(rows)
						? rows
						: [createDefaultImageTokenTierRow()]
				);
				return;
			}
			if (kind === 'audio') {
				setFormData((prev) => ({
					...prev,
					input_modalities: ['audio'],
					output_modalities: ['text'],
					context_window: '',
					max_tokens: '',
				}));
				setAudioPricingDraft(createDefaultAudioPricingDraft());
				setPricingTierRows([]);
				return;
			}
			setFormData((prev) => ({
				...prev,
				input_modalities: prev.input_modalities.includes('text')
					? prev.input_modalities
					: ['text', ...prev.input_modalities],
				output_modalities: ['text'],
				max_tokens: prev.max_tokens || '8192',
			}));
			setPricingTierRows((rows) =>
				!rows.length || draftRowsLookLikeImageOnly(rows)
					? [createDefaultNewModelTierRow()]
					: rows
			);
		},
		[imageBillingMode]
	);

	const handleAddTag = useCallback(() => {
		const t = tagInput.trim();
		if (t && !formData.tags.includes(t)) {
			setFormData({ ...formData, tags: [...formData.tags, t] });
			setTagInput('');
		}
	}, [formData, tagInput]);

	const handleRemoveTag = useCallback((tag: string) => {
		setFormData((prev) => ({
			...prev,
			tags: prev.tags.filter((x) => x !== tag),
		}));
	}, []);

	const toggleFormModality = useCallback(
		(key: 'input_modalities' | 'output_modalities', modality: string) => {
			if (writeBusy.current) return;
			const current = formData[key];
			if (current.length === 1 && current.includes(modality)) return;
			const next = current.includes(modality)
				? current.filter((m) => m !== modality)
				: [...current, modality];
			if (key === 'output_modalities') {
				if (next.includes('image')) {
					setFormKind('image');
					setPricingTierRows((rows) =>
						imageBillingMode === 'per_image'
							? []
							: draftRowsHaveImageTokenPrices(rows)
							? rows
							: [createDefaultImageTokenTierRow()]
					);
					setFormData({
						...formData,
						[key]: next,
						context_window: '',
						max_tokens: '',
					});
					return;
				}
				if (formKind === 'image') {
					setFormKind('llm');
					setPricingTierRows((rows) =>
						draftRowsLookLikeImageOnly(rows) || !rows.length
							? [createDefaultNewModelTierRow()]
							: rows
					);
					setFormData({ ...formData, [key]: next, max_tokens: '8192' });
					return;
				}
			}
			setFormData({ ...formData, [key]: next });
		},
		[formData, formKind, imageBillingMode]
	);

	const openEditById = useCallback(
		async (id: string) => {
			if (writeBusy.current) return;
			captureFocus();
			setEditingModel(null);
			setSaveError('');
			setActionFailure(null);
			setShowDelete(false);
			setTagInput('');
			setEditorStatus('loading');
			setShowModal(true);
			await readDetail(
				'/api/admin/models/' + encodeURIComponent(id),
				{},
				parseModel,
				(model) => {
					setEditingModel(model);
					fillFormFromModel(model);
					setEditorStatus('ready');
				},
				(failure) =>
					authorizedFailure(failure, () => {
						setEditorStatus('error');
						setActionFailure({
							title: t('detailFailed'),
							failure,
							uncertain: false,
						});
					})
			);
		},
		[readDetail, fillFormFromModel, captureFocus, authorizedFailure, t]
	);
	const handleEdit = useCallback(
		(model: ModelListItem) => openEditById(model.id),
		[openEditById]
	);
	const perform = useCallback(
		(kind: 'save' | 'delete', path: string, init: RequestInit) => {
			if (
				writeBusy.current ||
				currencyState.status !== 'ready' ||
				editorStatus !== 'ready'
			)
				return;
			writeBusy.current = true;
			setIsSaving(kind === 'save');
			setIsDeleting(kind === 'delete');
			setActionFailure(null);
			void write(
				path,
				init,
				parseShellSuccess,
				() => {
					if (successFocus?.current) {
				returnFocus.current = successFocus.current;
				deleteReturnFocus.current = successFocus.current;
			}
					writeBusy.current = false;
					setIsSaving(false);
					setIsDeleting(false);
					setShowDelete(false);
					setShowModal(false);
					setEditingModel(null);
					void onChanged?.();
				},
				(failure) => {
					writeBusy.current = false;
					setIsSaving(false);
					setIsDeleting(false);
					authorizedFailure(failure, () =>
						setActionFailure({
							title: t(kind === 'save' ? 'saveFailed' : 'deleteFailed'),
							failure,
							uncertain: failure.code !== 'HTTP_ERROR',
						})
					);
				}
			);
		},
		[
			write,
			authorizedFailure,
			onChanged,
			successFocus,
			currencyState.status,
			editorStatus,
			t,
		]
	);
	const handleSave = useCallback(() => {
		if (writeBusy.current) return;
		setSaveError('');
		if (!formData.id.trim()) {
			setSaveError(t('idRequired'));
			return;
		}
		const request = modelWrite(
			formData,
			pricingTierRows,
			editingModel?.id ?? null,
			formKind === 'image'
				? {
						mode: imageBillingMode,
						tiers: pricingTierRows,
						perImage: imagePerImageDraft,
				  }
				: null,
			formKind === 'audio' ? audioPricingDraft : null
		);
		if (!request.ok) {
			setSaveError(
				request.message === 'INVALID_TOKEN_LIMITS'
					? t('tokenLimits')
					: request.message
			);
			return;
		}
		perform('save', request.path, request.init);
	}, [
		formData,
		pricingTierRows,
		editingModel,
		formKind,
		imageBillingMode,
		imagePerImageDraft,
		audioPricingDraft,
		perform,
		t,
	]);
	const handleDelete = useCallback(
		(id: string) => {
			perform('delete', '/api/admin/models/' + encodeURIComponent(id), {
				method: 'DELETE',
			});
		},
		[perform]
	);
	const closeModal = useCallback(() => {
		if (writeBusy.current) return;
		cancelDetail();
		setShowModal(false);
		setShowDelete(false);
		setActionFailure(null);
	}, [cancelDetail]);
	return {
		currencyState,
		loadCurrency,
		billingCurrency:
			currencyState.status === 'ready' ? currencyState.value : '',
		editorStatus,
		actionFailure,
		showDelete,
		setShowDelete: changeDeleteConfirmation,
		deleteReturnFocus,
		returnFocus,
		showModal,
		editingModel,
		formData,
		setFormData,
		formKind,
		pricingTierRows,
		setPricingTierRows,
		imageBillingMode,
		setImageBillingMode: handleImageBillingModeChange,
		imagePerImageDraft,
		setImagePerImageDraft,
		audioPricingDraft,
		setAudioPricingDraft,
		tagInput,
		setTagInput,
		saveError,
		isSaving,
		isDeleting,
		handleCreate,
		applyFormKind,
		handleEdit,
		openEditById,
		handleDelete,
		handleAddTag,
		handleRemoveTag,
		toggleFormModality,
		handleSave,
		closeModal,
	};
}
