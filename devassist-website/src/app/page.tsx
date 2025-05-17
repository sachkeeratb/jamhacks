'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import LandingPage from '@/components/home/LandingPage';
import UnifiedAnalysis from '@/components/analysis/UnifiedAnalysis';
import { useAppStore } from '@/lib/store/useAppStore';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

/**
 * Dynamically import tab components to reduce initial bundle size
 * This improves initial page load performance by only loading components when needed
 */

// HTTP Inspector: Analyzes HTTP traffic and API requests
const HttpInspector = dynamic(() => import('@/components/http-inspector'), {
	loading: () => (
		<div className='p-4 text-center'>Loading HTTP Inspector...</div>
	)
});

// Security Analyzer: Detects vulnerabilities and security issues
const SecurityAnalyzer = dynamic(
	() => import('@/components/security-analyzer'),
	{
		loading: () => (
			<div className='p-4 text-center'>Loading Security Analyzer...</div>
		)
	}
);

// Code Intelligence: Provides semantic search and code understanding
const CodeIntelligence = dynamic(
	() => import('@/components/code-intelligence'),
	{
		loading: () => (
			<div className='p-4 text-center'>Loading Code Intelligence...</div>
		)
	}
);

// Eco Analyzer: Analyzes environmental impact and efficiency
const EcoAnalyzer = dynamic(() => import('@/components/eco-analyzer'), {
	loading: () => <div className='p-4 text-center'>Loading Eco Analyzer...</div>
});

/**
 * Interface defining the structure of analysis source data
 * This is used to track what type of analysis is being performed and the source content
 */
interface AnalysisSource {
	type: 'folder' | 'github' | 'paste'; // Source type (local folder, GitHub repo, or pasted code)
	content: string; // Content (file path, GitHub URL, or code text)
	metadata?: any; // Optional additional data about the source
}

/**
 * Main application component
 *
 * Handles the application state and routing between different views:
 * - Landing page for initial input
 * - Unified analysis for showing analysis results
 * - Individual tool tabs for specific functionality
 */
export default function Home() {
	// Global app state from Zustand store
	const { activeTab, setActiveTab } = useAppStore();

	// Local state for UI flow control
	const [showLanding, setShowLanding] = useState(true);
	const [analysisSource, setAnalysisSource] = useState<AnalysisSource | null>(
		null
	);

	/**
	 * Handle analysis request from landing page
	 * Transitions from landing page to analysis view
	 *
	 * @param source - The analysis source data
	 */
	const handleAnalysisRequest = (source: AnalysisSource) => {
		setAnalysisSource(source);
		setShowLanding(false);
	};

	/**
	 * Return to landing page from analysis view
	 * Resets the analysis state
	 */
	const handleBackToLanding = () => {
		setShowLanding(true);
		setAnalysisSource(null);
	};

	return (
		<MainLayout>
			<Suspense fallback={<div className='p-4 text-center'>Loading...</div>}>
				{/* Conditional rendering based on application state */}
				{showLanding ? (
					// Landing page with options to upload folder, enter GitHub URL, or paste code
					<LandingPage onAnalyze={handleAnalysisRequest} />
				) : analysisSource ? (
					// Analysis view showing results for the selected source
					<UnifiedAnalysis
						sourceType={analysisSource.type}
						sourceContent={analysisSource.content}
						sourceMetadata={analysisSource.metadata}
						onBack={handleBackToLanding}
					/>
				) : (
					// Individual tool tabs when not in analysis mode
					<>
						{activeTab === 'http-inspector' && <HttpInspector />}
						{activeTab === 'security-analyzer' && <SecurityAnalyzer />}
						{activeTab === 'code-intelligence' && <CodeIntelligence />}
						{activeTab === 'eco-analyzer' && <EcoAnalyzer />}
					</>
				)}
			</Suspense>
		</MainLayout>
	);
}
