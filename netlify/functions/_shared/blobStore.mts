import { getDeployStore, getStore, type Store } from '@netlify/blobs';

const STORE_NAME = 'abimanyu3wholesale-customer-portal';

export const getPortalStore = (): Store => {
	const deployContext = process.env.CONTEXT;

	if (deployContext === 'production') {
		return getStore(STORE_NAME, { consistency: 'strong' });
	}

	return getDeployStore(STORE_NAME);
};

