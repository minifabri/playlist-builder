/**
 * Minimal scope set (08_SPOTIFY_INTEGRATION.md — "Likely scopes: minimize
 * scopes"). Each scope here is used by at least one adapter method:
 * - user-top-read            → getTopArtists / getTopTracks
 * - playlist-modify-public   → createPlaylist(isPublic: true) / addPlaylistItems
 * - playlist-modify-private  → createPlaylist(isPublic: false) / addPlaylistItems
 */
export const SPOTIFY_SCOPES = [
  "user-top-read",
  "playlist-modify-public",
  "playlist-modify-private",
] as const;

export const SPOTIFY_SCOPE_STRING = SPOTIFY_SCOPES.join(" ");
