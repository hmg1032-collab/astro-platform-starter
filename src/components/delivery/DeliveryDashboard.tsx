import * as React from 'react';
import * as netlifyIdentity from 'netlify-identity-widget';

type OrderStatus = 'processing' | 'shipped' | 'delivered';

type OrderLineItem = {
	product: string;
	quantity: number;
	unitPrice: number;
	lineTotal?: number;
};

type DeliveryAddress = {
	company?: string;
	contactName?: string;
	phone?: string;
	line1?: string;
	line2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
};

type DeliveryInfo = {
	carrier?: string;
	trackingNumber?: string;
	trackingUrl?: string;
	address?: DeliveryAddress;
	lastUpdatedAt?: string;
	statusText?: string;
};

type CustomerOrder = {
	id: string;
	createdAt: string;
	status: OrderStatus;
	estimatedDeliveryText?: string;
	estimatedDeliveryDate?: string;
	delivery?: DeliveryInfo;
	items: OrderLineItem[];
	currency: string;
	total: number;
	invoice?: {
		key: string;
		filename: string;
	};
};

type MeResponse = {
	user: { id: string; email: string; name: string | null };
};

const fmtDate = (iso: string) => {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
};

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
	const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border';
	const styles =
		status === 'delivered'
			? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
			: status === 'shipped'
				? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
				: 'border-amber-400/40 bg-amber-500/10 text-amber-200';

	return <span className={`${base} ${styles}`}>{status}</span>;
};

async function getJwt(): Promise<string> {
	return netlifyIdentity.refresh(true);
}

async function apiGet<T>(path: string): Promise<T> {
	const jwt = await getJwt();
	const res = await fetch(path, { headers: { Authorization: `Bearer ${jwt}` } });
	if (!res.ok) throw new Error(`Request failed: ${res.status}`);
	return (await res.json()) as T;
}

