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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { aiClient } from '@/lib/ai';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle
} from '../ui/sheet';

// Mock vector embeddings API - in a real app, this would use a WebAssembly-backed embeddings engine
// or call an external API like OpenAI
class VectorStore {
	private files: {
		path: string;
		content: string;
		embedding?: number[];
	}[] = [];

	private apiKey: string | null = null;

	setApiKey(key: string) {
		this.apiKey = key;
		aiClient.setApiKey(key);
	}

	// Add a file to the store
	async addFile(path: string, content: string) {
		// Use the more sophisticated embedding generator from AIClient
		const embedding = aiClient.generateTextEmbedding(content);

		this.files.push({
			path,
			content,
			embedding
		});
	}

	// Search for files matching a query
	async search(
		query: string,
		limit = 5
	): Promise<Array<{ path: string; content: string; score: number }>> {
		if (this.files.length === 0) {
			return [];
		}

		// Create embedding for the query using AIClient's sophisticated function
		const queryEmbedding = aiClient.generateTextEmbedding(query);

		// Calculate cosine similarity between query and all files
		const results = this.files.map((file) => {
			const score = this.calculateCosineSimilarity(
				queryEmbedding,
				file.embedding || []
			);
			return {
				path: file.path,
				content: file.content,
				score
			};
		});

		// Sort by similarity score (descending)
		results.sort((a, b) => b.score - a.score);

		// Return top results
		return results.slice(0, limit);
	}

	// Get all files in the store
	getFiles() {
		return this.files.map(({ path, content }) => ({ path, content }));
	}

	// Clear all files
	clear() {
		this.files = [];
	}

	private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
		if (vec1.length !== vec2.length) {
			return 0;
		}

		let dotProduct = 0;
		let mag1 = 0;
		let mag2 = 0;

		for (let i = 0; i < vec1.length; i++) {
			dotProduct += vec1[i] * vec2[i];
			mag1 += vec1[i] * vec1[i];
			mag2 += vec2[i] * vec2[i];
		}

		mag1 = Math.sqrt(mag1);
		mag2 = Math.sqrt(mag2);

		const denominator = mag1 * mag2;

		return denominator === 0 ? 0 : dotProduct / denominator;
	}
}

// Create a singleton instance of our vector store
const vectorStore = new VectorStore();

