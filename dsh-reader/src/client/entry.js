const inject = ['slots']

function apply(ctx) {
  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'dsh-reader')
  style.textContent = READER_CSS
  document.head.appendChild(style)
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'reader',
        order: 20,
        label: () => t('view.label'),
      },
      ReaderRoot,
    ),
  )
}
