import * as React from 'react';
import * as netlifyIdentity from 'netlify-identity-widget';

type OrderStatus = 'processing' | 'shipped' | 'delivered';

type OrderLineItem = {
	product: string;
	quantity: number;
	unitPrice: number;
	lineTotal?: number;
};

type CustomerOrder = {
	id: string;
	createdAt: string;
	status: OrderStatus;
	items: OrderLineItem[];
	currency: string;
	total: number;
};

type MeResponse = {
	user: { id: string; email: string; name: string | null };
};

const fmtDate = (iso: string) => {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
};

const formatMoney = (currency: string, amount: number) => {
	try {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${currency}`;
	}
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

const QuickLink = ({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) => (
	<a
		href={href}
		className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-amber-400/50 hover:bg-white/[0.06] hover:shadow-xl shadow-lg shadow-black/20 group"
	>
		<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
			{icon}
		</div>
		<h3 className="text-lg font-semibold text-white">{title}</h3>
		<p className="mt-1 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{description}</p>
	</a>
);

export default function WholesaleDashboard() {
	const [me, setMe] = React.useState<MeResponse['user'] | null>(null);
	const [orders, setOrders] = React.useState<CustomerOrder[]>([]);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		netlifyIdentity.init({ locale: 'en' });
		const user = netlifyIdentity.currentUser();

		if (!user) {
			window.location.assign('/login?returnTo=/dashboard');
			return;
		}

		const fetchData = async () => {
			try {
				const [meRes, ordersRes] = await Promise.all([apiGet<MeResponse>('/api/me'), apiGet<{ orders: CustomerOrder[] }>('/api/orders')]);
				setMe(meRes.user);
				setOrders(ordersRes.orders);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	const reorder = (order: CustomerOrder) => {
		const cartKey = 'abimanyu_cart_v1';
		try {
			const raw = localStorage.getItem(cartKey);
			const currentCart = raw ? JSON.parse(raw) : [];
			const newItems = order.items.map(item => ({
				id: `reorder-${item.product}`, // Simplified, ideally we have real IDs
				name: item.product,
				grade: 'Reorder',
				grams: 1000, // Defaulting to 1kg if not known, or we need to parse from product name/metadata
				priceGbp: item.lineTotal || (item.unitPrice * item.quantity)
			}));
			
			// Note: This is a basic reorder implementation. A real one would need precise product IDs and variants.
			// Since the current cart logic is loose (text based), this might just work for the quote request.
			
			const updatedCart = [...currentCart, ...newItems];
			localStorage.setItem(cartKey, JSON.stringify(updatedCart));
			window.location.assign('/cart');
		} catch (e) {
			console.error("Failed to add to cart", e);
			alert("Could not reorder items.");
		}
	};

	if (loading) {
		return <div className="text-center text-slate-400 py-20">Loading dashboard...</div>;
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold text-white">Welcome back, {me?.name || me?.email}</h1>
					<p className="text-slate-400 mt-1">Manage your wholesale orders and account.</p>
				</div>
				<button
					onClick={() => {
						netlifyIdentity.logout();
						window.location.assign('/login');
					}}
					className="px-4 py-2 rounded-full border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
				>
					Log out
				</button>
			</div>

			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				<QuickLink
					href="/products"
					title="Browse Products"
					description="View latest catalogue & prices"
					icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
				/>
				<QuickLink
					href="/products"
					title="Place Order"
					description="Start a new wholesale order"
					icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
				/>
				<QuickLink
					href="/account"
					title="Track Orders"
					description="Check delivery status"
					icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
				/>
				<QuickLink
					href="/cart"
					title="Cart"
					description="Review your active cart"
					icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
				/>
			</div>

			<section className="space-y-4">
				<h2 className="text-xl font-semibold text-white">Recent Orders</h2>
				{orders.length === 0 ? (
					<div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-center text-slate-400">
						No recent orders found. <a href="/products" className="text-amber-400 hover:underline">Start shopping</a>
					</div>
				) : (
					<div className="grid gap-4">
						{orders.slice(0, 3).map(order => (
							<div key={order.id} className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
								<div>
									<div className="flex items-center gap-3">
										<span className="font-semibold text-white">{order.id}</span>
										<span className={`text-xs px-2 py-0.5 rounded-full border ${
											order.status === 'delivered' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
											order.status === 'shipped' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' :
											'border-amber-500/30 bg-amber-500/10 text-amber-300'
										}`}>
											{order.status}
										</span>
									</div>
									<p className="text-sm text-slate-400 mt-1">{fmtDate(order.createdAt)} · {formatMoney(order.currency, order.total)}</p>
								</div>
								<div className="flex gap-3 w-full sm:w-auto">
									<a href="/account" className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition">
										Details
									</a>
									<button 
										onClick={() => reorder(order)}
										className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 text-sm font-medium text-slate-950 hover:bg-amber-400 transition shadow-lg shadow-amber-500/20"
									>
										Reorder
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
