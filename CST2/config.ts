export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000"
).replace(/\/+$/, "");
