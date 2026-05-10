import { API_BASE_URL as BASE_URL } from "../config";

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
