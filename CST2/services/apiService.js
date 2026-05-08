export async function syncEnergy(plantId) {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000";
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");

  const res = await fetch(
    `${baseUrl}/energy/sync/${encodeURIComponent(plantId)}`
  );

  if (!res.ok) {
    throw new Error(`syncEnergy failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getReadingHistory(plantId, fromDate, toDate) {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000";
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
  });

  const res = await fetch(
    `${baseUrl}/readings/history/${encodeURIComponent(plantId)}?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`getReadingHistory failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
