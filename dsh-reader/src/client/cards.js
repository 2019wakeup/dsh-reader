/** Keep the newest entry and at most `max` cards, oldest first. */
export function pushCard(stack, entry, max = 3) {
  const next = [...stack, entry]
  return next.slice(Math.max(0, next.length - max))
}

/** Close the top card and reveal its parent. */
export function popCard(stack) {
  return stack.slice(0, -1)
}

/** The card the user is interacting with. */
export function topCard(stack) {
  return stack.length > 0 ? stack[stack.length - 1] : null
}

/** Swap the top card for a settled version (pending -> loaded). */
export function replaceTop(stack, entry) {
  return [...stack.slice(0, -1), entry]
}
