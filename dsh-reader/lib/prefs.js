export function defaultPrefs() {
  return {
    fontSize: 18,
    lineHeight: 1.85,
    theme: 'system',
    hoverDelay: 150,
    cardTrigger: 'hover',
    pdfSpread: false,
    pageKeys: 'arrows',
    model: null,
    drawerWidth: 320,
    mapWidth: 760,
    chatWidth: 420,
    // `auto` detects the source language; `translateFromExplicit` records that
    // the reader actually picked a language, so the 0.15 default `en` can be
    // migrated instead of being mistaken for a deliberate choice.
    translateFrom: 'auto',
    translateFromExplicit: false,
    translateTo: 'zh',
    guideDepth: 'standard',
    motion: 'system',
  }
}
