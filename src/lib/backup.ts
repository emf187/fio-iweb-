import { DEFAULT_SETTINGS, emptyState, uid, type AppSettings, type FioState } from './types'

/**
 * Backup JSON in the Android app's `exportAllToJson` format (version 4).
 * Every section key matches the Android writer; unknown top-level keys from
 * either side survive round-trips through `extras`.
 */

function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : []
}

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
}

function str(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback
}

function num(x: unknown, fallback = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback
}

function bool(x: unknown, fallback = false): boolean {
  return typeof x === 'boolean' ? x : fallback
}

/** Android writes nullables as -1; keep -1 → null semantics out of the UI. */
function fromMinus1(x: unknown): number {
  return num(x, -1)
}

export function exportBackup(state: FioState): string {
  const root: Record<string, unknown> = {
    version: 4,
    exportedAt: Date.now(),
    profileName: state.profileName,
    events: state.events.map((e) => ({
      id: e.id, title: e.title, description: e.description,
      startTimeMillis: e.startTimeMillis, endTimeMillis: e.endTimeMillis,
      type: e.type, courseId: e.courseId, isCompleted: e.isCompleted,
      loggedAtMillis: e.loggedAtMillis, editedAtMillis: e.editedAtMillis
    })),
    timetable: state.timetable.map((t) => ({
      id: t.id, title: t.title, room: t.room, details: t.details,
      dayOfWeek: t.dayOfWeek, startMinutes: t.startMinutes, endMinutes: t.endMinutes,
      alarmEnabled: t.alarmEnabled
    })),
    habits: state.habits.map((h) => ({
      id: h.id, name: h.name, description: h.description,
      frequencyDays: h.frequencyDays, dailyGoal: h.dailyGoal,
      streak: h.streak, bestStreak: h.bestStreak,
      completedDates: h.completedDates, progressDates: h.progressDates,
      colorIndex: h.colorIndex, reminderMinutes: h.reminderMinutes,
      question: h.question, timesPerWeek: h.timesPerWeek, archived: h.archived,
      loggedAtMillis: h.loggedAtMillis, lastCompletedAtMillis: h.lastCompletedAtMillis
    })),
    goals: state.goals.map((g) => ({
      id: g.id, title: g.title, category: g.category,
      targetValue: g.targetValue, currentValue: g.currentValue, unit: g.unit,
      deadlineMillis: g.deadlineMillis, loggedAtMillis: g.loggedAtMillis,
      editedAtMillis: g.editedAtMillis
    })),
    courses: state.courses.map((c) => ({
      id: c.id, name: c.name, sectionType: c.sectionType,
      description: c.description, createdAtMillis: c.createdAtMillis
    })),
    documents: state.documents.map((d) => ({
      id: d.id, courseId: d.courseId, title: d.title, author: d.author,
      format: d.format, content: d.content ?? '',
      readingProgressPercent: d.readingProgressPercent,
      lastReadPosition: d.lastReadPosition,
      loggedAtMillis: d.loggedAtMillis, lastAccessedMillis: d.lastAccessedMillis,
      highlights: d.highlights
    })),
    notes: state.notes.map((n) => ({
      id: n.id, title: n.title, content: n.content, courseId: n.courseId,
      folder: n.folder, tags: n.tags, imageUris: n.imageUris,
      createdAtMillis: n.createdAtMillis, updatedAtMillis: n.updatedAtMillis
    })),
    noteFolders: state.noteFolders,
    sleep: state.sleepLogs.map((s) => ({
      id: s.id, type: s.type, startTimeMillis: s.startTimeMillis,
      endTimeMillis: s.endTimeMillis, qualityRating: s.qualityRating,
      loggedAtMillis: s.loggedAtMillis, editedAtMillis: s.editedAtMillis
    })),
    meals: state.mealLogs.map((m) => ({
      id: m.id, timestampMillis: m.timestampMillis, note: m.note,
      loggedAtMillis: m.loggedAtMillis, editedAtMillis: m.editedAtMillis
    })),
    flashcards: state.flashcards.map((f) => ({
      id: f.id, courseId: f.courseId, front: f.front, back: f.back,
      timesReviewed: f.timesReviewed, correctCount: f.correctCount,
      lastReviewedMillis: f.lastReviewedMillis
    })),
    tutorSessions: state.tutorSessions.map((t) => ({
      id: t.id, courseId: t.courseId, questionPrompt: t.questionPrompt,
      studentAnswer: t.studentAnswer, aiGrade: t.aiGrade,
      scorePercentage: t.scorePercentage, feedback: t.feedback,
      weakTopics: t.weakTopics, recommendedRevision: t.recommendedRevision,
      loggedAtMillis: t.loggedAtMillis
    })),
    sessionLogs: state.sessionLogs.map((s) => ({
      id: s.id, title: s.title, plannedMinutes: s.plannedMinutes,
      actualMinutes: s.actualMinutes, isLockdownEnabled: s.isLockdownEnabled,
      startingStrikes: s.startingStrikes, strikesUsed: s.strikesUsed,
      breaksTaken: s.breaksTaken, status: s.status, loggedAtMillis: s.loggedAtMillis
    })),
    chat: state.chat.map((c) => ({
      id: c.id, sender: c.sender, text: c.text, courseId: c.courseId,
      channel: c.channel, imagePath: c.imagePath, aiImagePaths: c.aiImagePaths,
      timestampMillis: c.timestampMillis
    })),
    settings: {
      aiProvider: state.settings.aiProvider,
      aiBaseUrl: state.settings.aiBaseUrl,
      aiApiKey: state.settings.aiApiKey,
      aiModelName: state.settings.aiModelName,
      theme: state.settings.theme,
      fontScale: state.settings.fontScale,
      reduceMotion: state.settings.reduceMotion,
      gracePeriodSeconds: state.settings.gracePeriodSeconds,
      breakFrequencyMinutes: state.settings.breakFrequencyMinutes,
      breakDurationMinutes: state.settings.breakDurationMinutes,
      sleepTargetHours: state.settings.sleepTargetHours,
      mealTargetCount: state.settings.mealTargetCount,
      showAiImages: state.settings.showAiImages
    },
    gallery: state.gallery.map((g) => ({
      id: g.id, fileName: g.fileName, displayName: g.displayName,
      mimeType: g.mimeType, addedAtMillis: g.addedAtMillis
    })),
    habitStatsSelection: state.habitStatsSelection,
    ...state.extras
  }
  if (state.pendingSleepStart > 0) root.pendingSleepStart = state.pendingSleepStart
  return JSON.stringify(root, null, 2)
}

