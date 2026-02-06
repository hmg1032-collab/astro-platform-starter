import * as React from 'react';
import * as netlifyIdentity from 'netlify-identity-widget';

type Mode = 'login' | 'signup' | 'recovery';
type IdentityAvailability = 'unknown' | 'available' | 'unavailable';

type Props = {
	mode: Mode;
	defaultReturnTo?: string;
};

const safeMessage = (err: unknown) => {
	if (err && typeof err === 'object') {
		const maybeJson = (err as { json?: unknown }).json;
		if (maybeJson && typeof maybeJson === 'object') {
			const jsonMsg = (maybeJson as { msg?: unknown }).msg;
			if (typeof jsonMsg === 'string' && jsonMsg.trim()) return jsonMsg;

			const jsonDesc = (maybeJson as { error_description?: unknown }).error_description;
			if (typeof jsonDesc === 'string' && jsonDesc.trim()) return jsonDesc;

			const jsonError = (maybeJson as { error?: unknown }).error;
			if (typeof jsonError === 'string' && jsonError.trim()) return jsonError;
		}

		const maybeMessage = (err as { message?: unknown }).message;
		if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;

		const maybeMsg = (err as { msg?: unknown }).msg;
		if (typeof maybeMsg === 'string' && maybeMsg.trim()) return maybeMsg;

		const maybeErrorDescription = (err as { error_description?: unknown }).error_description;
		if (typeof maybeErrorDescription === 'string' && maybeErrorDescription.trim()) return maybeErrorDescription;
	}
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === 'string' && err.trim()) return err;
	return 'Something went wrong. Please try again.';
};

const toCustomerFacingError = (raw: string) => {
	const message = raw.trim();
	const lower = message.toLowerCase();

	if (lower.includes('email not confirmed') || lower.includes('confirm your email')) {
		return 'Email not confirmed yet. Please use the confirmation link in your inbox, then sign in again.';
	}

	if (lower.includes('invalid login credentials') || (lower.includes('invalid') && lower.includes('credentials'))) {
		return 'Incorrect email or password.';
	}

	if (lower.includes('user not found') || (lower.includes('not found') && lower.includes('user'))) {
		return 'Account not found for this email. Please create an account first.';
	}

	if (lower.includes('user already exists') || lower.includes('already registered')) {
		return 'An account already exists for this email. Please sign in instead.';
	}

	if (lower.includes('password') && (lower.includes('too short') || lower.includes('must be at least'))) {
		return 'Password is too short. Please choose a longer password.';
	}

	if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
		return 'Sign in is unavailable right now. Please try again in a moment, or contact support if the issue persists.';
	}

	if (lower.includes('not found') && lower.includes('identity')) {
		return 'Customer accounts are not enabled on this site yet. Please contact support.';
	}

	return message;
};

async function checkIdentityAvailability(): Promise<IdentityAvailability> {
	try {
		const res = await fetch('/.netlify/identity/settings', { headers: { Accept: 'application/json' } });
		if (res.ok) return 'available';
		if (res.status === 404) return 'unavailable';
		return 'unknown';
	} catch {
		return 'unknown';
	}
}

const getReturnTo = (fallback: string) => {
	const params = new URLSearchParams(window.location.search);
	const requested = params.get('returnTo')?.trim();
	if (!requested) return fallback;
	if (!requested.startsWith('/')) return fallback;
	if (requested.startsWith('//')) return fallback;
	return requested;
};

const getPrefilledEmail = () => {
	const params = new URLSearchParams(window.location.search);
	return params.get('email')?.trim() ?? '';
};

const getPendingMessage = () => {
	const params = new URLSearchParams(window.location.search);
	const pending = params.get('pending')?.trim().toLowerCase();
	if (pending === 'confirmation' || pending === 'confirm') {
		return 'Welcome to Abimanyu 3 Ltd. Please confirm your email using the link we sent, then sign in to access your dashboard.';
	}
	return null;
};

const getHashParams = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

function removeHashFromUrl() {
	if (!window.location.hash) return;
	window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
}

