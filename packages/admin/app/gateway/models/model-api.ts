import {
	isAudioTranscriptionModel,
	isImageGenerationModel,
} from '@octafuse/core/db/model-modalities';
import {
	isRecord,
	parseShellSuccess,
	ShellRequestError,
} from '@/lib/shell-request';
import { parsePricingProfile } from '@octafuse/core/db/pricing-profile';
import {
	MODEL_INPUT_MODALITIES,
	MODEL_OUTPUT_MODALITIES,
} from '@octafuse/core/db/model-modalities';
import { normalizeModelVendorInput } from '@/lib/model-vendor';
import {
	serializeAudioPricingDraft,
	serializeDraftRowsToProfileJson,
	serializeImagePricingDraft,
	type AudioPricingDraftState,
	type ImagePricingDraftState,
	type PricingTierDraftRow,
} from '@/lib/pricing-tiers-draft';
import { parseMetadataForSave } from './model-utils';
import type {
	ModelFormData,
	ModelImportResult,
	ModelListItem,
	PresetCatalogRow,
} from './types';

export function modelWrite(
	formData: ModelFormData,
	pricingTierRows: PricingTierDraftRow[],
	editingModelId: string | null,
	imagePricingDraft?: ImagePricingDraftState | null,
	audioPricingDraft?: AudioPricingDraftState | null
):
	| { ok: true; path: string; init: RequestInit }
	| { ok: false; message: string } {
	const isImage = isImageGenerationModel({
		output_modalities: formData.output_modalities,
	});
	const isAudio = !!audioPricingDraft;
	const tierJson = isAudio
		? serializeAudioPricingDraft(audioPricingDraft)
		: isImage && imagePricingDraft
		? serializeImagePricingDraft(imagePricingDraft)
		: serializeDraftRowsToProfileJson(pricingTierRows);
	if (!tierJson.ok) {
		return { ok: false, message: tierJson.error };
	}
	const metaParsed = parseMetadataForSave(formData.metadata);
	if (!metaParsed.ok) {
		return { ok: false, message: metaParsed.error };
	}

	const isImageResolved = isImageGenerationModel({
		output_modalities: formData.output_modalities,
		pricing_profile: tierJson.json,
	});
	const isAudioResolved =
		isAudio ||
		isAudioTranscriptionModel({
			pricing_profile: tierJson.json,
		});
	const skipTokenLimits = isImageResolved || isAudioResolved;
	const parsedMax = formData.max_tokens.trim()
		? Number(formData.max_tokens)
		: 4096;
	const context = formData.context_window.trim()
		? Number(formData.context_window)
		: null;
	if (
		!skipTokenLimits &&
		(!Number.isSafeInteger(parsedMax) ||
			parsedMax <= 0 ||
			(context !== null && (!Number.isSafeInteger(context) || context <= 0)))
	)
		return { ok: false, message: 'INVALID_TOKEN_LIMITS' };
	const payload = {
		...formData,
		tags: formData.tags,
		vendor: normalizeModelVendorInput(formData.vendor),
		// Image / Audio：chat context / max_tokens 不适用 — 保存时始终清空
		context_window: skipTokenLimits ? null : context,
		max_tokens: skipTokenLimits ? null : parsedMax,
		input_modalities: formData.input_modalities,
		output_modalities: formData.output_modalities,
		released_at: formData.released_at.trim() || null,
		pricing_profile: tierJson.json,
		metadata: metaParsed.value,
	};

	return {
		ok: true,
		path: editingModelId
			? `/api/admin/models/${encodeURIComponent(editingModelId)}`
			: '/api/admin/models',
		init: {
			method: editingModelId ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(
				editingModelId
					? Object.fromEntries(
							Object.entries(payload).filter(([key]) => key !== 'id')
					  )
					: payload
			),
		},
	};
}

function invalid(): never {
	throw new ShellRequestError('INVALID_RESPONSE');
}
function data(body: unknown): unknown {
	parseShellSuccess(body);
	return (body as Record<string, unknown>).data;
}
const nullableString = (v: unknown) =>
	v === null || v === undefined || typeof v === 'string';
