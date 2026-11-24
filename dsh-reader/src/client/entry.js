const inject = ['slots', 'sessions', 'conversation']

function apply(ctx) {
  // A hot reload must not leave the previous generation's rules in the page:
  // the old sheet wins for equal selectors and would keep an outdated chat look.
  if (typeof document.querySelectorAll === 'function') {
    for (const stale of document.querySelectorAll('style[data-plugin="dsh-reader"]')) stale.remove()
  }
  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'dsh-reader')
  style.textContent = READER_CSS
  document.head.appendChild(style)
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => style.remove(), 'reader styles')
  }
  // The reader panel resolves durable message images itself (the standard
  // conversation props only carry attachment refs), so pass the client Session
  // object layer down as a prop instead of making it a module dependency.
  const View = (props) =>
    React.createElement(ReaderRoot, { ...props, sessions: ctx.sessions, conversation: ctx.conversation })
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'reader',
        order: 20,
        label: () => t('view.label'),
      },
      View,
    ),
  )
}
