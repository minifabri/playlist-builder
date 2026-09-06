/**
 * Minimal scope set (08_SPOTIFY_INTEGRATION.md — "Likely scopes: minimize
 * scopes"). Each scope here is used by at least one adapter method:
 * - user-top-read                 → getTopArtists / getTopTracks
 * - playlist-modify-public        → createPlaylist(isPublic: true) / addPlaylistItems
 * - playlist-modify-private       → createPlaylist(isPublic: false) / addPlaylistItems
 * - playlist-read-private         → getUserPlaylists / getPlaylist / getPlaylistItems
 * - playlist-read-collaborative   → same, for playlists the user collaborates on
 *   (05_PLAYLIST_RESHAPE.md — "Spotify integration requirements": reading
 *   playlist contents requires adding read scopes)
 */
export const SPOTIFY_SCOPES = [
  "user-top-read",
  "playlist-modify-public",
  "playlist-modify-private",
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

export const SPOTIFY_SCOPE_STRING = SPOTIFY_SCOPES.join(" ");
