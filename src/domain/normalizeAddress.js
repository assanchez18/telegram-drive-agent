export function normalizeAddress(address) {
  if (typeof address !== 'string') {
    throw new Error('Address must be a string');
  }

  return address
    .trim()
    .replace(/\s+/g, ' ');
}
