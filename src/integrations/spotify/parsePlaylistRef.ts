/**
 * Parses a pasted Spotify playlist reference into a bare playlist ID
 * (05_PLAYLIST_RESHAPE.md — "Entry point / IA": "manual paste of a
 * playlist URL/URI for any playlist, own or foreign"). Accepts:
 * - a share URL, e.g. https://open.spotify.com/playlist/37i9dQ...?si=...
 * - a URI, e.g. spotify:playlist:37i9dQ...
 * - a bare ID, e.g. 37i9dQ...
 * Returns null when the input doesn't look like any of those.
 */
export function parseSpotifyPlaylistRef(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const uriMatch = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  try {
    const url = new URL(trimmed);
    if (url.hostname === "open.spotify.com" || url.hostname.endsWith(".spotify.com")) {
      const pathMatch = url.pathname.match(/\/playlist\/([A-Za-z0-9]+)/);
      if (pathMatch) return pathMatch[1];
    }
    return null;
  } catch {
    // Not a URL — fall through to the bare-ID check below.
  }

  if (/^[A-Za-z0-9]{10,30}$/.test(trimmed)) return trimmed;

  return null;
}
