import { describe, it, expect } from "vitest";
import { isAnswerCorrect } from "@/lib/grading/isAnswerCorrect";
import type { Question } from "@/lib/qbank/types";

// ---------------------------------------------------------------------------
// CHARACTERIZATION tests for lib/grading/isAnswerCorrect.ts
//
// The standalone exported grading helper. Handles MCQ (where the user's
// choice and the stored correct key may each be an option id, an originalKey,
// or a positional letter A/B/C/D) and ROW ("R"/"W"/"Right"/"Wrong").
// ---------------------------------------------------------------------------

function mcq(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    number: 1,
    type: "MCQ",
    prompt: "p",
    sourcePrompt: "p",
    options: [
      { id: "opt-a", text: "A text", originalKey: "A" },
      { id: "opt-b", text: "B text", originalKey: "B" },
      { id: "opt-c", text: "C text", originalKey: "C" },
    ],
    sourceOptions: [],
    correctRow: null,
    correctOptionId: "opt-b",
    assets: [],
    tags: [],
    autoTags: [],
    ...overrides,
  };
}

function row(overrides: Partial<Question> = {}): Question {
  return {
    id: "r1",
    number: 1,
    type: "ROW",
    prompt: "p",
    sourcePrompt: "p",
    options: [],
    sourceOptions: [],
    correctRow: "Right",
    correctOptionId: null,
    assets: [],
    tags: [],
    autoTags: [],
    ...overrides,
  };
}

describe("isAnswerCorrect - falsy / empty choice", () => {
  it("returns false for null, undefined, and empty string", () => {
    const q = mcq();
    expect(isAnswerCorrect(q, null)).toBe(false);
    expect(isAnswerCorrect(q, undefined)).toBe(false);
    expect(isAnswerCorrect(q, "")).toBe(false);
  });
});

describe("isAnswerCorrect - MCQ", () => {
  it("matches when chosen equals the correct option's id (correctOptionId = id)", () => {
    const q = mcq({ correctOptionId: "opt-b" });
    expect(isAnswerCorrect(q, "opt-b")).toBe(true);
    expect(isAnswerCorrect(q, "opt-a")).toBe(false);
  });

  it("matches when the user chose the originalKey of the correct option", () => {
    const q = mcq({ correctOptionId: "opt-b" });
    expect(isAnswerCorrect(q, "B")).toBe(true);
    expect(isAnswerCorrect(q, "A")).toBe(false);
  });

  it("matches when the user chose the positional letter and correctOptionId is a letter", () => {
    // correctOptionId stored as a positional letter "B"; user picks "B".
    const q = mcq({ correctOptionId: "B" });
    expect(isAnswerCorrect(q, "B")).toBe(true);
  });

  it("matches when correctOptionId is stored as the positional letter but user chose the option id", () => {
    const q = mcq({ correctOptionId: "B" });
    // user chose by id 'opt-b' (index 1 -> letter 'B'); expected 'B' === letter.
    expect(isAnswerCorrect(q, "opt-b")).toBe(true);
  });

  it("falls back to positional letter when an option has no originalKey", () => {
    const q = mcq({
      options: [
        { id: "x0", text: "zero" }, // no originalKey -> letter 'A'
        { id: "x1", text: "one" }, // -> letter 'B'
      ],
      correctOptionId: "x1",
    });
    expect(isAnswerCorrect(q, "B")).toBe(true); // letter for index 1
    expect(isAnswerCorrect(q, "x1")).toBe(true); // id
    expect(isAnswerCorrect(q, "A")).toBe(false);
  });

  it("returns false when the chosen key matches no option", () => {
    const q = mcq();
    expect(isAnswerCorrect(q, "Z")).toBe(false);
    expect(isAnswerCorrect(q, "opt-zzz")).toBe(false);
  });

  it("returns false when correctOptionId is null/missing", () => {
    expect(isAnswerCorrect(mcq({ correctOptionId: null }), "B")).toBe(false);
  });

  it("returns false when there are no options", () => {
    expect(isAnswerCorrect(mcq({ options: [], correctOptionId: "opt-b" }), "A")).toBe(
      false,
    );
  });
});

describe("isAnswerCorrect - ROW", () => {
  it("matches R/Right (case-insensitive) against correctRow 'Right'", () => {
    const q = row({ correctRow: "Right" });
    expect(isAnswerCorrect(q, "R")).toBe(true);
    expect(isAnswerCorrect(q, "r")).toBe(true);
    expect(isAnswerCorrect(q, "Right")).toBe(true);
    expect(isAnswerCorrect(q, "right")).toBe(true);
    expect(isAnswerCorrect(q, "W")).toBe(false);
  });

  it("matches W/Wrong against correctRow 'Wrong'", () => {
    const q = row({ correctRow: "Wrong" });
    expect(isAnswerCorrect(q, "W")).toBe(true);
    expect(isAnswerCorrect(q, "wrong")).toBe(true);
    expect(isAnswerCorrect(q, "R")).toBe(false);
  });

  it("matches the short 'R'/'W' forms of correctRow too", () => {
    expect(isAnswerCorrect(row({ correctRow: "R" }), "Right")).toBe(true);
    expect(isAnswerCorrect(row({ correctRow: "W" }), "w")).toBe(true);
  });

  it("returns false when correctRow is null or an unrecognized value", () => {
    expect(isAnswerCorrect(row({ correctRow: null }), "R")).toBe(false);
    expect(isAnswerCorrect(row({ correctRow: "Right" }), "maybe")).toBe(false);
  });
});

describe("isAnswerCorrect - unknown type", () => {
  it("returns false for a non-MCQ/non-ROW type", () => {
    const q = mcq({ type: "SOMETHING" as Question["type"] });
    expect(isAnswerCorrect(q, "A")).toBe(false);
  });
});
