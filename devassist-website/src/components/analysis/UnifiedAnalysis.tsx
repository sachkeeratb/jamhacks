'use client';

import { useState, useEffect } from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { aiClient } from '@/lib/ai';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { useTheme } from 'next-themes';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Moon, Sun, Folder, ChevronRight, File } from 'lucide-react';
import {
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	Tooltip,
	Legend,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid
} from 'recharts';

// Define types for analysis results
interface SecurityResult {
	riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
	threats: string[];
	recommendations: string[];
	confidenceLevel: number;
}

interface EcoResult {
	ecoScore: number;
	issues: string[];
	suggestions: string[];
	details: Record<string, any>;
}

interface UnifiedAnalysisProps {
	sourceType: 'folder' | 'github' | 'paste';
	sourceContent: string;
	sourceMetadata?: any;
	onBack: () => void;
}

export default function UnifiedAnalysis({
	sourceType,
	sourceContent,
	sourceMetadata = {},
	onBack
}: UnifiedAnalysisProps) {
	const [currentTab, setCurrentTab] = useState('overview');
	const [isAnalyzing, setIsAnalyzing] = useState(true);
	const [securityResults, setSecurityResults] = useState<SecurityResult | null>(
		null
	);
	const [ecoResults, setEcoResults] = useState<EcoResult | null>(null);
	const [codeSnippets, setCodeSnippets] = useState<
		{ path: string; content: string; language?: string; lineCount?: number }[]
	>([]);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [overallScore, setOverallScore] = useState<number | null>(null);
	const [isExplaining, setIsExplaining] = useState(false);
	const [explanation, setExplanation] = useState<string>('');
	const [analysisPerformed, setAnalysisPerformed] = useState(false);
	const { theme } = useTheme();

	// Colours for language charts
	const COLOURS = [
		'#0088FE',
		'#00C49F',
		'#FFBB28',
		'#FF8042',
		'#8884d8',
		'#82ca9d',
		'#ffc658',
		'#8dd1e1',
		'#a4de6c',
		'#d0ed57'
	];

	// Analyze content when component mounts
	useEffect(() => {
		// Skip if analysis has already been performed
		if (analysisPerformed) return;

		async function performAnalysis() {
			setIsAnalyzing(true);
			toast.info('Starting comprehensive analysis...');

			try {
				// For folder analysis and GitHub repositories (which now use the same processing)
				if (
					(sourceType === 'folder' || sourceType === 'github') &&
					sourceMetadata?.files
				) {
					const files = sourceMetadata.files as {
						path: string;
						content: string;
						language: string;
						lineCount: number;
					}[];

					// Keep all metadata with code snippets
					setCodeSnippets(files.slice(0, 10));

					if (files.length > 0) {
						setSelectedFile(files[0].path);

						// Pick a representative file for analysis (ideally we'd analyze all, but for demo purposes)
						const representativeFile =
							files.find(
								(f) =>
									f.path.endsWith('.js') ||
									f.path.endsWith('.ts') ||
									f.path.endsWith('.py') ||
									f.path.endsWith('.java')
							) || files[0];

						// Run security analysis
						const securityResult = await aiClient.generateSecurityReport(
							representativeFile.content
						);
						setSecurityResults(securityResult);

						// Run eco impact analysis
						const ecoResult = await aiClient.optimizeEcoImpact(
							representativeFile.content
						);
						setEcoResults(ecoResult);

						// Calculate overall score (weighted average)
						const securityScore = securityResultToScore(
							securityResult.riskLevel
						);
						const overallScoreValue = Math.round(
							securityScore * 0.6 + ecoResult.ecoScore * 0.4
						);
						setOverallScore(overallScoreValue);
					}
				}
				// For the old GitHub URL approach (fallback only)
				else if (sourceType === 'github' && !sourceMetadata?.files) {
					toast.error(
						'Failed to download GitHub repository. This may be due to CORS restrictions.',
						{
							id: 'github-download-error',
							duration: 5000
						}
					);

					toast.info(
						'Try using the "View on GitHub" button to download and analyze locally.',
						{
							id: 'github-alternative',
							duration: 7000
						}
					);

					setSecurityResults({
						riskLevel: 'Medium',
						threats: ['Unable to analyze repository directly'],
						recommendations: [
							'Clone repository locally for full analysis',
							'Try disabling CORS restrictions in your browser (developer mode)',
							'Use a browser extension that disables CORS'
						],
						confidenceLevel: 0.5
					});

					setEcoResults({
						ecoScore: 60,
						issues: ['Repository analysis requires local files'],
						suggestions: ['Download repository for detailed analysis'],
						details: {}
					});

					setOverallScore(50);

					// Create a single code snippet placeholder for GitHub repos with troubleshooting info
					setCodeSnippets([
						{
							path: 'README.md',
							content: `# GitHub Repository Analysis Error

Repository: ${sourceContent}

## Troubleshooting

1. GitHub download failed due to CORS restrictions
2. Try one of these solutions:
   - Clone this repository locally and use the folder upload option
   - Use a browser extension to disable CORS
   - Open DevTools and disable CORS (Chrome: run with --disable-web-security flag)

## Direct Links

- [View on GitHub](${sourceContent})
- [Download ZIP](${sourceContent}/archive/refs/heads/main.zip) (Right-click → Save Link As)
- [Clone Repository](git clone ${sourceContent}.git)

## Technical Details

The browser's security policy (CORS) prevents direct downloading from GitHub via JavaScript.
Check the console for specific error messages.`,
							language: 'markdown',
							lineCount: 20
						}
					]);
					setSelectedFile('README.md');
				}
				// For pasted code
				else if (sourceType === 'paste') {
					// Count lines in pasted code
					const lineCount = sourceContent
						.split('\n')
						.filter((line) => line.trim().length > 0).length;
					// Try to determine language from file extension
					let language = 'unknown';
					const fileName = sourceMetadata?.fileName || '';
					const ext = fileName.split('.').pop()?.toLowerCase();

					if (ext) {
						if (['js', 'jsx'].includes(ext)) language = 'javascript';
						else if (['ts', 'tsx'].includes(ext)) language = 'typescript';
						else if (['py'].includes(ext)) language = 'python';
						else if (['java'].includes(ext)) language = 'java';
						else if (['c', 'cpp', 'h'].includes(ext)) language = 'cpp';
						else if (['cs'].includes(ext)) language = 'csharp';
						else if (['html'].includes(ext)) language = 'html';
						else if (['css'].includes(ext)) language = 'css';
						else if (['rs'].includes(ext)) language = 'rust';
						else if (['go'].includes(ext)) language = 'go';
						else if (['php'].includes(ext)) language = 'php';
						else if (['rb'].includes(ext)) language = 'ruby';
						else if (['swift'].includes(ext)) language = 'swift';
						else if (['kt'].includes(ext)) language = 'kotlin';
						else language = ext;
					}

					// Additional language detection from content if extension doesn't help
					if (language === 'unknown' || language === 'txt') {
						// Check for Rust code patterns
						if (
							sourceContent.includes('fn main()') &&
							(sourceContent.includes('rust') ||
								sourceContent.includes('impl') ||
								sourceContent.includes('pub struct') ||
								sourceContent.includes('use std::'))
						) {
							language = 'rust';
						}
						// Check for other languages
						else if (
							sourceContent.includes('public static void main(String[] args)')
						) {
							language = 'java';
						} else if (
							sourceContent.includes('def __init__') ||
							sourceContent.includes('import pandas')
						) {
							language = 'python';
						} else if (
							sourceContent.includes('console.log') ||
							sourceContent.includes('function(')
						) {
							language = 'javascript';
						}
					}

					setCodeSnippets([
						{
							path: sourceMetadata?.fileName || 'pasted-code.txt',
							content: sourceContent,
							language,
							lineCount
						}
					]);
					setSelectedFile(sourceMetadata?.fileName || 'pasted-code.txt');

					// Run security analysis
					const securityResult = await aiClient.generateSecurityReport(
						sourceContent
					);
					setSecurityResults(securityResult);

					// Run eco impact analysis
					const ecoResult = await aiClient.optimizeEcoImpact(sourceContent);
					setEcoResults(ecoResult);

					// Calculate overall score (weighted average)
					const securityScore = securityResultToScore(securityResult.riskLevel);
					const overallScoreValue = Math.round(
						securityScore * 0.6 + ecoResult.ecoScore * 0.4
					);
					setOverallScore(overallScoreValue);
				}

				// Mark analysis as complete to prevent re-runs
				setAnalysisPerformed(true);
				toast.success('Analysis complete!');
			} catch (error) {
				console.error('Analysis failed:', error);
				toast.error('Failed to complete analysis');
				// Even on error, mark as performed to prevent infinite loops
				setAnalysisPerformed(true);
			} finally {
				setIsAnalyzing(false);
			}
		}

		performAnalysis();
	}, [sourceType, sourceContent, sourceMetadata, analysisPerformed]);

	// Helper function to convert security risk level to a numeric score
	const securityResultToScore = (riskLevel: string): number => {
		switch (riskLevel) {
			case 'Low':
				return 90;
			case 'Medium':
				return 60;
			case 'High':
				return 30;
			case 'Critical':
				return 10;
			default:
				return 50;
		}
	};

	// Helper for score color
	const getScoreColor = (score: number) => {
		if (score >= 80) return 'bg-emerald-500';
		if (score >= 60) return 'bg-amber-500';
		if (score >= 40) return 'bg-orange-500';
		return 'bg-rose-600';
	};

	// Helper for score label
	const getScoreLabel = (score: number) => {
		if (score >= 80) return 'Excellent';
		if (score >= 60) return 'Good';
		if (score >= 40) return 'Fair';
		return 'Poor';
	};

	const handleExplainCode = async () => {
		if (!selectedFile) {
			toast.error('Please select a file');
			return;
		}

		setIsExplaining(true);

		try {
			const result = await aiClient.explainCode(
				codeSnippets.find((f) => f.path === selectedFile)?.content || ''
			);
			setExplanation(result);
		} catch (error) {
			console.error('Explanation error:', error);
			toast.error('Failed to generate explanation');
			setExplanation(
				'Failed to generate explanation. Please check if AI assistance is enabled.'
			);
		} finally {
			setIsExplaining(false);
		}
	};

	// Helper function to get language display name
	const getLanguageDisplayName = (langCode: string) => {
		const displayNames: Record<string, string> = {
			javascript: 'JavaScript',
			typescript: 'TypeScript',
			python: 'Python',
			java: 'Java',
			cpp: 'C/C++',
			csharp: 'C#',
			php: 'PHP',
			ruby: 'Ruby',
			go: 'Go',
			rust: 'Rust',
			html: 'HTML',
			css: 'CSS',
			swift: 'Swift',
			kotlin: 'Kotlin'
		};
		return (
			displayNames[langCode] ||
			langCode.charAt(0).toUpperCase() + langCode.slice(1)
		);
	};

	const getRiskColor = (level: string) => {
		switch (level) {
			case 'Critical':
				return 'bg-rose-600';
			case 'High':
				return 'bg-red-500';
			case 'Medium':
				return 'bg-amber-500';
			case 'Low':
				return 'bg-emerald-500';
			default:
				return 'bg-slate-500';
		}
	};

	// Add this helper function for folder tree visualization
	const buildFileTree = (files: { path: string; language?: string }[]) => {
		const tree: { [key: string]: any } = {};

		files.forEach((file) => {
			const pathParts = file.path.split('/');
			let currentLevel = tree;

			// Build the tree structure
			pathParts.forEach((part, index) => {
				if (index === pathParts.length - 1) {
					// It's a file
					currentLevel[part] = {
						type: 'file',
						path: file.path,
						language: file.language || 'unknown'
					};
				} else {
					// It's a directory
					currentLevel[part] = currentLevel[part] || {
						type: 'directory',
						children: {}
					};
					currentLevel = currentLevel[part].children;
				}
			});
		});

		return tree;
	};

	// Component for rendering file tree
	interface FileTreeProps {
		tree: { [key: string]: any };
		level?: number;
		onSelectFile?: (path: string) => void;
	}

	const FileTree = ({ tree, level = 0, onSelectFile }: FileTreeProps) => {
		const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

		const toggleExpand = (key: string) => {
			setExpanded((prev) => ({
				...prev,
				[key]: !prev[key]
			}));
		};

		return (
			<div className='ml-2'>
				{Object.entries(tree).map(([key, value]) => {
					if (value.type === 'directory') {
						const isExpanded = expanded[key] || level < 1; // Auto-expand first level
						return (
							<div key={key} className='my-1'>
								<div
									className='flex items-center cursor-pointer hover:bg-accent/50 rounded-sm px-1'
									onClick={() => toggleExpand(key)}
								>
									<ChevronRight
										className={`h-4 w-4 mr-1 transition-transform ${
											isExpanded ? 'rotate-90' : ''
										}`}
									/>
									<Folder className='h-4 w-4 mr-2 text-blue-500' />
									<span className='text-sm font-medium'>{key}</span>
								</div>
								{isExpanded && (
									<div className='ml-4 border-l border-dashed border-muted-foreground/30 pl-2 mt-1'>
										<FileTree
											tree={value.children}
											level={level + 1}
											onSelectFile={onSelectFile}
										/>
									</div>
								)}
							</div>
						);
					} else {
						const fileIcon = value.language && getFileIcon(value.language);
						return (
							<div
								key={key}
								className='flex items-center my-1 ml-6 cursor-pointer hover:bg-accent/50 rounded-sm px-1'
								onClick={() => onSelectFile?.(value.path)}
							>
								{fileIcon || <File className='h-4 w-4 mr-2 text-gray-500' />}
								<span className='text-sm truncate'>{key}</span>
							</div>
						);
					}
				})}
			</div>
		);
	};

	// Helper to get appropriate file icon based on language
	const getFileIcon = (language: string) => {
		const iconColor = 'h-4 w-4 mr-2';
		switch (language.toLowerCase()) {
			case 'javascript':
				return (
					<span className={iconColor} style={{ color: '#f7df1e' }}>
						JS
					</span>
				);
			case 'typescript':
				return (
					<span className={iconColor} style={{ color: '#3178c6' }}>
						TS
					</span>
				);
			case 'python':
				return (
					<span className={iconColor} style={{ color: '#3572A5' }}>
						PY
					</span>
				);
			case 'rust':
				return (
					<span className={iconColor} style={{ color: '#dea584' }}>
						RS
					</span>
				);
			case 'java':
				return (
					<span className={iconColor} style={{ color: '#b07219' }}>
						JV
					</span>
				);
			case 'html':
				return (
					<span className={iconColor} style={{ color: '#e34c26' }}>
						HTML
					</span>
				);
			case 'css':
				return (
					<span className={iconColor} style={{ color: '#563d7c' }}>
						CSS
					</span>
				);
			default:
				return <File className={iconColor} />;
		}
	};

	return (
		<div className='space-y-6'>
			<div className='flex justify-between items-center'>
				<h1 className='text-3xl font-bold'>Analysis Results</h1>
				<div className='flex space-x-2'>
					<Button variant='outline' onClick={onBack}>
						Back to Input
					</Button>
				</div>
			</div>

			<Tabs value={currentTab} onValueChange={setCurrentTab} className='w-full'>
				<TabsList className='grid grid-cols-4'>
					<TabsTrigger value='overview'>Overview</TabsTrigger>
					<TabsTrigger value='security'>Security</TabsTrigger>
					<TabsTrigger value='code'>Code Analysis</TabsTrigger>
					<TabsTrigger value='eco'>Eco Impact</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value='overview' className='space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle>Analysis Summary</CardTitle>
							<CardDescription>
								Combined results from all analysis modules
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-6'>
							{isAnalyzing ? (
								<div className='flex flex-col items-center justify-center py-12'>
									<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4'></div>
									<p className='text-center text-muted-foreground'>
										Analyzing your code...
									</p>
								</div>
							) : (
								<>
									<div>
										<div className='flex justify-between items-center mb-2'>
											<h3 className='text-xl font-medium'>
												Overall Quality Score
											</h3>
											<span className='text-3xl font-bold'>
												{overallScore}/100
											</span>
										</div>
										<div className='flex items-center space-x-3'>
											<Progress
												value={overallScore || 0}
												max={100}
												className={`h-3 flex-1 ${
													overallScore ? getScoreColor(overallScore) : ''
												}`}
											/>
											<span className='font-medium'>
												{overallScore ? getScoreLabel(overallScore) : 'N/A'}
											</span>
										</div>
									</div>

									{sourceType === 'folder' &&
										sourceMetadata?.languagePercentages && (
											<div>
												<h3 className='text-lg font-medium mb-3'>
													Project Composition
												</h3>
												<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
													<div className='col-span-1 flex flex-col'>
														<div className='mb-2 text-center'>
															<p className='font-medium text-sm'>
																Files by Language
															</p>
														</div>
														<div className='h-[250px] flex items-center justify-center'>
															<ResponsiveContainer width='100%' height='100%'>
																<PieChart
																	margin={{
																		top: 5,
																		right: 30,
																		bottom: 5,
																		left: 5
																	}}
																>
																	<Pie
																		data={Object.entries(
																			sourceMetadata.languageCounts || {}
																		).map(([lang, count], index) => ({
																			name: getLanguageDisplayName(lang),
																			value: count
																		}))}
																		cx='50%'
																		cy='50%'
																		innerRadius={40}
																		outerRadius={70}
																		fill='#8884d8'
																		dataKey='value'
																		label={({ percent }) =>
																			`${(percent * 100).toFixed(0)}%`
																		}
																		labelLine={false}
																	>
																		{Object.entries(
																			sourceMetadata.languageCounts || {}
																		).map((entry, index) => (
																			<Cell
																				key={`cell-${index}`}
																				fill={COLOURS[index % COLOURS.length]}
																			/>
																		))}
																	</Pie>
																	<Legend
																		layout='vertical'
																		align='right'
																		verticalAlign='middle'
																		iconSize={10}
																		iconType='circle'
																		wrapperStyle={{
																			fontSize: '11px',
																			paddingLeft: '10px',
																			overflowY: 'auto',
																			maxHeight: '180px'
																		}}
																	/>
																	<Tooltip
																		formatter={(value) => [
																			`${value} files`,
																			''
																		]}
																	/>
																</PieChart>
															</ResponsiveContainer>
														</div>
													</div>

													<div className='col-span-1 flex flex-col'>
														<div className='mb-2 text-center'>
															<p className='font-medium text-sm'>
																Lines of Code by Language
															</p>
														</div>
														<div className='h-[250px] flex items-center justify-center'>
															<ResponsiveContainer width='100%' height='100%'>
																<PieChart
																	margin={{
																		top: 5,
																		right: 30,
																		bottom: 5,
																		left: 5
																	}}
																>
																	<Pie
																		data={Object.entries(
																			sourceMetadata.languageLines || {}
																		).map(([lang, lines], index) => ({
																			name: getLanguageDisplayName(lang),
																			value: lines
																		}))}
																		cx='50%'
																		cy='50%'
																		innerRadius={40}
																		outerRadius={70}
																		fill='#8884d8'
																		dataKey='value'
																		label={({ percent }) =>
																			`${(percent * 100).toFixed(0)}%`
																		}
																		labelLine={false}
																	>
																		{Object.entries(
																			sourceMetadata.languageLines || {}
																		).map((entry, index) => (
																			<Cell
																				key={`cell-${index}`}
																				fill={COLOURS[index % COLOURS.length]}
																			/>
																		))}
																	</Pie>
																	<Legend
																		layout='vertical'
																		align='right'
																		verticalAlign='middle'
																		iconSize={10}
																		iconType='circle'
																		wrapperStyle={{
																			fontSize: '11px',
																			paddingLeft: '10px',
																			overflowY: 'auto',
																			maxHeight: '180px'
																		}}
																	/>
																	<Tooltip
																		formatter={(value) => [
																			`${value.toLocaleString()} lines`,
																			''
																		]}
																	/>
																</PieChart>
															</ResponsiveContainer>
														</div>
													</div>
												</div>
											</div>
										)}

									<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
										<div>
											<h3 className='text-lg font-medium mb-3'>
												Security Assessment
											</h3>
											{securityResults ? (
												<div className='space-y-2'>
													<div className='flex justify-between items-center'>
														<span>Risk Level:</span>
														<Badge
															className={getRiskColor(
																securityResults.riskLevel
															)}
														>
															{securityResults.riskLevel}
														</Badge>
													</div>

													<div>
														<span className='text-sm font-medium'>
															Top Threats:
														</span>
														<ul className='list-disc pl-5 mt-1 text-sm'>
															{securityResults.threats
																.slice(0, 3)
																.map((threat, i) => (
																	<li key={i}>{threat}</li>
																))}
															{securityResults.threats.length === 0 && (
																<li className='text-muted-foreground'>
																	No threats detected
																</li>
															)}
														</ul>
													</div>
												</div>
											) : (
												<p className='text-muted-foreground'>
													Security data not available
												</p>
											)}
										</div>

										<div>
											<h3 className='text-lg font-medium mb-3'>Eco Impact</h3>
											{ecoResults ? (
												<div className='space-y-2'>
													<div className='flex justify-between items-center'>
														<span>Eco Score:</span>
														<Badge
															className={getScoreColor(ecoResults.ecoScore)}
														>
															{ecoResults.ecoScore}/100
														</Badge>
													</div>

													<div>
														<span className='text-sm font-medium'>
															Issues Found:
														</span>
														<ul className='list-disc pl-5 mt-1 text-sm'>
															{ecoResults.issues.slice(0, 3).map((issue, i) => (
																<li key={i}>{issue}</li>
															))}
															{ecoResults.issues.length === 0 && (
																<li className='text-muted-foreground'>
																	No issues detected
																</li>
															)}
														</ul>
													</div>
												</div>
											) : (
												<p className='text-muted-foreground'>
													Eco data not available
												</p>
											)}
										</div>
									</div>

									<div>
										<h3 className='text-lg font-medium mb-3'>Analyzed Files</h3>
										<div className='text-sm'>
											{sourceType === 'folder' && (
												<p>
													{sourceMetadata?.fileCount || 0} files analyzed from
													your project
												</p>
											)}
											{sourceType === 'github' && (
												<p>GitHub repository: {sourceContent}</p>
											)}
											{sourceType === 'paste' && (
												<p>
													Analyzed pasted code (
													{sourceMetadata?.fileName || 'untitled'})
												</p>
											)}
										</div>
									</div>

									{sourceType === 'folder' &&
										sourceMetadata?.files &&
										sourceMetadata.files.length > 0 && (
											<div className='mt-6'>
												<h3 className='text-lg font-medium mb-3'>
													Project Structure
												</h3>
												<Card>
													<CardHeader className='py-3'>
														<CardTitle className='text-base'>
															Folder Tree
														</CardTitle>
														<CardDescription>
															File organization overview
														</CardDescription>
													</CardHeader>
													<CardContent>
														<div className='max-h-[300px] overflow-y-auto border rounded-md p-2'>
															<FileTree
																tree={buildFileTree(sourceMetadata.files)}
																onSelectFile={(path) => {
																	const file = sourceMetadata.files.find(
																		(f: {
																			path: string;
																			content: string;
																			language?: string;
																			lineCount?: number;
																		}) => f.path === path
																	);
																	if (file) {
																		setSelectedFile(file.path);
																		if (currentTab !== 'code') {
																			setCurrentTab('code');
																		}
																	}
																}}
															/>
														</div>
													</CardContent>
												</Card>
											</div>
										)}
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Security Tab */}
				<TabsContent value='security' className='space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle>Security Analysis</CardTitle>
							<CardDescription>
								Detailed security assessment of your code
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isAnalyzing ? (
								<div className='flex flex-col items-center justify-center py-12'>
									<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4'></div>
									<p className='text-center text-muted-foreground'>
										Analyzing security aspects...
									</p>
								</div>
							) : securityResults ? (
								<div className='space-y-6'>
									<div>
										<h3 className='text-lg font-medium mb-2'>
											Risk Assessment
										</h3>
										<div className='flex items-center space-x-3'>
											<Progress
												value={securityResultToScore(securityResults.riskLevel)}
												max={100}
												className={`h-2 flex-1 ${getRiskColor(
													securityResults.riskLevel
												)}`}
											/>
											<span className='font-medium'>
												{securityResults.riskLevel} Risk
											</span>
											<Badge variant='outline'>
												{Math.round(securityResults.confidenceLevel * 100)}%
												confidence
											</Badge>
										</div>
									</div>

									<div>
										<h3 className='text-lg font-medium mb-2'>
											Detected Threats
										</h3>
										{securityResults.threats.length === 0 ? (
											<p className='text-muted-foreground'>
												No threats detected
											</p>
										) : (
											<div className='space-y-2'>
												{securityResults.threats.map((threat, i) => (
													<div
														key={i}
														className='p-2 bg-muted/40 rounded-md text-sm'
													>
														{threat}
													</div>
												))}
											</div>
										)}
									</div>

									<div>
										<h3 className='text-lg font-medium mb-2'>
											Recommendations
										</h3>
										<div className='space-y-2'>
											{securityResults.recommendations.map((rec, i) => (
												<div
													key={i}
													className='p-2 bg-muted/40 rounded-md text-sm'
												>
													{rec}
												</div>
											))}
										</div>
									</div>
								</div>
							) : (
								<div className='text-center py-8 text-muted-foreground'>
									No security analysis data available
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Code Analysis Tab */}
				<TabsContent value='code' className='space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle>Code Intelligence</CardTitle>
							<CardDescription>Browse and understand your code</CardDescription>
						</CardHeader>
						<CardContent>
							{isAnalyzing ? (
								<div className='flex flex-col items-center justify-center py-12'>
									<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4'></div>
									<p className='text-center text-muted-foreground'>
										Processing code...
									</p>
								</div>
							) : codeSnippets.length > 0 ? (
								<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
									<div className='md:col-span-1 border rounded-md overflow-hidden'>
										<div className='bg-muted p-3 font-medium border-b'>
											Files
										</div>
										<div className='h-[400px] overflow-y-auto'>
											{codeSnippets.map((file, i) => (
												<div
													key={i}
													className={`p-2 border-b cursor-pointer hover:bg-accent/50 ${
														selectedFile === file.path ? 'bg-accent' : ''
													}`}
													onClick={() => setSelectedFile(file.path)}
												>
													<p className='text-sm font-medium truncate'>
														{file.path}
													</p>
													{file.lineCount && (
														<p className='text-xs text-muted-foreground'>
															{file.lineCount} lines -{' '}
															{file.language &&
																getLanguageDisplayName(file.language)}
														</p>
													)}
												</div>
											))}
										</div>
									</div>

									<div className='md:col-span-2 border rounded-md overflow-hidden'>
										<div className='bg-muted p-3 font-medium border-b flex justify-between items-center'>
											<span>{selectedFile || 'No file selected'}</span>
											{selectedFile && (
												<Button
													size='sm'
													variant='outline'
													onClick={handleExplainCode}
													disabled={isExplaining}
												>
													{isExplaining ? 'Analyzing...' : 'Explain Code'}
												</Button>
											)}
										</div>
										<div className='h-[400px] overflow-auto'>
											{selectedFile ? (
												<CodeMirror
													value={
														codeSnippets.find((f) => f.path === selectedFile)
															?.content || ''
													}
													height='400px'
													theme={vscodeDark}
													readOnly
													basicSetup={{
														lineNumbers: true,
														highlightActiveLine: true,
														foldGutter: true
													}}
												/>
											) : (
												<div className='flex items-center justify-center h-full'>
													<p className='text-muted-foreground'>
														Select a file to view
													</p>
												</div>
											)}
										</div>
									</div>
								</div>
							) : (
								<div className='text-center py-8 text-muted-foreground'>
									No code files available for analysis
								</div>
							)}

							{explanation && (
								<div className='mt-4 p-4 bg-muted/40 rounded-md'>
									<h3 className='text-lg font-medium mb-3'>Code Explanation</h3>
									<p className='whitespace-pre-line'>{explanation}</p>
								</div>
							)}

							{sourceType === 'folder' && sourceMetadata?.languageLines && (
								<div className='mt-6'>
									<h3 className='text-lg font-medium mb-3'>Code Statistics</h3>
									<div className='grid grid-cols-1 gap-6'>
										<div className='bg-muted/40 rounded-lg p-4'>
											<h4 className='font-medium mb-3'>Project Stats</h4>
											<ul className='space-y-2 text-sm'>
												<li className='flex justify-between'>
													<span>Total Files:</span>
													<span className='font-medium'>
														{sourceMetadata.fileCount}
													</span>
												</li>
												<li className='flex justify-between'>
													<span>Lines of Code:</span>
													<span className='font-medium'>
														{sourceMetadata.totalLineCount?.toLocaleString()}
													</span>
												</li>
												<li className='flex justify-between'>
													<span>Unique Languages:</span>
													<span className='font-medium'>
														{
															Object.keys(sourceMetadata.languageCounts || {})
																.length
														}
													</span>
												</li>
												<li className='flex justify-between'>
													<span>Primary Language:</span>
													{sourceMetadata.languagePercentages?.[0] && (
														<span className='font-medium'>
															{getLanguageDisplayName(
																sourceMetadata.languagePercentages[0].language
															)}{' '}
															(
															{sourceMetadata.languagePercentages[0].percentage}
															%)
														</span>
													)}
												</li>
												<li className='flex justify-between'>
													<span>Avg. Lines per File:</span>
													<span className='font-medium'>
														{sourceMetadata.totalLineCount &&
														sourceMetadata.fileCount
															? Math.round(
																	sourceMetadata.totalLineCount /
																		sourceMetadata.fileCount
															  )
															: 'N/A'}
													</span>
												</li>
												<li className='flex justify-between'>
													<span>Code Density:</span>
													<span className='font-medium'>
														{sourceMetadata.totalLineCount &&
														sourceMetadata.fileCount
															? `${
																	Math.round(
																		(sourceMetadata.totalLineCount /
																			sourceMetadata.fileCount) *
																			100
																	) / 100
															  } lines/file`
															: 'N/A'}
													</span>
												</li>
												<li className='flex justify-between'>
													<span>File Distribution:</span>
													<span className='font-medium'>
														{Object.entries(sourceMetadata.languageCounts || {})
															.sort(
																([, a], [, b]) => (b as number) - (a as number)
															)
															.slice(0, 3)
															.map(
																([lang, count], i) =>
																	`${getLanguageDisplayName(lang)}: ${count}`
															)
															.join(', ')}
													</span>
												</li>
											</ul>
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Eco Impact Tab */}
				<TabsContent value='eco' className='space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle>Eco Impact Analysis</CardTitle>
							<CardDescription>
								Environmental efficiency assessment
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isAnalyzing ? (
								<div className='flex flex-col items-center justify-center py-12'>
									<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4'></div>
									<p className='text-center text-muted-foreground'>
										Analyzing eco impact...
									</p>
								</div>
							) : ecoResults ? (
								<div className='space-y-6'>
									<div>
										<div className='flex justify-between items-center mb-2'>
											<h3 className='text-lg font-medium'>Eco Score</h3>
											<span className='text-2xl font-bold'>
												{ecoResults?.ecoScore}/100
											</span>
										</div>
										<div className='flex items-center space-x-3'>
											<Progress
												value={ecoResults?.ecoScore || 0}
												max={100}
												className={`h-2 flex-1 ${getScoreColor(
													ecoResults?.ecoScore || 0
												)}`}
											/>
											<span className='font-medium'>
												{getScoreLabel(ecoResults?.ecoScore || 0)}
											</span>
										</div>
									</div>

									<div>
										<h3 className='text-lg font-medium mb-2'>
											Identified Issues
										</h3>
										{ecoResults?.issues?.length === 0 ? (
											<p className='text-muted-foreground'>
												No issues detected
											</p>
										) : (
											<div className='space-y-2 max-h-[200px] overflow-y-auto'>
												{ecoResults?.issues?.map((issue, index) => (
													<div
														key={index}
														className={`flex items-start space-x-2 p-2 bg-muted/50 rounded-md`}
													>
														<Badge variant='destructive' className='mt-0.5'>
															Issue
														</Badge>
														<span className='text-sm'>{issue}</span>
													</div>
												))}
											</div>
										)}
									</div>

									<div>
										<h3 className='text-lg font-medium mb-2'>
											Optimization Suggestions
										</h3>
										<div className='space-y-2 max-h-[200px] overflow-y-auto'>
											{ecoResults?.suggestions?.map((suggestion, index) => (
												<div
													key={index}
													className={`flex items-start space-x-2 p-2 bg-muted/50 rounded-md`}
												>
													<Badge variant='secondary' className='mt-0.5'>
														Tip
													</Badge>
													<span className='text-sm'>{suggestion}</span>
												</div>
											))}
										</div>
									</div>
								</div>
							) : (
								<div className='text-center py-8 text-muted-foreground'>
									No eco impact data available
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

// Theme toggle component
function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<Button
			variant='ghost'
			size='icon'
			onClick={() => setTheme(theme === 'dark' ? 'system' : 'dark')}
			title={
				theme === 'dark' ? 'Switch to system theme' : 'Switch to dark mode'
			}
			className='rounded-full w-9 h-9 bg-background'
		>
			<Sun className='h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
			<Moon className='absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
			<span className='sr-only'>Toggle theme</span>
		</Button>
	);
}
