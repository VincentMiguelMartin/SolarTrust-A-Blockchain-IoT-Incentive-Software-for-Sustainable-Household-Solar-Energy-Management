const BASE_URL = "http://192.168.1.40:3000";

export async function sendGameCompletion(data: {
  householdId: string;
  cleanliness: number;
  score: number;
}) {
  try {
    const res = await fetch(`${BASE_URL}/game/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return await res.json();
  } catch (error) {
    console.error("Game API error:", error);
    throw error;
  }
}