import { withSpotifyAccessToken } from "@/lib/apiSpotifyHandler";
import { spotifyWebApiProvider } from "@/integrations/spotify/SpotifyWebApiProvider";

export async function GET() {
  return withSpotifyAccessToken((accessToken) =>
    spotifyWebApiProvider.getTopTracks(accessToken, { limit: 8 }),
  );
}
