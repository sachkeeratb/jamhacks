'use client';

import { useAppStore } from '@/lib/store/useAppStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
	MoonIcon,
	SunIcon,
	ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Theme } from '@/lib/store/useAppStore';

/**
 * Navbar component
 *
 * Provides the main navigation interface for the application, including:
 * - Application title/logo
 * - Main navigation tabs for different tools
 * - Theme toggle button
 *
 * The component handles theme synchronization between next-themes and the
 * application's global state store.
 *
 * @returns {JSX.Element | null} The rendered navbar or null during SSR
 */
export default function Navbar() {
	// Access global app state for active tab
	const { activeTab, setActiveTab } = useAppStore();

	// Access theme control from next-themes
	const { theme, setTheme } = useTheme();

	// Track component mounting to prevent hydration mismatch
	const [mounted, setMounted] = useState(false);

	/**
	 * After mounting, we can safely show the UI
	 * This prevents hydration mismatch between server and client rendering
	 */
	useEffect(() => {
		setMounted(true);
	}, []);

	/**
	 * Sync theme changes with global store
	 * Ensures theme state is consistent across the application
	 */
	useEffect(() => {
		if (mounted && theme) {
			useAppStore.setState({ theme: theme as Theme });
		}
	}, [theme, mounted]);

	// Don't render during SSR to prevent hydration mismatch
	if (!mounted) {
		return null;
	}

	return (
		<header className='sticky top-0 z-50 w-full border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
			<div className='container flex h-14 max-w-screen-2xl items-center'>
				{/* Application title/logo */}
				<div className='mr-4 flex items-center space-x-2'>
					<span className='text-xl font-bold'>DevAssist</span>
				</div>

				{/* Main navigation tabs */}
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as any)}
					className='flex-1'
				>
					<TabsList className='grid w-full max-w-md grid-cols-4'>
						<TabsTrigger value='http-inspector'>HTTP Inspector</TabsTrigger>
						<TabsTrigger value='security-analyzer'>Security</TabsTrigger>
						<TabsTrigger value='code-intelligence'>Code Intel</TabsTrigger>
						<TabsTrigger value='eco-analyzer'>Eco Analyzer</TabsTrigger>
					</TabsList>
				</Tabs>

				{/* Theme toggle button */}
				<div className='ml-auto flex items-center space-x-2'>
					<Button
						variant='ghost'
						size='icon'
						onClick={() => {
							const newTheme = theme === 'dark' ? 'system' : 'dark';
							setTheme(newTheme);
						}}
						aria-label='Toggle theme'
					>
						{theme === 'dark' ? (
							<MoonIcon className='h-5 w-5' />
						) : (
							<ComputerDesktopIcon className='h-5 w-5' />
						)}
					</Button>
				</div>
			</div>
		</header>
	);
}
