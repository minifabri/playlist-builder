import { withSpotifyAccessToken } from "@/lib/apiSpotifyHandler";
import { spotifyWebApiProvider } from "@/integrations/spotify/SpotifyWebApiProvider";
import type { SpotifyPlaylistSummary } from "@/integrations/spotify/types";

// Bounds the picker's own-playlist list to a few hundred playlists rather
// than paging indefinitely — the "Import a playlist" picker
// (05_PLAYLIST_RESHAPE.md), not a full account export.
const MAX_PAGES = 4;

/**
 * Lists the current user's own playlists for the "Import a playlist"
 * picker. Spotify's /me/playlists has no name-search parameter, so
 * search-by-name (05_PLAYLIST_RESHAPE.md — "Entry point / IA") is done
 * client-side over this list.
 */
export async function GET() {
  return withSpotifyAccessToken(async (accessToken) => {
    const items: SpotifyPlaylistSummary[] = [];
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await spotifyWebApiProvider.getUserPlaylists(accessToken, offset);
      items.push(...result.items);
      if (!result.hasMore) break;
      offset += result.limit;
    }
    return { items };
  });
}
