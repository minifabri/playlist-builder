import { mapSpotifyErrorResponse } from "./spotifyErrors";
import type { SpotifyProvider } from "./SpotifyProvider";
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

const API_BASE = "https://api.spotify.com/v1";

/**
 * Development Mode caps search page size at 10 as of the 2026 changes
 * (08_SPOTIFY_INTEGRATION.md — "Search"). Never assume 50.
 */
const MAX_SEARCH_LIMIT = 10;
const MAX_TOP_ITEMS_LIMIT = 20;
/**
 * No Development Mode restriction is documented for playlist listing/item
 * endpoints specifically (only /search — see MAX_SEARCH_LIMIT above), so
 * these use Spotify's ordinary page sizes rather than the search cap.
 */
const MAX_USER_PLAYLISTS_LIMIT = 50;
const MAX_PLAYLIST_ITEMS_LIMIT = 50;

type RawArtist = {
  id: string;
  name: string;
  images?: { url: string }[];
  genres?: string[];
};

type RawTrack = {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists?: { name: string }[];
  album?: { images?: { url: string }[] };
};

type RawPlaylistSummary = {
  id: string;
  name: string;
  owner?: { id?: string };
  images?: { url: string }[];
  tracks?: { total?: number };
};

type RawPlaylistDetails = {
  id: string;
  name: string;
  description?: string | null;
  owner?: { id?: string };
  collaborative?: boolean;
  tracks?: { total?: number };
};

/** A playlist item's `track` field is null for a removed track, and local
 * files carry no usable `id`/`uri` — both are skipped on import. */
type RawPlaylistItem = { track: RawTrack | null };

function toArtistSummary(raw: RawArtist): ArtistSummary {
  return {
    id: raw.id,
    name: raw.name,
    imageUrl: raw.images?.[0]?.url ?? null,
    genres: raw.genres ?? [],
  };
}

function toTrackSummary(raw: RawTrack): TrackSummary {
  return {
    id: raw.id,
    uri: raw.uri,
    title: raw.name,
    artist: raw.artists?.map((a) => a.name).join(", ") ?? "Unknown artist",
    durationMs: raw.duration_ms,
    imageUrl: raw.album?.images?.[0]?.url ?? null,
  };
}

async function spotifyFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw await mapSpotifyErrorResponse(response);
  }
  return response;
}

/**
 * Live Spotify Web API implementation of SpotifyProvider
 * (07_ARCHITECTURE.md — "Spotify adapter"). Only calls endpoints confirmed
 * available in Development Mode as of the September 2026 baseline
 * (08_SPOTIFY_INTEGRATION.md) — no Recommendations, Audio Features, Audio
 * Analysis, or Related Artists.
 */
export class SpotifyWebApiProvider implements SpotifyProvider {
  async getCurrentUser(accessToken: string): Promise<SpotifyUser> {
    const res = await spotifyFetch(accessToken, "/me");
    const raw = (await res.json()) as { id: string; display_name?: string | null };
    return { id: raw.id, displayName: raw.display_name ?? null };
  }

  async getTopArtists(
    accessToken: string,
    params?: TopItemParams,
  ): Promise<ArtistSummary[]> {
    const limit = Math.min(params?.limit ?? 10, MAX_TOP_ITEMS_LIMIT);
    const timeRange = params?.timeRange ?? "medium_term";
    const res = await spotifyFetch(
      accessToken,
      `/me/top/artists?limit=${limit}&time_range=${timeRange}`,
    );
    const raw = (await res.json()) as { items: RawArtist[] };
    return raw.items.map(toArtistSummary);
  }

  async getTopTracks(
    accessToken: string,
    params?: TopItemParams,
  ): Promise<TrackSummary[]> {
    const limit = Math.min(params?.limit ?? 10, MAX_TOP_ITEMS_LIMIT);
    const timeRange = params?.timeRange ?? "medium_term";
    const res = await spotifyFetch(
      accessToken,
      `/me/top/tracks?limit=${limit}&time_range=${timeRange}`,
    );
    const raw = (await res.json()) as { items: RawTrack[] };
    return raw.items.map(toTrackSummary);
  }

  async searchArtists(
    accessToken: string,
    query: string,
    offset = 0,
  ): Promise<Page<ArtistSummary>> {
    const limit = MAX_SEARCH_LIMIT;
    const res = await spotifyFetch(
      accessToken,
      `/search?type=artist&limit=${limit}&offset=${offset}&q=${encodeURIComponent(query)}`,
    );
    const raw = (await res.json()) as {
      artists: { items: RawArtist[]; total: number };
    };
    const items = raw.artists.items.map(toArtistSummary);
    return {
      items,
      offset,
      limit,
      total: raw.artists.total,
      hasMore: offset + items.length < raw.artists.total,
    };
  }

