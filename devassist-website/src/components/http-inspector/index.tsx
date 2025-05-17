'use client';

import { useState, useRef, ChangeEvent } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { aiClient } from '@/lib/ai';
import { Textarea } from '../ui/textarea';

interface HttpRequest {
	id: string;
	method: string;
	url: string;
	status: number;
	headers: Record<string, string>;
	body: string;
	timestamp: number;
	riskScore?: number;
	securityFlags?: string[];
}

export default function HttpInspector() {
	const [requests, setRequests] = useState<HttpRequest[]>([]);
	const [selectedRequest, setSelectedRequest] = useState<HttpRequest | null>(
		null
	);
	const [searchTerm, setSearchTerm] = useState('');
	const [loading, setLoading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [rawInput, setRawInput] = useState('');
	const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

	// Handler for file upload
	const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setLoading(true);
		try {
			const text = await file.text();
			const data = JSON.parse(text);

			// Handle HAR format
			if (data.log && Array.isArray(data.log.entries)) {
				processHarEntries(data.log.entries);
			}
			// Handle raw JSON array of requests
			else if (Array.isArray(data)) {
				processJsonRequests(data);
			}
		} catch (error) {
			console.error('Error parsing file:', error);
		} finally {
			setLoading(false);
			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	// Process HAR entries
	const processHarEntries = (entries: any[]) => {
		const processedRequests = entries.map((entry) => {
			// Calculate risk score based on various factors
			const hasAuth = entry.request.headers.some(
				(h: any) =>
					h.name.toLowerCase() === 'authorization' ||
					h.name.toLowerCase() === 'cookie'
			);
			const hasSensitiveData =
				entry.request.postData?.text?.toLowerCase().includes('password') ||
				false;
			const isSecure = entry.request.url.startsWith('https://');

			let riskScore = isSecure ? 20 : 60;
			if (hasSensitiveData) riskScore += 30;
			if (!hasAuth && entry.request.method !== 'GET') riskScore += 20;
			riskScore = Math.min(100, riskScore);

			// Identify security flags
			const securityFlags = [];
			if (!isSecure) securityFlags.push('Insecure HTTP');
			if (hasSensitiveData) securityFlags.push('Sensitive Data');
			if (!hasAuth && entry.request.method !== 'GET')
				securityFlags.push('Missing Auth');

			// Convert headers array to object
			const headers: Record<string, string> = {};
			entry.request.headers.forEach((h: any) => {
				headers[h.name] = h.value;
			});

			return {
				id: crypto.randomUUID(),
				method: entry.request.method,
				url: entry.request.url,
				status: entry.response.status,
				headers,
				body: entry.request.postData?.text || '',
				timestamp: new Date(entry.startedDateTime).getTime(),
				riskScore,
				securityFlags
			};
		});

		setRequests(processedRequests);
		if (processedRequests.length > 0) {
			setSelectedRequest(processedRequests[0]);
		}
	};

	// Process raw JSON requests
	const processJsonRequests = (data: any[]) => {
		const processedRequests = data.map((req) => {
			// Similar risk scoring as above
			const hasAuth =
				req.headers && (req.headers.authorization || req.headers.cookie);
			const hasSensitiveData =
				req.body?.toLowerCase().includes('password') || false;
			const isSecure = req.url.startsWith('https://');

			let riskScore = isSecure ? 20 : 60;
			if (hasSensitiveData) riskScore += 30;
			if (!hasAuth && req.method !== 'GET') riskScore += 20;
			riskScore = Math.min(100, riskScore);

			// Identify security flags
			const securityFlags = [];
			if (!isSecure) securityFlags.push('Insecure HTTP');
			if (hasSensitiveData) securityFlags.push('Sensitive Data');
			if (!hasAuth && req.method !== 'GET') securityFlags.push('Missing Auth');

			return {
				id: crypto.randomUUID(),
				method: req.method,
				url: req.url,
				status: req.status || 200,
				headers: req.headers || {},
				body: req.body || '',
				timestamp: req.timestamp || Date.now(),
				riskScore,
				securityFlags
			};
		});

		setRequests(processedRequests);
		if (processedRequests.length > 0) {
			setSelectedRequest(processedRequests[0]);
		}
	};

	// Process pasted curl or raw HTTP request
	const handlePasteSubmit = async () => {
		if (!rawInput.trim()) return;

		setLoading(true);
		try {
			// Simple parsing of curl command or raw HTTP request
			const isCurl = rawInput.trim().startsWith('curl');
			let method = 'GET';
			let url = '';
			let headers: Record<string, string> = {};
			let body = '';

			if (isCurl) {
				// Very basic curl parsing - a real implementation would be more robust
				const urlMatch = rawInput.match(/curl\s+['"]?([^'">\s]+)['"]?/);
				if (urlMatch && urlMatch[1]) {
					url = urlMatch[1];
				}

				// Extract method
				const methodMatch = rawInput.match(/-X\s+(['"]?)(\w+)\1/);
				if (methodMatch && methodMatch[2]) {
					method = methodMatch[2];
				}

				// Extract headers
				const headerMatches = [...rawInput.matchAll(/-H\s+(['"]?)([^'"]+)\1/g)];
				headerMatches.forEach((match) => {
					if (match[2]) {
						const [name, value] = match[2].split(/:\s*/);
						if (name && value) {
							headers[name] = value;
						}
					}
				});

				// Extract body
				const bodyMatch = rawInput.match(/-d\s+(['"]?)([^'"]+)\1/);
				if (bodyMatch && bodyMatch[2]) {
					body = bodyMatch[2];
				}
			} else {
				// Parse raw HTTP request
				const lines = rawInput.split('\n');
				if (lines.length > 0) {
					const firstLine = lines[0].split(' ');
					if (firstLine.length >= 2) {
						method = firstLine[0];
						url = firstLine[1];
					}
				}

				// Find the empty line that separates headers from body
				const emptyLineIndex = lines.findIndex((line) => line.trim() === '');

				// Extract headers
				if (emptyLineIndex > 1) {
					lines.slice(1, emptyLineIndex).forEach((line) => {
						const [name, value] = line.split(/:\s*/);
						if (name && value) {
							headers[name] = value;
						}
					});
				}

				// Extract body
				if (emptyLineIndex !== -1 && emptyLineIndex < lines.length - 1) {
					body = lines.slice(emptyLineIndex + 1).join('\n');
				}
			}

			// Calculate risk score
			const hasAuth =
				headers['Authorization'] ||
				headers['Cookie'] ||
				headers['authorization'] ||
				headers['cookie'];
			const hasSensitiveData = body.toLowerCase().includes('password');
			const isSecure = url.startsWith('https://');

			let riskScore = isSecure ? 20 : 60;
			if (hasSensitiveData) riskScore += 30;
			if (!hasAuth && method !== 'GET') riskScore += 20;
			riskScore = Math.min(100, riskScore);

			// Identify security flags
			const securityFlags = [];
			if (!isSecure) securityFlags.push('Insecure HTTP');
			if (hasSensitiveData) securityFlags.push('Sensitive Data');
			if (!hasAuth && method !== 'GET') securityFlags.push('Missing Auth');

			const newRequest: HttpRequest = {
				id: crypto.randomUUID(),
				method,
				url,
				status: 200, // Assuming 200 as we don't have actual response
				headers,
				body,
				timestamp: Date.now(),
				riskScore,
				securityFlags
			};

			setRequests([newRequest, ...requests]);
			setSelectedRequest(newRequest);
			setRawInput('');
		} catch (error) {
			console.error('Error processing pasted input:', error);
		} finally {
			setLoading(false);
		}
	};

	// Filter requests based on search term
	const filteredRequests = requests.filter((req) => {
		const searchLower = searchTerm.toLowerCase();
		return (
			req.url.toLowerCase().includes(searchLower) ||
			req.method.toLowerCase().includes(searchLower) ||
			req.body.toLowerCase().includes(searchLower) ||
			(req.securityFlags?.some((flag) =>
				flag.toLowerCase().includes(searchLower)
			) ??
				false)
		);
	});

	// Helper for risk score color
	const getRiskColor = (score: number) => {
		if (score < 30) return 'bg-green-500';
		if (score < 70) return 'bg-yellow-500';
		return 'bg-red-500';
	};

	// Helper for risk score label
	const getRiskLabel = (score: number) => {
		if (score < 30) return 'Low';
		if (score < 70) return 'Medium';
		return 'High';
	};

	return (
		<div className='space-y-4'>
			<Card>
				<CardHeader>
					<CardTitle>HTTP Traffic Inspector</CardTitle>
					<CardDescription>
						Upload HAR files or paste raw HTTP/cURL requests to analyze network
						traffic
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs
						value={activeTab}
						onValueChange={(v) => setActiveTab(v as 'upload' | 'paste')}
						className='w-full'
					>
						<TabsList className='mb-4'>
							<TabsTrigger value='upload'>Upload File</TabsTrigger>
							<TabsTrigger value='paste'>Paste Request</TabsTrigger>
						</TabsList>

						<TabsContent value='upload'>
							<div className='flex flex-col space-y-4'>
								<Input
									ref={fileInputRef}
									type='file'
									accept='.har,.json'
									onChange={handleFileUpload}
									disabled={loading}
									className='w-full'
								/>
								<p className='text-sm text-muted-foreground'>
									Upload .har or .json files exported from your browser's
									network tab
								</p>
							</div>
						</TabsContent>

						<TabsContent value='paste'>
							<div className='flex flex-col space-y-4'>
								<Textarea
									value={rawInput}
									onChange={(e) => setRawInput(e.target.value)}
									placeholder='Paste a cURL command or raw HTTP request...'
									disabled={loading}
									className='min-h-[150px]'
								/>
								<Button
									onClick={handlePasteSubmit}
									disabled={loading || !rawInput.trim()}
								>
									Analyze Request
								</Button>
							</div>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{requests.length > 0 && (
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<Card className='md:col-span-1'>
						<CardHeader>
							<CardTitle>Requests</CardTitle>
							<div className='flex items-center space-x-2'>
								<Input
									placeholder='Search requests...'
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className='w-full'
								/>
							</div>
						</CardHeader>
						<CardContent>
							<div className='space-y-2 max-h-[400px] overflow-y-auto'>
								{filteredRequests.length === 0 ? (
									<p className='text-center text-sm text-muted-foreground py-4'>
										No matching requests found
									</p>
								) : (
									filteredRequests.map((req) => (
										<div
											key={req.id}
											onClick={() => setSelectedRequest(req)}
											className={`p-2 rounded-md cursor-pointer flex flex-col space-y-1 ${
												selectedRequest?.id === req.id
													? 'bg-accent'
													: 'hover:bg-accent/50'
											}`}
										>
											<div className='flex items-center justify-between'>
												<Badge
													variant={req.method === 'GET' ? 'outline' : 'default'}
												>
													{req.method}
												</Badge>
												<Badge
													variant={req.status < 400 ? 'outline' : 'destructive'}
												>
													{req.status}
												</Badge>
											</div>
											<div className='text-xs font-medium truncate'>
												{req.url}
											</div>
											<div className='flex items-center space-x-1'>
												<div className='text-xs text-muted-foreground'>
													Risk:{' '}
												</div>
												<Progress
													value={req.riskScore ?? 0}
													max={100}
													className={`h-1 w-16 ${getRiskColor(
														req.riskScore ?? 0
													)}`}
												/>
												<div className='text-xs text-muted-foreground'>
													{getRiskLabel(req.riskScore ?? 0)}
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>

					<Card className='md:col-span-2'>
						<CardHeader>
							<CardTitle>Request Details</CardTitle>
							{selectedRequest && (
								<div className='flex flex-wrap items-center gap-2'>
									<Badge variant='outline' className='text-xs'>
										{selectedRequest.method}
									</Badge>
									<Badge
										variant={
											selectedRequest.status < 400 ? 'outline' : 'destructive'
										}
										className='text-xs'
									>
										{selectedRequest.status}
									</Badge>
									{selectedRequest.securityFlags?.map((flag) => (
										<Badge key={flag} variant='secondary' className='text-xs'>
											{flag}
										</Badge>
									))}
								</div>
							)}
						</CardHeader>
						<CardContent>
							{selectedRequest ? (
								<div className='space-y-4'>
									<div>
										<h3 className='text-sm font-medium mb-1'>URL</h3>
										<div className='text-xs p-2 bg-muted rounded-md break-all'>
											{selectedRequest.url}
										</div>
									</div>

									<div>
										<h3 className='text-sm font-medium mb-1'>Headers</h3>
										<div className='text-xs p-2 bg-muted rounded-md h-[100px] overflow-auto'>
											<pre className='whitespace-pre-wrap'>
												{JSON.stringify(selectedRequest.headers, null, 2)}
											</pre>
										</div>
									</div>

									<div>
										<h3 className='text-sm font-medium mb-1'>Body</h3>
										<div className='text-xs p-2 bg-muted rounded-md h-[150px] overflow-auto'>
											<pre className='whitespace-pre-wrap'>
												{selectedRequest.body || '(No body)'}
											</pre>
										</div>
									</div>

									<div>
										<h3 className='text-sm font-medium mb-1'>
											Risk Assessment{' '}
											<span className='text-xs text-muted-foreground'>
												(Local Analysis)
											</span>
										</h3>
										<div className='flex items-center space-x-2 mb-2'>
											<Progress
												value={selectedRequest.riskScore ?? 0}
												max={100}
												className={`h-2 flex-1 ${getRiskColor(
													selectedRequest.riskScore ?? 0
												)}`}
											/>
											<span className='text-xs font-medium'>
												{selectedRequest.riskScore ?? 0}% -{' '}
												{getRiskLabel(selectedRequest.riskScore ?? 0)} Risk
											</span>
										</div>

										<div className='text-xs text-muted-foreground'>
											{selectedRequest.securityFlags?.length ? (
												<ul className='list-disc pl-4 space-y-1'>
													{selectedRequest.securityFlags.map((flag, i) => (
														<li key={i}>{flag}</li>
													))}
												</ul>
											) : (
												'No security flags detected'
											)}
										</div>
									</div>
								</div>
							) : (
								<div className='text-center py-8 text-muted-foreground'>
									Select a request to view details
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
