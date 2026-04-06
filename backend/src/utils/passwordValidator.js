/**
 * Validates that a password meets complexity requirements.
 * Returns null if valid, or a Swedish error string if invalid.
 */
function validatePassword(password) {
  const MIN_LENGTH = 12;
  const MSG = 'Lösenordet måste vara minst 12 tecken och innehålla stora och små bokstäver, siffror och specialtecken.';

  if (
    !password ||
    password.length < MIN_LENGTH ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return MSG;
  }

  return null;
}

module.exports = { validatePassword };
