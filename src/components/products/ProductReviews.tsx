import React, { useState, useEffect } from 'react';

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

interface ProductReviewsProps {
  productName: string;
  initialRating?: number;
}

export default function ProductReviews({ productName, initialRating = 0 }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ author: '', rating: 5, comment: '' });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  // Slugify helper to match the API
  const slugify = (text: string) =>
    text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');

  const productId = slugify(productName);

  useEffect(() => {
    // Fetch reviews when component mounts or modal opens
    // We can fetch primarily when modal opens to save bandwidth, 
    // but fetching on mount allows showing the correct count in the summary.
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/reviews?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (error) {
      console.error('Failed to fetch reviews', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const newReview = await res.json();
        setReviews([newReview, ...reviews]);
        setFormData({ author: '', rating: 5, comment: '' });
        setSubmitStatus('success');
        setTimeout(() => setSubmitStatus('idle'), 3000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    }
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : initialRating;

  const renderStars = (rating: number) => {
    return (
      <div className="flex text-yellow-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-4 w-4 ${star <= Math.round(rating) ? 'fill-current' : 'text-slate-300 fill-current'}`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-2">
      {/* Summary View */}
      <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => setShowModal(true)}>
        {renderStars(averageRating)}
        <span className="text-xs text-slate-500 group-hover:underline">
          {reviews.length} review{reviews.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-blue-600 group-hover:underline ml-1">Write a review</span>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-2xl font-bold text-slate-900">Customer Reviews</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Stats & Form */}
                <div className="md:col-span-1">
                  <div className="mb-6">
                    <div className="text-4xl font-bold text-slate-900">{averageRating.toFixed(1)}</div>
                    <div className="flex text-yellow-400 my-2">
                      {renderStars(averageRating)}
                    </div>
                    <p className="text-sm text-slate-500">Based on {reviews.length} reviews</p>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-4">Write a review</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Your Name</label>
                        <input
                          type="text"
                          required
                          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                          value={formData.author}
                          onChange={e => setFormData({...formData, author: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Rating</label>
                        <select
                          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                          value={formData.rating}
                          onChange={e => setFormData({...formData, rating: Number(e.target.value)})}
                        >
                          <option value="5">5 - Excellent</option>
                          <option value="4">4 - Good</option>
                          <option value="3">3 - Average</option>
                          <option value="2">2 - Poor</option>
                          <option value="1">1 - Terrible</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Review</label>
                        <textarea
                          required
                          rows={3}
                          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                          value={formData.comment}
                          onChange={e => setFormData({...formData, comment: e.target.value})}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitStatus === 'submitting'}
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                      >
                        {submitStatus === 'submitting' ? 'Submitting...' : 'Submit Review'}
                      </button>
                      {submitStatus === 'success' && <p className="text-green-600 text-sm">Review submitted!</p>}
                      {submitStatus === 'error' && <p className="text-red-600 text-sm">Error submitting review.</p>}
                    </form>
                  </div>
                </div>

                {/* Right Column: Review List */}
                <div className="md:col-span-2">
                  <h4 className="font-bold text-lg mb-4">Top Reviews</h4>
                  {isLoading ? (
                    <p className="text-slate-500">Loading reviews...</p>
                  ) : reviews.length === 0 ? (
                    <p className="text-slate-500 italic">No reviews yet. Be the first to share your thoughts!</p>
                  ) : (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b pb-6 last:border-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="bg-slate-200 rounded-full p-1">
                              <svg className="h-6 w-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                            </div>
                            <span className="font-semibold text-slate-900">{review.author}</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                             <div className="flex text-yellow-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`h-4 w-4 ${star <= review.rating ? 'fill-current' : 'text-slate-300 fill-current'}`}
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-sm text-slate-500 font-bold">Verified Purchase</span>
                          </div>
                          <div className="text-xs text-slate-400 mb-2">
                             Reviewed on {new Date(review.date).toLocaleDateString()}
                          </div>
                          <p className="text-slate-700 leading-relaxed">{review.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