const count = (v: unknown) =>
	typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function stringArray(v: unknown): v is string[] {
	return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function model(value: unknown): ModelListItem {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		!value.id ||
		typeof value.vendor !== 'string' ||
		!stringArray(value.tags)
	)
		invalid();
	for (const key of [
		'display_name',
		'description',
		'metadata',
		'released_at',
		'pricing_profile',
		'input_modalities',
		'output_modalities',
	])
		if (!nullableString(value[key])) invalid();
	for (const key of ['context_window', 'max_tokens'])
		if (
			value[key] != null &&
			(typeof value[key] !== 'number' ||
				!Number.isSafeInteger(value[key]) ||
				(value[key] as number) <= 0)
		)
			invalid();
	for (const key of ['routes_count', 'active_routes_count'])
		if (value[key] !== undefined && !count(value[key])) invalid();
	for (const [key, allowed] of [
		['input_modalities', MODEL_INPUT_MODALITIES],
		['output_modalities', MODEL_OUTPUT_MODALITIES],
	] as const) {
		const raw = value[key];
		if (raw == null || raw === '') continue;
		let mods: unknown;
		try {
			mods = JSON.parse(raw as string);
		} catch {
			invalid();
		}
		if (
			!stringArray(mods) ||
			mods.some((m) => !(allowed as readonly string[]).includes(m))
		)
			invalid();
	}
	if (
		!nullableString(value.route_policy) ||
		typeof value.created_at !== 'string'
	)
		invalid();
	const raw = value.pricing_profile;
	if (typeof raw === 'string' && raw.trim()) {
		const profile = parsePricingProfile(raw);
		if (!profile) invalid();
		const root = JSON.parse(raw) as Record<string, unknown>;
		if (
			(root.image != null && !profile.image) ||
			(root.audio != null && !profile.audio) ||
			(profile.image_billing_mode === 'per_image' && !profile.image) ||
			(profile.audio_billing_mode === 'per_second' && !profile.audio)
		)
			invalid();
	}
	return value as unknown as ModelListItem;
}
export function parseModels(body: unknown): ModelListItem[] {
	const rows = data(body);
	if (!Array.isArray(rows)) invalid();
	const models = rows.map(model);
	if (new Set(models.map((m) => m.id)).size !== models.length) invalid();
	return models;
}
export function parseModel(body: unknown): ModelListItem {
	return model(data(body));
}
export function parseModelCatalog(body: unknown): {
	currency: string;
	rows: PresetCatalogRow[];
} {
	const rows = data(body);
	if (
		!isRecord(body) ||
		!['USD', 'CNY'].includes(String(body.billing_currency)) ||
		!Array.isArray(rows)
	)
		invalid();
	for (const row of rows) {
		if (
			!isRecord(row) ||
			typeof row.id !== 'string' ||
			!row.id ||
			typeof row.vendor !== 'string' ||
			!['llm', 'image', 'audio'].includes(String(row.kind)) ||
			!count(row.tier_count)
		)
			invalid();
		for (const key of ['context_window', 'max_tokens'])
			if (
				row[key] !== null &&
				(typeof row[key] !== 'number' ||
					!Number.isSafeInteger(row[key]) ||
					(row[key] as number) <= 0)
			)
				invalid();
		for (const key of [
			'display_name',
			'description',
			'pricing_label',
			'pricing_preview',
		])
			if (!nullableString(row[key])) invalid();
		if (
			row.i18n != null &&
			(!isRecord(row.i18n) ||
				typeof row.i18n.en !== 'string' ||
				typeof row.i18n.zh !== 'string')
		)
			invalid();
	}
	if (new Set(rows.map((r) => r.id)).size !== rows.length) invalid();
	return {
		currency: body.billing_currency as string,
		rows: rows as PresetCatalogRow[],
	};
}
export function parseModelImport(body: unknown): ModelImportResult {
	const result = data(body);
	if (
		!isRecord(result) ||
		!['USD', 'CNY'].includes(String(result.billing_currency_used)) ||
		!count(result.created) ||
		!stringArray(result.skipped_existing) ||
		!Array.isArray(result.failed) ||
		!result.failed.every(
			(f) =>
				isRecord(f) && typeof f.id === 'string' && typeof f.message === 'string'
		)
	)
		invalid();
	const ids = [...result.skipped_existing, ...result.failed.map((f) => f.id)];
	if (ids.some((id) => !id) || new Set(ids).size !== ids.length) invalid();
	return result as ModelImportResult;
}
export function parseModelCurrency(body: unknown): string {
	const rows = data(body);
	if (
		!Array.isArray(rows) ||
		!rows.every(
			(r) =>
				isRecord(r) && typeof r.key === 'string' && typeof r.value === 'string'
		)
	)
		invalid();
	if (new Set(rows.map((r) => r.key)).size !== rows.length) invalid();
	const row = rows.find((r) => r.key === 'BILLING_CURRENCY');
	// An absent setting has the documented USD business meaning; malformed reads fail.
	if (!row) return 'USD';
	const currency = row.value.trim().toUpperCase();
	if (!['USD', 'CNY'].includes(currency)) invalid();
	return currency;
}
