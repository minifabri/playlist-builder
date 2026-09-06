import type { NextRequest } from "next/server";
import { withSpotifyAccessToken } from "@/lib/apiSpotifyHandler";
import { spotifyWebApiProvider } from "@/integrations/spotify/SpotifyWebApiProvider";
import type { PlaylistImportTrackSnapshot } from "@/domain/class-session/types";

// One playlist, capped pages — not a bulk-import mechanism
// (05_PLAYLIST_RESHAPE.md — "Non-goals: no bulk import of multiple
// playlists at once"). 20 pages * 50 items covers playlists well beyond a
// typical class length.
const MAX_ITEM_PAGES = 20;

/**
 * Fetches one playlist's metadata + full ordered track list for the
 * "Import a playlist" flow (05_PLAYLIST_RESHAPE.md). Returns a
 * PlaylistImport-shaped payload minus `id`/`importedAt`, which the client
 * fills in when it saves the import locally — this route is stateless,
 * consistent with the rest of this app's no-database MVP slice.
 *
 * Ownership/readability follows the documented caveat: Development Mode
 * may restrict content access to playlists owned by or collaborative with
 * the current user, so a foreign public playlist can 403 here — that
 * surfaces as the normal FORBIDDEN error code, not a special case.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: playlistId } = await context.params;

  return withSpotifyAccessToken(async (accessToken) => {
    const [details, currentUser] = await Promise.all([
      spotifyWebApiProvider.getPlaylist(accessToken, playlistId),
      spotifyWebApiProvider.getCurrentUser(accessToken),
    ]);

    const ownership =
      details.ownerId === currentUser.id
        ? "own"
        : details.collaborative
          ? "collaborative"
          : "foreign";

    const trackSnapshot: PlaylistImportTrackSnapshot[] = [];
    let offset = 0;
    for (let page = 0; page < MAX_ITEM_PAGES; page++) {
      const result = await spotifyWebApiProvider.getPlaylistItems(
        accessToken,
        playlistId,
        offset,
      );
      for (const track of result.items) {
        trackSnapshot.push({
          spotifyTrackId: track.id,
          uri: track.uri,
          title: track.title,
          artist: track.artist,
          position: trackSnapshot.length,
          durationMs: track.durationMs,
        });
      }
      if (!result.hasMore) break;
      offset += result.limit;
    }

    return {
      sourceSpotifyPlaylistId: playlistId,
      sourceOwnerSpotifyUserId: details.ownerId || undefined,
      ownership,
      originalName: details.name,
      originalDescription: details.description ?? undefined,
      trackSnapshot,
    };
  });
}
