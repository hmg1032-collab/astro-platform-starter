import type { Config, Context } from '@netlify/functions';
import { getPortalStore } from './_shared/blobStore.mts';
import { getIdentityUser } from './_shared/identity.mts';

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

export type CustomerOrder = {
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

	const store = getPortalStore();
	const orders = (await store.get(getOrdersKey(user.sub), { type: 'json' })) as CustomerOrder[] | null;

	return json({ orders: orders ?? [] });
};

export const config: Config = {
	path: '/api/orders'
};
