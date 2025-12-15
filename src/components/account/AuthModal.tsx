import * as React from 'react';
import * as netlifyIdentity from 'netlify-identity-widget';

declare global {
	interface Window {
		__abimanyuAuthModalOpen?: (mode?: 'login' | 'signup') => void;
		__abimanyuAuthModalClose?: () => void;
	}
}

type Mode = 'login' | 'signup';

const getRequestedMode = (): Mode | null => {
	const path = window.location.pathname.toLowerCase();
	if (path === '/signup') return 'signup';
	if (path === '/login') return 'login';
	if (path === '/account/login') return 'login';

	const params = new URLSearchParams(window.location.search);
	const mode = params.get('mode')?.toLowerCase();
	if (mode === 'signup' || mode === 'register') return 'signup';
	if (mode === 'login' || mode === 'signin') return 'login';
	return null;
};

const safeMessage = (err: unknown) => {
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === 'string' && err.trim()) return err;
	return 'Something went wrong. Please try again.';
};

export default function AuthModal() {
	const [open, setOpen] = React.useState(false);
	const [mode, setMode] = React.useState<Mode>('login');
	const [email, setEmail] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [success, setSuccess] = React.useState<string | null>(null);

	const emailRef = React.useRef<HTMLInputElement | null>(null);

	const close = React.useCallback(() => {
		setOpen(false);
		setBusy(false);
		setError(null);
		setSuccess(null);
		setPassword('');
	}, []);

	const openWithMode = React.useCallback((nextMode: Mode = 'login') => {
		setMode(nextMode);
		setOpen(true);
		setError(null);
		setSuccess(null);
	}, []);

	React.useEffect(() => {
		try {
			netlifyIdentity.init({ locale: 'en' });
		} catch {
			// If Identity is disabled for the site, the UI still renders and can show the error from requests.
		}

		window.__abimanyuAuthModalOpen = (requested?: Mode) => openWithMode(requested ?? 'login');
		window.__abimanyuAuthModalClose = close;

		const requested = getRequestedMode();
		if (requested) openWithMode(requested);

		return () => {
			delete window.__abimanyuAuthModalOpen;
			delete window.__abimanyuAuthModalClose;
		};
	}, [close, openWithMode]);

	React.useEffect(() => {
		if (!open) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 50);

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKeyDown);

		return () => {
			window.clearTimeout(focusTimer);
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [close, open]);

	const redirectAfterLogin = () => window.location.assign('/account');

	const doLogin = async () => {
		setBusy(true);
		setError(null);
		setSuccess(null);
		try {
			await netlifyIdentity.gotrue.login(email.trim(), password, true);
			setSuccess('Signed in successfully. Redirecting…');
			window.setTimeout(redirectAfterLogin, 600);
		} catch (err) {
			setError(safeMessage(err));
		} finally {
			setBusy(false);
		}
	};

	const doSignup = async () => {
		setBusy(true);
		setError(null);
		setSuccess(null);
		try {
			const created = await netlifyIdentity.gotrue.signup(email.trim(), password);
			const confirmationSentAt = (created as { confirmation_sent_at?: string } | null)?.confirmation_sent_at;
			setSuccess(
				confirmationSentAt
					? 'Account created. Please check your email to confirm, then sign in.'
					: 'Account created. You can sign in now.'
			);
			setMode('login');
			setPassword('');
		} catch (err) {
			setError(safeMessage(err));
		} finally {
			setBusy(false);
		}
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
			<button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={close} />

			<section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#070c1c] shadow-2xl shadow-black/60">
				<header className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-[0.4em] text-amber-300/70">Customer portal</p>
							<h2 className="mt-2 text-xl font-semibold text-white">
								{mode === 'signup' ? 'Create account' : 'Sign in'}
							</h2>
							<p className="mt-1 text-sm text-slate-300">Use your email and password.</p>
						</div>
						<button
							type="button"
							onClick={close}
							className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
							aria-label="Close"
						>
							<span aria-hidden="true">×</span>
						</button>
					</div>
				</header>

				<div className="grid gap-4 px-6 py-6">
					<label className="grid gap-1.5 text-sm">
						<span className="font-medium text-slate-200">Email</span>
						<input
							ref={emailRef}
							type="email"
							inputMode="email"
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
							placeholder="you@company.com"
						/>
					</label>

					<label className="grid gap-1.5 text-sm">
						<span className="font-medium text-slate-200">Password</span>
						<input
							type="password"
							autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
							placeholder="Password"
						/>
					</label>

					{error ? (
						<p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p>
					) : null}
					{success ? (
						<p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</p>
					) : null}

					<div className="grid gap-3 sm:grid-cols-2">
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								setMode('login');
								void doLogin();
							}}
							className="inline-flex h-12 w-full items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/35 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{busy && mode === 'login' ? 'Signing in…' : 'Sign in'}
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								setMode('signup');
								void doSignup();
							}}
							className="inline-flex h-12 w-full items-center justify-center rounded-full border border-amber-400/60 bg-white/5 px-6 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-white/10 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{busy && mode === 'signup' ? 'Creating…' : 'Create account'}
						</button>
					</div>

					<div className="flex items-center justify-between gap-4 text-xs text-slate-400">
						<button
							type="button"
							onClick={() => setMode((prev) => (prev === 'login' ? 'signup' : 'login'))}
							className="text-amber-200 underline decoration-amber-400/40 underline-offset-4"
						>
							{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
						</button>
						<a
							href="mailto:abimanyu3wholesale@gmail.com"
							className="text-slate-300 underline decoration-white/20 underline-offset-4 hover:text-white"
						>
							Need help?
						</a>
					</div>
				</div>
			</section>
		</div>
	);
}

