// Google Places API (New), Text Search. One call per page of up to 20, three pages max per run.
// Website and phone are Enterprise tier fields, so every page here is one Enterprise request.
// The free monthly allowance covers early use; watch the Google Cloud billing page as volume grows.

export interface PlaceRow {
  placeId: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  primaryType: string | null;
  businessStatus: string | null;
}

interface PlacesResponse {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    primaryTypeDisplayName?: { text?: string };
    businessStatus?: string;
    addressComponents?: Array<{ longText?: string; types?: string[] }>;
  }>;
  nextPageToken?: string;
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.addressComponents",
  "nextPageToken",
].join(",");

export async function searchPlaces(textQuery: string, maxResults: number): Promise<PlaceRow[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");

  const rows: PlaceRow[] = [];
  let pageToken: string | undefined;
  const pages = Math.min(3, Math.ceil(maxResults / 20));

  for (let i = 0; i < pages; i++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 20,
        languageCode: "en",
        regionCode: "US",
        ...(pageToken ? { pageToken } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as PlacesResponse;
    for (const p of json.places ?? []) {
      const city = p.addressComponents?.find((c) => c.types?.includes("locality"))?.longText ?? null;
      rows.push({
        placeId: p.id,
        name: p.displayName?.text ?? "Unknown",
        website: p.websiteUri ? normalizeWebsite(p.websiteUri) : null,
        phone: p.nationalPhoneNumber ?? null,
        address: p.formattedAddress ?? null,
        city,
        primaryType: p.primaryTypeDisplayName?.text ?? null,
        businessStatus: p.businessStatus ?? null,
      });
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return rows.slice(0, maxResults);
}

export function normalizeWebsite(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function websiteDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Sites that are not the company's own. A lead whose "website" is one of these has no logo to
// fetch and no domain to find an email on, so it is kept but marked.
const NOT_OWN_SITE = ["facebook.com", "yelp.com", "angi.com", "homeadvisor.com", "nextdoor.com", "instagram.com", "linkedin.com", "google.com", "business.site"];
export function isOwnWebsite(url: string | null): boolean {
  const d = websiteDomain(url);
  if (!d) return false;
  return !NOT_OWN_SITE.some((bad) => d === bad || d.endsWith("." + bad));
}
