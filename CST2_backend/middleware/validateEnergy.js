function validateLiveData(data) {
  if (!data.values || data.values.length === 0) return false;

  const reading = data.values[0];

  if (!reading.ts) return false;
  if (reading.sap < 0) return false;
  if (reading.eap < 0) return false;

  return true;
}

module.exports = { validateLiveData };