import { appUrl } from "@/lib/site";

/** Origin for Stripe redirect URLs: request origin on previews, else canonical. */
export function requestOrigin(request: Request): string {
  try {
    const url = new URL(request.url);
    if (url.origin && url.origin !== "null") return url.origin;
  } catch {
    // fall through
  }
  return appUrl();
}
