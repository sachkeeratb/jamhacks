'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { aiClient } from '@/lib/ai';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AnalysisResult {
	riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
	threats: string[];
	recommendations: string[];
	confidenceLevel: number;
	timestamp: number;
}

export default function SecurityAnalyzer() {
	const [inputText, setInputText] = useState('');
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [apiKey, setApiKey] = useState('');
	const [useAI, setUseAI] = useState(false);
	const [activeTab, setActiveTab] = useState<'input' | 'results' | 'settings'>(
		'input'
	);
	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
		null
	);
	const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);

	const handleAnalyzeClick = async () => {
		if (!inputText.trim()) {
			toast.error('Please enter a request to analyze');
			return;
		}

		setIsAnalyzing(true);

		try {
			if (useAI && apiKey) {
				aiClient.setApiKey(apiKey);
			}

			const result = await aiClient.generateSecurityReport(inputText);
			const analysisResult: AnalysisResult = {
				...result,
				timestamp: Date.now()
			};

			setAnalysisResult(analysisResult);
			setAnalysisHistory((prev) => [analysisResult, ...prev]);
			setActiveTab('results');
			toast.success('Security analysis complete');
		} catch (error) {
			console.error('Error during analysis:', error);
			toast.error('Failed to complete analysis');
		} finally {
			setIsAnalyzing(false);
		}
	};

	const getRiskColor = (level: string) => {
		switch (level) {
			case 'Critical':
				return 'bg-red-600';
			case 'High':
				return 'bg-red-500';
			case 'Medium':
				return 'bg-yellow-500';
			case 'Low':
				return 'bg-green-500';
			default:
				return 'bg-gray-500';
		}
	};

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			setInputText(text);
		} catch (error) {
			console.error('Error reading file:', error);
			toast.error('Failed to read file');
		}
	};

	return (
		<div className='space-y-4'>
			<div className='flex justify-between items-center'>
				<h2 className='text-2xl font-bold'>Security Analyzer</h2>
				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as any)}
					className='w-[400px]'
				>
					<TabsList>
						<TabsTrigger value='input'>Input</TabsTrigger>
						<TabsTrigger value='results'>Results</TabsTrigger>
						<TabsTrigger value='settings'>Settings</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<TabsContent value='input' className='mt-0'>
				<Card>
					<CardHeader>
						<CardTitle>Request Analysis</CardTitle>
						<CardDescription>
							Enter an HTTP request to analyze for security vulnerabilities
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<div className='grid w-full items-center gap-1.5'>
								<Label htmlFor='request-input'>HTTP Request</Label>
								<Textarea
									id='request-input'
									placeholder='Paste your HTTP request here...'
									value={inputText}
									onChange={(e) => setInputText(e.target.value)}
									className='min-h-[300px] font-mono'
								/>
							</div>

							<div className='flex items-center space-x-2'>
								<Button
									onClick={handleAnalyzeClick}
									disabled={isAnalyzing || !inputText.trim()}
								>
									{isAnalyzing ? 'Analyzing...' : 'Analyze Security Risks'}
								</Button>

								<Input
									type='file'
									onChange={handleFileUpload}
									className='max-w-[220px]'
								/>
							</div>

							<div className='flex items-center space-x-2'>
								<Switch
									id='use-ai'
									checked={useAI}
									onCheckedChange={setUseAI}
								/>
								<Label htmlFor='use-ai'>Use AI-enhanced analysis</Label>

								{!apiKey && useAI && (
									<Badge variant='outline' className='ml-2'>
										API key required in Settings
									</Badge>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value='results' className='mt-0'>
				<Card>
					<CardHeader>
						<CardTitle>Security Analysis Results</CardTitle>
						{analysisResult && (
							<div className='flex items-center space-x-2'>
								<Badge className={getRiskColor(analysisResult.riskLevel)}>
									{analysisResult.riskLevel} Risk
								</Badge>
								<Badge variant='outline'>
									Confidence: {Math.round(analysisResult.confidenceLevel * 100)}
									%
								</Badge>
								<Badge variant='secondary'>
									{useAI && apiKey ? 'AI-Enhanced' : 'Local Analysis'}
								</Badge>
							</div>
						)}
					</CardHeader>
					<CardContent>
						{analysisResult ? (
							<div className='space-y-6'>
								<div>
									<h3 className='text-lg font-medium mb-2'>Risk Level</h3>
									<div className='flex items-center space-x-2'>
										<Progress
											value={
												analysisResult.riskLevel === 'Low'
													? 25
													: analysisResult.riskLevel === 'Medium'
													? 50
													: analysisResult.riskLevel === 'High'
													? 75
													: 100
											}
											max={100}
											className={`h-2 flex-1 ${getRiskColor(
												analysisResult.riskLevel
											)}`}
										/>
										<span className='font-medium'>
											{analysisResult.riskLevel}
										</span>
									</div>
								</div>

								<div>
									<h3 className='text-lg font-medium mb-2'>Detected Threats</h3>
									{analysisResult.threats.length === 0 ? (
										<p className='text-muted-foreground'>No threats detected</p>
									) : (
										<ul className='list-disc pl-5 space-y-2'>
											{analysisResult.threats.map((threat, index) => (
												<li key={index} className='text-sm'>
													{threat}
												</li>
											))}
										</ul>
									)}
								</div>

								<div>
									<h3 className='text-lg font-medium mb-2'>Recommendations</h3>
									<ul className='list-disc pl-5 space-y-2'>
										{analysisResult.recommendations.map(
											(recommendation, index) => (
												<li key={index} className='text-sm'>
													{recommendation}
												</li>
											)
										)}
									</ul>
								</div>

								<div className='pt-4 border-t'>
									<div className='flex justify-between items-center'>
										<span className='text-sm text-muted-foreground'>
											Analysis performed{' '}
											{new Date(analysisResult.timestamp).toLocaleString()}
										</span>

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
												a.download = `security-analysis-${new Date()
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
							</div>
						) : (
							<div className='text-center py-8 text-muted-foreground'>
								No analysis results yet. Submit a request to analyze security
								risks.
							</div>
						)}
					</CardContent>
				</Card>

				{analysisHistory.length > 0 && (
					<Card className='mt-4'>
						<CardHeader>
							<CardTitle>Analysis History</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='space-y-2 max-h-[200px] overflow-y-auto'>
								{analysisHistory.map((result, index) => (
									<div
										key={index}
										onClick={() => {
											setAnalysisResult(result);
										}}
										className={`p-3 rounded-md cursor-pointer hover:bg-accent/50 flex justify-between items-center ${
											analysisResult === result ? 'bg-accent' : ''
										}`}
									>
										<div className='flex items-center space-x-2'>
											<Badge className={getRiskColor(result.riskLevel)}>
												{result.riskLevel}
											</Badge>
											<span className='text-sm'>
												{new Date(result.timestamp).toLocaleTimeString()}
											</span>
											<span className='text-xs text-muted-foreground'>
												Threats: {result.threats.length}
											</span>
										</div>

										<Badge variant='outline'>
											{Math.round(result.confidenceLevel * 100)}% confidence
										</Badge>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}
			</TabsContent>

			<TabsContent value='settings' className='mt-0'>
				<Card>
					<CardHeader>
						<CardTitle>Analysis Settings</CardTitle>
						<CardDescription>
							Configure your security analysis preferences
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<div className='grid w-full items-center gap-1.5'>
								<Label htmlFor='api-key'>
									OpenAI API Key (for AI-enhanced analysis)
								</Label>
								<Input
									id='api-key'
									type='password'
									placeholder='sk-...'
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
								/>
								<p className='text-xs text-muted-foreground'>
									Your API key is stored locally and never sent to our servers.
								</p>
							</div>

							<div className='flex items-center space-x-2'>
								<Switch
									id='use-ai-settings'
									checked={useAI}
									onCheckedChange={setUseAI}
								/>
								<Label htmlFor='use-ai-settings'>
									Enable AI-enhanced analysis
								</Label>
							</div>

							<div className='pt-4 border-t'>
								<h3 className='text-sm font-medium mb-2'>
									About Security Analysis
								</h3>
								<p className='text-sm text-muted-foreground'>
									The security analyzer evaluates HTTP requests for potential
									vulnerabilities including authentication issues, sensitive
									data exposure, and injection attacks. When AI-enhanced
									analysis is enabled and a valid API key is provided, results
									will be more comprehensive and accurate.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</TabsContent>
		</div>
	);
}
