const API_URL = "http://192.168.0.253:3000";

export async function searchProduct(query: string, userCity: string, userProvince: string) {

  const url = `${API_URL}/api/search?q=${encodeURIComponent(query)}&userCity=${encodeURIComponent(userCity)}&userProvince=${encodeURIComponent(userProvince)}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Search failed");
  }

  if (res.status === 429) {
    throw new Error("Rate limit exceeded. Try again later.");
    }

  return res.json();
}

