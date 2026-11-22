function lines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function commas(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Validate the concept edit form and produce the patch sent to the Host.
 * @param {{term?: string, definition?: string, intuition?: string, context?: string, examples?: string, aliases?: string, related?: string}} form
 */
export function conceptPatch(form = {}) {
  const term = String(form.term || '').trim()
  if (!term) return { ok: false, error: 'term required' }
  return {
    ok: true,
    patch: {
      term,
      definition: String(form.definition || '').trim(),
      intuition: String(form.intuition || '').trim(),
      context: String(form.context || '').trim(),
      examples: lines(form.examples).slice(0, 3),
      aliases: commas(form.aliases).slice(0, 8),
      related: commas(form.related).slice(0, 8),
    },
  }
}
