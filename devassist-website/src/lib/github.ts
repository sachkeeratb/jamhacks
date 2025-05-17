/**
 * GitHub repository downloader and processor
 * This module handles downloading a GitHub repository and processing its files for analysis
 */

import JSZip from 'jszip';
import { handleNetworkError } from './utils';

/**
 * Parse GitHub URL to extract owner and repo name
 * @param url GitHub repository URL
 */
export function parseGitHubUrl(
	url: string
): { owner: string; repo: string } | null {
	// Handle different GitHub URL formats
	try {
		const urlObj = new URL(url);
		if (!urlObj.hostname.includes('github.com')) {
			return null;
		}

		// Remove .git extension if present
		const pathParts = urlObj.pathname
			.replace(/\.git$/, '')
			.split('/')
			.filter(Boolean);
		if (pathParts.length < 2) {
			return null;
		}

		return {
			owner: pathParts[0],
			repo: pathParts[1]
		};
	} catch (error) {
		console.error('Invalid URL:', error);
		return null;
	}
}

// List of CORS proxies to try
const CORS_PROXIES = [
	'https://proxy.cors.sh/',
	'https://corsproxy.io/?',
	'https://cors-proxy.htmldriven.com/?url=',
	'https://cors-anywhere.herokuapp.com/',
	'https://api.allorigins.win/raw?url='
];

/**
 * Download a GitHub repository as a ZIP file
 * @param owner Repository owner username
 * @param repo Repository name
 */
export async function downloadGitHubRepo(
	owner: string,
	repo: string
): Promise<ArrayBuffer | null> {
	// URLs to try (codeload is GitHub's download service)
	const urlsToTry = [
		`https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`,
		`https://codeload.github.com/${owner}/${repo}/zip/refs/heads/master`,
		`https://api.github.com/repos/${owner}/${repo}/zipball`
	];

	// Try each URL with CORS proxies first (direct will fail due to CORS)
	for (const proxy of CORS_PROXIES) {
		for (const url of urlsToTry) {
			try {
				const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
				console.log(`Trying with CORS proxy: ${proxyUrl}`);

				const response = await fetch(proxyUrl, {
					headers: {
						'User-Agent': 'DevAssist-App',
						'X-Requested-With': 'XMLHttpRequest',
						Origin: window.location.origin
					},
					mode: 'cors'
				});

				if (response.ok) {
					console.log(`Successfully downloaded via proxy: ${proxyUrl}`);
					return await response.arrayBuffer();
				}
			} catch (error) {
				console.log(
					`Failed proxy download from: ${proxy}${url}`,
					handleNetworkError(error)
				);
			}
		}
	}

	// If proxies fail, try GitHub API approach to get file list instead of zip
	try {
		console.log(`Trying GitHub API file list approach for ${owner}/${repo}`);

		// First get the default branch
		const repoResponse = await fetch(
			`https://api.github.com/repos/${owner}/${repo}`,
			{
				headers: { 'User-Agent': 'DevAssist-App' }
			}
		);

		if (!repoResponse.ok) {
			throw new Error(`GitHub API error: ${repoResponse.status}`);
		}

		const repoData = await repoResponse.json();
		const defaultBranch = repoData.default_branch;

		// Get file tree (recursively)
		const treeResponse = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
			{
				headers: { 'User-Agent': 'DevAssist-App' }
			}
		);

		if (!treeResponse.ok) {
			throw new Error(`GitHub API tree error: ${treeResponse.status}`);
		}

		const treeData = await treeResponse.json();

		// Filter for actual files (not directories) and limit to reasonable number to avoid rate limiting
		const fileEntries = treeData.tree
			.filter((item: any) => item.type === 'blob')
			.filter((item: any) => {
				// Filter out files in ignored directories
				return !ignoredDirs.some((dir) => item.path.includes(`/${dir}/`));
			})
			.filter((item: any) => {
				// Filter out files with ignored extensions
				return !ignoredExtensions.some((ext) =>
					item.path.toLowerCase().endsWith(ext)
				);
			})
			.filter((item: any) => {
				// Only include files with programming extensions
				const fileExt = `.${item.path.split('.').pop()?.toLowerCase()}`;
				return programmingExtensions.some((ext) =>
					item.path.toLowerCase().endsWith(ext)
				);
			})
			.slice(0, 20); // Limit to 20 files

		// Download each file individually
		const files = [];
		for (const file of fileEntries) {
			try {
				const contentResponse = await fetch(
					`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${defaultBranch}`,
					{
						headers: { 'User-Agent': 'DevAssist-App' }
					}
				);

				if (contentResponse.ok) {
					const contentData = await contentResponse.json();
					// GitHub API returns base64 encoded content
					if (contentData.encoding === 'base64' && contentData.content) {
						const content = atob(contentData.content);

						// Determine language from file extension
						const fileExt = `.${file.path.split('.').pop()?.toLowerCase()}`;
						let language = fileExt.substring(1);
						if (['.js', '.jsx'].includes(fileExt)) language = 'javascript';
						else if (['.ts', '.tsx'].includes(fileExt)) language = 'typescript';
						else if (['.py'].includes(fileExt)) language = 'python';
						else if (['.java'].includes(fileExt)) language = 'java';
						else if (['.c', '.cpp', '.h'].includes(fileExt)) language = 'cpp';
						else if (['.cs'].includes(fileExt)) language = 'csharp';

						// Count lines
						const lineCount = content
							.split('\n')
							.filter((line) => line.trim().length > 0).length;

						files.push({
							path: file.path,
							content,
							language,
							lineCount
						});
					}
				}
			} catch (error) {
				console.error(
					`Error fetching file ${file.path}:`,
					handleNetworkError(error)
				);
			}
		}

		if (files.length > 0) {
			console.log(`Successfully loaded ${files.length} files via GitHub API`);

			// Create a mock zip with these files to match the expected return type
			const zip = new JSZip();

			// Add each file to the zip
			for (const file of files) {
				zip.file(file.path, file.content);
			}

			// Generate the zip and return it
			const zipContent = await zip.generateAsync({ type: 'arraybuffer' });

			// Create an object URL for the zip and return it
			return zipContent;
		}
	} catch (error) {
		console.error('GitHub API approach failed:', handleNetworkError(error));
	}

	// If all methods failed, throw a more descriptive error
	console.error(
		'All GitHub download methods failed - This is likely due to CORS restrictions.'
	);
	return null;
}

