import path from 'node:path'

/**
 * Resolve a workspace-relative reference without letting it leave the workspace.
 * @param {string} cwd absolute workspace directory
 * @param {string} rel path as typed by the client
 */
export function resolveInWorkspace(cwd, rel) {
  if (typeof rel !== 'string' || rel.length === 0) return { ok: false, code: 'EMPTY' }
  if (path.isAbsolute(rel)) return { ok: false, code: 'ABSOLUTE' }
  const root = path.resolve(cwd)
  const abs = path.resolve(root, rel)
  if (abs !== root && !abs.startsWith(root + path.sep)) return { ok: false, code: 'ESCAPE' }
  return { ok: true, abs }
}
