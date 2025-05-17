'use client';

import { useAppStore } from '@/lib/store/useAppStore';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from 'next-themes';
import { ReactNode } from 'react';

/**
 * Props interface for the MainLayout component
 * @interface MainLayoutProps
 * @property {ReactNode} children - The child components to render within the layout
 */
interface MainLayoutProps {
	children: ReactNode;
}

/**
 * MainLayout component
 *
 * Provides the primary layout structure for the application, including:
 * - Main content area with responsive padding
 * - Footer with copyright information
 * - Toast notification system
 *
 * This component serves as the application shell and maintains consistent
 * styling and structure across all pages.
 *
 * @param {MainLayoutProps} props - Component props
 * @returns {JSX.Element} The rendered layout component
 */
export default function MainLayout({ children }: MainLayoutProps) {
	// Access global app state
	const { activeTab } = useAppStore();

	// Access theme information for dark/light mode
	const { theme } = useTheme();

	return (
		<div className='min-h-screen flex flex-col bg-background'>
			{/* Main content area with responsive padding */}
			<main className='flex-1 container py-6 px-6 sm:px-8 md:px-12 max-w-screen-2xl mx-auto'>
				{children}
			</main>

			{/* Footer with copyright information */}
			<footer className='py-4 border-t border-border/40 text-center text-sm text-muted-foreground'>
				<div className='container max-w-screen-2xl px-6 sm:px-8 md:px-12 mx-auto'>
					DevAssist © {new Date().getFullYear()} - A Modern Developer Tool Suite
				</div>
			</footer>

			{/* Toast notification system */}
			<Toaster richColors closeButton position='bottom-right' />
		</div>
	);
}
