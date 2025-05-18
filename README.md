# DevAssist 🛡️🌱

## JamHacks 9 Hackathon Project

DevAssist is a powerful web-based tool designed to enhance the software development process through intelligent code analysis, focusing on security, environmental impact, and code quality. Built with modern web technologies, it provides developers with real-time insights and recommendations.

## Core Features

### 1. Code Intelligence 🧠

- Semantic code search and understanding
- Project structure visualization
- Language detection and statistics
- Code explanation and documentation generation

### 2. Security Analysis 🔒

- Real-time vulnerability detection
- Risk level assessment (Low/Medium/High/Critical)
- Security best practices recommendations
- Language-specific security checks

### 3. Environmental Impact 🌍

- Code efficiency analysis
- Carbon footprint estimation
- Resource optimization suggestions
- Environmental impact scoring
- Green coding practices recommendations

### 4. HTTP Inspector 🔍

- Request/response analysis
- Headers and payload inspection
- Performance metrics
- API testing functionality

## Tech Stack

### Core Framework

- Next.js 15.3.2
- React 19.0.0
- TypeScript 5

### UI Components

- TailwindCSS 4
- Radix UI Components
- Framer Motion
- CodeMirror

### Analysis Tools

- Custom embedding generation
- JSZip for repository processing
- Chart.js and Recharts for visualizations
- Zustand for state management

## Getting Started

### Prerequisites

- Node.js
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/sachkeeratb/jamhacks

# Navigate to project directory
cd devassist-website

# Install dependencies
npm install

# Start development server
npm run dev
```

Put in your Hugging Face AI API Key into your .env file if you want to incorporate AI analyses within your project overview.

The application will be available at `http://localhost:3000`

## Usage

DevAssist offers three methods for code analysis:

1. Local folder upload
2. GitHub repository URL analysis
3. Direct code pasting

Each analysis provides comprehensive insights through our four analysis modules, displayed in an intuitive tabbed interface.

## Architecture

The project follows a modular architecture with:

- Core analysis engine
- AI-powered processing (optional Hugging Face API integration)
- Parallel processing of analysis modules
- Real-time result aggregation and visualization

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Performance and Security

- No sensitive data sent to external services without consent
- Local analysis options for sensitive codebases
- No data persistence beyond session
- 10MB file size limit for optimal performance
- Dynamic imports and lazy loading for efficiency

## Team

Meet the passionate developers behind DevAssist:

- **Sachkeerat Singh Brar** - Full Stack Developer
- **Vihaan Shah** - Security & Analysis Expert
- **Dhyey Hansoti** - Environmental Impact Specialist
