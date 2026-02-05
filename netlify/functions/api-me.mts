import type { Config, Context } from '@netlify/functions';
import { getPortalStore } from './_shared/blobStore.mts';
import { getIdentityUser, normalizeEmail } from './_shared/identity.mts';

const json = (data: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...(init?.headers ?? {})
		}
	});

export default async (_req: Request, context: Context) => {
	const user = getIdentityUser(context);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const email = user.email ? normalizeEmail(user.email) : null;
	if (!email) return json({ error: 'Email missing on identity user' }, { status: 400 });

	const store = getPortalStore();
	await store.setJSON(`identity/email/${email}`, { sub: user.sub, updatedAt: new Date().toISOString() });
	await store.setJSON(`user_login/${user.sub}`, {
		id: user.sub,
		email,
		name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
		lastLoginAt: new Date().toISOString()
	});

	return json({
		user: {
			id: user.sub,
			email,
			name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
		}
	});
};

export const config: Config = {
	path: '/api/me'
};
