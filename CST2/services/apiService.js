import { API_BASE_URL } from "../config";

export async function syncEnergy(plantId) {
  const res = await fetch(
    `${API_BASE_URL}/energy/sync/${encodeURIComponent(plantId)}`
  );

  if (!res.ok) {
    throw new Error(`syncEnergy failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getReadingHistory(plantId, fromDate, toDate) {
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
  });

  const res = await fetch(
    `${API_BASE_URL}/readings/history/${encodeURIComponent(plantId)}?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(`getReadingHistory failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