export default function CodeIntelligence() {
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<
		Array<{ path: string; content: string; score: number }>
	>([]);
	const [selectedFile, setSelectedFile] = useState<{
		path: string;
		content: string;
	} | null>(null);
	const [explanation, setExplanation] = useState('');
	const [isExplaining, setIsExplaining] = useState(false);
	const [apiKey, setApiKey] = useState('');
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const folderInputRef = useRef<HTMLInputElement>(null);
	const [loadedFiles, setLoadedFiles] = useState<
		{ path: string; content: string }[]
	>([]);

	const handleFolderSelect = async (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		// Clear existing files
		vectorStore.clear();
		setLoadedFiles([]);

		// Process all files
		const loadedFilesArray = [];
		let fileCount = 0;

		toast.info('Processing files...');

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			try {
				// Skip non-text files and hidden files
				if (
					!file.type.includes('text') &&
					!file.name.match(
						/\.(js|ts|jsx|tsx|py|rb|java|c|cpp|h|cs|php|html|css|json|md|rs|go)$/i
					)
				) {
					continue;
				}

				if (file.name.startsWith('.')) {
					continue;
				}

				const content = await file.text();
				const path = file.webkitRelativePath || file.name;

				// Add to vector store
				await vectorStore.addFile(path, content);
				loadedFilesArray.push({ path, content });
				fileCount++;
			} catch (error) {
				console.error('Error processing file:', file.name, error);
			}
		}

		setLoadedFiles(loadedFilesArray);
		toast.success(`Loaded ${fileCount} files`);
	};

	const handleSearch = async () => {
		if (!searchQuery.trim() || loadedFiles.length === 0) return;

		setIsSearching(true);

		try {
			const results = await vectorStore.search(searchQuery);
			setSearchResults(results);
		} catch (error) {
			console.error('Search error:', error);
			toast.error('Search failed');
		} finally {
			setIsSearching(false);
		}
	};

	const handleExplainCode = async () => {
		if (!selectedFile || !apiKey) {
			toast.error('Please select a file and enter an API key');
			return;
		}

		setIsExplaining(true);

		try {
			aiClient.setApiKey(apiKey);
			const result = await aiClient.explainCode(selectedFile.content);
			setExplanation(result);
		} catch (error) {
			console.error('Explanation error:', error);
			toast.error('Failed to generate explanation');
			setExplanation(
				'Failed to generate explanation. Please check your API key.'
			);
		} finally {
			setIsExplaining(false);
		}
	};

	return (
		<div className='space-y-4'>
			<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
				<Card className='md:col-span-1'>
					<CardHeader>
						<CardTitle>Code Loading</CardTitle>
						<CardDescription>
							Load a codebase to enable semantic search
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<div>
								<Label htmlFor='folder-input'>Select Code Folder</Label>
								<Input
									id='folder-input'
									ref={folderInputRef}
									type='file'
									// @ts-ignore - webkitdirectory is not in the standard HTML input properties
									webkitdirectory='true'
									directory=''
									multiple
									onChange={handleFolderSelect}
									className='mt-1'
								/>
							</div>

							<div className='text-sm'>
								<p className='text-muted-foreground mb-2'>
									Files loaded: {loadedFiles.length}
								</p>
								{loadedFiles.length > 0 && (
									<Button
										size='sm'
										variant='outline'
										onClick={() => setIsSheetOpen(true)}
									>
										View Files
									</Button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className='md:col-span-2'>
					<CardHeader>
						<CardTitle>Semantic Search</CardTitle>
						<CardDescription>
							Find relevant code snippets with natural language
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='flex flex-col space-y-4'>
							<div className='flex space-x-2'>
								<Input
									placeholder='Search code using natural language...'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className='flex-1'
									disabled={loadedFiles.length === 0}
								/>
								<Button
									onClick={handleSearch}
									disabled={
										isSearching ||
										!searchQuery.trim() ||
										loadedFiles.length === 0
									}
								>
									{isSearching ? 'Searching...' : 'Search'}
								</Button>
							</div>

							{loadedFiles.length === 0 && (
								<p className='text-center text-muted-foreground py-4'>
									Please load a codebase to enable search
								</p>
							)}

							{searchResults.length > 0 && (
								<div className='space-y-3'>
									<h3 className='text-sm font-medium'>Search Results</h3>
									<div className='max-h-[300px] overflow-y-auto space-y-2'>
										{searchResults.map((result, index) => (
											<div
												key={index}
												onClick={() => setSelectedFile(result)}
												className={`p-2 border rounded-md cursor-pointer ${
													selectedFile?.path === result.path
														? 'bg-accent border-accent'
														: 'hover:bg-accent/50'
												}`}
											>
												<div className='flex justify-between items-start mb-1'>
													<span className='font-medium text-sm truncate'>
														{result.path}
													</span>
													<Badge variant='outline' className='text-xs'>
														{Math.round(result.score * 100)}% match
													</Badge>
												</div>
												<p className='text-xs text-muted-foreground line-clamp-2'>
													{result.content.slice(0, 150)}...
												</p>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{selectedFile && (
				<Card>
					<CardHeader>
						<CardTitle className='flex justify-between items-center'>
							<span>File: {selectedFile.path}</span>
							<div className='flex space-x-2 items-center'>
								<Input
									type='password'
									placeholder='OpenAI API Key (for explanation)'
									className='text-xs w-64'
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
								/>
								<Button
									size='sm'
									variant='outline'
									onClick={handleExplainCode}
									disabled={isExplaining || !apiKey}
								>
									{isExplaining ? 'Analyzing...' : 'Explain Code'}
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
							<div className='border rounded-md overflow-hidden'>
								<div className='bg-muted px-3 py-1 text-sm font-medium border-b'>
									Code
								</div>
								<div className='max-h-[400px] overflow-auto'>
									<CodeMirror
										value={selectedFile.content}
										height='400px'
										readOnly
										basicSetup={{
											lineNumbers: true,
											highlightActiveLine: true
										}}
									/>
								</div>
							</div>

							<div className='border rounded-md overflow-hidden'>
								<div className='bg-muted px-3 py-1 text-sm font-medium border-b'>
									Explanation
								</div>
								<div className='p-4 max-h-[400px] overflow-auto'>
									{explanation ? (
										<div className='text-sm'>{explanation}</div>
									) : (
										<div className='text-center text-muted-foreground py-8'>
											{isExplaining
												? 'Generating explanation...'
												: 'Click "Explain Code" to generate an explanation'}
										</div>
									)}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
				<SheetContent className='w-[400px] sm:w-[540px] sm:max-w-lg'>
					<SheetHeader>
						<SheetTitle>Loaded Files</SheetTitle>
						<SheetDescription>
							{loadedFiles.length} files loaded for semantic search
						</SheetDescription>
					</SheetHeader>
					<div className='mt-6 max-h-[80vh] overflow-y-auto'>
						{loadedFiles.map((file, index) => (
							<div
								key={index}
								onClick={() => {
									setSelectedFile(file);
									setIsSheetOpen(false);
								}}
								className='py-2 px-1 border-b cursor-pointer hover:bg-accent/50'
							>
								<p className='text-sm font-medium'>{file.path}</p>
								<p className='text-xs text-muted-foreground'>
									{file.content.length} bytes
								</p>
							</div>
						))}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
