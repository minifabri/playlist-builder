import { describe, expect, it } from "vitest";
import { parseSpotifyPlaylistRef } from "./parsePlaylistRef";

describe("parseSpotifyPlaylistRef", () => {
  it("parses a share URL, stripping query params", () => {
    expect(
      parseSpotifyPlaylistRef(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123",
      ),
    ).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("parses a spotify: URI", () => {
    expect(parseSpotifyPlaylistRef("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toBe(
      "37i9dQZF1DXcBWIGoYBM5M",
    );
  });

  it("parses a bare ID", () => {
    expect(parseSpotifyPlaylistRef("37i9dQZF1DXcBWIGoYBM5M")).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("trims surrounding whitespace", () => {
    expect(parseSpotifyPlaylistRef("  37i9dQZF1DXcBWIGoYBM5M  ")).toBe("37i9dQZF1DXcBWIGoYBM5M");
  });

  it("returns null for unrelated input", () => {
    expect(parseSpotifyPlaylistRef("not a playlist")).toBeNull();
    expect(parseSpotifyPlaylistRef("")).toBeNull();
    expect(parseSpotifyPlaylistRef("https://example.com/playlist/123")).toBeNull();
  });
});
