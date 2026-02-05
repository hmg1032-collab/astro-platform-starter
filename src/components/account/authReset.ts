import * as netlifyIdentity from 'netlify-identity-widget';

const RESET_KEYS = ['reset', 'resetAuth', 'clearAuth', 'clearCache'];
const STORAGE_KEYS = ['netlifySiteURL', 'netlifyIdentity', 'gotrue.user', 'gotrue.session', 'nf_jwt'];

const removeStorageKey = (key: string) => {
	try {
		window.localStorage?.removeItem(key);
	} catch {
		// Ignore storage errors (private browsing, disabled storage).
	}
	try {
		window.sessionStorage?.removeItem(key);
	} catch {
		// Ignore storage errors (private browsing, disabled storage).
	}
};

export const consumeAuthReset = (): boolean => {
	if (typeof window === 'undefined') return false;
	const params = new URLSearchParams(window.location.search);
	let didReset = false;

	for (const key of RESET_KEYS) {
		if (params.has(key)) {
			params.delete(key);
			didReset = true;
		}
	}

	if (didReset) {
		const nextQuery = params.toString();
		const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
		window.history.replaceState(null, document.title, nextUrl);
	}

	return didReset;
};

export const clearAuthCache = () => {
	if (typeof window === 'undefined') return;

	try {
		netlifyIdentity.logout();
	} catch {
		// Ignore when identity is unavailable.
	}

	for (const key of STORAGE_KEYS) {
		removeStorageKey(key);
	}
};
