import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'DevAssist - Modern Developer Tools',
	description:
		'A modern, modular developer tool suite for HTTP inspection, security analysis, code intelligence and ecoimpact analysis.'
};

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en' suppressHydrationWarning>
			<body className={inter.className}>
				<ThemeProvider
					attribute='class'
					defaultTheme='dark'
					enableSystem
					disableTransitionOnChange
					forcedTheme='dark'
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