export default function AuthPage({ mode: initialMode, defaultReturnTo = '/dashboard' }: Props) {
	const [mode, setMode] = React.useState<Mode>(initialMode);
	const [email, setEmail] = React.useState(getPrefilledEmail());
	const [password, setPassword] = React.useState('');
	const [confirmPassword, setConfirmPassword] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [success, setSuccess] = React.useState<string | null>(null);
	const [identityAvailability, setIdentityAvailability] = React.useState<IdentityAvailability>('unknown');

	const emailRef = React.useRef<HTMLInputElement | null>(null);
	const returnTo = React.useMemo(() => getReturnTo(defaultReturnTo), [defaultReturnTo]);

	const goTo = React.useCallback(
		(path: string) => {
			window.location.assign(path);
		},
		[]
	);

	const redirectAfterAuth = React.useCallback(() => goTo(returnTo), [goTo, returnTo]);

	const loginPath = React.useMemo(() => `/login?returnTo=${encodeURIComponent(returnTo)}`, [returnTo]);
	const signupPath = React.useMemo(() => `/signup?returnTo=${encodeURIComponent(returnTo)}`, [returnTo]);

	React.useEffect(() => {
		try {
			netlifyIdentity.init({ locale: 'en' });
		} catch {
			// When Identity is disabled, the page should still render a helpful message.
		}

		void checkIdentityAvailability().then(setIdentityAvailability);

		const pendingMessage = getPendingMessage();
		if (pendingMessage) setSuccess(pendingMessage);
	}, []);

	React.useEffect(() => {
		const params = getHashParams();
		const confirmationToken = params.get('confirmation_token');

		if (!confirmationToken) return;

		const confirm = async () => {
			setBusy(true);
			setError(null);
			setSuccess(null);
			try {
				const gotrue = (netlifyIdentity as unknown as { gotrue?: any }).gotrue;
				if (!gotrue || (typeof gotrue.confirm !== 'function' && typeof gotrue.verify !== 'function')) {
					throw new Error('Confirmation is unavailable on this device. Please try again.');
				}

				if (typeof gotrue.confirm === 'function') {
					await gotrue.confirm(confirmationToken, true);
				} else if (typeof gotrue.verify === 'function') {
					await gotrue.verify('signup', confirmationToken, true);
				}

				setSuccess('Welcome to Abimanyu 3 Ltd. Email confirmed. Redirecting to your dashboard…');
				removeHashFromUrl();
				window.setTimeout(redirectAfterAuth, 900);
			} catch (err) {
				setError(toCustomerFacingError(safeMessage(err)));
			} finally {
				setBusy(false);
			}
		};

		void confirm();
	}, [redirectAfterAuth]);

	React.useEffect(() => {
		const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 50);
		return () => window.clearTimeout(focusTimer);
	}, []);

	const doLogin = async () => {
		if (identityAvailability === 'unavailable') {
			setError('Customer accounts are not enabled on this site yet. Please contact support.');
			return;
		}
		setBusy(true);
		setError(null);
		setSuccess(null);
		try {
			const gotrue = (netlifyIdentity as unknown as { gotrue?: any }).gotrue;
			if (!gotrue || typeof gotrue.login !== 'function') {
				throw new Error('Customer accounts are unavailable right now. Please try again later.');
			}
			await gotrue.login(email.trim(), password, true);
			setSuccess('Signed in successfully. Redirecting…');
			window.setTimeout(redirectAfterAuth, 600);
		} catch (err) {
			setError(toCustomerFacingError(safeMessage(err)));
		} finally {
			setBusy(false);
		}
	};

	const doRecovery = async () => {
		if (identityAvailability === 'unavailable') {
			setError('Customer accounts are not enabled on this site yet. Please contact support.');
			return;
		}
		if (!email.trim()) {
			setError('Please enter your email address.');
			return;
		}
		setBusy(true);
		setError(null);
		setSuccess(null);

		try {
			const gotrue = (netlifyIdentity as unknown as { gotrue?: any }).gotrue;
			if (!gotrue || typeof gotrue.requestPasswordRecovery !== 'function') {
				throw new Error('Password recovery is unavailable right now. Please try again later.');
			}
			await gotrue.requestPasswordRecovery(email.trim());
			setSuccess('If an account exists for this email, you will receive a password reset link shortly.');
		} catch (err) {
			setError(toCustomerFacingError(safeMessage(err)));
		} finally {
			setBusy(false);
		}
	};

	const doSignup = async () => {
		if (identityAvailability === 'unavailable') {
			setError('Customer accounts are not enabled on this site yet. Please contact support.');
			return;
		}

		if (password.length < 8) {
			setError('Password must be at least 8 characters.');
			return;
		}
		if (password !== confirmPassword) {
			setError('Passwords do not match.');
			return;
		}

		setBusy(true);
		setError(null);
		setSuccess(null);

		try {
			const gotrue = (netlifyIdentity as unknown as { gotrue?: any }).gotrue;
			if (!gotrue || typeof gotrue.signup !== 'function') {
				throw new Error('Customer accounts are unavailable right now. Please try again later.');
			}
			const created = await gotrue.signup(email.trim(), password);
			const confirmationSentAt = (created as { confirmation_sent_at?: string } | null)?.confirmation_sent_at;

			if (confirmationSentAt) {
				setSuccess('Welcome to Abimanyu 3 Ltd. Please check your email to confirm your registration, then sign in.');
				window.setTimeout(() => {
					goTo(`/account?pending=confirmation&email=${encodeURIComponent(email.trim())}`);
				}, 900);
				return;
			}

			try {
				if (typeof gotrue.login !== 'function') throw new Error('Sign in unavailable');
				await gotrue.login(email.trim(), password, true);
				setSuccess('Welcome to Abimanyu 3 Ltd. Redirecting to your dashboard…');
				window.setTimeout(redirectAfterAuth, 800);
			} catch {
				setSuccess('Welcome to Abimanyu 3 Ltd. Your account is created — please sign in to continue.');
				window.setTimeout(() => goTo(`${loginPath}&email=${encodeURIComponent(email.trim())}`), 900);
			}
		} catch (err) {
			setError(toCustomerFacingError(safeMessage(err)));
		} finally {
			setBusy(false);
		}
	};

	const isSignup = mode === 'signup';
	const isRecovery = mode === 'recovery';

	return (
		<div className="mx-auto max-w-2xl">
			<p className="text-xs uppercase tracking-[0.4em] text-amber-300/70">Customer portal</p>
			<h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
				{isSignup ? 'Create account' : isRecovery ? 'Reset Password' : 'Sign in'}
			</h1>
			<p className="mt-4 text-base text-slate-300">
				{isSignup
					? 'Create an account to track orders and delivery.'
					: isRecovery
						? 'Enter your email to receive a password reset link.'
						: 'Sign in to track orders and delivery.'}
			</p>

			{identityAvailability === 'unavailable' ? (
				<div className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-100 shadow-2xl shadow-black/40">
					<p className="font-semibold text-white">Customer accounts are not enabled</p>
					<p className="mt-2">
						This website has Netlify Identity turned off. Enable Netlify Identity in the Netlify dashboard to allow customers to create accounts and sign in.
					</p>
				</div>
			) : null}

			<form
				className="mt-10 grid gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40"
				onSubmit={(event) => {
					event.preventDefault();
					if (!email.trim()) return;
					if (isRecovery) return void doRecovery();
					if (!password) return;
					if (isSignup) return void doSignup();
					return void doLogin();
				}}
			>
				<label className="grid gap-2">
					<span className="text-sm font-medium text-slate-200">Email</span>
					<input
						ref={emailRef}
						type="email"
						inputMode="email"
						autoComplete="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/30"
						placeholder="you@company.com"
					/>
				</label>

				{!isRecovery ? (
					<label className="grid gap-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-slate-200">Password</span>
							{!isSignup ? (
								<button
									type="button"
									onClick={() => {
										setMode('recovery');
										setError(null);
										setSuccess(null);
									}}
									className="text-xs text-amber-200 hover:text-amber-100 transition"
								>
									Forgot password?
								</button>
							) : null}
						</div>
						<input
							type="password"
							autoComplete={isSignup ? 'new-password' : 'current-password'}
							required={!isRecovery}
							minLength={8}
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/30"
							placeholder="At least 8 characters"
						/>
					</label>
				) : null}

				{isSignup ? (
					<label className="grid gap-2">
						<span className="text-sm font-medium text-slate-200">Confirm Password</span>
						<input
							type="password"
							autoComplete="new-password"
							required
							minLength={8}
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/30"
							placeholder="Re-enter your password"
						/>
					</label>
				) : null}

				{error ? (
					<div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
				) : null}

				{success ? (
					<div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
						{success}
					</div>
				) : null}

				<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<button
						type="submit"
						disabled={busy || identityAvailability === 'unavailable' || !email.trim() || (!isRecovery && !password) || (isSignup && !confirmPassword)}
						className="inline-flex h-11 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/35 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{busy
							? isSignup
								? 'Creating…'
								: isRecovery
									? 'Sending…'
									: 'Signing in…'
							: isSignup
								? 'Create Account'
								: isRecovery
									? 'Send Reset Link'
									: 'Sign in'}
					</button>

					<div className="text-sm text-slate-300">
						{isSignup ? (
							<>
								Already have an account?{' '}
								<button
									type="button"
									onClick={() => {
										setMode('login');
										setError(null);
										setSuccess(null);
										setPassword('');
										setConfirmPassword('');
										goTo(`${loginPath}&email=${encodeURIComponent(email.trim())}`);
									}}
									className="font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-4 transition hover:text-amber-100"
								>
									Sign in
								</button>
							</>
						) : isRecovery ? (
							<button
								type="button"
								onClick={() => {
									setMode('login');
									setError(null);
									setSuccess(null);
								}}
								className="font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-4 transition hover:text-amber-100"
							>
								Back to sign in
							</button>
						) : (
							<>
								New customer?{' '}
								<a
									href={`${signupPath}&email=${encodeURIComponent(email.trim())}`}
									className="font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-4 transition hover:text-amber-100"
								>
									Create an account
								</a>
							</>
						)}
					</div>
				</div>
			</form>

			<div className="mt-6 text-sm text-slate-400">
				<a href="/account" className="underline decoration-white/20 underline-offset-4 transition hover:text-slate-200">
					Go to dashboard
				</a>
			</div>
		</div>
	);
}
