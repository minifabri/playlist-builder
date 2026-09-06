import type {
  ArtistSummary,
  CreatePlaylistInput,
  Page,
  SpotifyPlaylist,
  SpotifyPlaylistDetails,
  SpotifyPlaylistSummary,
  SpotifyUser,
  TopItemParams,
  TrackSummary,
} from "./types";

/**
 * Spotify adapter interface (07_ARCHITECTURE.md — "Spotify adapter").
 * The UI and playlist engine depend on this interface, never on the
 * Spotify Web API directly, so an endpoint change only touches
 * SpotifyWebApiProvider.
 *
 * Every method takes a caller-supplied access token rather than holding
 * one internally — token storage/refresh is a session concern
 * (src/lib/spotifySession.ts), not an adapter concern.
 */
export interface SpotifyProvider {
  getCurrentUser(accessToken: string): Promise<SpotifyUser>;
  getTopArtists(accessToken: string, params?: TopItemParams): Promise<ArtistSummary[]>;
  getTopTracks(accessToken: string, params?: TopItemParams): Promise<TrackSummary[]>;
  searchArtists(
    accessToken: string,
    query: string,
    offset?: number,
  ): Promise<Page<ArtistSummary>>;
  searchTracks(
    accessToken: string,
    query: string,
    offset?: number,
  ): Promise<Page<TrackSummary>>;
  createPlaylist(
    accessToken: string,
    input: CreatePlaylistInput,
  ): Promise<SpotifyPlaylist>;
  addPlaylistItems(
    accessToken: string,
    playlistId: string,
    uris: string[],
  ): Promise<void>;
  /** The current user's own playlists — the "Import a playlist" picker's
   * primary source (05_PLAYLIST_RESHAPE.md — "Entry point / IA"). */
  getUserPlaylists(accessToken: string, offset?: number): Promise<Page<SpotifyPlaylistSummary>>;
  /** Playlist metadata only (no tracks) — resolved first so ownership and
   * readability can be checked before paging through items. */
  getPlaylist(accessToken: string, playlistId: string): Promise<SpotifyPlaylistDetails>;
  /** A page of a playlist's own tracks, in order
   * (05_PLAYLIST_RESHAPE.md — "Adapter method": getPlaylistItems). */
  getPlaylistItems(
    accessToken: string,
    playlistId: string,
    offset?: number,
  ): Promise<Page<TrackSummary>>;
}
