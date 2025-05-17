import { create } from 'zustand';

/**
 * Theme type definition
 * Represents the possible theme values for the application
 */
export type Theme = 'dark' | 'light' | 'system';

/**
 * Tab type definition
 * Represents the main navigation tabs in the application
 */
export type AppTab =
	| 'http-inspector'
	| 'security-analyzer'
	| 'code-intelligence'
	| 'eco-analyzer';

/**
 * Session type definition
 * Represents a saved analysis session
 */
export interface Session {
	id: string;
	name: string;
	timestamp: number;
	type: AppTab;
}

/**
 * Application State Interface
 *
 * Defines the global state structure for the entire application.
 * This includes theme settings, active tab tracking, and session management.
 *
 * @interface AppState
 */
interface AppState {
	// Theme management
	/** Current application theme */
	theme: Theme;
	/** Function to update the application theme */
	setTheme: (theme: Theme) => void;

	// Navigation management
	/** Currently active tab in the application */
	activeTab: AppTab;
	/** Function to change the active tab */
	setActiveTab: (tab: AppTab) => void;

	// Session management
	/** Array of saved analysis sessions */
	sessions: Session[];
	/** ID of the currently active session, or null if none */
	currentSessionId: string | null;
	/** Function to add a new session to the store */
	addSession: (session: { name: string; type: AppTab }) => void;
	/** Function to set the current active session */
	setCurrentSessionId: (id: string | null) => void;
	/** Function to remove a session from the store */
	removeSession: (id: string) => void;
}

/**
 * Global application state store using Zustand
 *
 * This store provides a centralized way to manage application state
 * across components without prop drilling or complex context providers.
 *
 * Usage:
 * ```
 * const { theme, setTheme } = useAppStore();
 * ```
 */
export const useAppStore = create<AppState>((set) => ({
	// Theme management
	theme: 'dark', // Default theme is dark
	setTheme: (theme) => set({ theme }),

	// Navigation management
	activeTab: 'http-inspector', // Default active tab
	setActiveTab: (activeTab) => set({ activeTab }),

	// Session management
	sessions: [],
	currentSessionId: null,
	addSession: (session) =>
		set((state) => ({
			sessions: [
				...state.sessions,
				{
					id: crypto.randomUUID(),
					timestamp: Date.now(),
					...session
				}
			]
		})),
	setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
	removeSession: (id) =>
		set((state) => ({
			sessions: state.sessions.filter((session) => session.id !== id),
			currentSessionId:
				state.currentSessionId === id ? null : state.currentSessionId
		}))
}));
