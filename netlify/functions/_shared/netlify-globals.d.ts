declare const Netlify: {
	env: Record<string, string | undefined>;
	context?: {
		deploy?: {
			context?: string;
		};
	};
};

