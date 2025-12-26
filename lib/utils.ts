import { Activity, TimeSlot, DayPlan, ACTIVITY_COLORS, ACTIVITY_ICONS, ActivityType } from './types';

// Time utilities
export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

export function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  const { hours, minutes: mins } = parseTime(time);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return formatTime(newHours, newMins);
}

export function getMinutesBetween(start: string, end: string): number {
  const startParsed = parseTime(start);
  const endParsed = parseTime(end);
  const startMinutes = startParsed.hours * 60 + startParsed.minutes;
  const endMinutes = endParsed.hours * 60 + endParsed.minutes;
  return endMinutes - startMinutes;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

export function formatTimeRange(start: string, duration: number): string {
  const end = addMinutes(start, duration);
  return `${start} - ${end}`;
}

export function isTimeInRange(time: string, start: string, end: string): boolean {
  const timeMins = parseTime(time).hours * 60 + parseTime(time).minutes;
  const startMins = parseTime(start).hours * 60 + parseTime(start).minutes;
  const endMins = parseTime(end).hours * 60 + parseTime(end).minutes;
  return timeMins >= startMins && timeMins < endMins;
}

// Calculate end time for activity
export function calculateEndTime(activity: Activity): string {
  return addMinutes(activity.startTime, activity.duration);
}

// Generate time slots for a day
export function generateTimeSlots(
  activities: Activity[],
  dayStart: string = '08:00',
  dayEnd: string = '22:00',
  slotDuration: number = 30
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let currentTime = dayStart;
  
  while (getMinutesBetween(currentTime, dayEnd) > 0) {
    const slotEnd = addMinutes(currentTime, slotDuration);
    const activity = activities.find(a => 
      isTimeInRange(currentTime, a.startTime, calculateEndTime(a))
    );
    
    slots.push({
      start: currentTime,
      end: slotEnd,
      isFree: !activity,
      activity,
    });
    
    currentTime = slotEnd;
  }
  
  return slots;
}

// Find free time slots
export function findFreeSlots(
  activities: Activity[],
  dayStart: string = '08:00',
  dayEnd: string = '22:00',
  minDuration: number = 30
): TimeSlot[] {
  const sortedActivities = [...activities].sort((a, b) => 
    getMinutesBetween(b.startTime, a.startTime)
  );
  
  const freeSlots: TimeSlot[] = [];
  let currentTime = dayStart;
  
  for (const activity of sortedActivities) {
    const gapMinutes = getMinutesBetween(currentTime, activity.startTime);
    if (gapMinutes >= minDuration) {
      freeSlots.push({
        start: currentTime,
        end: activity.startTime,
        isFree: true,
      });
    }
    currentTime = calculateEndTime(activity);
  }
  
  // Check remaining time after last activity
  const remainingMinutes = getMinutesBetween(currentTime, dayEnd);
  if (remainingMinutes >= minDuration) {
    freeSlots.push({
      start: currentTime,
      end: dayEnd,
      isFree: true,
    });
  }
  
  return freeSlots;
}

// Reorder activities after drag-drop
export function reorderActivities(
  activities: Activity[],
  startIndex: number,
  endIndex: number
): Activity[] {
  const result = Array.from(activities);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  
  // Update order property
  return result.map((activity, index) => ({
    ...activity,
    order: index,
  }));
}

// Reschedule activities to remove gaps
export function compactSchedule(
  activities: Activity[],
  dayStart: string = '08:00'
): Activity[] {
  const sorted = [...activities].sort((a, b) => a.order - b.order);
  let currentTime = dayStart;
  
  return sorted.map(activity => {
    const updated = {
      ...activity,
      startTime: currentTime,
    };
    currentTime = addMinutes(currentTime, activity.duration);
    return updated;
  });
}

// Insert breaks between activities
export function insertBreaks(
  activities: Activity[],
  breakFrequency: number = 120,
  breakDuration: number = 15
): Activity[] {
  const withBreaks: Activity[] = [];
  let minutesSinceBreak = 0;
  
  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    
    // Check if break is needed before this activity
    if (minutesSinceBreak >= breakFrequency && !activity.isBreak) {
      const breakActivity: Activity = {
        id: `break-${Date.now()}-${i}`,
        title: 'Break',
        type: 'rest',
        startTime: activity.startTime,
        duration: breakDuration,
        status: 'planned',
        isBreak: true,
        order: withBreaks.length,
        aiSuggested: true,
      };
      withBreaks.push(breakActivity);
      minutesSinceBreak = 0;
    }
    
    withBreaks.push({
      ...activity,
      order: withBreaks.length,
    });
    
    minutesSinceBreak += activity.duration;
  }
  
  return withBreaks;
}

// Calculate day progress
export function calculateDayProgress(day: DayPlan): {
  total: number;
  completed: number;
  percentage: number;
} {
  const total = day.activities.length;
  const completed = day.activities.filter(a => 
    a.status === 'completed' || a.status === 'skipped'
  ).length;
  
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

// Get activity color
export function getActivityColor(type: ActivityType, customColor?: string): string {
  return customColor || ACTIVITY_COLORS[type] || ACTIVITY_COLORS.custom;
}

// Get activity icon
export function getActivityIcon(type: ActivityType, customIcon?: string): string {
  return customIcon || ACTIVITY_ICONS[type] || ACTIVITY_ICONS.custom;
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format date
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Get day of week
export function getDayOfWeek(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
}

// Calculate date range
export function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Check if time slot conflicts with existing activities
export function hasConflict(
  newActivity: { startTime: string; duration: number },
  existingActivities: Activity[]
): Activity | null {
  const newEnd = addMinutes(newActivity.startTime, newActivity.duration);
  
  for (const activity of existingActivities) {
    const existingEnd = calculateEndTime(activity);
    
    // Check for overlap
    if (
      isTimeInRange(newActivity.startTime, activity.startTime, existingEnd) ||
      isTimeInRange(activity.startTime, newActivity.startTime, newEnd)
    ) {
      return activity;
    }
  }
  
  return null;
}

// Get current time slot based on current time
export function getCurrentTimeSlot(activities: Activity[]): Activity | null {
  const now = new Date();
  const currentTime = formatTime(now.getHours(), now.getMinutes());
  
  return activities.find(activity => {
    const endTime = calculateEndTime(activity);
    return isTimeInRange(currentTime, activity.startTime, endTime);
  }) || null;
}

// Calculate total duration for activities
export function getTotalDuration(activities: Activity[]): number {
  return activities.reduce((total, activity) => total + activity.duration, 0);
}

// Group activities by type
export function groupByType(activities: Activity[]): Record<ActivityType, Activity[]> {
  return activities.reduce((groups, activity) => {
    const type = activity.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(activity);
    return groups;
  }, {} as Record<ActivityType, Activity[]>);
}

// Sort activities by time
export function sortByTime(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    const aMinutes = parseTime(a.startTime).hours * 60 + parseTime(a.startTime).minutes;
    const bMinutes = parseTime(b.startTime).hours * 60 + parseTime(b.startTime).minutes;
    return aMinutes - bMinutes;
  });
}

// CN helper for classnames
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