/** Replaces local state with a backup (Android importFromJson). */
export function parseBackup(json: string): FioState | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    if (!raw || typeof raw !== 'object') return null
    return stateFromBackup(raw)
  } catch {
    return null
  }
}

function settingsFrom(raw: unknown, fallback: AppSettings): AppSettings {
  const s = obj(raw)
  return {
    aiProvider: str(s.aiProvider, fallback.aiProvider),
    aiBaseUrl: str(s.aiBaseUrl, fallback.aiBaseUrl),
    aiApiKey: str(s.aiApiKey, fallback.aiApiKey),
    aiModelName: str(s.aiModelName, fallback.aiModelName),
    theme: str(s.theme, fallback.theme),
    accentColor: str(s.accentColor, fallback.accentColor),
    fontScale: num(s.fontScale, fallback.fontScale) || 1,
    reduceMotion: bool(s.reduceMotion, fallback.reduceMotion),
    gracePeriodSeconds: num(s.gracePeriodSeconds, fallback.gracePeriodSeconds),
    breakFrequencyMinutes: num(s.breakFrequencyMinutes, fallback.breakFrequencyMinutes) || 50,
    breakDurationMinutes: num(s.breakDurationMinutes, fallback.breakDurationMinutes) || 10,
    sleepTargetHours: num(s.sleepTargetHours, fallback.sleepTargetHours) || 8,
    mealTargetCount: num(s.mealTargetCount, fallback.mealTargetCount) || 3,
    showAiImages: bool(s.showAiImages, fallback.showAiImages)
  }
}

