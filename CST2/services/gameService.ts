const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000";
const BASE_URL = API_BASE_URL.replace(/\/+$/, "");

export async function sendGameCompletion(data: {
  householdId: string;
  cleanliness: number;
  score: number;
}) {
  try {
    const res = await fetch(`${BASE_URL}/game/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error || `Game request failed: ${res.status}`);
    }

    return body;
  } catch (error) {
    console.error("Game API error:", error);
    throw error;
  }
}
