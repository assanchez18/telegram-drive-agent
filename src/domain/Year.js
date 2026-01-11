export function validateYear(year) {
  if (typeof year !== 'string') {
    return { valid: false, error: 'Year must be a string' };
  }

  const yearPattern = /^\d{4}$/;
  if (!yearPattern.test(year)) {
    return { valid: false, error: 'Year must be in YYYY format' };
  }

  const yearNumber = parseInt(year, 10);
  const currentYear = new Date().getFullYear();

  if (yearNumber < 1900 || yearNumber > currentYear + 10) {
    return { valid: false, error: `Year must be between 1900 and ${currentYear + 10}` };
  }

  return { valid: true };
}

export function getCurrentYear() {
  return String(new Date().getFullYear());
}