function stateFromBackup(raw: Record<string, unknown>): FioState {
  const base = emptyState()
  const known = new Set([
    'version', 'exportedAt', 'profileName', 'events', 'timetable', 'habits', 'goals',
    'courses', 'documents', 'notes', 'noteFolders', 'sleep', 'meals', 'flashcards',
    'tutorSessions', 'sessionLogs', 'chat', 'settings', 'gallery', 'pendingSleepStart',
    'habitStatsSelection'
  ])
  const extras: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!known.has(k)) extras[k] = v
  }
  return {
    ...base,
    profileName: str(raw.profileName, ''),
    events: arr(raw.events).map((e) => {
      const o = obj(e)
      return {
        id: str(o.id) || uid(), title: str(o.title), description: str(o.description),
        startTimeMillis: num(o.startTimeMillis), endTimeMillis: num(o.endTimeMillis),
        type: str(o.type, 'OTHER') as FioState['events'][number]['type'],
        courseId: str(o.courseId), isCompleted: bool(o.isCompleted),
        loggedAtMillis: num(o.loggedAtMillis), editedAtMillis: fromMinus1(o.editedAtMillis)
      }
    }),
    timetable: arr(raw.timetable).map((t) => {
      const o = obj(t)
      return {
        id: str(o.id) || uid(), title: str(o.title), room: str(o.room),
        details: str(o.details), dayOfWeek: num(o.dayOfWeek, 1) || 1,
        startMinutes: num(o.startMinutes), endMinutes: num(o.endMinutes),
        alarmEnabled: bool(o.alarmEnabled)
      }
    }),
    habits: arr(raw.habits).map((h) => {
      const o = obj(h)
      return {
        id: str(o.id) || uid(), name: str(o.name), description: str(o.description),
        frequencyDays: num(o.frequencyDays, 1) || 1, dailyGoal: num(o.dailyGoal, 1) || 1,
        streak: num(o.streak), bestStreak: num(o.bestStreak),
        completedDates: arr(o.completedDates).map(String),
        progressDates: obj(o.progressDates) as Record<string, number>,
        colorIndex: num(o.colorIndex), reminderMinutes: fromMinus1(o.reminderMinutes),
        question: str(o.question), timesPerWeek: num(o.timesPerWeek),
        archived: bool(o.archived), loggedAtMillis: num(o.loggedAtMillis),
        lastCompletedAtMillis: fromMinus1(o.lastCompletedAtMillis)
      }
    }),
    goals: arr(raw.goals).map((g) => {
      const o = obj(g)
      return {
        id: str(o.id) || uid(), title: str(o.title), category: str(o.category),
        targetValue: num(o.targetValue), currentValue: num(o.currentValue),
        unit: str(o.unit), deadlineMillis: fromMinus1(o.deadlineMillis),
        loggedAtMillis: num(o.loggedAtMillis), editedAtMillis: fromMinus1(o.editedAtMillis)
      }
    }),
    courses: arr(raw.courses).map((c) => {
      const o = obj(c)
      return {
        id: str(o.id) || uid(), name: str(o.name),
        sectionType: str(o.sectionType, 'STUDY') as FioState['courses'][number]['sectionType'],
        description: str(o.description), createdAtMillis: num(o.createdAtMillis)
      }
    }),
    documents: arr(raw.documents).map((d) => {
      const o = obj(d)
      return {
        id: str(o.id) || uid(), courseId: str(o.courseId), title: str(o.title),
        author: str(o.author), format: str(o.format), content: str(o.content),
        readingProgressPercent: num(o.readingProgressPercent),
        lastReadPosition: num(o.lastReadPosition),
        loggedAtMillis: num(o.loggedAtMillis), lastAccessedMillis: num(o.lastAccessedMillis),
        highlights: arr(o.highlights).map(String)
      }
    }),
    notes: arr(raw.notes).map((n) => {
      const o = obj(n)
      return {
        id: str(o.id) || uid(), title: str(o.title), content: str(o.content),
        courseId: str(o.courseId), folder: str(o.folder),
        tags: arr(o.tags).map(String), imageUris: arr(o.imageUris).map(String),
        createdAtMillis: num(o.createdAtMillis), updatedAtMillis: num(o.updatedAtMillis)
      }
    }),
    noteFolders: arr(raw.noteFolders).map(String),
    sleepLogs: arr(raw.sleep).map((s) => {
      const o = obj(s)
      return {
        id: str(o.id) || uid(), type: str(o.type, 'NIGHT') as FioState['sleepLogs'][number]['type'],
        startTimeMillis: num(o.startTimeMillis), endTimeMillis: num(o.endTimeMillis),
        qualityRating: num(o.qualityRating), loggedAtMillis: num(o.loggedAtMillis),
        editedAtMillis: fromMinus1(o.editedAtMillis)
      }
    }),
    pendingSleepStart: num(raw.pendingSleepStart, 0),
    mealLogs: arr(raw.meals).map((m) => {
      const o = obj(m)
      return {
        id: str(o.id) || uid(), timestampMillis: num(o.timestampMillis), note: str(o.note),
        loggedAtMillis: num(o.loggedAtMillis), editedAtMillis: fromMinus1(o.editedAtMillis)
      }
    }),
    flashcards: arr(raw.flashcards).map((f) => {
      const o = obj(f)
      return {
        id: str(o.id) || uid(), courseId: str(o.courseId), front: str(o.front),
        back: str(o.back), timesReviewed: num(o.timesReviewed),
        correctCount: num(o.correctCount), lastReviewedMillis: fromMinus1(o.lastReviewedMillis)
      }
    }),
    tutorSessions: arr(raw.tutorSessions).map((t) => {
      const o = obj(t)
      return {
        id: str(o.id) || uid(), courseId: str(o.courseId),
        questionPrompt: str(o.questionPrompt), studentAnswer: str(o.studentAnswer),
        aiGrade: str(o.aiGrade), scorePercentage: num(o.scorePercentage),
        feedback: str(o.feedback), weakTopics: arr(o.weakTopics).map(String),
        recommendedRevision: str(o.recommendedRevision),
        loggedAtMillis: num(o.loggedAtMillis)
      }
    }),
    sessionLogs: arr(raw.sessionLogs).map((s) => {
      const o = obj(s)
      return {
        id: str(o.id) || uid(), title: str(o.title, 'Focus Session'),
        plannedMinutes: num(o.plannedMinutes), actualMinutes: num(o.actualMinutes),
        isLockdownEnabled: bool(o.isLockdownEnabled),
        startingStrikes: num(o.startingStrikes), strikesUsed: num(o.strikesUsed),
        breaksTaken: num(o.breaksTaken),
        status: str(o.status, 'COMPLETED') as FioState['sessionLogs'][number]['status'],
        loggedAtMillis: num(o.loggedAtMillis)
      }
    }),
    chat: arr(raw.chat).map((c) => {
      const o = obj(c)
      return {
        id: str(o.id) || uid(), sender: str(o.sender, 'USER'), text: str(o.text),
        courseId: str(o.courseId), channel: str(o.channel, 'STUDY'),
        imagePath: str(o.imagePath), aiImagePaths: arr(o.aiImagePaths).map(String),
        timestampMillis: num(o.timestampMillis)
      }
    }),
    settings: settingsFrom(raw.settings, DEFAULT_SETTINGS),
    gallery: arr(raw.gallery).map((g) => {
      const o = obj(g)
      return {
        id: str(o.id) || uid(), fileName: str(o.fileName), displayName: str(o.displayName),
        mimeType: str(o.mimeType), addedAtMillis: num(o.addedAtMillis)
      }
    }),
    habitStatsSelection: str(raw.habitStatsSelection, ''),
    photos: base.photos,
    extras,
    updatedAt: Date.now()
  }
}

