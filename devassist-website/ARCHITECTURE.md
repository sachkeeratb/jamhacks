# DevAssist Architecture Documentation

This document provides a detailed overview of the DevAssist application architecture, components, data flow, and implementation details.

## System Overview

DevAssist is built as a modern web application using Next.js and React. The application analyzes code repositories and provides insights through four primary analysis modules:

1. **Code Intelligence**: Semantic search and understanding of code
2. **Security Analyzer**: Detection of vulnerabilities and security issues
3. **Eco Analyzer**: Analysis of environmental impact and efficiency
4. **HTTP Inspector**: Analysis of HTTP/HTTPS traffic

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Application                       │
│                                                                 │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐    ┌─────────┐         │
│  │  Code   │   │ Security│   │  Eco    │    │  HTTP   │         │
│  │ Intel.  │   │ Analyzer│   │ Analyzer│    │Inspector│         │
│  └────┬────┘   └────┬────┘   └────┬────┘    └────┬────┘         │
│       │             │             │              │              │
│       └─────────────┼─────────────┼──────────────┘              │
│                     │             │                             │
│                 ┌───▼─────────────▼───┐                         │
│                 │   Analysis Core     │                         │
│                 └──────────┬──────────┘                         │
│                            │                                    │
│                    ┌───────▼────────┐                           │
│                    │   AI Client    │                           │
│                    └───────┬────────┘                           │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │Hugging Face API  │
                    │  (Optional)      │
                    └──────────────────┘
```

## Component Architecture

### 1. Core Components

#### 1.1 Landing Page (`src/components/home/LandingPage.tsx`)

- Entry point for the application
- Provides three methods for code analysis:
  - Local folder upload
  - GitHub repository URL analysis
  - Direct code pasting
- Processes and validates inputs before passing to analysis components

#### 1.2 Unified Analysis (`src/components/analysis/UnifiedAnalysis.tsx`)

- Central component that coordinates all analysis types
- Displays results from all analyzers in a tabbed interface
- Shows file structure and detailed statistics

#### 1.3 AI Client (`src/lib/ai/index.ts`)

- Core service that handles AI-powered analysis
- Connects to Hugging Face API when available
- Provides fallback local analysis functions when no API key is present
- Implements text embedding generation for semantic search

### 2. Analysis Modules

#### 2.1 Code Intelligence

- Semantic search using vector embeddings
- Code explanation and documentation generation
- Project structure visualization
- Language detection and statistics

#### 2.2 Security Analyzer

- Vulnerability detection through pattern matching
- Risk level assessment (Low/Medium/High/Critical)
- Security recommendations generation
- Language-specific security checks

#### 2.3 Eco Analyzer

- Code efficiency analysis
- Environmental impact scoring
- Optimization recommendations
- Resource usage analysis

#### 2.4 HTTP Inspector

- Request/response analysis
- Headers and payload inspection
- Performance metrics
- API testing functionality

## Data Flow

1. **Input Processing**

   - User provides code through folder upload, GitHub URL, or direct pasting
   - System processes files, excluding binaries, large files, and non-code files
   - Code is parsed and prepared for analysis

2. **Analysis Pipeline**

   - Code is analyzed by each module in parallel
   - Results are aggregated in the unified analysis view

3. **AI Processing**

   - If Hugging Face API key is available:
     - Code is sent to AI models for enhanced analysis
     - Results are processed and displayed
   - If no API key:
     - Local analysis algorithms are used as fallback
     - Basic pattern matching and heuristics provide analysis results

4. **Result Presentation**
   - Analysis results are displayed in a unified interface
   - Users can navigate between different analysis types
   - Details are presented in an interactive format with visualizations

## State Management

The application uses Zustand for state management:

- **Global Application State**: `src/lib/store/useAppStore.ts`
- **Analytics State**: Managed within the analysis components
- **Component-level State**: React's useState for component-specific state

## Key Technologies and Libraries

1. **Core Framework**

   - Next.js 15.3.2
   - React 19.0.0
   - TypeScript 5

2. **UI Components**

   - TailwindCSS 4
   - Radix UI Components
   - Framer Motion for animations
   - CodeMirror for code display

3. **Analysis Tools**

   - Custom embedding generation
   - JSZip for GitHub repository processing
   - Chart.js and Recharts for visualizations

4. **State Management**
   - Zustand for global state

## Security and Performance Considerations

1. **Security**

   - No sensitive data is sent to external services without user consent
   - Local analysis options available for sensitive codebases
   - No data persistence beyond the session

2. **Performance**

   - Dynamic imports for code splitting
   - Lazy loading of analysis modules
   - Efficient processing of large codebases
   - Limited file size (10MB max) to prevent browser crashes

3. **Accessibility**
   - Dark mode support
   - Keyboard navigation
   - Screen reader compatible components

## Extensibility

The architecture is designed for extensibility:

1. **Adding New Analyzers**

   - Create a new analyzer component in `src/components`
   - Extend the unified analysis to include the new analyzer
   - Add appropriate tab in the UI

2. **Supporting New Languages**

   - Extend language detection in `src/lib/ai/index.ts`
   - Add language-specific analysis patterns

3. **Integrating Additional AI Models**
   - Modify the AIClient to support new model endpoints
   - Add appropriate API integration
