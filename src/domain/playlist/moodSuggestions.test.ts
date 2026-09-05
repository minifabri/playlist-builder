import { describe, expect, it } from "vitest";
import { pickMoodSuggestionSeed } from "./moodSuggestions";

describe("pickMoodSuggestionSeed", () => {
  it("maps low energy to a calm curated genre when no top genres match", () => {
    const seed = pickMoodSuggestionSeed(5, []);
    expect(seed.moodLabel).toBe("Still");
    expect(["ambient", "meditation", "new age"]).toContain(seed.genre);
    expect(seed.personalized).toBe(false);
  });

  it("maps high energy to an energetic curated genre", () => {
    const seed = pickMoodSuggestionSeed(95, []);
    expect(seed.moodLabel).toBe("Peak");
    expect(["house", "dance pop", "electronica"]).toContain(seed.genre);
  });

  it("prefers a matching top genre over the curated pool", () => {
    const seed = pickMoodSuggestionSeed(10, ["deep ambient", "pop"]);
    expect(seed.moodLabel).toBe("Still");
    expect(seed.genre).toBe("deep ambient");
    expect(seed.personalized).toBe(true);
  });

  it("rotates through the curated pool when no personal match exists", () => {
    const first = pickMoodSuggestionSeed(50, [], 0);
    const second = pickMoodSuggestionSeed(50, [], 1);
    expect(first.genre).not.toBe(second.genre);
  });
});
