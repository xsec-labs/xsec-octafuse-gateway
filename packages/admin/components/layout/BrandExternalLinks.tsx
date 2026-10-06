'use client';

/**
 * GitHub / docs links for admin chrome (sidebar + login).
 */
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import type { SimpleIcon } from 'simple-icons';
import { siGithub } from 'simple-icons';
import {
	OCTAFUSE_GITHUB_DOCS_INDEX,
	OCTAFUSE_GITHUB_REPO_WEB,
} from '@/lib/brand';

/** GitHub mark: use currentColor so it follows link text on dark sidebar (brand hex is near-black). */
function GithubGlyph({ icon, className }: { icon: SimpleIcon; className?: string }) {
	const tBrand = useTranslations('brand');
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
		>
			<title>{tBrand('github')}</title>
			<path fill="currentColor" d={icon.path} />
		</svg>
	);
}

type Variant = 'sidebar' | 'login';

export default function BrandExternalLinks({ variant }: { variant: Variant }) {
	const tBrand = useTranslations('brand');
	const cls = 'octafuse-external-link';
	return (
		<div className={"octafuse-external-links octafuse-external-links-" + variant}>
			<a
				href={OCTAFUSE_GITHUB_REPO_WEB}
				target="_blank"
				rel="noopener noreferrer"
				className={cls}
			>
				<GithubGlyph icon={siGithub} className="h-3.5 w-3.5 shrink-0" />
				{tBrand('github')}
			</a>
			<a
				href={OCTAFUSE_GITHUB_DOCS_INDEX}
				target="_blank"
				rel="noopener noreferrer"
				className={cls}
			>
				<BookOpenIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
				{tBrand('docs')}
			</a>
		</div>
	);
}
