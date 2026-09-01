import type { Route } from "./+types/api";
import { loadProtocolData } from "../lib/protocol.server";

export async function loader({}: Route.LoaderArgs) {
  const data = await loadProtocolData();
  return Response.json(data, {
    headers: { "Cache-Control": "public, max-age=15" },
  });
}
