import { describe, expect, it } from "vitest";
import { pickMoodSuggestionSeed } from "./moodSuggestions";

describe("pickMoodSuggestionSeed", () => {
  it("maps low energy to a calm curated yoga genre with no preferences set", () => {
    const seed = pickMoodSuggestionSeed(5, {});
    expect(seed.moodLabel).toBe("Still");
    expect(["ambient", "meditation", "new age", "drone", "healing", "singing bowls"]).toContain(
      seed.genre,
    );
    expect(seed.personalized).toBe(false);
  });

  it("maps high energy to an energetic curated yoga genre", () => {
    const seed = pickMoodSuggestionSeed(95, {});
    expect(seed.moodLabel).toBe("Peak");
    expect(seed.genre).not.toMatch(/pop|rock/i);
  });

  it("never suggests a pop/rock style genre by default", () => {
    for (const energy of [0, 25, 50, 75, 100]) {
      const seed = pickMoodSuggestionSeed(energy, {});
      expect(seed.genre).not.toMatch(/pop|rock/i);
    }
  });

  it("restricts suggestions to preferred genres that fit the mood", () => {
    const seed = pickMoodSuggestionSeed(10, { preferredGenres: ["ambient", "house"] });
    expect(seed.moodLabel).toBe("Still");
    expect(seed.genre).toBe("ambient"); // "house" isn't a Still-band genre
    expect(seed.personalized).toBe(true);
  });

  it("falls back to the teacher's own picks when none fit this mood band", () => {
    const seed = pickMoodSuggestionSeed(10, { preferredGenres: ["afrobeat"] });
    expect(seed.moodLabel).toBe("Still");
    expect(seed.genre).toBe("afrobeat");
    expect(seed.personalized).toBe(true);
  });

  it("never returns an excluded genre, even one that's normally curated for this mood", () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      const seed = pickMoodSuggestionSeed(5, { excludedGenres: ["ambient"] }, rotation);
      expect(seed.genre).not.toBe("ambient");
    }
  });

  it("lets an excluded genre win over the same genre being preferred", () => {
    const seed = pickMoodSuggestionSeed(5, {
      preferredGenres: ["ambient"],
      excludedGenres: ["ambient"],
    });
    expect(seed.genre).not.toBe("ambient");
  });

  it("rotates through the resulting pool when no personal match narrows it", () => {
    const first = pickMoodSuggestionSeed(50, {}, 0);
    const second = pickMoodSuggestionSeed(50, {}, 1);
    expect(first.genre).not.toBe(second.genre);
  });
});