// Common directories and file patterns to ignore (shared with folder upload)
export const ignoredDirs = [
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

export const ignoredExtensions = [
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
	'.eot'
];

// Extensions we're explicitly interested in (programming languages)
export const programmingExtensions = [
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

/**
 * Process GitHub repository ZIP file
 * @param zipData ZIP file data as ArrayBuffer
 */
export async function processGitHubRepo(zipData: ArrayBuffer): Promise<
	{
		path: string;
		content: string;
		language: string;
		lineCount: number;
	}[]
> {
	const zip = new JSZip();
	await zip.loadAsync(zipData);

	const files: {
		path: string;
		content: string;
		language: string;
		lineCount: number;
	}[] = [];
	const maxFiles = 50; // Limit to 50 files
	let processedCount = 0;

	// Get the root directory name (GitHub adds a random folder at the root)
	let rootDirName = '';
	for (const filename in zip.files) {
		const parts = filename.split('/');
		if (parts.length > 1 && !rootDirName) {
			rootDirName = parts[0] + '/';
			break;
		}
	}

	// Sort entries by file path so we get a consistent order
	const entries = Object.entries(zip.files).sort((a, b) =>
		a[0].localeCompare(b[0])
	);

	for (const [path, zipEntry] of entries) {
		if (processedCount >= maxFiles) break;

		// Skip directories
		if (zipEntry.dir) continue;

		// Remove the root directory prefix for cleaner paths
		const relativePath = path.startsWith(rootDirName)
			? path.substring(rootDirName.length)
			: path;

		// Skip if in ignored directory
		if (ignoredDirs.some((dir) => relativePath.includes(`/${dir}/`))) {
			continue;
		}

		// Skip files with ignored extensions
		if (
			ignoredExtensions.some((ext) => relativePath.toLowerCase().endsWith(ext))
		) {
			continue;
		}

		// Skip hidden files
		if (relativePath.split('/').some((part) => part.startsWith('.'))) {
			continue;
		}

		// Only include files with programming extensions
		const fileExt = '.' + relativePath.split('.').pop()?.toLowerCase();
		if (
			!programmingExtensions.some((ext) =>
				relativePath.toLowerCase().endsWith(ext)
			)
		) {
			continue;
		}

		try {
			// Get file content as text
			const content = await (zipEntry as JSZip.JSZipObject).async('text');

			// Skip large files
			if (content.length > 1024 * 1024) {
				continue;
			}

			// Skip binary files (check for non-printable characters)
			if (/[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(content.substring(0, 1000))) {
				continue;
			}

			// Determine language from file extension
			let language = fileExt ? fileExt.substring(1) : 'unknown';
			if (['.js', '.jsx'].includes(fileExt)) language = 'javascript';
			else if (['.ts', '.tsx'].includes(fileExt)) language = 'typescript';
			else if (['.py'].includes(fileExt)) language = 'python';
			else if (['.java'].includes(fileExt)) language = 'java';
			else if (['.c', '.cpp', '.h'].includes(fileExt)) language = 'cpp';
			else if (['.cs'].includes(fileExt)) language = 'csharp';
			else if (['.rb'].includes(fileExt)) language = 'ruby';
			else if (['.php'].includes(fileExt)) language = 'php';
			else if (['.go'].includes(fileExt)) language = 'go';
			else if (['.rs'].includes(fileExt)) language = 'rust';
			else if (['.swift'].includes(fileExt)) language = 'swift';
			else if (['.kt'].includes(fileExt)) language = 'kotlin';
			else if (['.html'].includes(fileExt)) language = 'html';
			else if (['.css', '.scss', '.sass'].includes(fileExt)) language = 'css';

			// Count lines of code (non-empty lines)
			const lineCount = content
				.split('\n')
				.filter((line: string) => line.trim().length > 0).length;

			files.push({ path: relativePath, content, language, lineCount });
			processedCount++;
		} catch (error) {
			console.error(`Failed to process file ${relativePath}:`, error);
		}
	}

	// If we couldn't find any files, throw an error
	if (files.length === 0) {
		throw new Error('No valid code files found in repository');
	}

	return files;
}
