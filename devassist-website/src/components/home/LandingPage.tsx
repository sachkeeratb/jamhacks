'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store/useAppStore';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
	ChevronRight,
	Code,
	Github,
	FileCode,
	Terminal,
	Loader2,
	Download,
	Moon,
	Sun,
	Lock,
	ThumbsUp,
	Bug,
	FolderTree
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { aiClient } from '@/lib/ai';
import { useTheme } from 'next-themes';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import {
	parseGitHubUrl,
	downloadGitHubRepo,
	processGitHubRepo
} from '@/lib/github';

interface AnalysisSource {
	type: 'folder' | 'github' | 'paste';
	content: string;
	metadata?: any;
}

export default function LandingPage({
	onAnalyze
}: {
	onAnalyze: (source: AnalysisSource) => void;
}) {
	const [activeTab, setActiveTab] = useState<'folder' | 'github' | 'paste'>(
		'folder'
	);
	const [githubUrl, setGithubUrl] = useState('');
	const [pastedCode, setPastedCode] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [fileName, setFileName] = useState('');
	const folderInputRef = useRef<HTMLInputElement>(null);
	const [aiEnabled, setAiEnabled] = useState(false);
	const { theme } = useTheme();
	const [processingStatus, setProcessingStatus] = useState<string | null>(null);
	const [githubProcessingStatus, setGithubProcessingStatus] = useState<
		string | null
	>(null);

	// Check if Hugging Face API key is available
	useEffect(() => {
		const hasApiKey =
			process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY &&
			process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY.trim() !== '' &&
			process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY !==
				'your_huggingface_api_key_here';

		if (hasApiKey) {
			setAiEnabled(true);
			toast.success('AI assistance enabled with Hugging Face', {
				duration: 3000
			});
		} else {
			toast.warning(
				'AI assistance disabled. Add NEXT_PUBLIC_HUGGINGFACE_API_KEY to enable.',
				{
					duration: 5000
				}
			);
		}
	}, []);

	const handleSubmit = async () => {
		setIsLoading(true);

		try {
			if (activeTab === 'github') {
				if (!githubUrl.trim()) {
					toast.error('Please enter a GitHub URL');
					return;
				}

				// Simple validation for GitHub URL format
				if (!githubUrl.includes('github.com/')) {
					toast.error('Please enter a valid GitHub URL');
					return;
				}

				// Download and process GitHub repository
				await handleGithubRepo(githubUrl);
			} else if (activeTab === 'paste') {
				if (!pastedCode.trim()) {
					toast.error('Please paste some code');
					return;
				}

				onAnalyze({
					type: 'paste',
					content: pastedCode,
					metadata: {
						fileName: fileName || 'Untitled.txt'
					}
				});
			} else if (activeTab === 'folder') {
				// This will be handled by the folder input change event
				if (folderInputRef.current) {
					toast.info('Please select a folder using the file browser');
				}
			}
		} finally {
			setIsLoading(false);
		}
	};

	// Function to handle GitHub repo downloads
	const handleGithubRepo = async (url: string) => {
		setGithubProcessingStatus('Parsing GitHub URL...');

		// Parse GitHub URL to get owner and repo
		const repoInfo = parseGitHubUrl(url);
		if (!repoInfo) {
			toast.error('Invalid GitHub URL');
			setGithubProcessingStatus(null);
			return;
		}

		try {
			setGithubProcessingStatus(
				`Downloading repository: ${repoInfo.owner}/${repoInfo.repo}...`
			);
			toast.info(`Downloading ${repoInfo.owner}/${repoInfo.repo}...`);

			// Download the repository as a ZIP file
			const zipData = await downloadGitHubRepo(repoInfo.owner, repoInfo.repo);
			if (!zipData) {
				toast.error('Failed to download repository');
				setGithubProcessingStatus(null);
				return;
			}

			// Process the ZIP file to extract code files
			setGithubProcessingStatus('Processing repository files...');
			const files = await processGitHubRepo(zipData);

			if (files.length === 0) {
				toast.error('No valid code files found in repository');
				setGithubProcessingStatus(null);
				return;
			}

			// Calculate statistics for the metadata
			const totalLineCount = files.reduce(
				(sum, file) => sum + file.lineCount,
				0
			);
			const languageCounts = files.reduce((acc, file) => {
				acc[file.language] = (acc[file.language] || 0) + 1;
				return acc;
			}, {} as Record<string, number>);

			const languageLines = files.reduce((acc, file) => {
				acc[file.language] = (acc[file.language] || 0) + file.lineCount;
				return acc;
			}, {} as Record<string, number>);

			const languagePercentages = Object.entries(languageLines).map(
				([lang, lines]) => ({
					language: lang,
					percentage: Math.round((lines / totalLineCount) * 100)
				})
			);

			toast.success(
				`Processed ${
					files.length
				} files with ${totalLineCount.toLocaleString()} lines of code from GitHub`
			);

			// Send to analysis
			onAnalyze({
				type: 'folder', // Reuse folder type for consistent processing
				content: url, // Store the original URL for reference
				metadata: {
					files,
					fileCount: files.length,
					totalLineCount,
					languageCounts,
					languagePercentages,
					languageLines,
					repositoryUrl: url,
					repositoryInfo: repoInfo
				}
			});
		} catch (error) {
			console.error('Error processing GitHub repository:', error);
			toast.error(
				'Failed to process GitHub repository: ' +
					(error instanceof Error ? error.message : 'Unknown error')
			);
		} finally {
			setGithubProcessingStatus(null);
		}
	};

	const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		setIsLoading(true);
		setProcessingStatus('Scanning files...');

		try {
			const fileData: {
				path: string;
				content: string;
				language: string;
				lineCount: number;
			}[] = [];

			toast.info('Processing files...');

			// Common directories and file patterns to ignore
			const ignoredDirs = [
				'node_modules',
				'.git',
				'.next',
				'dist',
				'build',
				'target',
				'out',
				'__pycache__',
				'venv',
				'.env',
				'bin',
				'obj',
				'debug',
				'release',
				'.idea',
				'.vscode',
				'coverage'
			];

			const ignoredExtensions = [
				'.min.js',
				'.min.css',
				'.pyc',
				'.pyo',
				'.log',
				'.lock',
				'.zip',
				'.tar',
				'.gz',
				'.rar',
				'.jar',
				'.class',
				'.dll',
				'.exe',
				'.so',
				'.o',
				'.obj',
				'.pack',
				'.idx',
				'.mp4',
				'.mp3',
				'.jpg',
				'.jpeg',
				'.png',
				'.gif',
				'.svg',
				'.ico',
				'.woff',
				'.woff2',
				'.ttf',
				'.eot',
				'.md',
				'.markdown'
			];

			// Extensions we're explicitly interested in (programming languages)
			const programmingExtensions = [
				'.js',
				'.ts',
				'.jsx',
				'.tsx',
				'.py',
				'.java',
				'.c',
				'.cpp',
				'.h',
				'.cs',
				'.php',
				'.go',
				'.rs',
				'.rb',
				'.swift',
				'.kt',
				'.scala',
				'.lua',
				'.dart',
				'.ex',
				'.exs',
				'.erl',
				'.html',
				'.css',
				'.scss',
				'.sass',
				'.vue',
				'.svelte',
				'.sol',
				'.sql'
			];

			// Process up to 50 files
			const maxFiles = Math.min(files.length, 50);
			let processedCount = 0;
			let scannedCount = 0;
			let totalFiles = files.length;

			for (let i = 0; i < files.length && processedCount < maxFiles; i++) {
				const file = files[i];
				try {
					scannedCount++;
					if (scannedCount % 10 === 0) {
						setProcessingStatus(
							`Scanning files... ${scannedCount}/${totalFiles}`
						);
					}

					const path = file.webkitRelativePath || file.name;
					const ext = '.' + path.split('.').pop()?.toLowerCase();

					// Skip files in ignored directories
					if (ignoredDirs.some((dir) => path.includes(`/${dir}/`))) {
						continue;
					}

					// Skip files with ignored extensions
					if (
						ignoredExtensions.some((ext) => path.toLowerCase().endsWith(ext))
					) {
						continue;
					}

					// Skip hidden files
					if (file.name.startsWith('.')) {
						continue;
					}

					// Only include files with programming extensions
					if (
						!programmingExtensions.some((ext) =>
							path.toLowerCase().endsWith(ext)
						)
					) {
						continue;
					}

					// Skip large files (> 10MB)
					if (file.size > 10 * 1024 * 1024) {
						continue;
					}

					setProcessingStatus(
						`Reading file ${processedCount + 1}: ${file.name}`
					);
					const content = await file.text();

					// Determine language from file extension
					let language = ext ? ext.substring(1) : 'unknown';
					if (['.js', '.jsx'].includes(ext)) language = 'javascript';
					else if (['.ts', '.tsx'].includes(ext)) language = 'typescript';
					else if (['.py'].includes(ext)) language = 'python';
					else if (['.java'].includes(ext)) language = 'java';
					else if (['.c', '.cpp', '.h'].includes(ext)) language = 'cpp';
					else if (['.cs'].includes(ext)) language = 'csharp';
					else if (['.rb'].includes(ext)) language = 'ruby';
					else if (['.php'].includes(ext)) language = 'php';
					else if (['.go'].includes(ext)) language = 'go';
					else if (['.rs'].includes(ext)) language = 'rust';
					else if (['.swift'].includes(ext)) language = 'swift';
					else if (['.kt'].includes(ext)) language = 'kotlin';
					else if (['.html'].includes(ext)) language = 'html';
					else if (['.css', '.scss', '.sass'].includes(ext)) language = 'css';

					// Count lines of code (non-empty lines)
					const lineCount = content
						.split('\n')
						.filter((line) => line.trim().length > 0).length;

					fileData.push({ path, content, language, lineCount });
					processedCount++;
				} catch (error) {
					console.error('Error processing file:', file.name, error);
				}
			}

			if (fileData.length === 0) {
				toast.error(
					'No valid code files found. Try a different folder with programming files.'
				);
				return;
			}

			// Calculate statistics for the metadata
			const totalLineCount = fileData.reduce(
				(sum, file) => sum + file.lineCount,
				0
			);
			const languageCounts = fileData.reduce((acc, file) => {
				acc[file.language] = (acc[file.language] || 0) + 1;
				return acc;
			}, {} as Record<string, number>);

			const languageLines = fileData.reduce((acc, file) => {
				acc[file.language] = (acc[file.language] || 0) + file.lineCount;
				return acc;
			}, {} as Record<string, number>);

			const languagePercentages = Object.entries(languageLines).map(
				([lang, lines]) => ({
					language: lang,
					percentage: Math.round((lines / totalLineCount) * 100)
				})
			);

			toast.success(
				`Processed ${
					fileData.length
				} files with ${totalLineCount.toLocaleString()} lines of code`
			);

			onAnalyze({
				type: 'folder',
				content: 'folder-data',
				metadata: {
					files: fileData,
					fileCount: fileData.length,
					totalLineCount,
					languageCounts,
					languagePercentages,
					languageLines
				}
			});
		} catch (error) {
			console.error('Error processing folder:', error);
			toast.error(
				'Failed to process folder: ' +
					(error instanceof Error ? error.message : 'Unknown error')
			);
		} finally {
			setProcessingStatus(null);
			setIsLoading(false);
		}
	};

	return (
		<div className='flex flex-col items-center relative'>
			<motion.div
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className='text-center mb-8 pt-6'
			>
				<h1 className='text-4xl md:text-5xl font-bold mb-4'>DevAssist</h1>
				<p className='text-xl text-muted-foreground max-w-3xl'>
					An intelligent toolkit for developers to analyze code, inspect HTTP
					traffic, identify security vulnerabilities, and optimize
					eco-efficiency.
				</p>
				{aiEnabled && (
					<div className='mt-2 inline-flex items-center bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full px-3 py-1 text-sm'>
						<span className='mr-1 h-2 w-2 rounded-full bg-green-500'></span>
						AI Assistance Enabled
					</div>
				)}
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.2 }}
				className='w-full max-w-3xl'
			>
				<Card className='border-2'>
					<CardHeader>
						<CardTitle>Start Your Analysis</CardTitle>
						<CardDescription>
							Select a project folder, enter a GitHub URL, or paste your code to
							begin deep analysis
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs
							value={activeTab}
							onValueChange={(v) => setActiveTab(v as any)}
							className='w-full'
						>
							<TabsList className='grid grid-cols-3 mb-6'>
								<TabsTrigger value='folder' className='flex items-center gap-2'>
									<FileCode className='h-4 w-4' />
									Local Folder
								</TabsTrigger>
								<TabsTrigger value='github' className='flex items-center gap-2'>
									<Github className='h-4 w-4' />
									GitHub URL
								</TabsTrigger>
								<TabsTrigger value='paste' className='flex items-center gap-2'>
									<Code className='h-4 w-4' />
									Paste Code
								</TabsTrigger>
							</TabsList>

							<TabsContent value='folder' className='space-y-4'>
								<div className='flex flex-col space-y-2'>
									{isLoading && processingStatus ? (
										<div className='py-8 px-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center'>
											<Loader2 className='h-8 w-8 animate-spin mb-2 text-primary' />
											<p className='text-center'>{processingStatus}</p>
										</div>
									) : (
										<Input
											id='folder-input'
											ref={folderInputRef}
											type='file'
											// @ts-ignore - webkitdirectory is not in standard HTML input properties
											webkitdirectory='true'
											directory=''
											multiple={false}
											onChange={handleFolderSelect}
											className='py-8 px-4 border-2 border-dashed text-center'
											disabled={isLoading}
										/>
									)}
									<p className='text-sm text-muted-foreground text-center'>
										Select a project folder to analyze programming files (.js,
										.py, .java, etc.)
									</p>
								</div>
							</TabsContent>

							<TabsContent value='github' className='space-y-4'>
								<div className='flex flex-col space-y-2'>
									{isLoading && githubProcessingStatus ? (
										<div className='py-8 px-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center'>
											<Loader2 className='h-8 w-8 animate-spin mb-2 text-primary' />
											<p className='text-center'>{githubProcessingStatus}</p>
										</div>
									) : (
										<>
											<Input
												placeholder='https://github.com/username/repository'
												value={githubUrl}
												onChange={(e) => setGithubUrl(e.target.value)}
												disabled={isLoading}
											/>
											<p className='text-sm text-muted-foreground'>
												Enter a GitHub repository URL to download and analyze
											</p>
											<div className='bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mt-2 mb-2'>
												<p className='text-sm text-yellow-800 dark:text-yellow-200'>
													<strong>Note:</strong> GitHub downloads may be blocked
													by browser security (CORS). The app will attempt
													multiple download methods including:
												</p>
												<ul className='text-xs text-yellow-700 dark:text-yellow-300 list-disc pl-5 pt-1'>
													<li>Using CORS proxies</li>
													<li>GitHub API file-by-file download</li>
													<li>Fallback information display</li>
												</ul>
												<p className='text-xs text-yellow-700 dark:text-yellow-300 mt-1'>
													For best results, clone repositories locally and use
													the folder upload option.
												</p>
											</div>
											<div className='pt-2'>
												<Button
													onClick={handleSubmit}
													disabled={isLoading || !githubUrl.trim()}
													className='w-full'
												>
													{isLoading ? (
														<>
															<Loader2 className='mr-2 h-4 w-4 animate-spin' />
															Processing...
														</>
													) : (
														<>
															<Download className='mr-2 h-4 w-4' />
															Download & Analyze Repository
														</>
													)}
												</Button>
											</div>
										</>
									)}
								</div>
							</TabsContent>

							<TabsContent value='paste' className='space-y-4'>
								<div className='flex flex-col space-y-2'>
									<div className='mb-2'>
										<Input
											placeholder='Filename (optional, e.g. main.js)'
											value={fileName}
											onChange={(e) => setFileName(e.target.value)}
											className='mb-2'
										/>
									</div>
									<div className='border rounded-md overflow-hidden'>
										<CodeMirror
											value={pastedCode}
											onChange={setPastedCode}
											height='240px'
											theme={vscodeDark}
											basicSetup={{
												lineNumbers: true,
												highlightActiveLine: true,
												highlightSpecialChars: true,
												foldGutter: true,
												tabSize: 2
											}}
										/>
									</div>
									<div className='pt-2'>
										<Button
											onClick={handleSubmit}
											disabled={isLoading || !pastedCode.trim()}
											className='w-full'
										>
											{isLoading ? (
												<>
													<Loader2 className='mr-2 h-4 w-4 animate-spin' />
													Processing...
												</>
											) : (
												<>
													Analyze Pasted Code
													<ChevronRight className='ml-2 h-4 w-4' />
												</>
											)}
										</Button>
									</div>
								</div>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</motion.div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5, delay: 0.4 }}
				className='mt-12 grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-4xl'
			>
				{[
					{
						icon: <Terminal className='h-6 w-6' />,
						title: 'HTTP Inspector',
						desc: 'Analyze HTTP/HTTPS traffic'
					},
					{
						icon: <Code className='h-6 w-6' />,
						title: 'Security Analysis',
						desc: 'Identify vulnerabilities'
					},
					{
						icon: <FileCode className='h-6 w-6' />,
						title: 'Code Intelligence',
						desc: 'Understand your codebase'
					},
					{
						icon: <Github className='h-6 w-6' />,
						title: 'Eco Analysis',
						desc: 'Improve environmental impact'
					}
				].map((feature, i) => (
					<Card key={i} className='flex flex-col items-center text-center p-4'>
						<div className='rounded-full bg-primary/10 p-3 mb-3'>
							{feature.icon}
						</div>
						<h3 className='font-medium'>{feature.title}</h3>
						<p className='text-sm text-muted-foreground'>{feature.desc}</p>
					</Card>
				))}
			</motion.div>
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
			className='rounded-full w-8 h-8'
		>
			<Sun className='h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
			<Moon className='absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
			<span className='sr-only'>Toggle theme</span>
		</Button>
	);
}
