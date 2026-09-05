import type {
  ArtistSummary,
  CreatePlaylistInput,
  Page,
  SpotifyPlaylist,
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
}