  async searchTracks(
    accessToken: string,
    query: string,
    offset = 0,
  ): Promise<Page<TrackSummary>> {
    const limit = MAX_SEARCH_LIMIT;
    const res = await spotifyFetch(
      accessToken,
      `/search?type=track&limit=${limit}&offset=${offset}&q=${encodeURIComponent(query)}`,
    );
    const raw = (await res.json()) as {
      tracks: { items: RawTrack[]; total: number };
    };
    const items = raw.tracks.items.map(toTrackSummary);
    return {
      items,
      offset,
      limit,
      total: raw.tracks.total,
      hasMore: offset + items.length < raw.tracks.total,
    };
  }

  async createPlaylist(
    accessToken: string,
    input: CreatePlaylistInput,
  ): Promise<SpotifyPlaylist> {
    // Current endpoint per 08_SPOTIFY_INTEGRATION.md — POST /me/playlists.
    const res = await spotifyFetch(accessToken, "/me/playlists", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? "",
        public: input.isPublic,
      }),
    });
    const raw = (await res.json()) as {
      id: string;
      name: string;
      external_urls?: { spotify?: string };
    };
    return {
      id: raw.id,
      name: raw.name,
      url: raw.external_urls?.spotify ?? `https://open.spotify.com/playlist/${raw.id}`,
    };
  }

  async addPlaylistItems(
    accessToken: string,
    playlistId: string,
    uris: string[],
  ): Promise<void> {
    // Current endpoint per 08_SPOTIFY_INTEGRATION.md — POST /playlists/{id}/items.
    // The older /tracks route is deprecated/renamed; do not use it.
    await spotifyFetch(accessToken, `/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris }),
    });
  }

  async getUserPlaylists(
    accessToken: string,
    offset = 0,
  ): Promise<Page<SpotifyPlaylistSummary>> {
    const limit = MAX_USER_PLAYLISTS_LIMIT;
    const res = await spotifyFetch(
      accessToken,
      `/me/playlists?limit=${limit}&offset=${offset}`,
    );
    const raw = (await res.json()) as { items: RawPlaylistSummary[]; total: number };
    const items = raw.items.map((p) => ({
      id: p.id,
      name: p.name,
      ownerId: p.owner?.id ?? "",
      trackCount: p.tracks?.total ?? 0,
      imageUrl: p.images?.[0]?.url ?? null,
    }));
    return {
      items,
      offset,
      limit,
      total: raw.total,
      hasMore: offset + items.length < raw.total,
    };
  }

  async getPlaylist(accessToken: string, playlistId: string): Promise<SpotifyPlaylistDetails> {
    const res = await spotifyFetch(
      accessToken,
      `/playlists/${playlistId}?fields=id,name,description,owner(id),collaborative,tracks(total)`,
    );
    const raw = (await res.json()) as RawPlaylistDetails;
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? null,
      ownerId: raw.owner?.id ?? "",
      collaborative: raw.collaborative ?? false,
      trackCount: raw.tracks?.total ?? 0,
    };
  }

  async getPlaylistItems(
    accessToken: string,
    playlistId: string,
    offset = 0,
  ): Promise<Page<TrackSummary>> {
    // 08_SPOTIFY_INTEGRATION.md — "the 2026 API uses /items terminology for
    // add/get/remove/update"; do not build new code around /tracks.
    const limit = MAX_PLAYLIST_ITEMS_LIMIT;
    const res = await spotifyFetch(
      accessToken,
      `/playlists/${playlistId}/items?limit=${limit}&offset=${offset}` +
        `&fields=items(track(id,uri,name,duration_ms,artists(name),album(images))),total`,
    );
    const raw = (await res.json()) as { items: RawPlaylistItem[]; total: number };
    const items = raw.items
      .filter((it): it is { track: RawTrack } => Boolean(it.track?.id && it.track?.uri))
      .map((it) => toTrackSummary(it.track));
    return {
      items,
      offset,
      limit,
      total: raw.total,
      // Advance by the raw (unfiltered) page size, not the filtered item
      // count, so pagination doesn't stall on a page full of removed
      // tracks/local files.
      hasMore: offset + raw.items.length < raw.total,
    };
  }
}

export const spotifyWebApiProvider = new SpotifyWebApiProvider();
