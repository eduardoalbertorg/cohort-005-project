import { and, desc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules, notes } from "~/db/schema";
import { noteBodySchema } from "./note-body";

type Db = BetterSQLite3Database<typeof schema>;

export function isLessonBookmarked(db: Db, userId: number, lessonId: number) {
  return Boolean(
    db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId))
      )
      .get()
  );
}

export function toggleBookmark(db: Db, userId: number, lessonId: number) {
  return db.transaction((tx) => {
    const removed = tx
      .delete(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId))
      )
      .run();
    if (removed.changes > 0) return false;

    tx.insert(bookmarks).values({ userId, lessonId }).run();
    return true;
  });
}

export function getLessonNote(db: Db, userId: number, lessonId: number) {
  return db
    .select({ body: notes.body, updatedAt: notes.updatedAt })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

export function saveLessonNote(
  db: Db,
  userId: number,
  lessonId: number,
  input: unknown,
  now = new Date()
) {
  const parsed = noteBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const body = parsed.data;
  const timestamp = now.toISOString();
  db.insert(notes)
    .values({
      userId,
      lessonId,
      body,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body, updatedAt: timestamp },
    })
    .run();
  return { ok: true as const };
}

const lessonDetails = {
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  moduleTitle: modules.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};

export function listSavedLessons(db: Db, userId: number, courseIds: number[]) {
  if (courseIds.length === 0) return { savedBookmarks: [], savedNotes: [] };

  const savedBookmarks = db
    .select({
      ...lessonDetails,
      id: bookmarks.id,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(eq(bookmarks.userId, userId), inArray(courses.id, courseIds)))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .all();

  const savedNotes = db
    .select({
      ...lessonDetails,
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(eq(notes.userId, userId), inArray(courses.id, courseIds)))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();

  return { savedBookmarks, savedNotes };
}
