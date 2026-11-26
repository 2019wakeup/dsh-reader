export const READER_CSS = `
.rd-root,.rd-root *,.rd-hover-zone *,.rd-note-mask *{box-sizing:border-box}
.rd-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif}
.rd-toolbar{display:flex;align-items:center;gap:8px;height:44px;flex:0 0 auto;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.rd-icon-btn{width:30px;min-width:30px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.rd-icon-btn svg{display:block;width:18px;height:18px;flex:0 0 auto}
.rd-icon-btn:disabled{opacity:.4;cursor:default}
.rd-reader-wrap{display:flex;flex-direction:column;flex:1;min-height:0}
.rd-translate-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:0 0 auto;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:12px}
.rd-lang-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rd-lang-controls-drawer{margin:4px 0 6px}
.rd-lang-field{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}
.rd-lang-field .rd-select{height:26px;padding:0 6px;font-size:12px}
.rd-lang-swap{height:26px;min-width:26px;padding:0 6px;font-size:13px;line-height:1}
.rd-lang-detected{color:var(--dsw-alias-brand-primary);font-size:11px;white-space:nowrap}
.rd-lang-notice{display:inline-flex;align-items:center;gap:6px;padding:2px 4px 2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:11.5px}
.rd-lang-notice .rd-btn{height:22px;padding:0 8px;font-size:11px}
.rd-translate-status{font-size:11.5px}
.rd-translate-error{font-size:11.5px;color:var(--dsw-alias-state-error-primary);flex-basis:100%}
.rd-trans-stale{opacity:.72}
.rd-progress{position:relative;flex:0 0 auto;height:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.rd-progress-bar{height:100%;width:0;background:var(--dsw-alias-brand-primary);transition:width .2s ease-out}
.rd-page-input{width:48px;height:24px;text-align:center;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;padding:0 4px;font-family:inherit}
.rd-page-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.rd-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40%}
.rd-spacer{flex:1}
.rd-btn{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer;white-space:nowrap}
.rd-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.rd-btn[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.rd-btn.ghost{border-color:transparent;background:transparent}
.rd-btn.ghost:hover{background:var(--dsw-alias-bg-layer-1)}
.rd-btn:disabled{opacity:.45;cursor:default}
.rd-body{display:flex;flex:1;min-height:0}
.rd-main{flex:1;min-width:0;overflow:auto;position:relative;scroll-behavior:smooth;overscroll-behavior:contain;scrollbar-gutter:stable}
.rd-page{max-width:760px;margin:0 auto;padding:40px 28px 120px;font-size:var(--rd-fs,18px);line-height:var(--rd-lh,1.85)}
.rd-prose>h1{font-size:1.7em;line-height:1.3;margin:1.4em 0 .6em;font-weight:700}
.rd-prose>h2{font-size:1.4em;line-height:1.35;margin:1.4em 0 .5em;font-weight:650}
.rd-prose>h3{font-size:1.18em;margin:1.2em 0 .4em;font-weight:650}
.rd-prose>h4,.rd-prose>h5,.rd-prose>h6{font-size:1.02em;margin:1em 0 .3em;font-weight:600}
.rd-prose p{margin:.9em 0}
.rd-prose blockquote{margin:1em 0;padding:.2em 0 .2em 1em;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.rd-prose pre{margin:1em 0;padding:14px 16px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);overflow:auto;font-size:.86em;line-height:1.6}
.rd-prose code{font-family:ui-monospace,SFMono-Regular,Menlo,"Cascadia Mono",Consolas,monospace;font-size:.9em;background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:5px}
.rd-prose pre code{background:transparent;padding:0;border-radius:0}
.rd-prose ul,.rd-prose ol{margin:.8em 0;padding-left:1.4em}
.rd-prose li{margin:.3em 0}
.rd-prose hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:2em 0}
.rd-prose a{color:var(--dsw-alias-brand-primary);text-decoration:underline;text-underline-offset:2px}
.rd-prose img{max-width:100%;height:auto;border-radius:8px;margin:.4em 0}
.rd-prose .rd-img-alt{display:inline-block;padding:2px 8px;border:1px dashed var(--dsw-alias-border-l1);border-radius:6px;font-size:.9em;color:var(--dsw-alias-label-secondary)}
.rd-prose del{color:var(--dsw-alias-label-secondary)}
.rd-prose .rd-table-wrap{max-width:100%;overflow-x:auto;margin:1.1em 0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px}
.rd-prose table{width:100%;border-collapse:collapse;font-size:.94em;line-height:1.55}
.rd-prose th,.rd-prose td{border-bottom:1px solid var(--dsw-alias-border-l1);border-right:1px solid var(--dsw-alias-border-l1);padding:8px 11px;text-align:left;vertical-align:top}
.rd-prose th:last-child,.rd-prose td:last-child{border-right:0}
.rd-prose tr:last-child td{border-bottom:0}
.rd-prose thead th{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);font-weight:600;white-space:nowrap}
.rd-prose tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}
.rd-prose .rd-task{list-style:none;margin-left:-1.2em}
.rd-prose .rd-task input{width:14px;height:14px;margin-right:7px;vertical-align:-2px;accent-color:var(--dsw-alias-brand-primary);opacity:1}
.rd-term{text-decoration:underline dashed var(--dsw-alias-border-l2);text-underline-offset:3px;cursor:help;border-radius:3px}
.rd-term:hover{background:var(--dsw-alias-bg-layer-2)}
.rd-term:focus-visible,.rd-hl:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.rd-hl{background:color-mix(in srgb,var(--hl,#f2c94c) 38%,transparent);border-radius:3px;padding:0 1px;cursor:pointer}
.rd-drawer.rd-drawer-wide{flex-basis:min(760px,62vw);max-width:min(760px,62vw)}
.rd-drawer{position:relative;flex:0 0 320px;min-width:0;max-width:320px;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-base)}
.rd-drawer-resizer{position:absolute;left:-6px;top:0;bottom:0;width:12px;z-index:6;cursor:col-resize;touch-action:none;border-radius:4px}
.rd-drawer-resizer:after{content:'';position:absolute;left:5px;top:50%;width:2px;height:36px;transform:translateY(-50%);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent)}
.rd-drawer-resizer:hover,.rd-drawer-resizer:focus-visible{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);outline:none}
.rd-drawer-head{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.rd-drawer-sub{flex:0 0 auto;margin-left:2px;padding:1px 7px;border:0;border-radius:999px;font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:nowrap;background:var(--dsw-alias-bg-layer-1)}
.rd-drawer-head-actions{display:flex;align-items:center;gap:2px}
.rd-drawer-head-btn{width:26px;min-width:26px;height:26px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary)}
.rd-drawer-head-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.rd-drawer-head-btn.is-on{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
.rd-drawer-head-btn svg{display:block;width:16px;height:16px}
.rd-drawer-body{flex:1;min-width:0;overflow:auto;padding:10px 12px;overscroll-behavior:contain;overflow-anchor:none}
.rd-drawer-item{padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;margin-bottom:8px;cursor:pointer;font-size:12.5px;line-height:1.5}
.rd-drawer-item:hover{background:var(--dsw-alias-bg-layer-1)}
.rd-drawer-item .rd-muted{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.rd-drawer-row-head{display:flex;align-items:flex-start;gap:6px}
.rd-drawer-row-head>div:first-child{flex:1;min-width:0}
.rd-row-delete{flex:0 0 auto;padding:0 6px;line-height:1.4;opacity:.55;font-size:14px}
.rd-drawer-item:hover .rd-row-delete,.rd-row-delete:focus-visible{opacity:1}
.rd-drawer-confirm{border-top:1px dashed var(--dsw-alias-border-l1);margin-top:6px}
.rd-btn.rd-danger{color:#c0392b;border-color:color-mix(in srgb,#c0392b 45%,transparent)}
.rd-btn.rd-danger:hover{background:color-mix(in srgb,#c0392b 12%,transparent)}
.rd-muted{color:var(--dsw-alias-label-secondary)}
.rd-empty{padding:28px 8px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}
.rd-library{padding:36px 28px 80px;max-width:900px;margin:0 auto}
.rd-library h2{font-size:20px;margin:0 0 4px}
.rd-crumb{display:flex;align-items:center;gap:6px;margin:18px 0 10px;font-size:12px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}
.rd-crumb button{border:0;background:none;color:var(--dsw-alias-brand-primary);cursor:pointer;font-size:12px;padding:0}
.rd-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden}
.rd-entry{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;font-size:13.5px;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1)}
.rd-entry:last-child{border-bottom:0}
.rd-entry:focus-visible,.rd-drawer-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rd-entry:hover{background:var(--dsw-alias-bg-layer-1)}
.rd-entry .rd-ext{flex:0 0 auto;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:2px 5px}
.rd-entry .rd-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-hover-zone{position:fixed;z-index:80;padding:0}
.rd-hover-zone .rd-card-stack{position:absolute;left:16px;top:16px;z-index:auto}
.rd-hover-zone .rd-card{position:relative;left:0;top:0;z-index:auto}
.rd-card{position:fixed;z-index:80;width:min(330px,calc(100vw - 16px));max-height:min(62vh,500px);overflow:auto;overscroll-behavior:contain;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.22);padding:14px 15px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent) transparent}
.rd-card::-webkit-scrollbar{width:8px}
.rd-card::-webkit-scrollbar-track{background:transparent;margin:8px 0}
.rd-card::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);border:2px solid transparent;background-clip:padding-box;border-radius:999px}
.rd-card::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 30%,transparent);border:2px solid transparent;background-clip:padding-box}
.rd-card h3{position:sticky;top:-14px;z-index:3;margin:-14px 0 8px;padding:14px 0 8px;background:var(--dsw-alias-bg-overlay);font-size:15px;display:flex;align-items:center;gap:6px;cursor:grab;user-select:none;touch-action:none}
.rd-card .rd-def{font-size:13.5px;line-height:1.62}
.rd-card .rd-sec{font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin-top:8px}
.rd-card .rd-sec b{color:var(--dsw-alias-label-primary);font-weight:600}
.rd-card .rd-actions{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.rd-card-pin{width:24px;height:24px;min-width:24px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.rd-card-pin[aria-pressed=true]{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}

.rd-editor .rd-input{width:100%;margin-top:6px}
.rd-editor{max-height:min(64vh,520px)}
.rd-editor textarea{width:100%;min-height:64px;margin-top:8px;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 10px;font-size:12.5px;line-height:1.6;font-family:inherit}
.rd-annotation-editor textarea{min-height:96px;max-height:min(34vh,260px);overflow:auto;overscroll-behavior:contain}
.rd-card .rd-actions.rd-sticky-actions{position:sticky;bottom:-1px;z-index:2;background:var(--dsw-alias-bg-overlay);padding:8px 0 2px;margin-top:10px;border-top:1px solid var(--dsw-alias-border-l1)}
.rd-trans-card{position:fixed;z-index:95;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.22);padding:12px 13px;overflow:auto}
.rd-trans{margin-top:6px;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:.92em;line-height:1.6}
.rd-quote{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:7px 9px;margin:0 0 8px;max-height:84px;overflow:auto}
.rd-badge{font-size:10.5px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 7px;font-weight:400}
.rd-mini{position:fixed;z-index:90;display:flex;align-items:center;gap:2px;padding:4px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.rd-mini .rd-btn{height:26px;border:0;background:transparent;padding:0 8px}
.rd-mini .rd-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.rd-mini .rd-dismiss{margin-left:2px;color:var(--dsw-alias-label-secondary)}
.rd-swatch{width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,.15);cursor:pointer;display:inline-block;padding:0}


.rd-pdf-spread{display:flex;gap:12px;align-items:flex-start;overflow:auto}
.rd-search{position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:105;width:min(520px,92vw);max-height:60vh;overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.24);padding:10px}
.rd-search-head{display:flex;gap:6px;align-items:center;margin-bottom:8px}
.rd-theme-dark .rd-main{background:#0f1115;color:#e5e7eb}
.rd-theme-dark .rd-page{color:#e5e7eb}
.rd-theme-sepia .rd-main{background:#f5ecd9;color:#3d2f24}
.rd-theme-sepia .rd-page{color:#3d2f24}
.rd-relink{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 12px;font-size:12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1)}
.rd-map-stage{display:flex;flex-direction:column;min-height:0}
.rd-map-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.rd-map-group{display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.rd-map-btn{height:26px;min-width:28px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}
.rd-map-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.rd-map-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rd-map-zoom{min-width:42px;text-align:center;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.rd-map-spacer{flex:1;min-width:4px}
.rd-map-toolbar .rd-map-fullscreen{padding:0 10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.rd-map-stage-fullscreen .rd-map-toolbar{flex:0 0 auto}
.rd-map-stage-fullscreen .rd-map-scroll{flex:1;min-height:0;max-height:none;height:auto}
.rd-map-stage-fullscreen{position:fixed;inset:0;z-index:130;display:flex;flex-direction:column;min-height:0;padding:14px 16px;background:var(--dsw-alias-bg-base)}
.rd-map-stage-fullscreen .rd-map-scroll{flex:1;min-height:0;max-height:none;height:auto}
.rd-map-stage-fullscreen .rd-map-detail{max-height:160px}
.rd-map-scroll:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.rd-map-scroll{position:relative;max-width:100%;height:min(46vh,520px);max-height:46vh;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);cursor:grab;touch-action:none;user-select:none;background-image:radial-gradient(circle,color-mix(in srgb,var(--dsw-alias-label-primary) 13%,transparent) 1px,transparent 1.15px);background-size:var(--rd-grid-size,24px) var(--rd-grid-size,24px);background-position:var(--rd-grid-x,12px) var(--rd-grid-y,12px)}
.rd-map-canvas{position:absolute;left:0;top:0;will-change:transform}.rd-map-canvas svg{display:block}
.rd-map-scroll:active{cursor:grabbing}
.rd-map-detail{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:1.65;max-height:160px;overflow:auto}
.rd-map-detail-title{font-weight:600;margin-bottom:4px}
.rd-map-detail-summary{color:var(--dsw-alias-label-secondary)}
.rd-map-detail-points{margin:6px 0 0;padding-left:1.2em;color:var(--dsw-alias-label-secondary)}
.rd-map-detail .rd-btn{margin-top:8px}
.rd-web-toggle{display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.rd-qa-src{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;margin-top:3px}
.rd-qa-src a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.rd-qa{font-size:12px;line-height:1.55;margin-top:6px}
.rd-part{margin-bottom:12px}
.rd-part-title{font-weight:700;font-size:12.5px;margin:2px 0 3px}
.rd-part-summary{font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary);margin-bottom:4px}
.rd-guide-synopsis{font-size:12.5px;line-height:1.65;margin-bottom:8px}
.rd-guide-questions{margin:0 0 10px;padding-left:18px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.rd-setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed var(--dsw-alias-border-l1);font-size:12.5px}
.rd-help-mask{position:fixed;inset:0;z-index:110;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
.rd-help-box{width:min(420px,90vw);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:18px;box-shadow:0 16px 48px rgba(0,0,0,.28)}
.rd-help-row{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px dashed var(--dsw-alias-border-l1)}
.rd-toast .rd-btn{margin-left:10px;height:24px}
.rd-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:95;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 14px;font-size:12.5px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.rd-pdf{display:flex;flex-direction:column;align-items:center;gap:14px;padding:22px 12px 60px}
.rd-pdf-page{position:relative;box-shadow:0 2px 14px rgba(0,0,0,.12);background:#fff}
.rd-pdf-page canvas{display:block;max-width:100%}
.rd-text-layer{position:absolute;inset:0;overflow:hidden;line-height:1;opacity:1}
.rd-text-layer span{position:absolute;color:transparent;white-space:pre;cursor:text;transform-origin:0 0}
.rd-text-layer span::selection{background:rgba(47,111,237,.42);color:transparent}
.rd-prose ::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}
.rd-pdf-hl{position:absolute;background:color-mix(in srgb,var(--hl,#f2c94c) 30%,transparent);pointer-events:none;border-radius:2px}
.rd-note-mask{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
.rd-note-box{width:min(420px,90vw);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:16px;box-shadow:0 16px 48px rgba(0,0,0,.28)}
.rd-note-box textarea{width:100%;min-height:110px;overscroll-behavior:contain;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:9px 10px;font-size:13px;line-height:1.6;font-family:inherit}
.rd-note-box .rd-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.rd-input{height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 9px;font-size:12px;font-family:inherit}
.rd-select{height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;padding:0 6px}
.rd-error{color:var(--dsw-alias-state-error-primary);font-size:12.5px}
.rd-skeleton{height:12px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);margin:7px 0;animation:rd-pulse 1.2s ease-in-out infinite}
@keyframes rd-pulse{0%,100%{opacity:.5}50%{opacity:1}}
@media (max-width:640px){.rd-toolbar{overflow-x:auto;gap:6px;padding:0 8px;scrollbar-width:none}.rd-toolbar::-webkit-scrollbar{display:none}.rd-icon-btn{width:30px;min-width:30px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.rd-icon-btn svg{display:block;width:18px;height:18px;flex:0 0 auto}
.rd-icon-btn:disabled{opacity:.4;cursor:default}
.rd-reader-wrap{display:flex;flex-direction:column;flex:1;min-height:0}
.rd-translate-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:0 0 auto;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:12px}
.rd-lang-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rd-lang-controls-drawer{margin:4px 0 6px}
.rd-lang-field{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}
.rd-lang-field .rd-select{height:26px;padding:0 6px;font-size:12px}
.rd-lang-swap{height:26px;min-width:26px;padding:0 6px;font-size:13px;line-height:1}
.rd-lang-detected{color:var(--dsw-alias-brand-primary);font-size:11px;white-space:nowrap}
.rd-lang-notice{display:inline-flex;align-items:center;gap:6px;padding:2px 4px 2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:11.5px}
.rd-lang-notice .rd-btn{height:22px;padding:0 8px;font-size:11px}
.rd-translate-status{font-size:11.5px}
.rd-translate-error{font-size:11.5px;color:var(--dsw-alias-state-error-primary);flex-basis:100%}
.rd-trans-stale{opacity:.72}
.rd-progress{position:relative;flex:0 0 auto;height:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.rd-progress-bar{height:100%;width:0;background:var(--dsw-alias-brand-primary);transition:width .2s ease-out}
.rd-page-input{width:48px;height:24px;text-align:center;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;padding:0 4px;font-family:inherit}
.rd-page-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.rd-title{max-width:30%}}
@media (max-width:900px){.rd-drawer{position:absolute;right:0;top:44px;bottom:0;z-index:70;box-shadow:-8px 0 28px rgba(0,0,0,.15)}.rd-page{padding:28px 18px 100px}}

.rd-drawer-body.rd-drawer-chat{padding:0;overflow:hidden;display:flex;flex-direction:column}
.rd-chat{display:flex;flex-direction:column;flex:1;min-height:0;position:relative;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.rd-chat-busy{flex:0 0 auto;align-self:flex-start;display:flex;align-items:center;gap:6px;margin:2px 0 12px;padding:5px 11px;border-radius:999px;background:var(--dsw-alias-bg-overlay);box-shadow:0 6px 16px rgba(0,0,0,.04);font-size:11.5px;color:var(--dsw-alias-brand-primary)}
.rd-chat-busy-dot{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:currentColor;animation:rd-dot-breathe 1.2s ease-in-out infinite}
.rd-chat-scroll{flex:1;min-height:0;overflow:auto;padding:16px 12px 28px;overscroll-behavior:contain;scrollbar-width:thin;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1)}
.rd-chat-row{flex:0 0 auto;margin:0 0 16px;overflow-wrap:anywhere;display:flex;flex-direction:column;align-items:flex-start}
.rd-chat-user{align-items:flex-end}
.rd-chat-role{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.rd-chat-bubble{min-width:0;max-width:93%;padding:9px 12px;border:0!important;outline:0!important;box-shadow:none!important;border-radius:15px;line-height:1.66}
.rd-chat-bubble-assistant{background:var(--dsw-alias-bg-overlay);border-top-left-radius:6px}
.rd-chat-bubble-user{max-width:88%;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,var(--dsw-alias-bg-overlay));border-bottom-right-radius:6px}
.rd-chat-bubble-muted{opacity:.86}
.rd-chat-body{min-width:0}
.rd-chat-source{display:block;margin:0 0 7px;padding:4px 8px;font-size:10.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-base) 58%,transparent);border-radius:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-chat-source:before{content:'“';margin-right:2px;color:var(--dsw-alias-brand-primary);font-size:12px;line-height:1}
.rd-chat-images{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 7px;max-width:100%}
.rd-chat-images.multi .rd-chat-image{width:calc(50% - 3px)}
.rd-chat-image{display:block;position:relative;max-width:100%;border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);line-height:0}
.rd-chat-image img{display:block;max-width:100%;max-height:min(42vh,320px);width:auto;height:auto;object-fit:contain}
.rd-chat-images.multi .rd-chat-image img{width:100%;height:auto;max-height:none;aspect-ratio:1;object-fit:cover}
.rd-chat-image-loading{display:block;width:150px;height:96px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);animation:rd-pulse 1.2s ease-in-out infinite}
.rd-chat-image-failed{display:inline-flex;align-items:center;max-width:100%;padding:4px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-chat-files{display:flex;flex-direction:column;gap:5px;margin:0 0 7px;max-width:100%}
.rd-chat-file{display:flex;align-items:center;gap:7px;min-width:0;padding:6px 9px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent);font-size:11.5px;line-height:1.4}
.rd-chat-file-ext{flex:0 0 auto;padding:1px 5px;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,transparent);color:var(--dsw-alias-brand-primary);font-size:9px;font-weight:600;letter-spacing:.04em}
.rd-chat-file-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.rd-chat-file-size{flex:0 0 auto;font-size:10.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.rd-chat-md{font-size:13px;line-height:1.68}
.rd-chat-md>:first-child{margin-top:0}
.rd-chat-md>:last-child{margin-bottom:0}
.rd-chat-md p{margin:.5em 0}
.rd-chat-md ul,.rd-chat-md ol{margin:.5em 0;padding-left:1.35em}
.rd-chat-md pre{margin:.65em 0;padding:9px 11px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);overflow:auto;font-size:12px;line-height:1.55}
.rd-chat-md code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;background:var(--dsw-alias-bg-layer-2);padding:1px 4px;border-radius:4px}
.rd-chat-md pre code{background:transparent;padding:0;border-radius:0}
.rd-chat-md blockquote{margin:.55em 0;padding:.1em 0 .1em .8em;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12.5px}
.rd-chat-md h1,.rd-chat-md h2,.rd-chat-md h3,.rd-chat-md h4{font-size:1.05em;margin:.7em 0 .35em;line-height:1.4}
.rd-chat-md a{color:var(--dsw-alias-brand-primary);text-underline-offset:2px}
.rd-chat-md table{width:100%;margin:.6em 0;border-collapse:collapse;font-size:12px}
.rd-chat-md th,.rd-chat-md td{border:1px solid var(--dsw-alias-border-l1);padding:4px 6px;text-align:left;vertical-align:top}
.rd-chat-md th{background:var(--dsw-alias-bg-layer-2);font-weight:600}
.rd-chat-md hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:1em 0}
.rd-chat-md .rd-math-block{display:block;overflow-x:auto;overflow-y:hidden;margin:.6em 0;padding:1px 0}
.rd-chat-md .rd-math-inline{display:inline-block;max-width:100%;vertical-align:-0.15em}
.rd-chat-md .katex{font-size:1.02em}
.rd-chat-md .katex-display{margin:.4em 0}
.rd-chat-process{margin:7px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.rd-chat-process>summary{display:inline-flex;align-items:center;gap:5px;list-style:none;cursor:pointer;padding:2px 9px;border:0;border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);transition:background var(--rd-motion-fast) ease,color var(--rd-motion-fast) ease}
.rd-chat-process>summary:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.rd-chat-process>summary::-webkit-details-marker{display:none}
.rd-chat-process>summary:before{content:'▸';display:inline-block}
.rd-chat-process[open]>summary:before{content:'▾'}
.rd-chat-process-tools{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}
.rd-chat-chip{border:0;border-radius:999px;padding:2px 8px;font-size:10.5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.rd-chat-process-reasoning{margin-top:5px;white-space:pre-wrap;max-height:38vh;overflow:auto}
.rd-chat-reasoning-sub{margin:5px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.rd-chat-reasoning-sub>summary{cursor:pointer;width:fit-content;list-style:none;padding:1px 0}
.rd-chat-reasoning-sub>summary::-webkit-details-marker{display:none}
.rd-chat-reasoning-sub>summary:before{content:'▸';display:inline-block;margin-right:4px;transform:translateY(-1px)}
.rd-chat-reasoning-sub[open]>summary:before{content:'▾'}
.rd-chat-live{display:flex;align-items:center;gap:7px;padding:1px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rd-chat-live-dot{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:var(--dsw-alias-brand-primary);animation:rd-dot-breathe 1.2s ease-in-out infinite}
.rd-chat-live-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-chat-live-extra{flex:0 0 auto;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.rd-chat-streaming-dot{display:inline-block;width:6px;height:6px;margin-left:4px;border-radius:50%;background:var(--dsw-alias-brand-primary);opacity:.7;vertical-align:middle}
.rd-chat-status{flex:0 0 auto;display:flex;align-items:center;gap:6px;margin:0 0 12px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.rd-chat-dot-running{background:var(--dsw-alias-brand-primary)}
.rd-chat-reasoning{margin:2px 0 6px}
.rd-chat-reasoning>summary{cursor:pointer;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.rd-chat-muted{color:var(--dsw-alias-label-secondary);font-size:12px}
.rd-chat-tool{flex:0 0 auto;display:flex;align-items:center;gap:6px;margin:0 0 10px;padding:6px 10px;border:0;border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 6px 16px rgba(0,0,0,.04);font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.rd-chat-tool-name{font-weight:600;color:var(--dsw-alias-label-primary);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-chat-tool-status{margin-left:auto;font-size:11px}
.rd-chat-dot{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:var(--dsw-alias-label-secondary)}
.rd-chat-tool-running .rd-chat-dot{background:var(--dsw-alias-brand-primary)}
.rd-chat-tool-error .rd-chat-dot{background:var(--dsw-alias-state-error-primary)}
.rd-chat-row.rd-chat-error{display:flex;align-items:flex-start;gap:6px;margin:0 0 14px;padding:8px 11px;border:0;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);border-radius:10px;font-size:12px;line-height:1.55;color:var(--dsw-alias-state-error-primary)}
.rd-chat-row.rd-chat-error .rd-chat-dot{background:var(--dsw-alias-state-error-primary);margin-top:5px}
.rd-chat-stopped{display:inline-block;margin-left:6px;font-size:11px;font-style:italic;color:var(--dsw-alias-label-secondary)}
.rd-chat-empty{margin:auto;padding:32px 22px 40px;display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center}
.rd-chat-empty-icon{width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;border:0;background:linear-gradient(160deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent),color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,transparent));color:var(--dsw-alias-brand-primary);margin-bottom:3px}
.rd-chat-empty-icon svg{width:20px;height:20px;display:block}
.rd-chat-empty-title{font-size:14px;font-weight:600;letter-spacing:.01em}
.rd-chat-empty-desc{max-width:250px;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary)}
.rd-chat-empty-book{font-size:11.5px;color:var(--dsw-alias-label-secondary);border:0;border-radius:999px;padding:2px 10px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent)}
.rd-chat-empty-hints{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}
.rd-chat-empty-hints span{font-size:10.5px;color:var(--dsw-alias-label-secondary);border:0;border-radius:999px;padding:2px 8px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 45%,transparent)}
.rd-chat-unavailable{margin:auto;padding:36px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;font-size:12.5px;line-height:1.65;color:var(--dsw-alias-label-secondary)}
.rd-chat-unavailable-text{max-width:240px}
.rd-chat-back-to-bottom{position:sticky;left:50%;bottom:8px;transform:translateX(-50%);z-index:3;height:26px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.18);background:var(--dsw-alias-bg-overlay);align-self:center}
.rd-chat-unread{display:inline-block;width:6px;height:6px;margin-left:5px;border-radius:50%;background:var(--dsw-alias-brand-primary);vertical-align:middle}
.rd-mini{flex-wrap:wrap;max-width:min(720px,calc(100vw - 16px))}
.rd-mini-error{flex-basis:100%;padding:0 6px 2px;color:var(--dsw-alias-state-error-primary);font-size:11.5px;line-height:1.4}
.rd-mini .rd-quick-ask{height:26px;max-width:132px;border:0;background:transparent;font-size:12px;color:var(--dsw-alias-label-secondary);padding:0 6px}


.rd-root{--rd-motion-fast:90ms;--rd-motion-base:140ms;--rd-motion-slow:180ms;--rd-motion-map:240ms;--rd-ease-enter:cubic-bezier(.22,1,.36,1);--rd-scale-from:.96}
.rd-mini[data-motion=in]{--rd-from:6px;animation:rd-float-in var(--rd-motion-base) var(--rd-ease-enter) both;transform-origin:var(--rd-origin-x,50%) var(--rd-origin-y,50%)}
.rd-mini[data-motion=in][data-side=below]{--rd-from:-6px}
.rd-card[data-motion=in]{--rd-from:8px;animation:rd-float-in var(--rd-motion-slow) var(--rd-ease-enter) both;transform-origin:var(--rd-origin-x,50%) var(--rd-origin-y,50%)}
.rd-card[data-motion=in][data-side=below]{--rd-from:-8px}
@keyframes rd-float-in{from{opacity:0;transform:translateY(var(--rd-from,6px)) scale(var(--rd-scale-from))}}
.rd-card-stack{transition:transform var(--rd-motion-slow) var(--rd-ease-enter),opacity var(--rd-motion-slow) var(--rd-ease-enter)}
.rd-hover-zone[data-dragging="1"] .rd-card-stack{transition:none}
.rd-drawer[data-motion=open]{animation:rd-drawer-in var(--rd-motion-slow) var(--rd-ease-enter)}
.rd-drawer-pane{min-width:0}
.rd-drawer[data-motion] .rd-drawer-pane{animation:rd-slide-in var(--rd-motion-base) var(--rd-ease-enter) 40ms backwards}
.rd-drawer-body.rd-drawer-chat .rd-drawer-pane{display:flex;flex-direction:column;flex:1;min-height:0}
@keyframes rd-drawer-in{from{flex-basis:0;width:0;max-width:0}}
@keyframes rd-slide-in{from{opacity:0;transform:translateX(8px)}}
.rd-chat-row[data-motion=in]{--rd-from:4px;--rd-scale-from:1;animation:rd-float-in var(--rd-motion-fast) var(--rd-ease-enter) both}
.rd-chat-streaming-dot{animation:rd-dot-breathe 1.2s ease-in-out infinite}
@keyframes rd-dot-breathe{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:.9;transform:scale(1.1)}}
.rdm-node-enter{--rd-from:0;--rd-scale-from:.92;animation:rd-float-in var(--rd-motion-slow) var(--rd-ease-enter) both;transform-box:fill-box;transform-origin:center}
.rdm-node-fade{animation:rdm-node-fade var(--rd-motion-fast) var(--rd-ease-enter) both}
.rdm-edge-enter{animation:rdm-edge-draw var(--rd-motion-map) linear forwards}
@keyframes rdm-node-fade{from{opacity:0}}
@keyframes rdm-edge-draw{to{stroke-dashoffset:0}}
.rd-jump-ring{position:fixed;z-index:60;pointer-events:none;border:2px solid var(--dsw-alias-brand-primary);border-radius:6px;box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);animation:rd-ring-out .7s cubic-bezier(.4,0,1,1) forwards}
.rd-jump-ring-static{animation:none;opacity:.8}
@keyframes rd-ring-out{0%{opacity:0}14%{opacity:.9}60%{opacity:.9}100%{opacity:0}}
.rd-btn,.rd-entry,.rd-drawer-item,.rd-map-btn{transition:background-color var(--rd-motion-fast) ease,transform var(--rd-motion-fast) ease}
.rd-btn:active:not(:disabled),.rd-entry:active,.rd-drawer-item:active,.rd-map-btn:active{transform:scale(.98)}
@media (prefers-reduced-motion: reduce){.rd-root *{animation:none!important;transition:none!important}.rd-root .rd-main{scroll-behavior:auto}}
.rd-root.rd-motion-off *{animation:none!important;transition:none!important}
.rd-root.rd-map-fullscreen-open .rd-drawer-pane{transform:none!important}
`
