import type { Context } from '@netlify/functions';

export type IdentityUser = {
	sub?: string;
	email?: string;
	user_metadata?: {
		full_name?: string;
		name?: string;
	};
};

export const getIdentityUser = (context: Context): IdentityUser | null => {
	const user = context.clientContext?.user as IdentityUser | undefined;
	if (!user?.sub) return null;
	return user;
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

