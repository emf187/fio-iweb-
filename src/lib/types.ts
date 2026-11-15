/**
 * Fio data model — mirrors the Android app's backup JSON (exportAllToJson,
 * version 4) field-for-field so an export from the Android app restores here
 * and back, untouched. Nullable Android fields arrive as -1 and are kept as
 * `number | null` in memory, written back as -1 on export.
 */

export type EventType = 'STUDY' | 'CLASS' | 'GYM' | 'JOG' | 'REST' | 'HABIT' | 'OTHER'
export type SleepType = 'NIGHT' | 'NAP'
export type SectionType = 'STUDY' | 'LEISURE' | 'RESEARCH'
export type SessionStatus = 'COMPLETED' | 'BROKEN' | 'PAUSED' | 'ACTIVE'

export interface ScheduleEvent {
  id: string
  title: string
  description: string
  startTimeMillis: number
  endTimeMillis: number
  type: EventType
  /** '' when the Android backup had no course (Android writes ""). */
  courseId: string
  isCompleted: boolean
  loggedAtMillis: number
  /** -1 when never edited. */
  editedAtMillis: number
}

/** Repeating weekly class. dayOfWeek: 1=Mon … 7=Sun. start/end are minutes of day. */
export interface TimetableItem {
  id: string
  title: string
  room: string
  details: string
  dayOfWeek: number
  startMinutes: number
  endMinutes: number
  alarmEnabled: boolean
}

export interface Habit {
  id: string
  name: string
  description: string
  frequencyDays: number
  dailyGoal: number
  streak: number
  bestStreak: number
  completedDates: string[]
  progressDates: Record<string, number>
  colorIndex: number
  /** -1 when unset. */
  reminderMinutes: number
  question: string
  timesPerWeek: number
  archived: boolean
  loggedAtMillis: number
  /** -1 when never completed. */
  lastCompletedAtMillis: number
}

export interface Goal {
  id: string
  title: string
  category: string
  targetValue: number
  currentValue: number
  unit: string
  /** -1 when unset. */
  deadlineMillis: number
  loggedAtMillis: number
  editedAtMillis: number
}

export interface CourseSection {
  id: string
  name: string
  sectionType: SectionType
  description: string
  createdAtMillis: number
}

export interface DocumentItem {
  id: string
  courseId: string
  title: string
  author: string
  format: string
  /** Embedded only in user-facing backups; may be absent in metadata-only exports. */
  content?: string
  readingProgressPercent: number
  lastReadPosition: number
  loggedAtMillis: number
  lastAccessedMillis: number
  highlights: string[]
}

export interface Note {
  id: string
  title: string
  content: string
  /** '' when unfiled. */
  courseId: string
  folder: string
  tags: string[]
  imageUris: string[]
  createdAtMillis: number
  updatedAtMillis: number
}

export interface SleepEntry {
  id: string
  type: SleepType
  startTimeMillis: number
  endTimeMillis: number
  qualityRating: number
  loggedAtMillis: number
  editedAtMillis: number
}

export interface MealLog {
  id: string
  timestampMillis: number
  note: string
  loggedAtMillis: number
  editedAtMillis: number
}

export interface Flashcard {
  id: string
  courseId: string
  front: string
  back: string
  timesReviewed: number
  correctCount: number
  /** -1 when never reviewed. */
  lastReviewedMillis: number
}

export interface TutorSession {
  id: string
  courseId: string
  questionPrompt: string
  studentAnswer: string
  aiGrade: string
  scorePercentage: number
  feedback: string
  weakTopics: string[]
  recommendedRevision: string
  loggedAtMillis: number
}

export interface SessionLog {
  id: string
  title: string
  plannedMinutes: number
  actualMinutes: number
  isLockdownEnabled: boolean
  startingStrikes: number
  strikesUsed: number
  breaksTaken: number
  status: SessionStatus
  /** Why the session ran: STUDY / LEISURE / RESEARCH (same sections as Study). */
  sectionType: SectionType
  /** Course id the session belonged to; '' when none. */
  courseId: string
  /** Free-text details the user typed for this session. */
  details: string
  loggedAtMillis: number
}

export interface ChatMessage {
  id: string
  /** "USER" or "WINGMAN" (Android sender values). */
  sender: string
  text: string
  courseId: string
  /** "STUDY" (Study Companion) or "TUTOR". */
  channel: string
  /** Local Android file path — meaningless on web, preserved for round-trips. */
  imagePath: string
  aiImagePaths: string[]
  timestampMillis: number
}

export interface GalleryMeta {
  id: string
  fileName: string
  displayName: string
  mimeType: string
  /** User-created folder name; '' when unfiled. */
  folder: string
  addedAtMillis: number
}

