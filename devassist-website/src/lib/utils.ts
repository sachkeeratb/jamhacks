import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Utility functions
 */

export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return (
		parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
	);
}

/**
 * Handle common network errors with descriptive messages
 * @param error The error object to analyze
 * @returns User-friendly error message
 */
export function handleNetworkError(error: unknown): string {
	// Default error message
	let errorMessage = 'An unknown network error occurred';

	if (typeof error === 'object' && error !== null) {
		// TypeScript error with message property
		if ('message' in error && typeof error.message === 'string') {
			errorMessage = error.message;

			// Look for common CORS-related errors
			if (
				errorMessage.includes('CORS') ||
				errorMessage.includes('cross-origin') ||
				errorMessage.includes('access-control-allow-origin')
			) {
				return 'Cross-Origin Request Blocked: The browser prevented this request due to CORS restrictions. Try using a CORS proxy or browser extension.';
			}

			// Network connection errors
			if (
				errorMessage.includes('NetworkError') ||
				errorMessage.includes('network') ||
				errorMessage.includes('Failed to fetch')
			) {
				return 'Network connection error: Please check your internet connection and try again.';
			}

			// Rate limiting or API restrictions
			if (
				errorMessage.includes('429') ||
				errorMessage.includes('rate limit') ||
				errorMessage.includes('too many requests')
			) {
				return 'Rate limit exceeded: Too many requests to the API. Please try again later.';
			}
		}

		// Standard fetch Response errors
		if ('status' in error && typeof error.status === 'number') {
			const status = error.status;
			if (status === 404) {
				return 'Resource not found: The requested file or repository does not exist.';
			} else if (status === 403) {
				return 'Access forbidden: You do not have permission to access this resource.';
			} else if (status === 401) {
				return 'Unauthorized: Authentication is required to access this resource.';
			} else if (status >= 500) {
				return 'Server error: The server encountered an error. Please try again later.';
			}
		}
	}

	return errorMessage;
}
