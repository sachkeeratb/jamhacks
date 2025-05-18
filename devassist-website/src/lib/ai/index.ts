const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';

/**
 * Configuration options for the AIClient
 * @interface AIClientConfig
 * @property {string} [apiKey] - Optional API key for Hugging Face
 * @property {string} [model] - Optional model name to override defaults
 */
interface AIClientConfig {
	apiKey?: string;
	model?: string;
}

/**
 * AIClient provides AI-powered code analysis capabilities
 *
 * This class handles all interactions with AI services (Hugging Face) and provides
 * fallback local implementations when no API key is available. It supports:
 * - Security vulnerability analysis
 * - Code explanation
 * - Environmental impact assessment
 * - Text embedding generation for semantic search
 *
 * @class AIClient
 */
export class AIClient {
	/** API key for Hugging Face, null if not available */
	private apiKey: string | null =
		process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || null;

	/** Model specialized for security classification tasks */
	private securityModel: string = 'Xenova/distilbart-cnn-12-6';

	/** Model specialized for code understanding and explanation */
	private codeExplanationModel: string = 'Salesforce/codet5-base';

	/** General purpose model for eco-impact analysis */
	private ecoImpactModel: string = 'google/flan-t5-base';

	/**
	 * Creates an instance of AIClient
	 * @param {AIClientConfig} [config] - Optional configuration
	 */
	constructor(config?: AIClientConfig) {
		if (config?.apiKey) {
			this.apiKey = config.apiKey;
		}
		if (config?.model) {
			this.securityModel = config.model;
			this.codeExplanationModel = config.model;
			this.ecoImpactModel = config.model;
		}
	}

