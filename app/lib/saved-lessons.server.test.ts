import { beforeEach, describe, expect, it, vi } from "vitest";
import { lessons, modules, users, UserRole } from "~/db/schema";
import { createTestDb, seedBaseData } from "~/test/setup";
import {
  getLessonNote,
  isLessonBookmarked,
  listSavedLessons,
  saveLessonNote,
  toggleBookmark,
} from "./saved-lessons.server";

let db: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let firstLessonId: number;
let secondLessonId: number;
const firstEdit = new Date("2026-11-20T09:00:00Z");
const secondEdit = new Date("2026-11-21T09:00:00Z");

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  [firstLessonId, secondLessonId] = [1, 2].map(
    (position) =>
      db
        .insert(lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("saved lessons", () => {
  it("toggles a single bookmark per student and lesson", () => {
    expect(isLessonBookmarked(db, base.user.id, firstLessonId)).toBe(false);
    expect(toggleBookmark(db, base.user.id, firstLessonId)).toBe(true);
    expect(
      listSavedLessons(db, base.user.id, [base.course.id]).savedBookmarks
    ).toHaveLength(1);
    expect(toggleBookmark(db, base.user.id, firstLessonId)).toBe(false);
    expect(isLessonBookmarked(db, base.user.id, firstLessonId)).toBe(false);
  });

  it("replaces the same note and advances the last edited time", () => {
    expect(getLessonNote(db, base.user.id, firstLessonId)).toBeUndefined();
    expect(
      saveLessonNote(
        db,
        base.user.id,
        firstLessonId,
        "  # First\n* line  ",
        firstEdit
      )
    ).toEqual({ ok: true });
    expect(getLessonNote(db, base.user.id, firstLessonId)).toEqual({
      body: "# First\n* line",
      updatedAt: firstEdit.toISOString(),
    });

    expect(
      saveLessonNote(db, base.user.id, firstLessonId, " ", secondEdit)
    ).toEqual({ ok: true });
    expect(getLessonNote(db, base.user.id, firstLessonId)).toEqual({
      body: "",
      updatedAt: secondEdit.toISOString(),
    });
    expect(
      listSavedLessons(db, base.user.id, [base.course.id]).savedNotes
    ).toHaveLength(1);
  });

  it("accepts 2,000 characters and refuses longer edits without changing the note", () => {
    const body = "a".repeat(2_000);
    expect(
      saveLessonNote(db, base.user.id, firstLessonId, body, firstEdit)
    ).toEqual({ ok: true });
    expect(
      saveLessonNote(db, base.user.id, firstLessonId, body + "a", secondEdit)
    ).toEqual({ ok: false, error: "Notes must be 2,000 characters or fewer." });
    expect(getLessonNote(db, base.user.id, firstLessonId)).toEqual({
      body,
      updatedAt: firstEdit.toISOString(),
    });
  });

  it("lists only the student's own rows newest first, with lesson and course details", () => {
    const anotherStudent = db
      .insert(users)
      .values({
        name: "Another student",
        email: "another@example.com",
        role: UserRole.Student,
      })
      .returning()
      .get();

    vi.useFakeTimers();
    try {
      vi.setSystemTime(firstEdit);
      toggleBookmark(db, base.user.id, firstLessonId);
      vi.setSystemTime(secondEdit);
      toggleBookmark(db, base.user.id, secondLessonId);
      toggleBookmark(db, anotherStudent.id, firstLessonId);
    } finally {
      vi.useRealTimers();
    }
    saveLessonNote(db, base.user.id, firstLessonId, "first", firstEdit);
    saveLessonNote(db, base.user.id, secondLessonId, "second", firstEdit);
    saveLessonNote(db, base.user.id, firstLessonId, "edited", secondEdit);
    saveLessonNote(db, anotherStudent.id, firstLessonId, "private", secondEdit);

    const result = listSavedLessons(db, base.user.id, [base.course.id]);
    const firstLesson = {
      lessonId: firstLessonId,
      lessonTitle: "Lesson 1",
      courseTitle: base.course.title,
      courseSlug: base.course.slug,
    };
    const secondLesson = {
      ...firstLesson,
      lessonId: secondLessonId,
      lessonTitle: "Lesson 2",
    };
    expect(result.savedBookmarks).toMatchObject([secondLesson, firstLesson]);
    expect(result.savedNotes).toMatchObject([
      { ...firstLesson, body: "edited" },
      { ...secondLesson, body: "second" },
    ]);
    expect(listSavedLessons(db, base.user.id, [])).toEqual({
      savedBookmarks: [],
      savedNotes: [],
    });
  });
});
