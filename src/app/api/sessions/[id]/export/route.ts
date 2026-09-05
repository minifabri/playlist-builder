import { NextRequest } from "next/server";
import { withSpotifyAccessToken } from "@/lib/apiSpotifyHandler";
import { spotifyWebApiProvider } from "@/integrations/spotify/SpotifyWebApiProvider";

type ExportBody = {
  title: string;
  isPublic: boolean;
  uris: string[];
};

function isValidBody(body: unknown): body is ExportBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.title === "string" &&
    b.title.trim().length > 0 &&
    typeof b.isPublic === "boolean" &&
    Array.isArray(b.uris) &&
    b.uris.every((u) => typeof u === "string" && u.startsWith("spotify:track:"))
  );
}

/**
 * Creates a real Spotify playlist from the session's current draft order
 * and adds its tracks (08_SPOTIFY_INTEGRATION.md — "Create playlist" /
 * "Add items"). This route doesn't read the session from a database — there
 * isn't one yet (11_ENV_AND_SETUP.md) — the client sends the current draft
 * directly, same as autosave does to localStorage.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return Response.json(
      { code: "UNKNOWN", message: "Invalid export request." },
      { status: 400 },
    );
  }
  if (body.uris.length === 0) {
    return Response.json(
      {
        code: "UNKNOWN",
        message: "No Spotify tracks in the draft to export.",
      },
      { status: 400 },
    );
  }

  return withSpotifyAccessToken(async (accessToken) => {
    const playlist = await spotifyWebApiProvider.createPlaylist(accessToken, {
      name: body.title,
      description: "Built with Ima Yoga Playlist Builder.",
      isPublic: body.isPublic,
    });

    // Add in batches of 100 (Spotify's per-request item cap).
    for (let i = 0; i < body.uris.length; i += 100) {
      const batch = body.uris.slice(i, i + 100);
      await spotifyWebApiProvider.addPlaylistItems(accessToken, playlist.id, batch);
    }

    return { playlistId: playlist.id, playlistUrl: playlist.url };
  });
}