	/**
	 * Sets the API key for Hugging Face
	 * @param {string} apiKey - The API key to use
	 */
	setApiKey(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * Generates a security report for the provided code
	 *
	 * Analyzes code for security vulnerabilities using AI or local fallback.
	 *
	 * @param {string} request - The code to analyze
	 * @returns {Promise<{
	 *   riskLevel: 'Low' | 'Medium' | 'High' | 'Critical',
	 *   threats: string[],
	 *   recommendations: string[],
	 *   confidenceLevel: number
	 * }>} Security analysis results
	 */
	async generateSecurityReport(request: string): Promise<{
		riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
		threats: string[];
		recommendations: string[];
		confidenceLevel: number;
	}> {
		if (!this.apiKey) {
			return this.localSecurityAnalysis(request);
		}

		try {
			// Prepare a concise version of the code to analyze (first 10k chars)
			const codeToAnalyze = request.substring(0, 10000);

			// Create a better prompt for security analysis
			const securityPrompt = `
Analyze this code for security vulnerabilities:

\`\`\`
${codeToAnalyze}
\`\`\`

Provide output in JSON format with:
1. "riskLevel": "Low", "Medium", "High", or "Critical"
2. "threats": [Array of specific security issues found]
3. "recommendations": [Specific fixes for each threat]
4. "confidenceLevel": Number between 0 and 1
`;

			const response = await fetch(
				`${HUGGINGFACE_API_URL}/${this.securityModel}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify({
						inputs: securityPrompt,
						parameters: {
							max_length: 1024,
							temperature: 0.7,
							num_return_sequences: 1
						}
					})
				}
			);

			const data = await response.json();

			try {
				// Try to extract JSON from the response
				let jsonText = data[0].generated_text || '';
				jsonText = jsonText.substring(
					jsonText.indexOf('{'),
					jsonText.lastIndexOf('}') + 1
				);

				const parsedResult = JSON.parse(jsonText);

				// Validate and normalize the result
				return {
					riskLevel: this.normalizeRiskLevel(parsedResult.riskLevel),
					threats: Array.isArray(parsedResult.threats)
						? parsedResult.threats
						: [],
					recommendations: Array.isArray(parsedResult.recommendations)
						? parsedResult.recommendations
						: [],
					confidenceLevel: parsedResult.confidenceLevel || 0.5
				};
			} catch (e) {
				// If parsing fails, use fallback local analysis
				console.error('Failed to parse HuggingFace response:', e);
				return this.localSecurityAnalysis(request);
			}
		} catch (error) {
			console.error('Error generating security report:', error);
			return this.localSecurityAnalysis(request);
		}
	}

	/**
	 * Explains code using AI or local fallback
	 *
	 * Generates a concise, single-paragraph explanation of the provided code.
	 *
	 * @param {string} code - The code to explain
	 * @returns {Promise<string>} A concise explanation of the code
	 */
	async explainCode(code: string): Promise<string> {
		if (!this.apiKey) {
			return this.localCodeExplanation(code);
		}

		try {
			// Prepare a concise version of the code to analyze (first 5k chars)
			const codeToExplain = code.substring(0, 5000);

			const prompt = `
Explain this code clearly and concisely in a single paragraph:

\`\`\`
${codeToExplain}
\`\`\`

Focus on:
1. What the code does
2. Key functions/classes
3. The overall architecture
4. Any notable patterns or algorithms

Keep your explanation to a single paragraph without line breaks.
`;

			const response = await fetch(
				`${HUGGINGFACE_API_URL}/${this.codeExplanationModel}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify({
						inputs: prompt,
						parameters: {
							max_length: 512,
							temperature: 0.5,
							num_return_sequences: 1
						}
					})
				}
			);

			const data = await response.json();
			if (data[0]?.generated_text) {
				// Clean up the explanation by removing any leading prompt repetition
				let explanation = data[0].generated_text;
				if (explanation.includes('```')) {
					explanation = explanation.split('```').pop() || explanation;
				}
				// Ensure it's a single paragraph without line breaks
				return explanation.trim().replace(/\s*\n\s*/g, ' ');
			}
			return this.localCodeExplanation(code);
		} catch (error) {
			console.error('Error explaining code:', error);
			return this.localCodeExplanation(code);
		}
	}

	/**
	 * Local implementation of code explanation when AI is unavailable
	 *
	 * Analyzes code structure and provides a basic explanation based on
	 * language detection and code patterns.
	 *
	 * @param {string} code - The code to explain
	 * @returns {string} A basic explanation of the code
	 * @private
	 */
	private localCodeExplanation(code: string): string {
		// Detect language
		let language = 'unknown';

		if (
			code.includes('import React') ||
			(code.includes('function') &&
				code.includes('return') &&
				(code.includes('<div>') || code.includes('<>')))
		) {
			language = 'React';
		} else if (
			code.includes('import ') &&
			code.includes('from ') &&
			code.includes('const ') &&
			code.includes('=>')
		) {
			language = 'JavaScript/TypeScript';
		} else if (
			code.includes('def ') &&
			code.includes(':') &&
			code.includes('import ')
		) {
			language = 'Python';
		} else if (
			code.includes('public class ') &&
			code.includes('{') &&
			code.includes('}')
		) {
			language = 'Java';
		} else if (code.includes('#include') && code.includes('int main(')) {
			language = 'C/C++';
		} else if (
			code.includes('package main') &&
			code.includes('func ') &&
			code.includes('import (')
		) {
			language = 'Go';
		} else if (
			code.includes('fn ') &&
			(code.includes('let mut ') ||
				code.includes('impl') ||
				code.includes('pub struct'))
		) {
			language = 'Rust';
		} else if (
			code.includes('<?php') ||
			(code.includes('function') && code.includes('$'))
		) {
			language = 'PHP';
		} else if (
			code.includes('class ') &&
			code.includes('def ') &&
			code.includes('end')
		) {
			language = 'Ruby';
		} else if (code.includes('using System') && code.includes('namespace ')) {
			language = 'C#';
		} else if (
			code.includes('import SwiftUI') ||
			(code.includes('class') && code.includes('override func'))
		) {
			language = 'Swift';
		} else if (
			code.includes('fun ') &&
			code.includes('val ') &&
			code.includes('kotlin')
		) {
			language = 'Kotlin';
		} else if (code.includes('<!DOCTYPE html>') || code.includes('<html>')) {
			language = 'HTML';
		} else if (
			code.includes('SELECT') &&
			code.includes('FROM') &&
			(code.includes('WHERE') || code.includes('JOIN'))
		) {
			language = 'SQL';
		} else if (
			code.includes('#!/bin/') ||
			(code.includes('echo ') && code.includes('='))
		) {
			language = 'Shell/Bash';
		}

		// Count lines, functions, classes
		const lines = code.split('\n');
		const lineCount = lines.length;
		const functionMatches =
			code.match(
				/function |def |public|private|protected.* \w+\(|const .* = \(.*\) =>|^\s*\w+\s*\([^)]*\)\s*{/gm
			) || [];
		const classMatches = code.match(/class |interface |struct |enum /g) || [];

		// Generate basic explanation as a single paragraph
		let explanation = `This code appears to be written in ${language}. It contains approximately ${lineCount} lines of code with ${functionMatches.length} functions/methods`;

		if (classMatches.length > 0) {
			explanation += ` and ${classMatches.length} classes/interfaces`;
		}
		explanation += '. ';

		// Add more details based on language
		if (language === 'React') {
			explanation += 'This is a React component that renders UI elements. ';
			if (code.includes('useState')) {
				explanation +=
					'It uses hooks (like useState) to manage component state. ';
			}
			if (code.includes('useEffect')) {
				explanation +=
					'The useEffect hook is used for side effects or lifecycle events. ';
			}
			explanation +=
				'The component structure includes JSX markup for rendering the interface.';
		} else if (language === 'JavaScript/TypeScript') {
			explanation += 'This code uses modern JavaScript/TypeScript features. ';
			if (code.includes('async')) {
				explanation +=
					'It contains asynchronous functions that likely handle promises or API calls. ';
			}
			if (code.includes('class ')) {
				explanation +=
					'It uses class-based syntax for object-oriented programming. ';
			}
			explanation +=
				'The code is structured with functions and modules for better organization.';
		} else if (language === 'Python') {
			explanation +=
				'This Python code is structured with functions and possibly classes. ';
			if (code.includes('def __init__')) {
				explanation += 'It uses classes with initialization methods. ';
			}
			if (code.includes('with ')) {
				explanation += 'Context managers are used for resource handling. ';
			}
			explanation += 'The indentation is significant for defining code blocks.';
		}

		return explanation;
	}

	/**
	 * Analyzes code for environmental impact and efficiency
	 *
	 * Evaluates code for resource usage, inefficiencies, and provides
	 * optimization suggestions. Uses AI when available or falls back to
	 * local analysis.
	 *
	 * @param {string} code - The code to analyze
	 * @returns {Promise<{
	 *   ecoScore: number,
	 *   issues: string[],
	 *   suggestions: string[],
	 *   details: Record<string, any>
	 * }>} Environmental impact analysis results
	 */
	async optimizeEcoImpact(code: string): Promise<{
		ecoScore: number;
		issues: string[];
		suggestions: string[];
		details: Record<string, any>;
	}> {
		if (!this.apiKey) {
			return this.localEcoAnalysis(code);
		}

		try {
			// Prepare a concise version of the code to analyze (first 10k chars)
			const codeToAnalyze = code.substring(0, 10000);

			// Create a better prompt for eco-impact analysis
			const ecoPrompt = `
Analyze this code for environmental impact and efficiency:

\`\`\`
${codeToAnalyze}
\`\`\`

Provide output in JSON format with:
1. "ecoScore": Number between 0 and 100
2. "issues": [Array of inefficiencies found]
3. "suggestions": [Specific optimization suggestions]
4. "details": {Object with performance metrics}
`;

			const response = await fetch(
				`${HUGGINGFACE_API_URL}/${this.ecoImpactModel}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify({
						inputs: ecoPrompt,
						parameters: {
							max_length: 1024,
							temperature: 0.7,
							num_return_sequences: 1
						}
					})
				}
			);

			const data = await response.json();

			try {
				// Try to extract JSON from the response
				let jsonText = data[0].generated_text || '';
				jsonText = jsonText.substring(
					jsonText.indexOf('{'),
					jsonText.lastIndexOf('}') + 1
				);

				const parsedResult = JSON.parse(jsonText);

				// Validate and normalize the result
				return {
					ecoScore: parsedResult.ecoScore || 50,
					issues: Array.isArray(parsedResult.issues) ? parsedResult.issues : [],
					suggestions: Array.isArray(parsedResult.suggestions)
						? parsedResult.suggestions
						: [],
					details: parsedResult.details || {}
				};
			} catch (e) {
				// If parsing fails, use fallback local analysis
				console.error('Failed to parse HuggingFace response:', e);
				return this.localEcoAnalysis(code);
			}
		} catch (error) {
			console.error('Error optimizing eco impact:', error);
			return this.localEcoAnalysis(code);
		}
	}

	/**
	 * Normalizes risk level strings to standard values
	 *
	 * Ensures that risk levels from AI responses are normalized to one of
	 * the four standard risk levels used throughout the application.
	 *
	 * @param {string} level - The risk level string to normalize
	 * @returns {'Low' | 'Medium' | 'High' | 'Critical'} Normalized risk level
	 * @private
	 */
	private normalizeRiskLevel(
		level: string
	): 'Low' | 'Medium' | 'High' | 'Critical' {
		const normalized = level?.toLowerCase() || '';
		if (normalized.includes('low')) return 'Low';
		if (normalized.includes('med')) return 'Medium';
		if (normalized.includes('high')) return 'High';
		if (normalized.includes('crit')) return 'Critical';
		return 'Medium'; // Default
	}

	/**
	 * Local implementation of security analysis when AI is unavailable
	 *
	 * Uses pattern matching and heuristics to identify common security issues
	 * in different programming languages.
	 *
	 * @param {string} request - The code to analyze for security issues
	 * @returns {{
	 *   riskLevel: 'Low' | 'Medium' | 'High' | 'Critical',
	 *   threats: string[],
	 *   recommendations: string[],
	 *   confidenceLevel: number
	 * }} Security analysis results
	 * @private
	 */
	private localSecurityAnalysis(request: string) {
		// Basic pattern matching for security issues
		const lowercaseCode = request.toLowerCase();
		const threats: string[] = [];
		const recommendations: string[] = [];
		let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';

		// Try to determine the language
		let language = 'unknown';
		if (
			lowercaseCode.includes('fn main') &&
			(lowercaseCode.includes('impl') ||
				lowercaseCode.includes('struct') ||
				lowercaseCode.includes('use std'))
		) {
			language = 'rust';
		} else if (lowercaseCode.includes('public static void main')) {
			language = 'java';
		} else if (
			lowercaseCode.includes('def ') &&
			(lowercaseCode.includes('import ') || lowercaseCode.includes('class '))
		) {
			language = 'python';
		} else if (
			lowercaseCode.includes('console.log') ||
			lowercaseCode.includes('function(') ||
			lowercaseCode.includes('const ') ||
			lowercaseCode.includes('let ')
		) {
			language = 'javascript';
		} else if (lowercaseCode.includes('#include')) {
			language = 'c/c++';
		}

		// Get confidence level based on code size and language detection
		let confidenceLevel = 0.6;
		if (language !== 'unknown') {
			confidenceLevel = 0.7;
		}
		if (request.length < 100) {
			confidenceLevel -= 0.2;
		} else if (request.length > 1000) {
			confidenceLevel += 0.1;
		}

		// Check for API endpoints and their security
		const apiEndpointPatterns = [
			/api\/\w+/,
			/\/v\d+\/\w+/,
			/@route|@api|@endpoint/,
			/router\.(get|post|put|delete|patch)/,
			/app\.(get|post|put|delete|patch)/,
			/@(get|post|put|delete|patch)/
		];

		let hasApiEndpoints = false;
		for (const pattern of apiEndpointPatterns) {
			if (pattern.test(request)) {
				hasApiEndpoints = true;
				break;
			}
		}

		// Check for CORS configurations
		if (hasApiEndpoints) {
			const corsPatterns = [
				/cors/i,
				/access-control-allow-origin/i,
				/origin:/i
			];

			let hasCorsConfig = false;
			for (const pattern of corsPatterns) {
				if (pattern.test(request)) {
					hasCorsConfig = true;
					break;
				}
			}

			if (!hasCorsConfig) {
				threats.push('API endpoints detected without CORS protection');
				recommendations.push(
					'Implement CORS policy to restrict API access to trusted domains'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}

			// Check for overly permissive CORS
			const permissiveCors =
				/('|")\*('|")/i.test(request) &&
				/access-control-allow-origin/i.test(request);
			if (permissiveCors) {
				threats.push(
					'Overly permissive CORS configuration (Access-Control-Allow-Origin: *)'
				);
				recommendations.push(
					'Restrict CORS to specific trusted origins rather than using wildcard *'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}

			// Check for proper authentication on endpoints
			const authPatterns = [
				/auth|authenticate|login|token|verify|session/i,
				/jwt|oauth|passport|bearer|basic auth/i
			];

			let hasAuth = false;
			for (const pattern of authPatterns) {
				if (pattern.test(request)) {
					hasAuth = true;
					break;
				}
			}

			if (!hasAuth && hasApiEndpoints) {
				threats.push('API endpoints may lack proper authentication');
				recommendations.push(
					'Implement authentication for all API endpoints that access sensitive data'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : 'High';
			}
		}

		// Check for data validation
		const validationPatterns = [
			/validate|validation|sanitize|sanitization|escape/i,
			/schema|joi|yup|zod|validator|isvalid/i
		];

		let hasValidation = false;
		for (const pattern of validationPatterns) {
			if (pattern.test(request)) {
				hasValidation = true;
				break;
			}
		}

		const inputPatterns = [
			/req\.body|req\.params|req\.query|request\./i,
			/input|form data|formdata|parseform/i,
			/get(parameter|attribute|element)/i,
			/\.val\(\)/i
		];

		let hasUserInput = false;
		for (const pattern of inputPatterns) {
			if (pattern.test(request)) {
				hasUserInput = true;
				break;
			}
		}

		if (hasUserInput && !hasValidation) {
			threats.push(
				'User input processing without obvious validation/sanitization'
			);
			recommendations.push(
				'Implement input validation and sanitization for all user-provided data'
			);
			riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
		}

		// Check for sensitive data handling
		const sensitiveDataPatterns = [
			/password|credit.?card|ssn|social.?security|passport|address|email|phone/i,
			/personal.?data|pii|kyc|medical|health|financial/i
		];

		let hasSensitiveData = false;
		for (const pattern of sensitiveDataPatterns) {
			if (pattern.test(request)) {
				hasSensitiveData = true;
				break;
			}
		}

		const encryptionPatterns = [
			/encrypt|encryption|cipher|hash|bcrypt|scrypt|pbkdf2/i,
			/aes|rsa|sha\d+|crypto|ssl|tls/i
		];

		let hasEncryption = false;
		for (const pattern of encryptionPatterns) {
			if (pattern.test(request)) {
				hasEncryption = true;
				break;
			}
		}

		if (hasSensitiveData && !hasEncryption) {
			threats.push(
				'Handling sensitive data without obvious encryption/protection'
			);
			recommendations.push(
				'Implement encryption for sensitive data both at rest and in transit'
			);
			riskLevel = riskLevel === 'Low' ? 'High' : 'Critical';
		}

		// Check for logging of sensitive data
		const loggingPatterns = [/console\.log|print|logger|debug|logging/i];

		let hasLogging = false;
		for (const pattern of loggingPatterns) {
			if (pattern.test(request)) {
				hasLogging = true;
				break;
			}
		}

		if (hasSensitiveData && hasLogging) {
			// Check if sensitive data might be logged
			const sensitiveLoggingRisk =
				new RegExp(
					`(${sensitiveDataPatterns
						.map((p) => p.source)
						.join('|')}).*?(${loggingPatterns.map((p) => p.source).join('|')})`,
					'i'
				).test(request) ||
				new RegExp(
					`(${loggingPatterns
						.map((p) => p.source)
						.join('|')}).*?(${sensitiveDataPatterns
						.map((p) => p.source)
						.join('|')})`,
					'i'
				).test(request);

			if (sensitiveLoggingRisk) {
				threats.push('Potential logging of sensitive information');
				recommendations.push(
					'Ensure sensitive data is redacted or excluded from logs'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}
		}

		// Check for error handling that might expose sensitive information
		const errorHandlingPatterns = [
			/try\s*{|catch\s*\(|except:|rescue|finally|throw|raise/i
		];

		let hasErrorHandling = false;
		for (const pattern of errorHandlingPatterns) {
			if (pattern.test(request)) {
				hasErrorHandling = true;
				break;
			}
		}

		if (hasApiEndpoints && !hasErrorHandling) {
			threats.push('API endpoints without proper error handling detected');
			recommendations.push(
				'Implement proper error handling to avoid exposing sensitive stack traces'
			);
			riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
		}

		// Look for SQL injection vulnerabilities
		if (
			(lowercaseCode.includes('select') ||
				lowercaseCode.includes('insert') ||
				lowercaseCode.includes('update') ||
				lowercaseCode.includes('delete')) &&
			(lowercaseCode.includes('$_') ||
				lowercaseCode.includes('req.param') ||
				lowercaseCode.includes('req.body') ||
				lowercaseCode.includes('req.query') ||
				lowercaseCode.includes('input') ||
				lowercaseCode.includes('user_input'))
		) {
			threats.push('Potential SQL injection vulnerability detected');
			riskLevel = 'High';
		}

		// Look for XSS vulnerabilities
		if (
			(lowercaseCode.includes('innerhtml') ||
				lowercaseCode.includes('document.write')) &&
			(lowercaseCode.includes('$_') ||
				lowercaseCode.includes('req.param') ||
				lowercaseCode.includes('req.body') ||
				lowercaseCode.includes('req.query') ||
				lowercaseCode.includes('input') ||
				lowercaseCode.includes('user_input'))
		) {
			threats.push(
				'Potential Cross-site Scripting (XSS) vulnerability detected'
			);
			riskLevel = riskLevel === 'High' ? 'Critical' : 'High';
		}

		// Check for secure headers
		if (
			hasApiEndpoints ||
			request.includes('http') ||
			request.includes('express')
		) {
			const secureHeadersPatterns = [
				/content-security-policy|csp/i,
				/strict-transport-security|hsts/i,
				/x-content-type-options/i,
				/x-frame-options/i,
				/x-xss-protection/i,
				/helmet/i // Common security middleware that sets secure headers
			];

			let hasSecureHeaders = false;
			for (const pattern of secureHeadersPatterns) {
				if (pattern.test(request)) {
					hasSecureHeaders = true;
					break;
				}
			}

			if (!hasSecureHeaders) {
				threats.push('Security headers may be missing from HTTP responses');
				recommendations.push(
					'Implement security headers (CSP, HSTS, etc.) or use middleware like helmet.js'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}
		}

		// Look for hardcoded credentials
		if (
			lowercaseCode.includes('password') ||
			lowercaseCode.includes('apikey') ||
			lowercaseCode.includes('secret') ||
			lowercaseCode.includes('token') ||
			lowercaseCode.includes('pwd') ||
			lowercaseCode.includes('auth')
		) {
			if (lowercaseCode.match(/['"`]([a-z0-9!@#$%^&*()]{8,})['"`]/i)) {
				threats.push('Potential hardcoded credentials or secrets detected');
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}
		}

		// Look for insecure direct object references
		if (
			lowercaseCode.includes('id') &&
			(lowercaseCode.includes('findbyid') ||
				lowercaseCode.includes('getbyid') ||
				lowercaseCode.includes('find_by_id') ||
				lowercaseCode.includes('get_by_id'))
		) {
			threats.push(
				'Potential Insecure Direct Object Reference (IDOR) vulnerability'
			);
			riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
		}

		// Look for command injection
		if (
			(lowercaseCode.includes('exec(') ||
				lowercaseCode.includes('spawn(') ||
				lowercaseCode.includes('system(') ||
				lowercaseCode.includes('eval(') ||
				lowercaseCode.includes('command(') ||
				lowercaseCode.includes('process::command') ||
				lowercaseCode.includes('shell(') ||
				lowercaseCode.includes('std::process')) &&
			(lowercaseCode.includes('$_') ||
				lowercaseCode.includes('req.param') ||
				lowercaseCode.includes('req.body') ||
				lowercaseCode.includes('req.query') ||
				lowercaseCode.includes('args') ||
				lowercaseCode.includes('input') ||
				lowercaseCode.includes('user_input') ||
				lowercaseCode.includes('var') ||
				lowercaseCode.includes('param'))
		) {
			threats.push('Potential command injection vulnerability detected');
			riskLevel = 'Critical';
		}

		// Rust-specific security issues
		if (language === 'rust') {
			// Check for unsafe blocks
			if (
				lowercaseCode.includes('unsafe ') ||
				lowercaseCode.includes('unsafe{')
			) {
				threats.push(
					'Use of unsafe Rust code detected - potential memory safety issues'
				);
				riskLevel = riskLevel === 'Low' ? 'High' : 'Critical';
			}

			// Check for raw pointers
			if (
				lowercaseCode.includes('*mut ') ||
				lowercaseCode.includes('*const ')
			) {
				threats.push(
					'Use of raw pointers in Rust - potential memory safety issues'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}

			// Check for FFI
			if (
				lowercaseCode.includes('extern "c"') ||
				lowercaseCode.includes('#[no_mangle]')
			) {
				threats.push(
					'Foreign Function Interface (FFI) usage detected - potential safety issues'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}

			// Check for unchecked conversions
			if (
				lowercaseCode.includes('.unwrap()') ||
				lowercaseCode.includes('panic!')
			) {
				threats.push(
					'Unchecked result/option usage with unwrap() or panic! - potential runtime failures'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}
		}

		// JavaScript-specific issues
		if (language === 'javascript') {
			if (
				lowercaseCode.includes('eval(') ||
				lowercaseCode.includes('new function(')
			) {
				threats.push(
					'Use of eval() or dynamic function creation - security risk'
				);
				riskLevel = riskLevel === 'Low' ? 'High' : riskLevel;
			}

			if (lowercaseCode.includes('document.cookie')) {
				threats.push(
					'Direct cookie manipulation - potential cookie security issues'
				);
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}

			// Check for frontend security concerns
			const frontendSecurityPatterns = [
				/innerhtml|outerhtml/i,
				/localstorage|sessionstorage/i,
				/postmessage/i
			];

			for (const pattern of frontendSecurityPatterns) {
				if (pattern.test(lowercaseCode)) {
					if (pattern.source.includes('innerhtml')) {
						threats.push(
							'Using innerHTML without proper sanitization - potential XSS risk'
						);
						recommendations.push(
							'Use textContent instead of innerHTML or sanitize HTML content'
						);
					} else if (pattern.source.includes('localstorage')) {
						if (hasSensitiveData) {
							threats.push(
								'Potential storage of sensitive data in localStorage/sessionStorage'
							);
							recommendations.push(
								'Avoid storing sensitive data in browser storage mechanisms'
							);
						}
					} else if (pattern.source.includes('postmessage')) {
						if (!lowercaseCode.includes('origin')) {
							threats.push('Using postMessage without origin validation');
							recommendations.push(
								'Always validate origin when receiving postMessage data'
							);
						}
					}
					riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
				}
			}
		}

		// Python-specific issues
		if (language === 'python') {
			if (
				lowercaseCode.includes('pickle.loads') ||
				lowercaseCode.includes('marshal.loads')
			) {
				threats.push(
					'Use of unsafe deserialization (pickle/marshal) - security risk'
				);
				riskLevel = 'High';
			}

			if (
				lowercaseCode.includes('__import__') ||
				lowercaseCode.includes('importlib')
			) {
				threats.push('Dynamic imports - potential code injection vector');
				riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
			}

			// Check for Django/Flask security patterns
			if (lowercaseCode.includes('django') || lowercaseCode.includes('flask')) {
				// Check for CSRF protection
				if (!lowercaseCode.includes('csrf')) {
					threats.push(
						'Web framework detected without obvious CSRF protection'
					);
					recommendations.push(
						'Ensure CSRF protection is enabled in your web framework'
					);
					riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
				}

				// Check for debug mode in production
				if (lowercaseCode.includes('debug') && lowercaseCode.includes('true')) {
					threats.push('Debug mode may be enabled in a web application');
					recommendations.push('Disable debug mode in production environments');
					riskLevel = riskLevel === 'Low' ? 'Medium' : riskLevel;
				}
			}
		}

		// Add recommendations based on detected threats
		if (threats.includes('Potential SQL injection vulnerability detected')) {
			recommendations.push(
				'Use parameterized queries or an ORM instead of string concatenation'
			);
		}

		if (
			threats.includes(
				'Potential Cross-site Scripting (XSS) vulnerability detected'
			)
		) {
			recommendations.push(
				'Use content security policy (CSP) and escape output before rendering'
			);
		}

		if (
			threats.includes('Potential hardcoded credentials or secrets detected')
		) {
			recommendations.push(
				'Store sensitive information in environment variables or a secure vault'
			);
		}

		if (
			threats.includes(
				'Potential Insecure Direct Object Reference (IDOR) vulnerability'
			)
		) {
			recommendations.push(
				'Implement proper access control checks before serving data'
			);
		}

		if (
			threats.includes('Potential command injection vulnerability detected')
		) {
			recommendations.push(
				'Avoid using exec/eval with user input; use allowlists for commands if necessary'
			);
		}

		// Add Rust-specific recommendations
		if (
			threats.includes(
				'Use of unsafe Rust code detected - potential memory safety issues'
			)
		) {
			recommendations.push(
				'Minimize unsafe blocks and ensure they are properly documented and reviewed'
			);
		}

		if (
			threats.includes(
				'Use of raw pointers in Rust - potential memory safety issues'
			)
		) {
			recommendations.push(
				'Prefer safe abstractions like references and smart pointers over raw pointers'
			);
		}

		if (
			threats.includes(
				'Foreign Function Interface (FFI) usage detected - potential safety issues'
			)
		) {
			recommendations.push(
				'Ensure all FFI code is carefully reviewed and properly isolated'
			);
		}

		if (
			threats.includes(
				'Unchecked result/option usage with unwrap() or panic! - potential runtime failures'
			)
		) {
			recommendations.push(
				'Replace .unwrap() with proper error handling using match, if let, or ?'
			);
		}

		// If no specific threats were found
		if (threats.length === 0) {
			threats.push('No obvious security vulnerabilities detected');
		}

		// Add generic recommendation if none specific were added
		if (recommendations.length === 0) {
			recommendations.push(
				'Follow security best practices for your framework/language'
			);
		}

		return {
			riskLevel,
			threats,
			recommendations,
			confidenceLevel // Local analysis has moderate confidence level
		};
	}

	/**
	 * Local implementation of eco-impact analysis when AI is unavailable
	 *
	 * Analyzes code for inefficiencies and environmental impact using
	 * pattern matching and language-specific heuristics.
	 *
	 * @param {string} code - The code to analyze for eco-impact
	 * @returns {{
	 *   ecoScore: number,
	 *   issues: string[],
	 *   suggestions: string[],
	 *   details: Record<string, any>
	 * }} Environmental impact analysis results
	 * @private
	 */
	private localEcoAnalysis(code: string) {
		const issues: string[] = [];
		const suggestions: string[] = [];

		// Try to detect the language
		let language = 'unknown';
		const lowercaseCode = code.toLowerCase();

		// Simple language detection based on syntax patterns
		if (
			lowercaseCode.includes('fn main') &&
			(lowercaseCode.includes('impl') ||
				lowercaseCode.includes('struct') ||
				lowercaseCode.includes('use std'))
		) {
			language = 'Rust';
		} else if (lowercaseCode.includes('public static void main')) {
			language = 'Java';
		} else if (
			lowercaseCode.match(/console\.log|function\s*\(|const\s+|let\s+|var\s+/)
		) {
			language = 'JavaScript/TypeScript';
		} else if (
			lowercaseCode.includes('def ') &&
			(lowercaseCode.includes('import ') || lowercaseCode.includes('class '))
		) {
			language = 'Python';
		} else if (lowercaseCode.includes('#include')) {
			language = 'C/C++';
		}

		// Split code into lines for analysis
		const lines = code.split('\n');

		// Initial eco score based on language efficiency
		let baseScore = 70;
		if (language === 'Rust' || language === 'C/C++') {
			baseScore = 75; // Higher baseline for systems languages
		} else if (language === 'Python') {
			baseScore = 65; // Slightly lower for interpreted languages
		} else if (language === 'JavaScript/TypeScript') {
			baseScore = 68;
		} else if (language === 'Java') {
			baseScore = 72;
		}

		// Check for code redundancies
		// 1. Look for repeated code blocks (minimum 3 lines)
		const lineSet = new Set<string>();
		const repeatedLines = new Set<string>();
		let redundancyCount = 0;

		// Clean lines for comparison (remove whitespace, comments)
		const cleanedLines = lines
			.map((line) => line.trim().replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, ''))
			.filter((line) => line.length > 0);

		// Check for repeated blocks (3+ lines)
		for (let i = 0; i < cleanedLines.length - 2; i++) {
			const block = cleanedLines.slice(i, i + 3).join('\n');
			if (lineSet.has(block)) {
				redundancyCount++;
				repeatedLines.add(block);
			} else {
				lineSet.add(block);
			}
		}

		if (redundancyCount > 0) {
			issues.push(
				`Detected ${redundancyCount} blocks of potentially redundant code`
			);
			suggestions.push(
				'Extract repeated code blocks into reusable functions or components'
			);
			baseScore -= Math.min(15, redundancyCount * 3);
		}

		// Check for duplicate function declarations
		const functionPatterns = [
			/function\s+(\w+)/g, // JavaScript
			/def\s+(\w+)/g, // Python
			/public|private|protected.*?\s+(\w+)\s*\(/g, // Java
			/fn\s+(\w+)/g // Rust
		];

		const functionNames = new Set<string>();
		const duplicateFunctions = new Set<string>();

		for (const pattern of functionPatterns) {
			const matches = code.matchAll(pattern);
			for (const match of matches) {
				if (match[1]) {
					if (functionNames.has(match[1])) {
						duplicateFunctions.add(match[1]);
					} else {
						functionNames.add(match[1]);
					}
				}
			}
		}

		if (duplicateFunctions.size > 0) {
			issues.push(
				`Found ${duplicateFunctions.size} potentially duplicated function names`
			);
			suggestions.push(
				'Rename or consolidate functions with similar names and purposes'
			);
			baseScore -= duplicateFunctions.size * 2;
		}

		// Check for AI integration
		const aiPatterns = [
			/openai|gpt|llm|huggingface|ai client|machine learning|neural network|transformer/i,
			/tensorflow|pytorch|keras|model\.predict|embedding|token|bert|stable diffusion/i
		];

		let hasAI = false;
		for (const pattern of aiPatterns) {
			if (pattern.test(code)) {
				hasAI = true;
				break;
			}
		}

		if (hasAI) {
			// Check for AI efficiency practices
			const aiEfficient = /cache|memoize|throttle|batch/i.test(code);

			if (aiEfficient) {
				suggestions.push('Good: Found caching or batching for AI operations');
				baseScore += 5;
			} else {
				issues.push(
					'AI integration detected without obvious efficiency measures'
				);
				suggestions.push(
					'Implement caching, batching, or throttling for AI API calls'
				);
				baseScore -= 8;
			}

			// Check for local vs. remote model usage
			const localModelUsage = /local_model|onnx|tflite|quantized|edge/i.test(
				code
			);
			if (localModelUsage) {
				suggestions.push(
					'Good: Using local/edge AI models which can reduce network overhead'
				);
				baseScore += 3;
			} else if (
				/api[\s-_]?key|token|secret|endpoint|openai\.com|api\.anthropic/i.test(
					code
				)
			) {
				issues.push('Using remote AI APIs which can increase carbon footprint');
				suggestions.push(
					'Consider using smaller, local models for less intensive tasks'
				);
				baseScore -= 5;
			}
		}

		// Check for loops that could be inefficient
		const loopMatches =
			code.match(
				/for\s*\([^)]*\)|while\s*\([^)]*\)|forEach|map|LOOP|do\s*{/g
			) || [];

		// Check for nested loops (potential O(n²) or worse)
		let nestedLoopCount = 0;
		const blockStarts = [];
		for (const line of lines) {
			if (line.match(/for\s*\(|while\s*\(|\{\s*$/)) {
				blockStarts.push(line);
			} else if (line.includes('}')) {
				blockStarts.pop();
			}

			if (blockStarts.filter((block) => block.match(/for|while/)).length > 1) {
				nestedLoopCount++;
			}
		}

		if (nestedLoopCount > 0) {
			issues.push(
				`${nestedLoopCount} nested loops detected (potential O(n²) or worse time complexity)`
			);
			suggestions.push(
				'Consider refactoring nested loops to reduce time complexity'
			);
		}

		// Check for recursion that might be inefficient
		if (
			code.match(/function\s+(\w+)[^{]*\{[\s\S]*\1\s*\(/) ||
			code.match(/def\s+(\w+)[^:]*:[\s\S]*\1\s*\(/) ||
			code.match(/fn\s+(\w+)[^{]*\{[\s\S]*\1\s*\(/)
		) {
			issues.push('Recursive function calls detected');
			suggestions.push(
				'Ensure recursive functions have proper termination conditions'
			);
		}

		// Check for large string concatenations
		if ((code.match(/\+\s*"/g) || []).length > 5) {
			issues.push('Multiple string concatenations found');
			suggestions.push(
				'Use string templating or builder pattern for multiple concatenations'
			);
		}

		// Check for energy-intensive operations
		if (code.match(/crypto|hash|bcrypt|scrypt|mining/i)) {
			issues.push(
				'Potentially energy-intensive cryptographic operations detected'
			);
			suggestions.push(
				'Ensure cryptographic operations are used sparingly and efficiently'
			);
			baseScore -= 7;
		}

		// Check for large media processing
		if (
			code.match(
				/image|video|audio|canvas|media|transcode|render|animation/i
			) &&
			code.match(/process|transform|filter|load|manipulation/i)
		) {
			issues.push(
				'Media processing detected - potentially high energy consumption'
			);
			suggestions.push(
				'Implement lazy loading and optimize media processing operations'
			);
			baseScore -= 6;
		}

		// Check for language-specific inefficiencies
		if (language === 'JavaScript/TypeScript') {
			// Check for document.querySelectorAll followed by loops
			if (
				code.includes('document.querySelectorAll') &&
				code.match(/for|forEach|map/)
			) {
				issues.push('DOM collection iteration pattern detected');
				suggestions.push('Consider using more efficient DOM traversal methods');
			}

			// Check for lots of DOM manipulation
			const domOperations = (
				code.match(
					/document\.createElement|appendChild|innerHTML|getElementById|querySelector/g
				) || []
			).length;
			if (domOperations > 10) {
				issues.push('High number of DOM operations detected');
				suggestions.push(
					'Batch DOM updates or consider using a virtual DOM approach'
				);
				baseScore -= 8;
			}

			// Check for excessive re-renders in React
			if (code.includes('React') || code.includes('useState')) {
				const stateUpdates = (code.match(/setState|useState|useReducer/g) || [])
					.length;
				const memoization = (
					code.match(/useMemo|React\.memo|useCallback/g) || []
				).length;

				if (stateUpdates > 5 && memoization === 0) {
					issues.push(
						'Multiple state updates without memoization could cause excessive re-renders'
					);
					suggestions.push(
						'Use React.memo, useMemo, or useCallback to prevent unnecessary re-renders'
					);
					baseScore -= 5;
				}
			}
		} else if (language === 'Python') {
			// Check for inefficient list operations
			if (
				code.includes('+= [') ||
				code.match(/for\s+.*\s+in\s+.*:\s*\n\s*.*\.append/)
			) {
				issues.push('Inefficient list concatenation pattern detected');
				suggestions.push(
					'Use list comprehensions or extend() instead of append in loops'
				);
				baseScore -= 5;
			}

			// Check for global interpreter lock issues
			if (code.includes('threading') && code.includes('while True')) {
				issues.push('Potential CPU-bound thread blocking due to GIL');
				suggestions.push(
					'Consider using multiprocessing instead of threading for CPU-bound tasks'
				);
				baseScore -= 10;
			}

			// Check for pandas efficiency
			if (code.includes('pandas') || code.includes('pd.')) {
				const inefficientPandas = /apply|iterrows|for.*row in/i.test(code);
				if (inefficientPandas) {
					issues.push(
						'Inefficient pandas operations detected (iterative processing)'
					);
					suggestions.push(
						'Use vectorized operations instead of iterative row processing'
					);
					baseScore -= 7;
				}
			}
		} else if (language === 'Java') {
			// Check for inefficient string handling
			if (
				(code.match(/String.*\+=/g) || []).length > 3 &&
				!code.includes('StringBuilder')
			) {
				issues.push('Inefficient String concatenation with += operator');
				suggestions.push('Use StringBuilder for string concatenation in loops');
				baseScore -= 7;
			}

			// Check for excessive object creation
			const newObjects = (code.match(/new\s+\w+/g) || []).length;
			if (newObjects > 20) {
				issues.push('High rate of object creation detected');
				suggestions.push('Consider object pooling or reuse patterns');
				baseScore -= 5;
			}

			// Check for stream API usage
			if (code.includes('Collection') || code.includes('List<')) {
				const usesStreams = code.includes('stream()');
				if (!usesStreams && code.match(/for\s*\([^)]*:/)) {
					suggestions.push(
						'Consider using Stream API for more efficient collection processing'
					);
					baseScore -= 3;
				}
			}
		} else if (language === 'Rust') {
			// Check for potential memory inefficiencies
			if (code.includes('to_string') && code.match(/for|while/)) {
				issues.push('Repeated to_string() calls in loops');
				suggestions.push(
					'Use string references (&str) instead of String allocations where possible'
				);
				baseScore -= 3;
			}

			// Check for potential clone inefficiencies
			if ((code.match(/\.clone\(\)/g) || []).length > 5) {
				issues.push(
					'Multiple clone() calls detected - potential memory inefficiency'
				);
				suggestions.push(
					'Consider using references or move semantics to avoid cloning'
				);
				baseScore -= 4;
			}

			// Positively adjust score for Rust's memory efficiency
			if (!code.includes('unsafe') && code.includes('&mut ')) {
				suggestions.push("Good use of Rust's memory safety features");
				baseScore += 5;
			}

			// Check for async efficiency
			if (code.includes('async') && code.includes('await')) {
				if (
					!code.includes('join') &&
					(code.match(/\.await/g) || []).length > 3
				) {
					issues.push(
						'Multiple sequential await operations could be parallelized'
					);
					suggestions.push(
						'Use join! macro to run async operations concurrently'
					);
					baseScore -= 3;
				}
			}
		} else if (language === 'C/C++') {
			// Check for memory leaks
			const allocations = (code.match(/malloc\(|new\s+\w+/g) || []).length;
			const frees = (code.match(/free\(|delete\s+/g) || []).length;
			if (allocations > frees + 2) {
				issues.push(
					'Potential memory leak: more allocations than deallocations'
				);
				suggestions.push('Ensure all allocated memory is properly freed');
				baseScore -= 15;
			}

			// Check for large buffer allocations
			if (code.match(/malloc\(\s*\w+\s*\*\s*sizeof/)) {
				issues.push('Large buffer allocation detected');
				suggestions.push(
					'Consider using dynamic data structures or memory-mapped files for large data'
				);
				baseScore -= 5;
			}
		}

		// Check for inefficient string concatenation
		if (
			(code.match(/\+\=/g) || []).length > 5 &&
			code.match(/string|String|str|text|Text/)
		) {
			issues.push('Inefficient string concatenation detected');

			if (language === 'JavaScript/TypeScript') {
				suggestions.push(
					'Use array.join() or template literals instead of string concatenation'
				);
			} else if (language === 'Java') {
				suggestions.push(
					'Use StringBuilder instead of String concatenation in loops'
				);
			} else if (language === 'Python') {
				suggestions.push('Use "".join(list) instead of string += in loops');
			} else if (language === 'C/C++') {
				suggestions.push(
					'Use std::stringstream or std::string::append() instead of += operator'
				);
			} else {
				suggestions.push(
					'Use string builder pattern for better memory efficiency'
				);
			}
		}

		// Calculate a dynamic eco score based on issues found
		let ecoScore = baseScore;

		// More severe issues reduce score more significantly
		ecoScore -= Math.min(20, issues.length * 5); // Cap the reduction at 20 points
		if (nestedLoopCount > 0) ecoScore -= Math.min(15, nestedLoopCount * 5); // Cap the reduction at 15 points

		// Modify score based on code size - very large files might be less maintainable
		if (code.length > 5000) ecoScore -= 3;
		if (code.length > 10000) ecoScore -= 5;

		// Check file organization - too many lines is not eco-friendly (harder to maintain)
		if (lines.length > 500) {
			issues.push('Extremely large file detected (over 500 lines)');
			suggestions.push(
				'Break down large files into smaller, more focused modules'
			);
			ecoScore -= 5;
		}

		// Ensure score stays within 0-100 range with more variance
		ecoScore = Math.max(35, Math.min(95, ecoScore));

		// Add generic suggestions if none specific were found
		if (suggestions.length === 0) {
			if (language === 'JavaScript/TypeScript') {
				suggestions.push(
					'Use modern JS features like array methods, async/await, and avoid jQuery DOM manipulation'
				);
			} else if (language === 'Python') {
				suggestions.push(
					'Follow PEP 8 style guide and use list comprehensions, generators, and context managers'
				);
			} else if (language === 'Java') {
				suggestions.push(
					'Use Stream API, try-with-resources, and follow effective Java patterns'
				);
			} else if (language === 'C/C++') {
				suggestions.push(
					'Use RAII pattern, smart pointers, and prefer std algorithms over raw loops'
				);
			} else if (language === 'Rust') {
				suggestions.push(
					"Leverage Rust's ownership system and avoid unnecessary memory allocations"
				);
			} else {
				suggestions.push(
					'Follow language-specific best practices for performance optimization'
				);
			}
		}

		// Add generic issues if none specific were found
		if (issues.length === 0) {
			issues.push('No obvious efficiency issues detected');
			// Bonus for clean code
			ecoScore += 5;
		}

		return {
			ecoScore,
			issues,
			suggestions,
			details: {
				codeSize: code.length,
				lineCount: lines.length,
				loopCount: loopMatches.length,
				issueCount: issues.length,
				language: language,
				redundancies: redundancyCount,
				aiIntegration: hasAI
			}
		};
	}

	/**
	 * Generates text embeddings for semantic search and similarity comparison
	 *
	 * Creates a vector representation of text that captures semantic meaning,
	 * allowing for similarity comparisons between different text fragments.
	 * This is a sophisticated local implementation that simulates the behavior
	 * of machine learning embedding models.
	 *
	 * @param {string} text - The text to convert to an embedding vector
	 * @returns {number[]} A 32-dimensional vector representation of the text
	 * @public
	 */
	public generateTextEmbedding(text: string): number[] {
		// Create a more complex embedding vector to simulate real embeddings
		// Real embeddings typically have hundreds or thousands of dimensions
		// Here we'll create a 32-dimensional mock embedding based on text characteristics

		// Initialize a zero vector
		const embedding = Array(32).fill(0);

		// Text characteristics to encode
		const charCount = text.length;
		const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
		const lineCount = text.split('\n').length;
		const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
		const digitCount = (text.match(/\d/g) || []).length;
		const specialCharCount = (text.match(/[^\w\s]/g) || []).length;
		const wordLengthAvg =
			wordCount > 0
				? text
						.split(/\s+/)
						.filter((w) => w.length > 0)
						.reduce((sum, word) => sum + word.length, 0) / wordCount
				: 0;

		// Encode basic text statistics (dimensions 0-7)
		embedding[0] = this.normalizeValue(charCount, 0, 10000);
		embedding[1] = this.normalizeValue(wordCount, 0, 2000);
		embedding[2] = this.normalizeValue(lineCount, 0, 500);
		embedding[3] = this.normalizeValue(
			uppercaseCount / Math.max(charCount, 1),
			0,
			1
		);
		embedding[4] = this.normalizeValue(
			digitCount / Math.max(charCount, 1),
			0,
			1
		);
		embedding[5] = this.normalizeValue(
			specialCharCount / Math.max(charCount, 1),
			0,
			1
		);
		embedding[6] = this.normalizeValue(wordLengthAvg, 1, 20);
		embedding[7] = this.normalizeValue(
			text.split(/[.!?]/).filter((s) => s.trim().length > 0).length /
				Math.max(lineCount, 1),
			0,
			10
		);

		// Programming patterns (next 8 dimensions)
		embedding[8] = this.normalizeValue(
			(text.match(/[{}]/g) || []).length / (lineCount || 1),
			0,
			2
		); // code block density
		embedding[9] = this.normalizeValue(
			(text.match(/[();]/g) || []).length / (lineCount || 1),
			0,
			5
		); // expression density

		// Domain-specific features (next 5 dimensions)
		embedding[10] = this.normalizeValue(
			(text.match(/[.!?]/g) || []).length /
				(text.split(/\s+/).filter((w) => w.length > 0).length || 1),
			0,
			10
		); // sentence complexity
		embedding[11] = this.normalizeValue(
			(text.match(/\s+/g) || []).length / (text.length || 1),
			0,
			5
		); // whitespace density
		embedding[12] = this.normalizeValue(
			(text.match(/[a-z]/g) || []).length / (text.length || 1),
			0,
			1
		); // lowercase letter frequency
		embedding[13] = this.normalizeValue(
			(text.match(/[A-Z]/g) || []).length / (text.length || 1),
			0,
			1
		); // uppercase letter frequency
		embedding[14] = this.normalizeValue(
			(text.match(/[0-9]/g) || []).length / (text.length || 1),
			0,
			1
		); // digit frequency

		// Language detection (simplified) (next 6 dimensions)
		embedding[15] = /function\s*\([^)]*\)\s*{|const |let |var |=>/.test(text)
			? 0.9
			: -0.5; // JS
		embedding[16] = /def\s+\w+\s*\([^)]*\):|import\s+\w+|class\s+\w+:/.test(
			text
		)
			? 0.9
			: -0.5; // Python
		embedding[17] =
			/public\s+\w+\s*\([^)]*\)\s*{|extends |implements |@Override/.test(text)
				? 0.9
				: -0.5; // Java
		embedding[18] = /fn\s+\w+|impl|pub\s+struct|use\s+std|::\w+/.test(text)
			? 0.9
			: -0.5; // Rust
		embedding[19] =
			/#include\s*<|void\s+\w+\s*\(|int\s+\w+\s*=|std::|template\s*</.test(text)
				? 0.9
				: -0.5; // C++
		embedding[20] = /<!DOCTYPE html>|<html>|<div|<span|className=|<\//.test(
			text
		)
			? 0.9
			: -0.5; // HTML/JSX

		// Add some noise for the last dimensions to mimic real embeddings
		for (let i = 21; i < 32; i++) {
			embedding[i] = (Math.random() * 2 - 1) * 0.1; // Small random noise
		}

		// Normalize the full vector to unit length as real embeddings often are
		const magnitude = Math.sqrt(
			embedding.reduce((sum, val) => sum + val * val, 0)
		);
		return embedding.map((val) => val / (magnitude || 1));
	}

	/**
	 * Normalizes a value to a range between -1 and 1
	 *
	 * Takes a value and its expected min/max range and converts it to
	 * a normalized value between -1 and 1, which is useful for embedding vectors.
	 *
	 * @param {number} value - The value to normalize
	 * @param {number} min - The minimum expected value in the original range
	 * @param {number} max - The maximum expected value in the original range
	 * @returns {number} The normalized value between -1 and 1
	 * @private
	 */
	private normalizeValue(value: number, min: number, max: number): number {
		return 2 * ((value - min) / (max - min || 1)) - 1;
	}
}

// Singleton instance
export const aiClient = new AIClient();
