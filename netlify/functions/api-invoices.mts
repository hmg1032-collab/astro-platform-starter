import type { Config, Context } from '@netlify/functions';
import { getPortalStore } from './_shared/blobStore.mts';
import { getIdentityUser } from './_shared/identity.mts';
import type { CustomerOrder } from './api-orders.mts';

const json = (data: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			...(init?.headers ?? {})
		}
	});

const getOrdersKey = (userId: string) => `orders/${userId}.json`;

export default async (req: Request, context: Context) => {
	if (req.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 });

	const user = getIdentityUser(context);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const url = new URL(req.url);
	const parts = url.pathname.split('/').filter(Boolean);
	const orderId = parts[parts.length - 1];
	if (!orderId) return json({ error: 'Missing order id' }, { status: 400 });

	const store = getPortalStore();
	const orders = (await store.get(getOrdersKey(user.sub), { type: 'json' })) as CustomerOrder[] | null;
	const order = (orders ?? []).find((candidate) => candidate.id === orderId);
	if (!order) return json({ error: 'Order not found' }, { status: 404 });
	if (!order.invoice?.key) return json({ error: 'Invoice not available for this order' }, { status: 404 });

	const pdf = (await store.get(order.invoice.key, { type: 'arrayBuffer' })) as ArrayBuffer | null;
	if (!pdf) return json({ error: 'Invoice file missing' }, { status: 404 });

	return new Response(pdf, {
		status: 200,
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${order.invoice.filename || `invoice-${order.id}.pdf`}"`,
			'cache-control': 'no-store'
		}
	});
};

export const config: Config = {
	path: '/api/invoices/*'
};

