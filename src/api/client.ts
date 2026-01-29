const API_URL = "http://192.168.0.253:3000";

export async function searchProduct(query: string) {
  const res = await fetch(
    `${API_URL}/api/search?q=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    throw new Error("Search failed");
  }

  if (res.status === 429) {
    throw new Error("Rate limit exceeded. Try again later.");
    }

  return res.json();
}

