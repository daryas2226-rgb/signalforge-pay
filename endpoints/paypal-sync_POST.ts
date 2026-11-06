import { paypalSyncService } from "../helpers/paypalSyncService";

export async function handle(request: Request) {
  const response = await paypalSyncService(request);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Content-Type", "application/json");
  return response;
}