import type { Config, Context } from '@netlify/functions';
import { getPortalStore } from './_shared/blobStore.mts';
import { normalizeEmail } from './_shared/identity.mts';
import type { CustomerOrder } from './api-orders.mts';

type AdminUpsertOrder = Omit<CustomerOrder, 'invoice'> & {
	invoiceFilename?: string;
	invoicePdfBase64?: string;
};

type AdminUpsertBody = {
	customerEmail: string;
	orders: AdminUpsertOrder[];
};

const json = (data: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...(init?.headers ?? {})
		}
	});

const decodeBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
	const buffer = Buffer.from(base64, 'base64');
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

const getOrdersKey = (userId: string) => `orders/${userId}.json`;

export default async (req: Request, context: Context) => {
	const adminToken = process.env.ADMIN_API_TOKEN;
	const providedToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

	if (!adminToken || !providedToken || providedToken !== adminToken) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (req.method !== 'POST' && req.method !== 'PUT') {
		return json({ error: 'Method not allowed' }, { status: 405 });
	}

	let payload: AdminUpsertBody;
	try {
		payload = (await req.json()) as AdminUpsertBody;
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (!payload?.customerEmail || !Array.isArray(payload?.orders)) {
		return json({ error: 'Missing customerEmail or orders' }, { status: 400 });
	}

	const normalized = normalizeEmail(payload.customerEmail);
	const store = getPortalStore();
	const identity = (await store.get(`identity/email/${normalized}`, { type: 'json' })) as { sub?: string } | null;

	if (!identity?.sub) {
		return json(
			{
				error: 'Customer not found',
				hint: 'Ask the customer to log in once, then retry.'
			},
			{ status: 404 }
		);
	}

	const existing = (await store.get(getOrdersKey(identity.sub), { type: 'json' })) as CustomerOrder[] | null;
	const byId = new Map<string, CustomerOrder>((existing ?? []).map((order) => [order.id, order]));

	const updatedOrders: CustomerOrder[] = [];

	for (const order of payload.orders) {
		if (!order?.id || !order?.createdAt || !order?.status || !order?.currency || typeof order.total !== 'number') {
			return json({ error: `Invalid order payload for id: ${order?.id ?? 'unknown'}` }, { status: 400 });
		}

		const previous = byId.get(order.id);
		const next: CustomerOrder = {
			...previous,
			...order,
			items: Array.isArray(order.items) ? order.items : previous?.items ?? [],
			invoice: previous?.invoice
		};

		if (order.invoicePdfBase64) {
			const filename = order.invoiceFilename?.trim() || `invoice-${order.id}.pdf`;
			const invoiceKey = `invoices/${identity.sub}/${order.id}.pdf`;
			const bytes = decodeBase64ToArrayBuffer(order.invoicePdfBase64);
			await store.set(invoiceKey, bytes);
			next.invoice = { key: invoiceKey, filename };
		}

		updatedOrders.push(next);
	}

	updatedOrders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	await store.setJSON(getOrdersKey(identity.sub), updatedOrders);

	return json({ ok: true, orders: updatedOrders.length });
};

export const config: Config = {
	path: '/api/admin/orders'
};
