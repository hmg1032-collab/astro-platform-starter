import type { Config, Context } from '@netlify/functions';
import { getPortalStore } from './_shared/blobStore.mts';

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {})
    }
  });

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');

export default async (req: Request, context: Context) => {
  const store = getPortalStore();
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');

  if (!productId) {
    return json({ error: 'Missing productId' }, { status: 400 });
  }

  const key = `reviews-${slugify(productId)}`;

  if (req.method === 'GET') {
    try {
      const data = await store.get(key, { type: 'json' });
      const reviews = (data as Review[]) || [];
      return json(reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { author, rating, comment } = body;

      if (!author || !rating || !comment) {
        return json({ error: 'Missing fields' }, { status: 400 });
      }

      const newReview: Review = {
        id: crypto.randomUUID(),
        author,
        rating: Number(rating),
        comment,
        date: new Date().toISOString(),
      };

      // Get existing reviews
      const existingData = await store.get(key, { type: 'json' });
      const reviews = (existingData as Review[]) || [];

      // Add new review
      const updatedReviews = [newReview, ...reviews];

      // Save back to store
      await store.setJSON(key, updatedReviews);

      return json(newReview, { status: 201 });
    } catch (error) {
      console.error('Error saving review:', error);
      return json({ error: 'Failed to save review' }, { status: 500 });
    }
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
};

export const config: Config = {
  path: '/api/reviews'
};
