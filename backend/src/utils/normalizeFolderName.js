// Utility: Normalize folder names for disk storage
// Only a-z allowed; å/ä→a, ö→o, spaces and special chars removed
function normalizeFolderName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/[ö]/g, 'o')
    .replace(/[^a-z]/g, '');
}

module.exports = { normalizeFolderName };