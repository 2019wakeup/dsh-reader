export const READER_CSS = `
.rd-root,.rd-root *,.rd-hover-zone *,.rd-note-mask *{box-sizing:border-box}
.rd-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.rd-toolbar{display:flex;align-items:center;gap:8px;height:44px;flex:0 0 auto;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.rd-icon-btn{width:30px;min-width:30px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.rd-icon-btn svg{display:block;width:18px;height:18px;flex:0 0 auto}
.rd-icon-btn:disabled{opacity:.4;cursor:default}
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
.rd-main{flex:1;min-width:0;overflow:auto;position:relative;scroll-behavior:smooth;overscroll-behavior:contain}
.rd-page{max-width:760px;margin:0 auto;padding:40px 28px 120px;font-size:var(--rd-fs,18px);line-height:var(--rd-lh,1.85)}
.rd-prose>h1{font-size:1.7em;line-height:1.3;margin:1.4em 0 .6em;font-weight:700}
.rd-prose>h2{font-size:1.4em;line-height:1.35;margin:1.4em 0 .5em;font-weight:650}
.rd-prose>h3{font-size:1.18em;margin:1.2em 0 .4em;font-weight:650}
.rd-prose>h4,.rd-prose>h5,.rd-prose>h6{font-size:1.02em;margin:1em 0 .3em;font-weight:600}
.rd-prose p{margin:.9em 0}
.rd-prose blockquote{margin:1em 0;padding:.2em 0 .2em 1em;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.rd-prose pre{margin:1em 0;padding:14px 16px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);overflow:auto;font-size:.86em;line-height:1.6}
.rd-prose code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:5px}
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
.rd-drawer{flex:0 0 320px;min-width:0;max-width:320px;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-base)}
.rd-drawer-head{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.rd-drawer-body{flex:1;min-width:0;overflow:auto;padding:10px 12px;overscroll-behavior:contain}
.rd-drawer-item{padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;margin-bottom:8px;cursor:pointer;font-size:12.5px;line-height:1.5}
.rd-drawer-item:hover{background:var(--dsw-alias-bg-layer-1)}
.rd-drawer-item .rd-muted{color:var(--dsw-alias-label-secondary);font-size:11.5px}
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
.rd-hover-zone{position:fixed;z-index:80;padding:16px}
.rd-hover-zone .rd-card{position:absolute;left:0;top:0;z-index:auto}
.rd-card{position:fixed;z-index:80;width:min(330px,calc(100vw - 16px));max-height:min(58vh,460px);overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.22);padding:14px 15px;animation:rd-in .12s ease-out}
@keyframes rd-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
.rd-card h3{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:6px}
.rd-card .rd-def{font-size:13.5px;line-height:1.62}
.rd-card .rd-sec{font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin-top:8px}
.rd-card .rd-sec b{color:var(--dsw-alias-label-primary);font-weight:600}
.rd-card .rd-actions{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}

.rd-editor .rd-input{width:100%;margin-top:6px}
.rd-editor{max-height:min(64vh,520px)}
.rd-editor textarea{width:100%;min-height:64px;margin-top:8px;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 10px;font-size:12.5px;line-height:1.6;font-family:inherit}
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
.rd-map-stage-fullscreen{position:fixed;inset:0;z-index:130;display:flex;flex-direction:column;min-height:0;padding:14px 16px;background:var(--dsw-alias-bg-base)}
.rd-map-stage-fullscreen .rd-map-scroll{flex:1;min-height:0;max-height:none;height:auto}
.rd-map-stage-fullscreen .rd-map-detail{max-height:160px}
.rd-map-scroll{max-width:100%;max-height:46vh;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);cursor:grab;touch-action:none;user-select:none}
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
.rd-text-layer span::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,transparent)}
.rd-pdf-hl{position:absolute;background:color-mix(in srgb,var(--hl,#f2c94c) 30%,transparent);pointer-events:none;border-radius:2px}
.rd-note-mask{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}
.rd-note-box{width:min(420px,90vw);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:16px;box-shadow:0 16px 48px rgba(0,0,0,.28)}
.rd-note-box textarea{width:100%;min-height:110px;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:9px 10px;font-size:13px;line-height:1.6;font-family:inherit}
.rd-note-box .rd-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.rd-input{height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 9px;font-size:12px;font-family:inherit}
.rd-select{height:28px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;padding:0 6px}
.rd-error{color:var(--dsw-alias-state-error-primary);font-size:12.5px}
.rd-skeleton{height:12px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);margin:7px 0;animation:rd-pulse 1.2s ease-in-out infinite}
@keyframes rd-pulse{0%,100%{opacity:.5}50%{opacity:1}}
@media (max-width:640px){.rd-toolbar{overflow-x:auto;gap:6px;padding:0 8px;scrollbar-width:none}.rd-toolbar::-webkit-scrollbar{display:none}.rd-icon-btn{width:30px;min-width:30px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.rd-icon-btn svg{display:block;width:18px;height:18px;flex:0 0 auto}
.rd-icon-btn:disabled{opacity:.4;cursor:default}
.rd-progress{position:relative;flex:0 0 auto;height:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.rd-progress-bar{height:100%;width:0;background:var(--dsw-alias-brand-primary);transition:width .2s ease-out}
.rd-page-input{width:48px;height:24px;text-align:center;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;padding:0 4px;font-family:inherit}
.rd-page-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.rd-title{max-width:30%}}
@media (max-width:900px){.rd-drawer{position:absolute;right:0;top:44px;bottom:0;z-index:70;box-shadow:-8px 0 28px rgba(0,0,0,.15)}.rd-page{padding:28px 18px 100px}}
`
