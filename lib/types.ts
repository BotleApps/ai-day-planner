// Core Types for AI Day Planner

export type ActivityType = 
  | 'activity'      // General activity
  | 'meal'          // Breakfast, lunch, dinner, snack
  | 'travel'        // Transportation between places
  | 'rest'          // Break, nap, relaxation
  | 'entertainment' // Shows, movies, concerts
  | 'sightseeing'   // Tourist spots, landmarks
  | 'shopping'      // Shopping activities
  | 'sports'        // Physical activities
  | 'wellness'      // Spa, meditation, yoga
  | 'social'        // Meetups, gatherings
  | 'work'          // Work-related activities
  | 'custom';       // User-defined

export type ActivityStatus = 
  | 'planned'       // Scheduled but not started
  | 'in-progress'   // Currently happening
  | 'completed'     // Done
  | 'skipped'       // User chose to skip
  | 'postponed';    // Moved to later

export type SharePermission = 
  | 'view'          // Can only view
  | 'suggest'       // Can suggest changes
  | 'edit';         // Full edit access

export type PlanStatus = 
  | 'draft'         // Still planning
  | 'active'        // Currently in use
  | 'completed'     // All days done
  | 'archived';     // Old plan

export interface Activity {
  _id?: string;
  id: string;                    // Client-side ID for drag-drop
  title: string;
  description?: string;
  type: ActivityType;
  startTime: string;             // HH:mm format
  duration: number;              // In minutes
  endTime?: string;              // Calculated HH:mm
  location?: string;
  address?: string;
  status: ActivityStatus;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  cost?: number;
  currency?: string;
  weatherDependent?: boolean;
  isBreak?: boolean;             // Auto-inserted break
  aiSuggested?: boolean;         // Suggested by AI
  order: number;                 // Position in timeline
  color?: string;                // Custom color
  icon?: string;                 // Custom icon
  tags?: string[];
  links?: string[];              // URLs, booking links
  reminders?: number[];          // Minutes before to remind
}

export interface DayPlan {
  _id?: string;
  id: string;
  date: string;                  // YYYY-MM-DD format
  dayNumber: number;             // Day 1, Day 2, etc.
  title?: string;                // "Beach Day", "City Tour"
  description?: string;
  activities: Activity[];
  weather?: {
    condition: string;
    temperature: number;
    icon: string;
  };
  notes?: string;
  startTime?: string;            // Day start time HH:mm
  endTime?: string;              // Day end time HH:mm
  totalDuration?: number;        // Total planned minutes
  completedDuration?: number;    // Completed minutes
}

export interface Plan {
  _id?: string;
  id: string;
  title: string;
  description?: string;
  destination?: string;
  coverImage?: string;
  status: PlanStatus;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  days: DayPlan[];
  preferences: PlanPreferences;
  sharing: SharingSettings;
  createdBy: string;             // User ID
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  budget?: {
    total: number;
    spent: number;
    currency: string;
  };
}

export interface PlanPreferences {
  wakeUpTime: string;            // Default day start HH:mm
  sleepTime: string;             // Default day end HH:mm
  mealTimes: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  breakFrequency: number;        // Minutes between breaks
  breakDuration: number;         // Default break length
  travelBuffer: number;          // Extra time for travel
  activityTypes: ActivityType[]; // Preferred activity types
  pace: 'relaxed' | 'moderate' | 'packed';
  accessibility?: string[];
  dietaryRestrictions?: string[];
  interests?: string[];
}

export interface SharingSettings {
  isPublic: boolean;
  shareLink?: string;
  sharedWith: SharedUser[];
}

export interface SharedUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  permission: SharePermission;
  addedAt: Date;
}

export interface Suggestion {
  id: string;
  planId: string;
  dayId: string;
  activityId?: string;           // If modifying existing
  suggestedBy: SharedUser;
  type: 'add' | 'modify' | 'remove' | 'swap' | 'reschedule';
  activity?: Partial<Activity>;
  reason?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface AIContext {
  destination?: string;
  dates: { start: string; end: string };
  preferences: PlanPreferences;
  existingActivities: Activity[];
  weather?: { condition: string; temperature: number };
  timeSlot?: { start: string; end: string };
  prompt?: string;
}

// Utility types
export interface TimeSlot {
  start: string;
  end: string;
  isFree: boolean;
  activity?: Activity;
}

export interface DragDropResult {
  activityId: string;
  sourceIndex: number;
  destinationIndex: number;
  newStartTime?: string;
}

// Default values
export const DEFAULT_PREFERENCES: PlanPreferences = {
  wakeUpTime: '08:00',
  sleepTime: '22:00',
  mealTimes: {
    breakfast: '08:30',
    lunch: '13:00',
    dinner: '19:30',
  },
  breakFrequency: 120,           // 2 hours
  breakDuration: 15,             // 15 min breaks
  travelBuffer: 15,              // 15 min buffer
  activityTypes: ['activity', 'meal', 'sightseeing', 'entertainment'],
  pace: 'moderate',
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  activity: '#3b82f6',           // Blue
  meal: '#f97316',               // Orange
  travel: '#8b5cf6',             // Purple
  rest: '#10b981',               // Green
  entertainment: '#ec4899',      // Pink
  sightseeing: '#06b6d4',        // Cyan
  shopping: '#f59e0b',           // Amber
  sports: '#ef4444',             // Red
  wellness: '#84cc16',           // Lime
  social: '#6366f1',             // Indigo
  work: '#64748b',               // Slate
  custom: '#78716c',             // Stone
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  activity: '🎯',
  meal: '🍽️',
  travel: '🚗',
  rest: '☕',
  entertainment: '🎭',
  sightseeing: '📸',
  shopping: '🛍️',
  sports: '⚽',
  wellness: '🧘',
  social: '👥',
  work: '💼',
  custom: '📌',
};