export interface AppSettings {
  aiProvider: string
  aiBaseUrl: string
  aiApiKey: string
  aiModelName: string
  theme: string
  accentColor: string
  fontScale: number
  reduceMotion: boolean
  gracePeriodSeconds: number
  breakFrequencyMinutes: number
  breakDurationMinutes: number
  sleepTargetHours: number
  mealTargetCount: number
  showAiImages: boolean
}

/** Focus timer session — persisted so reloads and app switches resume. */
export type TimerPhase = 'IDLE' | 'FOCUS' | 'BREAK' | 'EMERGENCY' | 'DONE'

export interface TimerState {
  phase: TimerPhase
  plannedMinutes: number
  /** Wall-clock end of the focus phase. */
  focusEndsAt: number
  breakEndsAt: number
  emergencyEndsAt: number
  breakFreqMinutes: number
  breakDurationMinutes: number
  alreadyFocusedMinutes: number
  breaksTaken: number
  emergencyUsed: boolean
  finishedStatus: SessionStatus | null
  lastBreakMark: number
  /** Purpose picked at setup; carried into the logged session. */
  sectionType: SectionType
  /** Course id for the session; '' when none. */
  courseId: string
}

export const INITIAL_TIMER: TimerState = {
  phase: 'IDLE',
  plannedMinutes: 50,
  focusEndsAt: 0,
  breakEndsAt: 0,
  emergencyEndsAt: 0,
  breakFreqMinutes: 50,
  breakDurationMinutes: 10,
  alreadyFocusedMinutes: 0,
  breaksTaken: 0,
  emergencyUsed: false,
  finishedStatus: null,
  lastBreakMark: -1,
  sectionType: 'STUDY',
  courseId: ''
}

export interface FioState {
  profileName: string
  /** Guided first-run setup (name + AI key) is complete. */
  setupDone: boolean
  events: ScheduleEvent[]
  timetable: TimetableItem[]
  habits: Habit[]
  goals: Goal[]
  courses: CourseSection[]
  documents: DocumentItem[]
  notes: Note[]
  noteFolders: string[]
  sleepLogs: SleepEntry[]
  pendingSleepStart: number
  mealLogs: MealLog[]
  flashcards: Flashcard[]
  tutorSessions: TutorSession[]
  sessionLogs: SessionLog[]
  chat: ChatMessage[]
  gallery: GalleryMeta[]
  /** User-created gallery folder names (photos carry their folder). */
  galleryFolders: string[]
  settings: AppSettings
  /** Progress-page featured habit stats: up to 3 habit ids, comma-separated. */
  habitStatsSelection: string
  /** Running focus session (absent = IDLE). */
  timer?: TimerState
  /** Photos live outside the JSON backup (files in IndexedDB). */
  photos: GalleryPhoto[]
  /** Any backup keys this build doesn't know, preserved for round-trips. */
  extras: Record<string, unknown>
  updatedAt: number
}

/** A photo imported on web: bytes in IndexedDB, metadata in state. */
export interface GalleryPhoto {
  id: string
  displayName: string
  mimeType: string
  /** User-created folder name; '' when unfiled. */
  folder: string
  addedAtMillis: number
}

export const EVENT_TYPES: EventType[] = ['STUDY', 'CLASS', 'GYM', 'JOG', 'REST', 'HABIT', 'OTHER']
export const SECTION_TYPES: SectionType[] = ['STUDY', 'LEISURE', 'RESEARCH']
export const SESSION_STATUSES: SessionStatus[] = ['COMPLETED', 'BROKEN', 'PAUSED', 'ACTIVE']

export const HABIT_COLORS = [
  '#34D399', '#60A5FA', '#F472B6', '#FBBF24', '#A78BFA',
  '#4ADE80', '#22D3EE', '#FB923C', '#94A3B8', '#E879F9'
]

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'Google Gemini',
  aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  aiApiKey: '',
  aiModelName: 'gemini-3.8-flash',
  theme: 'OBSIDIAN_PURPLE',
  accentColor: 'MINT',
  fontScale: 1,
  reduceMotion: false,
  gracePeriodSeconds: 15,
  breakFrequencyMinutes: 50,
  breakDurationMinutes: 10,
  sleepTargetHours: 8,
  mealTargetCount: 3,
  showAiImages: true
}

export function emptyState(): FioState {
  return {
    profileName: '',
    setupDone: false,
    events: [],
    timetable: [],
    habits: [],
    goals: [],
    courses: [],
    documents: [],
    notes: [],
    noteFolders: [],
    sleepLogs: [],
    pendingSleepStart: 0,
    mealLogs: [],
    flashcards: [],
    tutorSessions: [],
    sessionLogs: [],
    chat: [],
    gallery: [],
    galleryFolders: [],
    settings: { ...DEFAULT_SETTINGS },
    habitStatsSelection: '',
    photos: [],
    extras: {},
    updatedAt: Date.now()
  }
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
