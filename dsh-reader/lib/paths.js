import path from 'node:path'

/**
 * Normalize a workspace-relative path to POSIX separators. The client, the
 * store and every URL parameter use `/`; win32 `path.relative` returns `\`.
 * @param {string} value
 */
export function toPosix(value) {
  return String(value || '').replace(/\\/g, '/')
}

/**
 * Whether `target` is the workspace root or a descendant of it. Uses
 * path.relative so Windows drive-letter case and junctions behave correctly.
 * @param {string} root absolute workspace directory
 * @param {string} target absolute candidate path
 */
export function isInside(root, target) {
  const base = path.resolve(root)
  const candidate = path.resolve(target)
  const relative = path.relative(base, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

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
  if (!isInside(root, abs)) return { ok: false, code: 'ESCAPE' }
  return { ok: true, abs }
}