/**
 * Device-to-device merge (Android mergeFromJson): per-record newest-wins by
 * log/edit timestamp; add-only details are unioned so nothing is lost.
 */
export function mergeBackup(local: FioState, json: string): FioState | null {
  const incoming = parseBackup(json)
  if (!incoming) return null

  const unionStrings = (a: string[], b: string[]) => [...new Set([...a, ...b])]

  function mergeById<T extends { id: string }>(
    a: T[], b: T[], stamp: (x: T) => number, join?: (x: T, y: T) => T
  ): T[] {
    const out = new Map<string, T>()
    for (const item of a) out.set(item.id, item)
    for (const item of b) {
      const cur = out.get(item.id)
      if (!cur) out.set(item.id, item)
      else out.set(item.id, stamp(item) > stamp(cur) ? (join ? join(item, cur) : item) : (join ? join(cur, item) : cur))
    }
    return [...out.values()]
  }

  return {
    ...incoming,
    profileName: local.profileName || incoming.profileName,
    events: mergeById(local.events, incoming.events, (x) => x.editedAtMillis > 0 ? x.editedAtMillis : x.loggedAtMillis,
      (a, b) => ({ ...a, description: a.description || b.description })),
    timetable: mergeById(local.timetable, incoming.timetable, () => 0),
    habits: mergeById(local.habits, incoming.habits, (x) => x.lastCompletedAtMillis,
      (a, b) => ({
        ...a,
        completedDates: unionStrings(a.completedDates, b.completedDates),
        progressDates: { ...b.progressDates, ...a.progressDates }
      })),
    goals: mergeById(local.goals, incoming.goals, (x) => x.editedAtMillis > 0 ? x.editedAtMillis : x.loggedAtMillis),
    courses: mergeById(local.courses, incoming.courses, (x) => x.createdAtMillis),
    documents: mergeById(local.documents, incoming.documents, (x) => x.lastAccessedMillis,
      (a, b) => ({ ...a, highlights: unionStrings(a.highlights, b.highlights) })),
    notes: mergeById(local.notes, incoming.notes, (x) => x.updatedAtMillis,
      (a, b) => ({ ...a, tags: unionStrings(a.tags, b.tags), imageUris: unionStrings(a.imageUris, b.imageUris) })),
    noteFolders: unionStrings(local.noteFolders, incoming.noteFolders),
    sleepLogs: mergeById(local.sleepLogs, incoming.sleepLogs, (x) => x.loggedAtMillis),
    pendingSleepStart: Math.max(local.pendingSleepStart, incoming.pendingSleepStart),
    mealLogs: mergeById(local.mealLogs, incoming.mealLogs, (x) => x.loggedAtMillis),
    flashcards: mergeById(local.flashcards, incoming.flashcards, (x) => x.lastReviewedMillis),
    tutorSessions: mergeById(local.tutorSessions, incoming.tutorSessions, (x) => x.loggedAtMillis),
    sessionLogs: mergeById(local.sessionLogs, incoming.sessionLogs, (x) => x.loggedAtMillis),
    chat: mergeById(local.chat, incoming.chat, (x) => x.timestampMillis),
    settings: incoming.settings.aiApiKey ? incoming.settings : local.settings,
    gallery: mergeById(local.gallery, incoming.gallery, (x) => x.addedAtMillis),
    habitStatsSelection: local.habitStatsSelection || incoming.habitStatsSelection,
    photos: local.photos,
    extras: { ...incoming.extras, ...local.extras },
    updatedAt: Date.now()
  }
}
