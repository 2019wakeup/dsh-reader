/**
 * Copy-paste diagnostics for an error boundary. Contains no document content.
 * @param {{version?: string, docName?: string, action?: string, message?: string, stack?: string}} input
 */
export function diagnosticsText(input = {}) {
  return [
    `version: ${input.version || 'unknown'}`,
    `document: ${input.docName || '-'}`,
    `action: ${input.action || '-'}`,
    `error: ${input.message || 'unknown'}`,
    input.stack ? `stack:\n${input.stack}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