const formatMoney = (currency: string, amount: number) => {
	try {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${currency}`;
	}
};

function AddressBlock({ address }: { address: DeliveryAddress }) {
	const lines = [address.company, address.contactName, address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
		.map((value) => value?.trim())
		.filter(Boolean) as string[];

	if (lines.length === 0) return null;

	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
			<p className="text-xs text-slate-400">Delivery address</p>
			<div className="mt-1 grid gap-0.5">
				{lines.map((line, idx) => (
					<p key={idx} className="font-medium text-slate-100">
						{line}
					</p>
				))}
				{address.phone ? <p className="mt-1 text-sm text-slate-300">{address.phone}</p> : null}
			</div>
		</div>
	);
}

export default function DeliveryDashboard() {
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [me, setMe] = React.useState<MeResponse['user'] | null>(null);
	const [orders, setOrders] = React.useState<CustomerOrder[]>([]);
	const [tab, setTab] = React.useState<'orders' | 'contact'>('orders');
	const [needsAuth, setNeedsAuth] = React.useState(false);

	React.useEffect(() => {
		const onInit = async (user: netlifyIdentity.User | null) => {
			if (!user) {
				setNeedsAuth(true);
				setLoading(false);
				setError(null);
				try {
					window.__abimanyuAuthModalOpen?.('login');
				} catch {
					// Ignore.
				}
				return;
			}

			try {
				setLoading(true);
				setNeedsAuth(false);
				setError(null);
				const [meRes, ordersRes] = await Promise.all([apiGet<MeResponse>('/api/me'), apiGet<{ orders: CustomerOrder[] }>('/api/orders')]);
				setMe(meRes.user);
				setOrders(ordersRes.orders);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load delivery details');
			} finally {
				setLoading(false);
			}
		};

		const onError = (err: Error) => setError(err.message || 'Identity error');

		try {
			netlifyIdentity.init({ locale: 'en' });
			netlifyIdentity.on('init', onInit);
			netlifyIdentity.on('error', onError);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to initialise sign-in');
			setLoading(false);
		}

		return () => {
			netlifyIdentity.off('init', onInit);
			netlifyIdentity.off('error', onError);
		};
	}, []);

	return (
		<div className="grid gap-6">
			<header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.4em] text-amber-300/70">Customer portal</p>
					<h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Dashboard</h1>
					{me ? <p className="mt-2 text-sm text-slate-300">Signed in as {me.email}</p> : null}
				</div>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						onClick={() => setTab('orders')}
						className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
							tab === 'orders'
								? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/35 hover:bg-amber-400'
								: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
						}`}
					>
						Orders
					</button>
					<button
						type="button"
						onClick={() => setTab('contact')}
						className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
							tab === 'contact'
								? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/35 hover:bg-amber-400'
								: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
						}`}
					>
						Contact
					</button>
					<button
						type="button"
						onClick={async () => {
							await netlifyIdentity.logout();
							setMe(null);
							setOrders([]);
							setNeedsAuth(true);
							window.__abimanyuAuthModalOpen?.('login');
						}}
						className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400/60 bg-white/5 px-5 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-white/10 hover:text-amber-50"
					>
						Log out
					</button>
				</div>
			</header>

			{needsAuth ? (
				<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300 shadow-2xl shadow-black/40">
					<p className="font-semibold text-white">Sign in required</p>
					<p className="mt-2">
						For privacy and security, order and delivery details are only shown after sign-in.
					</p>
					<div className="mt-5 flex flex-col gap-3 sm:flex-row">
						<button
							type="button"
							onClick={() => window.__abimanyuAuthModalOpen?.('login')}
							className="inline-flex h-11 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/35 transition hover:bg-amber-400"
						>
							Sign in
						</button>
						<button
							type="button"
							onClick={() => window.__abimanyuAuthModalOpen?.('signup')}
							className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400/60 bg-white/5 px-6 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-white/10 hover:text-amber-50"
						>
							Create account
						</button>
					</div>
				</section>
			) : null}

			{loading ? (
				<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300 shadow-2xl shadow-black/40">
					Loading delivery details…
				</section>
			) : null}

			{error ? (
				<section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-100 shadow-2xl shadow-black/40">
					{error}
				</section>
			) : null}

			{!needsAuth && !loading && !error && tab === 'contact' ? (
				<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300 shadow-2xl shadow-black/40">
					<p className="text-xs uppercase tracking-[0.35em] text-slate-400">Support</p>
					<h2 className="mt-2 text-xl font-semibold text-white">Contact</h2>
					<p className="mt-3">
						Email{' '}
						<a className="text-amber-200 underline decoration-amber-400/40 underline-offset-4" href="mailto:abimanyu3wholesale@gmail.com">
							abimanyu3wholesale@gmail.com
						</a>{' '}
						for order questions.
					</p>
					<p className="mt-3">
						WhatsApp support:{' '}
						<a
							className="text-amber-200 underline decoration-amber-400/40 underline-offset-4"
							href={`https://wa.me/447341652445?text=${encodeURIComponent('Hello Abimanyu 3 Ltd, I need help with my order.')}`}
							target="_blank"
							rel="noreferrer"
						>
							+44 7341 652445
						</a>
					</p>
				</section>
			) : null}

			{!needsAuth && !loading && !error && tab === 'orders' ? (
				<section className="grid gap-6">
					{orders.length === 0 ? (
						<div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300 shadow-2xl shadow-black/40">
							<p className="font-semibold text-white">No deliveries found</p>
							<p className="mt-2">If an order was placed recently, it may take a short time to appear.</p>
							<p className="mt-2">
								Need help? Email{' '}
								<a className="text-amber-200 underline decoration-amber-400/40 underline-offset-4" href="mailto:abimanyu3wholesale@gmail.com">
									abimanyu3wholesale@gmail.com
								</a>
								.
							</p>
						</div>
					) : null}

					{orders.map((order) => (
						<article key={order.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<p className="text-xs uppercase tracking-[0.35em] text-slate-400">Order</p>
									<h2 className="mt-1 text-xl font-semibold text-white">{order.id}</h2>
									<p className="mt-2 text-sm text-slate-300">Placed {fmtDate(order.createdAt)}</p>
								</div>
								<div className="flex flex-wrap items-center gap-3">
									<StatusBadge status={order.status} />
									<div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-slate-200">
										<p className="text-xs text-slate-400">Estimated delivery</p>
										<p className="font-semibold text-slate-100">
											{order.estimatedDeliveryText ? order.estimatedDeliveryText : order.estimatedDeliveryDate ? fmtDate(order.estimatedDeliveryDate) : '—'}
										</p>
									</div>
									<div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-slate-200">
										<p className="text-xs text-slate-400">Total</p>
										<p className="font-semibold text-slate-100">{formatMoney(order.currency, order.total)}</p>
									</div>
								</div>
							</div>

							{order.delivery?.statusText ? <p className="mt-4 text-sm text-slate-300">{order.delivery.statusText}</p> : null}

							{Array.isArray(order.items) && order.items.length ? (
								<div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
									<table className="w-full text-left text-sm text-slate-200">
										<thead className="bg-white/[0.03] text-xs uppercase tracking-[0.25em] text-slate-400">
											<tr>
												<th className="px-4 py-3 font-semibold">Product</th>
												<th className="px-4 py-3 font-semibold">Qty</th>
												<th className="px-4 py-3 font-semibold">Unit</th>
												<th className="px-4 py-3 font-semibold">Line</th>
											</tr>
										</thead>
										<tbody>
											{order.items.map((item, idx) => {
												const lineTotal =
													typeof item.lineTotal === 'number' ? item.lineTotal : item.quantity * item.unitPrice;
												return (
													<tr key={`${order.id}-${idx}`} className="border-t border-white/10">
														<td className="px-4 py-3 font-medium text-white">{item.product}</td>
														<td className="px-4 py-3">{item.quantity}</td>
														<td className="px-4 py-3">{formatMoney(order.currency, item.unitPrice)}</td>
														<td className="px-4 py-3">{formatMoney(order.currency, lineTotal)}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : null}

							<div className="mt-6 grid gap-4 sm:grid-cols-2">
								{order.delivery?.carrier || order.delivery?.trackingNumber ? (
									<div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
										<p className="text-xs text-slate-400">Tracking</p>
										<div className="mt-1 grid gap-1">
											{order.delivery?.carrier ? <p className="font-medium text-slate-100">{order.delivery.carrier}</p> : null}
											{order.delivery?.trackingNumber ? <p className="text-slate-200">{order.delivery.trackingNumber}</p> : null}
											{order.delivery?.trackingUrl ? (
												<a
													className="mt-1 inline-flex w-fit items-center rounded-full border border-amber-400/60 bg-white/5 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-white/10 hover:text-amber-50"
													href={order.delivery.trackingUrl}
													target="_blank"
													rel="noreferrer"
												>
													Open tracking
												</a>
											) : null}
										</div>
									</div>
								) : null}

								{order.delivery?.address ? <AddressBlock address={order.delivery.address} /> : null}
							</div>

							{order.invoice?.key ? (
								<div className="mt-6 flex flex-wrap items-center gap-3">
									<button
										type="button"
										onClick={async () => {
											try {
												const jwt = await getJwt();
												const res = await fetch(`/api/invoices/${encodeURIComponent(order.id)}`, {
													headers: { Authorization: `Bearer ${jwt}` }
												});
												if (!res.ok) throw new Error(`Invoice download failed: ${res.status}`);
												const blob = await res.blob();
												const url = URL.createObjectURL(blob);
												const link = document.createElement('a');
												link.href = url;
												link.download = order.invoice?.filename || `invoice-${order.id}.pdf`;
												document.body.appendChild(link);
												link.click();
												link.remove();
												window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
											} catch (err) {
												setError(err instanceof Error ? err.message : 'Failed to download invoice');
											}
										}}
										className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400/60 bg-white/5 px-5 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-white/10 hover:text-amber-50"
									>
										Download invoice
									</button>
								</div>
							) : null}

							{order.delivery?.lastUpdatedAt ? (
								<p className="mt-4 text-xs text-slate-400">Last updated {fmtDate(order.delivery.lastUpdatedAt)}</p>
							) : null}
						</article>
					))}
				</section>
			) : null}
		</div>
	);
}
