import { describe, expect, it } from "vitest";
import {
  buildSuggestionSearchQuery,
  pickMoodSuggestionSeed,
  rankByFamiliarity,
  wantsInstrumentalSearch,
} from "./moodSuggestions";

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

  it("leans organic when the Organic ↔ Electronic dial is turned toward organic", () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      const seed = pickMoodSuggestionSeed(50, { organicElectronic: 0 }, rotation);
      expect(["indie folk", "nu jazz", "neo soul", "bossa nova", "world fusion"]).toContain(
        seed.genre,
      );
    }
  });

  it("leans electronic when the Organic ↔ Electronic dial is turned toward electronic", () => {
    for (let rotation = 0; rotation < 6; rotation++) {
      const seed = pickMoodSuggestionSeed(50, { organicElectronic: 100 }, rotation);
      expect(seed.genre).toBe("chillwave");
    }
  });

  it("leaves the pool alone when the Organic ↔ Electronic dial is near the middle", () => {
    const seed = pickMoodSuggestionSeed(50, { organicElectronic: 50 });
    expect([
      "indie folk",
      "nu jazz",
      "neo soul",
      "bossa nova",
      "world fusion",
      "chillwave",
    ]).toContain(seed.genre);
  });

  it("nudges the mood band up when the Soft ↔ Driving dial leans driving", () => {
    // 58 alone maps to "Flowing" (<=60); with drive=100 the nudge is +10 -> 68 -> "Driving".
    const seed = pickMoodSuggestionSeed(58, { drive: 100 });
    expect(seed.moodLabel).toBe("Driving");
  });

  it("nudges the mood band down when the Soft ↔ Driving dial leans soft", () => {
    // 42 alone maps to "Flowing" (>40); with drive=0 the nudge is -10 -> 32 -> "Grounded".
    const seed = pickMoodSuggestionSeed(42, { drive: 0 });
    expect(seed.moodLabel).toBe("Grounded");
  });
});

describe("wantsInstrumentalSearch / buildSuggestionSearchQuery", () => {
  it("asks for instrumental results when the Vocal dial leans instrumental", () => {
    expect(wantsInstrumentalSearch(10)).toBe(true);
    expect(buildSuggestionSearchQuery("ambient", 10)).toBe('genre:"ambient" instrumental');
  });

  it("leaves the query alone when the dial is mid-range or vocal-leaning", () => {
    expect(wantsInstrumentalSearch(50)).toBe(false);
    expect(wantsInstrumentalSearch(90)).toBe(false);
    expect(buildSuggestionSearchQuery("ambient", 90)).toBe('genre:"ambient"');
  });

  it("leaves the query alone when no preference is given", () => {
    expect(wantsInstrumentalSearch(undefined)).toBe(false);
    expect(buildSuggestionSearchQuery("ambient")).toBe('genre:"ambient"');
  });
});

describe("rankByFamiliarity", () => {
  const tracks = [
    { id: "1", artist: "New Artist" },
    { id: "2", artist: "Known Artist" },
    { id: "3", artist: "Another New One" },
  ];

  it("surfaces known artists first when the dial leans familiar", () => {
    const ranked = rankByFamiliarity(tracks, ["Known Artist"], 90);
    expect(ranked[0].artist).toBe("Known Artist");
  });

  it("pushes known artists down when the dial leans discovery", () => {
    const ranked = rankByFamiliarity(tracks, ["Known Artist"], 10);
    expect(ranked[ranked.length - 1].artist).toBe("Known Artist");
  });

  it("leaves the original order alone near the middle of the dial", () => {
    const ranked = rankByFamiliarity(tracks, ["Known Artist"], 50);
    expect(ranked).toEqual(tracks);
  });

  it("leaves the original order alone when no preference is given", () => {
    const ranked = rankByFamiliarity(tracks, ["Known Artist"], undefined);
    expect(ranked).toEqual(tracks);
  });
});
