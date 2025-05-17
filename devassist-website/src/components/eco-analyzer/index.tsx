'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { aiClient } from '@/lib/ai';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { Switch } from '@/components/ui/switch';

interface EcoAnalysisResult {
	ecoScore: number;
	issues: string[];
	suggestions: string[];
	details: Record<string, any>;
	timestamp: number;
	fileName?: string;
}

export default function EcoAnalyzer() {
	const [code, setCode] = useState('');
	const [fileName, setFileName] = useState('');
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [apiKey, setApiKey] = useState('');
	const [useAI, setUseAI] = useState(false);
	const [analysisResult, setAnalysisResult] =
		useState<EcoAnalysisResult | null>(null);
	const [analysisHistory, setAnalysisHistory] = useState<EcoAnalysisResult[]>(
		[]
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			setCode(content);
			setFileName(file.name);
			toast.success(`Loaded ${file.name}`);
		} catch (error) {
			console.error('Error reading file:', error);
			toast.error('Failed to read file');
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleAnalyzeClick = async () => {
		if (!code.trim()) {
			toast.error('Please enter code to analyze');
			return;
		}

		setIsAnalyzing(true);

		try {
			if (useAI && apiKey) {
				aiClient.setApiKey(apiKey);
			}

			const result = await aiClient.optimizeEcoImpact(code);
			const analysisResult: EcoAnalysisResult = {
				...result,
				timestamp: Date.now(),
				fileName: fileName || 'Untitled'
			};

			setAnalysisResult(analysisResult);
			setAnalysisHistory((prev) => [analysisResult, ...prev]);
			toast.success('Eco analysis complete');
		} catch (error) {
			console.error('Error during analysis:', error);
			toast.error('Failed to complete analysis');
		} finally {
			setIsAnalyzing(false);
		}
	};

	const getScoreColor = (score: number) => {
		if (score >= 80) return 'bg-green-500';
		if (score >= 60) return 'bg-yellow-500';
		if (score >= 40) return 'bg-orange-500';
		return 'bg-red-500';
	};

	const getScoreLabel = (score: number) => {
		if (score >= 80) return 'Excellent';
		if (score >= 60) return 'Good';
		if (score >= 40) return 'Fair';
		return 'Poor';
	};

	return (
		<div className='space-y-4'>
			<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
				<Card>
					<CardHeader>
						<CardTitle>Code Input</CardTitle>
						<CardDescription>
							Upload or paste code to analyze for environmental impact
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<div className='flex flex-col space-y-2'>
								<Label htmlFor='file-name'>File Name (optional)</Label>
								<Input
									id='file-name'
									placeholder='e.g., main.js'
									value={fileName}
									onChange={(e) => setFileName(e.target.value)}
								/>
							</div>

							<div className='flex flex-col space-y-2'>
								<div className='flex justify-between items-center'>
									<Label htmlFor='code-input'>Code</Label>
									<Input
										ref={fileInputRef}
										type='file'
										accept='.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.cs,.go,.rb'
										onChange={handleFileUpload}
										className='w-[200px]'
									/>
								</div>
								<div className='border rounded-md overflow-hidden'>
									<CodeMirror
										value={code}
										height='300px'
										onChange={setCode}
										basicSetup={{
											lineNumbers: true,
											highlightActiveLine: true
										}}
									/>
								</div>
							</div>

							<div className='flex items-center justify-between'>
								<div className='flex items-center space-x-2'>
									<Switch
										id='use-ai-eco'
										checked={useAI}
										onCheckedChange={setUseAI}
									/>
									<Label htmlFor='use-ai-eco'>Use AI-enhanced analysis</Label>

									{!apiKey && useAI && (
										<Badge variant='outline' className='ml-2'>
											API key required
										</Badge>
									)}
								</div>

								<Button
									onClick={handleAnalyzeClick}
									disabled={isAnalyzing || !code.trim()}
								>
									{isAnalyzing ? 'Analyzing...' : 'Analyze Impact'}
								</Button>
							</div>

							{useAI && (
								<div className='pt-2'>
									<Label htmlFor='api-key-eco'>HuggingFace API Key</Label>
									<Input
										id='api-key-eco'
										type='password'
										placeholder='sk-...'
										value={apiKey}
										onChange={(e) => setApiKey(e.target.value)}
										className='mt-1'
									/>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					{analysisResult ? (
						<>
							<CardHeader>
								<div className='flex justify-between items-center'>
									<CardTitle>Eco Impact Results</CardTitle>
									<Badge variant={useAI && apiKey ? 'default' : 'outline'}>
										{useAI && apiKey ? 'AI-Enhanced' : 'Local Analysis'}
									</Badge>
								</div>
								<CardDescription>
									{analysisResult.fileName} - Analyzed{' '}
									{new Date(analysisResult.timestamp).toLocaleString()}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className='space-y-6'>
									<div>
										<div className='flex justify-between items-center mb-2'>
											<h3 className='text-lg font-medium'>Eco Score</h3>
											<span className='text-2xl font-bold'>
												{analysisResult.ecoScore}/100
											</span>
										</div>
										<div className='flex items-center space-x-2'>
											<Progress
												value={analysisResult.ecoScore}
												max={100}
												className={`h-2 flex-1 ${getScoreColor(
													analysisResult.ecoScore
												)}`}
											/>
											<span className='font-medium'>
												{getScoreLabel(analysisResult.ecoScore)}
											</span>
										</div>
									</div>

									<div>
										<h3 className='text-lg font-medium mb-2'>
											Identified Issues
										</h3>
										{analysisResult.issues.length === 0 ? (
											<p className='text-muted-foreground'>
												No issues detected
											</p>
										) : (
											<div className='space-y-2 max-h-[150px] overflow-y-auto'>
												{analysisResult.issues.map((issue, index) => (
													<div
														key={index}
														className='flex items-start space-x-2 p-2 bg-muted/50 rounded-md'
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
										<div className='space-y-2 max-h-[150px] overflow-y-auto'>
											{analysisResult.suggestions.map((suggestion, index) => (
												<div
													key={index}
													className='flex items-start space-x-2 p-2 bg-muted/50 rounded-md'
												>
													<Badge variant='secondary' className='mt-0.5'>
														Tip
													</Badge>
													<span className='text-sm'>{suggestion}</span>
												</div>
											))}
										</div>
									</div>

									<div className='pt-4 border-t'>
										<Button
											variant='outline'
											size='sm'
											onClick={() => {
												const blob = new Blob(
													[JSON.stringify(analysisResult, null, 2)],
													{ type: 'application/json' }
												);
												const url = URL.createObjectURL(blob);
												const a = document.createElement('a');
												a.href = url;
												a.download = `eco-analysis-${new Date()
													.toISOString()
													.slice(0, 10)}.json`;
												document.body.appendChild(a);
												a.click();
												document.body.removeChild(a);
												URL.revokeObjectURL(url);
											}}
										>
											Export Results
										</Button>
									</div>
								</div>
							</CardContent>
						</>
					) : (
						<>
							<CardHeader>
								<CardTitle>Eco Impact Analysis</CardTitle>
								<CardDescription>
									Analyze code for environmental efficiency
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className='flex flex-col items-center justify-center h-[400px] text-center space-y-4'>
									<div className='text-muted-foreground'>
										Enter code and click "Analyze Impact" to get started
									</div>
									{analysisHistory.length > 0 && (
										<div>
											<p className='text-sm mb-2'>Or view previous analyses:</p>
											<div className='flex flex-wrap gap-2'>
												{analysisHistory.slice(0, 3).map((result, index) => (
													<Badge
														key={index}
														variant='outline'
														className='cursor-pointer'
														onClick={() => setAnalysisResult(result)}
													>
														{result.fileName} ({result.ecoScore}/100)
													</Badge>
												))}
												{analysisHistory.length > 3 && (
													<Badge variant='outline'>
														+{analysisHistory.length - 3} more
													</Badge>
												)}
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</>
					)}
				</Card>
			</div>

			{analysisHistory.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Analysis History</CardTitle>
						<CardDescription>Previous eco impact analyses</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
							{analysisHistory.map((result, index) => (
								<div
									key={index}
									onClick={() => setAnalysisResult(result)}
									className={`p-3 rounded-md border cursor-pointer hover:bg-accent/50 ${
										analysisResult === result ? 'bg-accent border-accent' : ''
									}`}
								>
									<div className='flex justify-between items-center mb-2'>
										<h3 className='font-medium truncate'>{result.fileName}</h3>
										<Badge className={getScoreColor(result.ecoScore)}>
											{result.ecoScore}/100
										</Badge>
									</div>
									<div className='flex justify-between text-xs text-muted-foreground'>
										<span>{new Date(result.timestamp).toLocaleString()}</span>
										<span>{result.issues.length} issues</span>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
