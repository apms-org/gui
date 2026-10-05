(()=>{
const React=window.React;
const h=React.createElement;
const {useState,useEffect,useRef,useLayoutEffect,useCallback,forwardRef,Fragment}=React;
const useId=React.useId||(()=>{const r=useRef(null);if(!r.current)r.current="i"+Math.random().toString(36).slice(2,9);return r.current;});
const ICONS={"activity":[["path",{"d":"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"}]],"archive":[["rect",{"width":"20","height":"5","x":"2","y":"3","rx":"1"}],["path",{"d":"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"}],["path",{"d":"M10 12h4"}]],"arrow-left":[["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],"arrow-right":[["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],"arrow-up-down":[["path",{"d":"m21 16-4 4-4-4"}],["path",{"d":"M17 20V4"}],["path",{"d":"m3 8 4-4 4 4"}],["path",{"d":"M7 4v16"}]],"arrow-up-right":[["path",{"d":"M7 7h10v10"}],["path",{"d":"M7 17 17 7"}]],"at-sign":[["circle",{"cx":"12","cy":"12","r":"4"}],["path",{"d":"M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"}]],"award":[["path",{"d":"m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"}],["circle",{"cx":"12","cy":"8","r":"6"}]],"badge-check":[["path",{"d":"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"}],["path",{"d":"m16 9-5.5 5.5L8 12"}]],"bell":[["path",{"d":"M10.268 21a2 2 0 0 0 3.464 0"}],["path",{"d":"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"}]],"book-open":[["path",{"d":"M12 5v16"}],["path",{"d":"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"}]],"bot":[["path",{"d":"M12 8V4H8"}],["rect",{"width":"16","height":"12","x":"4","y":"8","rx":"2"}],["path",{"d":"M2 14h2"}],["path",{"d":"M20 14h2"}],["path",{"d":"M15 13v2"}],["path",{"d":"M9 13v2"}]],"building-2":[["path",{"d":"M10 12h4"}],["path",{"d":"M10 8h4"}],["path",{"d":"M14 21v-3a2 2 0 0 0-4 0v3"}],["path",{"d":"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"}],["path",{"d":"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"}]],"calendar":[["path",{"d":"M8 2v3"}],["path",{"d":"M16 2v3"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}],["path",{"d":"M3 9h18"}]],"check-check":[["path",{"d":"M18 6 7 17l-5-5"}],["path",{"d":"m22 10-7.5 7.5L13 16"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"chevron-down":[["path",{"d":"m6 9 6 6 6-6"}]],"chevron-left":[["path",{"d":"m15 18-6-6 6-6"}]],"chevron-right":[["path",{"d":"m9 18 6-6-6-6"}]],"chevron-up":[["path",{"d":"m18 15-6-6-6 6"}]],"chevrons-up-down":[["path",{"d":"m7 15 5 5 5-5"}],["path",{"d":"m7 9 5-5 5 5"}]],"circle-alert":[["circle",{"cx":"12","cy":"12","r":"10"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16"}]],"circle-check":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16 9-5.5 5.5L8 12"}]],"circle-dot":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"12","cy":"12","r":"10"}]],"circle-help":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],"circle-x":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m15 9-6 6"}],["path",{"d":"m9 9 6 6"}]],"clock":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 6v6l4 2"}]],"cloud-check":[["path",{"d":"m17 15-5.5 5.5L9 18"}],["path",{"d":"M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327"}]],"cloud-off":[["path",{"d":"M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057"}],["path",{"d":"M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78"}],["path",{"d":"m2 2 20 20"}]],"cloud-upload":[["path",{"d":"M12 13v8"}],["path",{"d":"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"}],["path",{"d":"m8 17 4-4 4 4"}]],"cloud":[["path",{"d":"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"}]],"command":[["path",{"d":"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"}]],"contact":[["path",{"d":"M16 2v2"}],["path",{"d":"M7 21v-2a2 2 0 012-2h6a2 2 0 012 2v2"}],["path",{"d":"M8 2v2"}],["circle",{"cx":"12","cy":"10","r":"3"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}]],"container":[["path",{"d":"M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"}],["path",{"d":"M10 21.9V14L2.1 9.1"}],["path",{"d":"m10 14 11.9-6.9"}],["path",{"d":"M14 19.8v-8.1"}],["path",{"d":"M18 17.5V9.4"}]],"copy-plus":[["line",{"x1":"15","x2":"15","y1":"12","y2":"18"}],["line",{"x1":"12","x2":"18","y1":"15","y2":"15"}],["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],"copy":[["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],"cpu":[["path",{"d":"M12 20v2"}],["path",{"d":"M12 2v2"}],["path",{"d":"M17 20v2"}],["path",{"d":"M17 2v2"}],["path",{"d":"M2 12h2"}],["path",{"d":"M2 17h2"}],["path",{"d":"M2 7h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"M20 17h2"}],["path",{"d":"M20 7h2"}],["path",{"d":"M7 20v2"}],["path",{"d":"M7 2v2"}],["rect",{"x":"4","y":"4","width":"16","height":"16","rx":"2"}],["rect",{"x":"8","y":"8","width":"8","height":"8","rx":"1"}]],"credit-card":[["rect",{"width":"20","height":"14","x":"2","y":"5","rx":"2"}],["line",{"x1":"2","x2":"22","y1":"10","y2":"10"}],["path",{"d":"M6 14h2"}]],"dices":[["rect",{"width":"12","height":"12","x":"2","y":"10","rx":"2","ry":"2"}],["path",{"d":"m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"}],["path",{"d":"M6 18h.01"}],["path",{"d":"M10 14h.01"}],["path",{"d":"M15 6h.01"}],["path",{"d":"M18 9h.01"}]],"download":[["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]],"ellipsis-vertical":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"12","cy":"5","r":"1"}],["circle",{"cx":"12","cy":"19","r":"1"}]],"ellipsis":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],"eraser":[["path",{"d":"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"}],["path",{"d":"m5.082 11.09 8.828 8.828"}]],"external-link":[["path",{"d":"M15 3h6v6"}],["path",{"d":"M10 14 21 3"}],["path",{"d":"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"}]],"eye-off":[["path",{"d":"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"}],["path",{"d":"M14.084 14.158a3 3 0 0 1-4.242-4.242"}],["path",{"d":"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"}],["path",{"d":"m2 2 20 20"}]],"eye":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"file-archive":[["path",{"d":"M13.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v11.5"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M8 12v-1"}],["path",{"d":"M8 18v-2"}],["path",{"d":"M8 7V6"}],["circle",{"cx":"8","cy":"20","r":"2"}]],"file-down":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M12 18v-6"}],["path",{"d":"m9 15 3 3 3-3"}]],"file-key":[["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M4 12v6"}],["path",{"d":"M4 14h2"}],["path",{"d":"M9.65 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v4"}],["circle",{"cx":"4","cy":"20","r":"2"}]],"file-lock-2":[["path",{"d":"M4 9.8V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M9 17v-2a2 2 0 0 0-4 0v2"}],["rect",{"width":"8","height":"5","x":"3","y":"17","rx":"1"}]],"file-text":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M10 9H8"}],["path",{"d":"M16 13H8"}],["path",{"d":"M16 17H8"}]],"file-up":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}],["path",{"d":"M12 12v6"}],["path",{"d":"m15 15-3-3-3 3"}]],"file":[["path",{"d":"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}],["path",{"d":"M14 2v5a1 1 0 0 0 1 1h5"}]],"files":[["path",{"d":"M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"}],["path",{"d":"M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z"}],["path",{"d":"M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1"}]],"filter":[["path",{"d":"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"}]],"fingerprint":[["path",{"d":"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"}],["path",{"d":"M14 13.12c0 2.38 0 6.38-1 8.88"}],["path",{"d":"M17.29 21.02c.12-.6.43-2.3.5-3.02"}],["path",{"d":"M2 12a10 10 0 0 1 18-6"}],["path",{"d":"M2 16h.01"}],["path",{"d":"M21.8 16c.2-2 .131-5.354 0-6"}],["path",{"d":"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"}],["path",{"d":"M8.65 22c.21-.66.45-1.32.57-2"}],["path",{"d":"M9 6.8a6 6 0 0 1 9 5.2v2"}]],"folder-open":[["path",{"d":"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"}]],"folder-plus":[["path",{"d":"M12 10v6"}],["path",{"d":"M9 13h6"}],["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],"folder":[["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],"gauge":[["path",{"d":"m12 14 4-4"}],["path",{"d":"M3.34 19a10 10 0 1 1 17.32 0"}]],"git-branch":[["path",{"d":"M15 6a9 9 0 0 0-9 9V3"}],["circle",{"cx":"18","cy":"6","r":"3"}],["circle",{"cx":"6","cy":"18","r":"3"}]],"git-commit-horizontal":[["circle",{"cx":"12","cy":"12","r":"3"}],["line",{"x1":"3","x2":"9","y1":"12","y2":"12"}],["line",{"x1":"15","x2":"21","y1":"12","y2":"12"}]],"globe-lock":[["path",{"d":"M15.686 15A14.5 14.5 0 0 1 12 22a14.5 14.5 0 0 1 0-20 10 10 0 1 0 9.542 13"}],["path",{"d":"M2 12h8.5"}],["path",{"d":"M20 6V4a2 2 0 1 0-4 0v2"}],["rect",{"width":"8","height":"5","x":"14","y":"6","rx":"1"}]],"globe":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"}],["path",{"d":"M2 12h20"}]],"hard-drive":[["path",{"d":"M10 16h.01"}],["path",{"d":"M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}],["path",{"d":"M21.946 12.013H2.054"}],["path",{"d":"M6 16h.01"}]],"hash":[["line",{"x1":"4","x2":"20","y1":"9","y2":"9"}],["line",{"x1":"4","x2":"20","y1":"15","y2":"15"}],["line",{"x1":"10","x2":"8","y1":"3","y2":"21"}],["line",{"x1":"16","x2":"14","y1":"3","y2":"21"}]],"heart-pulse":[["path",{"d":"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"}],["path",{"d":"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"}]],"history":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}],["path",{"d":"M12 7v5l4 2"}]],"house":[["path",{"d":"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"}],["path",{"d":"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}]],"id-card":[["path",{"d":"M13 19a4 4 0 00-8 0"}],["path",{"d":"M16 10h2"}],["path",{"d":"M16 14h2"}],["circle",{"cx":"9","cy":"12","r":"3"}],["rect",{"x":"2","y":"5","width":"20","height":"14","rx":"2"}]],"image":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]],"info":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],"key-round":[["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor"}]],"key-square":[["path",{"d":"M12.4 2.7a2.5 2.5 0 0 1 3.4 0l5.5 5.5a2.5 2.5 0 0 1 0 3.4l-3.7 3.7a2.5 2.5 0 0 1-3.4 0L8.7 9.8a2.5 2.5 0 0 1 0-3.4z"}],["path",{"d":"m14 7 3 3"}],["path",{"d":"m9.4 10.6-6.814 6.814A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814"}]],"key":[["path",{"d":"m2 21 9.6-9.6"}],["path",{"d":"m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19"}],["circle",{"cx":"15.5","cy":"7.5","r":"5.5"}]],"keyboard":[["path",{"d":"M10 8h.01"}],["path",{"d":"M12 12h.01"}],["path",{"d":"M14 8h.01"}],["path",{"d":"M16 12h.01"}],["path",{"d":"M18 8h.01"}],["path",{"d":"M6 8h.01"}],["path",{"d":"M7 16h10"}],["path",{"d":"M8 12h.01"}],["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}]],"landmark":[["path",{"d":"M10 18v-7"}],["path",{"d":"M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"}],["path",{"d":"M14 18v-7"}],["path",{"d":"M18 18v-7"}],["path",{"d":"M3 22h18"}],["path",{"d":"M6 18v-7"}]],"laptop":[["path",{"d":"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"}],["path",{"d":"M20.054 15.987H3.946"}]],"layers":[["path",{"d":"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"}],["path",{"d":"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"}],["path",{"d":"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"}]],"layout-grid":[["rect",{"width":"7","height":"7","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"14","rx":"1"}],["rect",{"width":"7","height":"7","x":"3","y":"14","rx":"1"}]],"life-buoy":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m4.93 4.93 4.24 4.24"}],["path",{"d":"m14.83 9.17 4.24-4.24"}],["path",{"d":"m14.83 14.83 4.24 4.24"}],["path",{"d":"m9.17 14.83-4.24 4.24"}],["circle",{"cx":"12","cy":"12","r":"4"}]],"link-2":[["path",{"d":"M9 17H7A5 5 0 0 1 7 7h2"}],["path",{"d":"M15 7h2a5 5 0 1 1 0 10h-2"}],["line",{"x1":"8","x2":"16","y1":"12","y2":"12"}]],"list-filter":[["path",{"d":"M2 5h20"}],["path",{"d":"M6 12h12"}],["path",{"d":"M9 19h6"}]],"list":[["path",{"d":"M3 5h.01"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M3 19h.01"}],["path",{"d":"M8 5h13"}],["path",{"d":"M8 12h13"}],["path",{"d":"M8 19h13"}]],"lock-keyhole":[["circle",{"cx":"12","cy":"16","r":"1"}],["rect",{"x":"3","y":"10","width":"18","height":"12","rx":"2"}],["path",{"d":"M7 10V7a5 5 0 0 1 10 0v3"}]],"lock-open":[["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 9.9-1"}]],"lock":[["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],"log-in":[["path",{"d":"m10 17 5-5-5-5"}],["path",{"d":"M15 12H3"}],["path",{"d":"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"}]],"log-out":[["path",{"d":"m16 17 5-5-5-5"}],["path",{"d":"M21 12H9"}],["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}]],"mail":[["path",{"d":"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"}],["rect",{"x":"2","y":"4","width":"20","height":"16","rx":"2"}]],"map-pin":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],"maximize-2":[["path",{"d":"M15 3h6v6"}],["path",{"d":"m21 3-7 7"}],["path",{"d":"m3 21 7-7"}],["path",{"d":"M9 21H3v-6"}]],"minus":[["path",{"d":"M5 12h14"}]],"monitor":[["rect",{"width":"20","height":"14","x":"2","y":"3","rx":"2"}],["line",{"x1":"8","x2":"16","y1":"21","y2":"21"}],["line",{"x1":"12","x2":"12","y1":"17","y2":"21"}]],"moon":[["path",{"d":"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"}]],"mouse-pointer-click":[["path",{"d":"M14 4.1 12 6"}],["path",{"d":"m5.1 8-2.9-.8"}],["path",{"d":"m6 12-1.9 2"}],["path",{"d":"M7.2 2.2 8 5.1"}],["path",{"d":"M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"}]],"music":[["path",{"d":"M9 18V5l12-2v13"}],["circle",{"cx":"6","cy":"18","r":"3"}],["circle",{"cx":"18","cy":"16","r":"3"}]],"network":[["rect",{"x":"16","y":"16","width":"6","height":"6","rx":"1"}],["rect",{"x":"2","y":"16","width":"6","height":"6","rx":"1"}],["rect",{"x":"9","y":"2","width":"6","height":"6","rx":"1"}],["path",{"d":"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"}],["path",{"d":"M12 12V8"}]],"package":[["path",{"d":"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"}],["path",{"d":"M12 22V12"}],["polyline",{"points":"3.29 7 12 12 20.71 7"}],["path",{"d":"m7.5 4.27 9 5.15"}]],"palette":[["path",{"d":"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"}],["circle",{"cx":"13.5","cy":"6.5","r":".5","fill":"currentColor"}],["circle",{"cx":"17.5","cy":"10.5","r":".5","fill":"currentColor"}],["circle",{"cx":"6.5","cy":"12.5","r":".5","fill":"currentColor"}],["circle",{"cx":"8.5","cy":"7.5","r":".5","fill":"currentColor"}]],"panel-left":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M9 3v18"}]],"pencil":[["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],"phone":[["path",{"d":"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"}]],"pill":[["path",{"d":"m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"}],["path",{"d":"m8.5 8.5 7 7"}]],"plane":[["path",{"d":"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"}]],"plug":[["path",{"d":"M12 22v-5"}],["path",{"d":"M15 8V2"}],["path",{"d":"M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"}],["path",{"d":"M9 8V2"}]],"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"power":[["path",{"d":"M12 2v10"}],["path",{"d":"M18.4 6.6a9 9 0 1 1-12.77.04"}]],"puzzle":[["path",{"d":"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"}]],"qr-code":[["rect",{"width":"5","height":"5","x":"3","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"16","y":"3","rx":"1"}],["rect",{"width":"5","height":"5","x":"3","y":"16","rx":"1"}],["path",{"d":"M21 16h-3a2 2 0 0 0-2 2v3"}],["path",{"d":"M21 21v.01"}],["path",{"d":"M12 7v3a2 2 0 0 1-2 2H7"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M12 3h.01"}],["path",{"d":"M12 16v.01"}],["path",{"d":"M16 12h1"}],["path",{"d":"M21 12v.01"}],["path",{"d":"M12 21v-1"}]],"radar":[["path",{"d":"M19.07 4.93A10 10 0 0 0 6.99 3.34"}],["path",{"d":"M4 6h.01"}],["path",{"d":"M2.29 9.62A10 10 0 1 0 21.31 8.35"}],["path",{"d":"M16.24 7.76A6 6 0 1 0 8.23 16.67"}],["path",{"d":"M12 18h.01"}],["path",{"d":"M17.99 11.66A6 6 0 0 1 15.77 16.67"}],["circle",{"cx":"12","cy":"12","r":"2"}],["path",{"d":"m13.41 10.59 5.66-5.66"}]],"refresh-ccw":[["path",{"d":"M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}],["path",{"d":"M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"}],["path",{"d":"M16 16h5v5"}]],"refresh-cw":[["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],"rotate-ccw":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]],"rotate-cw":[["path",{"d":"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}]],"save":[["path",{"d":"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"}],["path",{"d":"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"}],["path",{"d":"M7 3v4a1 1 0 0 0 1 1h7"}]],"scale":[["path",{"d":"M12 3v18"}],["path",{"d":"m19 8 3 8a5 5 0 0 1-6 0zV7"}],["path",{"d":"M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"}],["path",{"d":"m5 8 3 8a5 5 0 0 1-6 0zV7"}],["path",{"d":"M7 21h10"}]],"scroll-text":[["path",{"d":"M15 12h-5"}],["path",{"d":"M15 8h-5"}],["path",{"d":"M19 17V5a2 2 0 0 0-2-2H4"}],["path",{"d":"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"}]],"search":[["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]],"send":[["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]],"server":[["rect",{"width":"20","height":"8","x":"2","y":"2","rx":"2","ry":"2"}],["rect",{"width":"20","height":"8","x":"2","y":"14","rx":"2","ry":"2"}],["line",{"x1":"6","x2":"6.01","y1":"6","y2":"6"}],["line",{"x1":"6","x2":"6.01","y1":"18","y2":"18"}]],"settings":[["path",{"d":"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"shield-alert":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"M12 8v4"}],["path",{"d":"M12 16h.01"}]],"shield-check":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"m9 12 2 2 4-4"}]],"shield-off":[["path",{"d":"m2 2 20 20"}],["path",{"d":"M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71"}],["path",{"d":"M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264"}]],"shield":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}]],"ship-wheel":[["circle",{"cx":"12","cy":"12","r":"8"}],["path",{"d":"M12 2v7.5"}],["path",{"d":"m19 5-5.23 5.23"}],["path",{"d":"M22 12h-7.5"}],["path",{"d":"m19 19-5.23-5.23"}],["path",{"d":"M12 14.5V22"}],["path",{"d":"M10.23 13.77 5 19"}],["path",{"d":"M9.5 12H2"}],["path",{"d":"M10.23 10.23 5 5"}],["circle",{"cx":"12","cy":"12","r":"2.5"}]],"sliders-horizontal":[["path",{"d":"M10 5H3"}],["path",{"d":"M12 19H3"}],["path",{"d":"M14 3v4"}],["path",{"d":"M16 17v4"}],["path",{"d":"M21 12h-9"}],["path",{"d":"M21 19h-5"}],["path",{"d":"M21 5h-7"}],["path",{"d":"M8 10v4"}],["path",{"d":"M8 12H3"}]],"smartphone":[["rect",{"width":"14","height":"20","x":"5","y":"2","rx":"2","ry":"2"}],["path",{"d":"M12 18h.01"}]],"sparkles":[["path",{"d":"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"}],["path",{"d":"M20 2v4"}],["path",{"d":"M22 4h-4"}],["circle",{"cx":"4","cy":"20","r":"2"}]],"square-pen":[["path",{"d":"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"}],["path",{"d":"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"}]],"star":[["path",{"d":"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"}]],"sticky-note":[["path",{"d":"M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"}],["path",{"d":"M15 3v5a1 1 0 0 0 1 1h5"}]],"store":[["path",{"d":"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"}],["path",{"d":"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"}],["path",{"d":"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"}]],"sun":[["circle",{"cx":"12","cy":"12","r":"4"}],["path",{"d":"M12 2v2"}],["path",{"d":"M12 20v2"}],["path",{"d":"m4.93 4.93 1.41 1.41"}],["path",{"d":"m17.66 17.66 1.41 1.41"}],["path",{"d":"M2 12h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"m6.34 17.66-1.41 1.41"}],["path",{"d":"m19.07 4.93-1.41 1.41"}]],"tag":[["path",{"d":"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"}],["circle",{"cx":"7.5","cy":"7.5","r":".5","fill":"currentColor"}]],"terminal-square":[["path",{"d":"m7 11 2-2-2-2"}],["path",{"d":"M11 13h4"}],["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}]],"terminal":[["path",{"d":"M12 19h8"}],["path",{"d":"m4 17 6-6-6-6"}]],"ticket":[["path",{"d":"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"}],["path",{"d":"M13 5v2"}],["path",{"d":"M13 17v2"}],["path",{"d":"M13 11v2"}]],"timer":[["line",{"x1":"10","x2":"14","y1":"2","y2":"2"}],["line",{"x1":"12","x2":"15","y1":"14","y2":"11"}],["circle",{"cx":"12","cy":"14","r":"8"}]],"trash-2":[["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],"trash":[["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],"triangle-alert":[["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]],"undo-2":[["path",{"d":"M9 14 4 9l5-5"}],["path",{"d":"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"}]],"unlink":[["path",{"d":"m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"}],["path",{"d":"m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"}],["line",{"x1":"8","x2":"8","y1":"2","y2":"5"}],["line",{"x1":"2","x2":"5","y1":"8","y2":"8"}],["line",{"x1":"16","x2":"16","y1":"19","y2":"22"}],["line",{"x1":"19","x2":"22","y1":"16","y2":"16"}]],"upload":[["path",{"d":"M12 3v12"}],["path",{"d":"m17 8-5-5-5 5"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}]],"user-round":[["circle",{"cx":"12","cy":"8","r":"5"}],["path",{"d":"M20 21a8 8 0 0 0-16 0"}]],"user":[["path",{"d":"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"}],["circle",{"cx":"12","cy":"7","r":"4"}]],"users":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]],"video":[["path",{"d":"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"}],["rect",{"x":"2","y":"6","width":"14","height":"12","rx":"2"}]],"webhook":[["path",{"d":"M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"}],["path",{"d":"m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"}],["path",{"d":"m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"}]],"wifi":[["path",{"d":"M12 20h.01"}],["path",{"d":"M2 8.82a15 15 0 0 1 20 0"}],["path",{"d":"M5 12.859a10 10 0 0 1 14 0"}],["path",{"d":"M8.5 16.429a5 5 0 0 1 7 0"}]],"workflow":[["rect",{"width":"8","height":"8","x":"3","y":"3","rx":"2"}],["path",{"d":"M7 11v4a2 2 0 0 0 2 2h4"}],["rect",{"width":"8","height":"8","x":"13","y":"13","rx":"2"}]],"x":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"zap":[["path",{"d":"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"}]]};
const MARK={"viewBox":"131 118 734 734","transform":"translate(535 625) rotate(-22)","body":"M330 -22 C312 -44 284 -54 262 -52 C248 -84 204 -104 150 -106 C40 -112 -80 -80 -170 -40 C-230 -14 -290 -20 -350 -40 Q-374 -46 -374 -22 C-368 22 -320 52 -250 54 C-160 58 -80 96 20 96 C130 96 230 60 266 16 C290 2 312 -6 326 -10 Q336 -14 330 -22 Z","wings":["M160 -84 C140 -170 130 -226 80 -236 L-120 -160 C-130 -110 -100 -80 -150 -40 C-60 -70 60 -84 160 -84 Z","M130 -209.4 Q72.4 -417.9 -15.9 -489.9 Q-18.6 -411.6 34.2 -202.7 Z","M33.1 -190.5 Q-84.8 -345.5 -182.8 -374.5 Q-160.6 -308.6 -46.8 -151.6 Z","M-70.4 -170.2 Q-218.8 -259.5 -308.8 -249.2 Q-270.7 -201.9 -125 -109.6 Z"],"eye":[222,-62,11]};
const cx=(...a)=>a.filter(Boolean).join(" ");
const camel=(k)=>k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const safeId=(s)=>String(s).replace(/[^a-zA-Z0-9_-]/g,"");

function Icon({name,size=16,strokeWidth=1.75,filled=false,className,style,label}){
  const nodes=ICONS[name];
  if(!nodes)return null;
  const a11y=label?{role:"img","aria-label":label}:{"aria-hidden":true};
  return h("svg",Object.assign({className:cx("apm-icon",className),style,width:size,height:size,viewBox:"0 0 24 24",fill:filled?"currentColor":"none",stroke:"currentColor",strokeWidth,strokeLinecap:"round",strokeLinejoin:"round",focusable:"false"},a11y),
    nodes.map(([tag,attrs],i)=>{const p={key:i};for(const k in attrs)p[camel(k)]=attrs[k];return h(tag,p);}));
}

function Mark({size=24,tile=false,label="APM",className,style}){
  const id=safeId(useId());
  const inner=tile?Math.round(size*0.66):size;
  const svg=h("svg",{viewBox:MARK.viewBox,width:inner,height:inner,role:"img","aria-label":label,focusable:"false"},
    h("defs",null,h("mask",{id:"apm-eye-"+id,maskUnits:"userSpaceOnUse",x:-700,y:-700,width:1400,height:1400},
      h("rect",{x:-700,y:-700,width:1400,height:1400,fill:"#fff"}),
      h("circle",{cx:MARK.eye[0],cy:MARK.eye[1],r:MARK.eye[2],fill:"#000"}))),
    h("g",{transform:MARK.transform,mask:"url(#apm-eye-"+id+")",fill:"currentColor",stroke:"currentColor",strokeWidth:12,strokeLinejoin:"round"},
      h("path",{d:MARK.body}),
      MARK.wings.map((d,i)=>h("path",{key:i,d}))));
  return h("span",{className:cx(tile?"apm-mark-tile":"apm-mark",className),style:Object.assign({width:size,height:size},style)},svg);
}

function Spinner({size=14}){
  return h("svg",{className:"apm-spinner",width:size,height:size,viewBox:"0 0 16 16",fill:"none","aria-hidden":true},
    h("circle",{cx:8,cy:8,r:6.25,strokeWidth:1.75}),
    h("path",{d:"M14.25 8A6.25 6.25 0 0 0 8 1.75",strokeWidth:1.75,strokeLinecap:"round"}));
}

function Kbd({keys,children,className}){
  const list=keys||(typeof children==="string"?children.split(/\s+/).filter(Boolean):[]);
  return h("span",{className:cx("apm-kbd",className)},list.map((k,i)=>h("kbd",{key:i},k)));
}

function Command({cmd,prompt="$",block=false,label="Copy the command",onCopy,className}){
  const [done,setDone]=useState(false);
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  if(!cmd)return null;
  const copy=(e)=>{e.stopPropagation();copyText(cmd);setDone(true);onCopy&&onCopy(cmd);clearTimeout(timer.current);timer.current=setTimeout(()=>setDone(false),1200);};
  return h("button",{type:"button",className:cx("apm-command",block&&"apm-command-block",done&&"is-done",className),title:label,"aria-label":label+": "+cmd,onClick:copy},
    h("span",{className:"apm-command-prompt","aria-hidden":true},prompt),
    h("span",{className:"apm-command-text"},cmd),
    h(Icon,{name:done?"check":"copy",size:11}));
}

const Button=forwardRef(function Button({variant="secondary",size="md",icon,iconRight,kbd,loading=false,block=false,href,type="button",className,children,disabled,...rest},ref){
  const iconSize=size==="sm"?14:16;
  const cls=cx("apm-btn","apm-btn-"+variant,size!=="md"&&"apm-btn-"+size,block&&"apm-btn-block",loading&&"is-loading",className);
  const kids=[
    icon&&h(Icon,{key:"i",name:icon,size:iconSize}),
    children!=null&&h("span",{key:"l",className:"apm-btn-label"},children),
    iconRight&&h(Icon,{key:"r",name:iconRight,size:iconSize}),
    kbd&&h(Kbd,{key:"k",keys:Array.isArray(kbd)?kbd:String(kbd).split(/\s+/)}),
    loading&&h(Spinner,{key:"s",size:iconSize})
  ];
  if(href)return h("a",Object.assign({ref,href,className:cls,"aria-disabled":disabled?"true":undefined},rest),kids);
  return h("button",Object.assign({ref,type,className:cls,disabled:disabled||loading,"aria-busy":loading||undefined},rest),kids);
});

const IconButton=forwardRef(function IconButton({icon,label,kbd,tip=true,tipSide="bottom",size="sm",variant="ghost",active=false,filled=false,tone,className,href,...rest},ref){
  const px=size==="xs"?14:16;
  const cls=cx("apm-iconbtn",size!=="sm"&&"apm-iconbtn-"+size,variant!=="ghost"&&"apm-iconbtn-"+variant,active&&"is-active",tone&&"is-"+tone,className);
  const kid=h(Icon,{name:icon,size:px,filled});
  const el=href?h("a",Object.assign({ref,href,className:cls,"aria-label":label},rest),kid):h("button",Object.assign({ref,type:"button",className:cls,"aria-label":label,"aria-pressed":active||undefined},rest),kid);
  return tip?h(Tooltip,{label,kbd,side:tipSide},el):el;
});

function Hint({tone,icon,children,className}){
  if(!children)return h("div",{className:cx("apm-hint",className),"aria-hidden":true});
  return h("div",{className:cx("apm-hint","apm-hint-enter",tone&&"apm-hint-"+tone,className),role:tone==="danger"?"alert":undefined},icon&&h(Icon,{name:icon,size:14}),h("span",null,children));
}

const Input=forwardRef(function Input({label,hint,hintTone,icon,trailing,size="md",invalid=false,disabled=false,id,className,style,...rest},ref){
  const auto=safeId(useId());
  const fid=id||"apm-in-"+auto;
  return h("div",{className:cx("apm-field",className),style},
    label&&h("label",{className:"apm-label",htmlFor:fid},label),
    h("div",{className:cx("apm-input",size!=="md"&&"apm-input-"+size),"data-invalid":invalid?"true":undefined,"data-disabled":disabled?"true":undefined},
      icon&&h(Icon,{name:icon,size:size==="lg"?18:16}),
      h("input",Object.assign({ref,id:fid,disabled,"aria-invalid":invalid||undefined},rest)),
      trailing),
    hint&&h(Hint,{tone:invalid?"danger":hintTone,icon:invalid?"triangle-alert":undefined},hint));
});

function PasswordInput({placeholder="Master password",value,defaultValue="",onChange,onSubmit,submitHref,invalid=false,error,hint,busy=false,autoFocus=false,shakeKey,id,label,className,style}){
  const auto=safeId(useId());
  const fid=id||"apm-pw-"+auto;
  const [inner,setInner]=useState(defaultValue);
  const val=value!=null?value:inner;
  const [shown,setShown]=useState(false);
  const [caps,setCaps]=useState(false);
  const [shaking,setShaking]=useState(false);
  const linkRef=useRef(null);
  const first=useRef(true);
  useEffect(()=>{if(first.current){first.current=false;return;}if(shakeKey==null)return;setShaking(true);const t=setTimeout(()=>setShaking(false),450);return()=>clearTimeout(t);},[shakeKey]);
  const change=(e)=>{if(value==null)setInner(e.target.value);onChange&&onChange(e.target.value,e);};
  const key=(e)=>{if(e.getModifierState)setCaps(e.getModifierState("CapsLock"));};
  const submit=(e)=>{e&&e.preventDefault();if(busy)return;if(submitHref&&linkRef.current&&e&&e.type==="submit"){linkRef.current.click();return;}onSubmit&&onSubmit(val);};
  const ready=val.length>0&&!busy;
  const btnKids=busy?h(Spinner,{size:14}):h(Icon,{name:"arrow-right",size:16,key:ready?"on":"off"});
  const btn=submitHref
    ?h("a",{ref:linkRef,href:submitHref,className:"apm-pw-submit","data-ready":ready?"true":"false","aria-label":"Unlock",title:"Unlock"},btnKids)
    :h("button",{type:"submit",className:"apm-pw-submit","data-ready":ready?"true":"false","aria-label":"Unlock",title:"Unlock",disabled:busy},btnKids);
  let hintNode=h(Hint,{tone:null},hint);
  if(error)hintNode=h(Hint,{tone:"danger",icon:"triangle-alert"},error);
  else if(caps)hintNode=h(Hint,{tone:"warning",icon:"info"},"Caps Lock is on");
  return h("form",{className:cx("apm-pw",shaking&&"is-shaking",className),style,onSubmit:submit,noValidate:true},
    label&&h("label",{className:"apm-label",htmlFor:fid},label),
    h("div",{className:"apm-input apm-input-lg","data-invalid":(invalid||error)?"true":undefined,"data-disabled":busy?"true":undefined},
      h(Icon,{name:"lock",size:18}),
      h("input",{id:fid,type:shown?"text":"password",value:val,onChange:change,onKeyDown:key,onKeyUp:key,placeholder,autoFocus,autoComplete:"current-password",spellCheck:false,"aria-invalid":(invalid||!!error)||undefined,"aria-describedby":fid+"-hint",disabled:busy}),
      h(IconButton,{icon:shown?"eye-off":"eye",label:shown?"Hide password":"Show password",size:"sm",onClick:()=>setShown(!shown)}),
      btn),
    h("div",{id:fid+"-hint"},hintNode));
}

const SearchField=forwardRef(function SearchField({placeholder="Search",value,defaultValue="",onChange,shortcut=["\u2318","K"],size="md",className,style,...rest},ref){
  const [inner,setInner]=useState(defaultValue);
  const val=value!=null?value:inner;
  const localRef=useRef(null);
  const set=(v,e)=>{if(value==null)setInner(v);onChange&&onChange(v,e);};
  const setRef=(n)=>{localRef.current=n;if(typeof ref==="function")ref(n);else if(ref)ref.current=n;};
  const trailing=val
    ?h("button",{type:"button",className:"apm-search-clear","aria-label":"Clear search",onClick:()=>{set("");localRef.current&&localRef.current.focus();}},h(Icon,{name:"x",size:12,strokeWidth:2.25}))
    :(shortcut&&h(Kbd,{keys:shortcut}));
  return h(Input,Object.assign({ref:setRef,className:cx("apm-search",className),style,icon:"search",size,placeholder,value:val,onChange:(e)=>set(e.target.value,e),onKeyDown:(e)=>{if(e.key==="Escape"&&val){e.stopPropagation();set("");}},trailing,type:"search","aria-label":placeholder,spellCheck:false},rest));
});

function Switch({checked,defaultChecked=false,onChange,label,disabled=false,id}){
  const [inner,setInner]=useState(defaultChecked);
  const on=checked!=null?checked:inner;
  return h("button",{type:"button",role:"switch",id,className:"apm-switch","aria-checked":on?"true":"false","aria-label":label,disabled,onClick:()=>{const n=!on;if(checked==null)setInner(n);onChange&&onChange(n);}});
}

function SegmentedControl({options=[],value,defaultValue,onChange,label,className}){
  const norm=options.map(o=>typeof o==="string"?{value:o,label:o}:o);
  const [inner,setInner]=useState(defaultValue!=null?defaultValue:(norm[0]&&norm[0].value));
  const cur=value!=null?value:inner;
  const refs=useRef({});
  const [thumb,setThumb]=useState(null);
  const measure=useCallback(()=>{const el=refs.current[cur];if(el)setThumb({x:el.offsetLeft,w:el.offsetWidth});},[cur]);
  useLayoutEffect(()=>{measure();},[measure,options.length]);
  useEffect(()=>{if(!document.fonts||!document.fonts.ready)return;let live=true;document.fonts.ready.then(()=>{if(live)measure();});return()=>{live=false;};},[measure]);
  return h("div",{className:cx("apm-seg",className),role:"group","aria-label":label},
    thumb&&h("span",{className:"apm-seg-thumb",style:{width:thumb.w,transform:"translateX("+thumb.x+"px)"}}),
    norm.map(o=>h("button",{key:o.value,type:"button",ref:(n)=>{refs.current[o.value]=n;},"aria-pressed":o.value===cur?"true":"false",onClick:()=>{if(value==null)setInner(o.value);onChange&&onChange(o.value);}},
      o.icon&&h(Icon,{name:o.icon,size:14}),o.label)));
}

function Badge({tone="neutral",icon,dot=false,size="md",outline=false,children,className}){
  return h("span",{className:cx("apm-badge",tone!=="neutral"&&"apm-badge-"+tone,dot&&"apm-badge-dot",size==="sm"&&"apm-badge-sm",outline&&"apm-badge-outline",className)},icon&&h(Icon,{name:icon,size:12,strokeWidth:2}),children);
}

const LOGO_LOOK=new Map();
function logoLook(img){
  const key=img.currentSrc||img.src;
  if(LOGO_LOOK.has(key))return LOGO_LOOK.get(key);
  let look="";
  try{
    const n=32,c=document.createElement("canvas");
    c.width=n;c.height=n;
    const g=c.getContext("2d",{willReadFrequently:true});
    g.drawImage(img,0,0,n,n);
    const d=g.getImageData(0,0,n,n).data;
    const at=(x,y)=>d[(y*n+x)*4+3];
    const corners=[at(1,1),at(n-2,1),at(1,n-2),at(n-2,n-2)];
    if(corners.every((a)=>a>230))look="is-opaque";
    else{
      let ink=0,lum=0,sat=0;
      for(let i=0;i<d.length;i+=4){
        const a=d[i+3]/255;
        if(a<.5)continue;
        const r=d[i],gg=d[i+1],b=d[i+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);
        ink++;lum+=(.2126*r+.7152*gg+.0722*b)/255;sat+=mx?(mx-mn)/mx:0;
      }
      if(ink&&lum/ink<.3&&sat/ink<.35)look="is-ink";
    }
  }catch(e){look="";}
  LOGO_LOOK.set(key,look);
  return look;
}

function ItemIcon({name="",letter,icon,src,size="md",solid=false,className,style}){
  const [broken,setBroken]=useState(null);
  const [look,setLook]=useState(()=>(src&&LOGO_LOOK.get(src))||"");
  useEffect(()=>{setLook((src&&LOGO_LOOK.get(src))||"");},[src]);
  const ch=letter||(String(name).trim().charAt(0)||"?").toUpperCase();
  const px={sm:12,md:16,lg:26}[size]||16;
  const img=src&&broken!==src;
  return h("span",{className:cx("apm-tile","apm-tile-"+size,solid&&!img&&"apm-tile-solid",img&&"has-img",img&&look,className),style,"aria-hidden":true},img?h("img",{className:"apm-tile-img",src,alt:"",draggable:false,decoding:"async",onLoad:(e)=>setLook(logoLook(e.currentTarget)),onError:()=>setBroken(src)}):icon?h(Icon,{name:icon,size:px}):ch);
}

function NavItem({icon,label,count,badge,kbd,active=false,href,onClick,className,children}){
  const tail=badge?h(Badge,{key:"b",tone:badge.tone||"neutral",size:"sm"},badge.text):kbd?h(Kbd,{key:"k",keys:Array.isArray(kbd)?kbd:String(kbd).split(/\s+/)}):(count!=null&&h("span",{key:"c",className:"apm-nav-count"},count));
  const kids=[icon&&h(Icon,{key:"i",name:icon,size:16}),h("span",{key:"l",className:"apm-nav-label"},label||children),tail];
  const cls=cx("apm-nav",active&&"is-active",className);
  if(href)return h("a",{href,className:cls,"aria-current":active?"page":undefined},kids);
  return h("button",{type:"button",className:cls,onClick,"aria-current":active?"page":undefined},kids);
}

function ItemRow({title,subtitle,letter,icon,src,time,favorite=false,alert,mono=false,active=false,solid=false,onClick,href,className}){
  const flags=[];
  if(alert)flags.push(h("span",{key:"a",className:"is-"+(alert==="danger"?"danger":"warning"),title:alert==="danger"?"Compromised":"Needs attention"},h(Icon,{name:"triangle-alert",size:13,strokeWidth:2})));
  if(favorite)flags.push(h("span",{key:"f",title:"Favorite"},h(Icon,{name:"star",size:13,filled:true,strokeWidth:1.5})));
  const kids=[h(ItemIcon,{key:"t",name:title,letter,icon,src,solid}),
    h("span",{key:"x",className:"apm-row-text"},h("span",{className:"apm-row-title"},title),subtitle&&h("span",{className:cx("apm-row-sub",mono&&"is-mono")},subtitle)),
    h("span",{key:"m",className:"apm-row-meta"},time&&h("span",{className:"apm-row-time"},time),h("span",{className:"apm-row-flags"},flags))];
  const cls=cx("apm-row",active&&"is-active",className);
  if(href)return h("a",{href,className:cls,"aria-current":active?"true":undefined},kids);
  return h("button",{type:"button",className:cls,onClick,"aria-current":active?"true":undefined},kids);
}

function FieldGroup({children,className,style}){
  return h("div",{className:cx("apm-fields",className),style},children);
}

function colorize(str){
  return Array.from(String(str)).map((c,i)=>/[0-9]/.test(c)?h("span",{key:i,className:"d"},c):(/[^A-Za-z0-9\s]/.test(c)?h("span",{key:i,className:"s"},c):c));
}

function copyText(text){
  try{if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(String(text)).catch(()=>{});}catch(e){}
  return Promise.resolve();
}

function SecretField({label,icon,value,copyValue,secret=false,mono=false,multiline=false,href,totp:totpSecret,reveal=false,pinned=false,copyable=true,onCopy,children,extra}){
  const [shown,setShown]=useState(reveal);
  const [copied,setCopied]=useState(false);
  const [revealTick,setRevealTick]=useState(0);
  const timer=useRef(null);
  const liveCode=useRef("");
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const rawOf=()=>totpSecret?liveCode.current:(copyValue!=null?copyValue:(typeof value==="string"||typeof value==="number"?String(value):""));
  const raw=rawOf();
  const copy=()=>{if(!copyable)return;const v=rawOf();copyText(v);setCopied(true);onCopy&&onCopy(label,v);clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),1600);};
  let display=totpSecret?h(TotpCode,{secret:totpSecret,onCode:(c)=>{liveCode.current=c;}}):value;
  let valueCls=cx("apm-sf-value",mono&&"is-mono",multiline&&"is-multiline");
  if(secret&&!shown){display="\u2022".repeat(Math.min(Math.max(raw.length,10),18));valueCls=cx("apm-sf-value","is-masked");}
  else if(secret&&shown){display=multiline?raw:colorize(raw);valueCls=cx("apm-sf-value","is-mono",multiline&&"is-multiline",revealTick>0&&"is-revealing");}
  else if(href){display=h("a",{href,target:"_blank",rel:"noreferrer"},value,h(Icon,{name:"external-link",size:12}));}
  const actions=[];
  if(secret)actions.push(h(IconButton,{key:"r",icon:shown?"eye-off":"eye",label:shown?"Hide":"Reveal",size:"sm",onClick:()=>{setShown(!shown);setRevealTick(revealTick+1);}}));
  if(copyable)actions.push(h(IconButton,{key:"c",icon:copied?"check":"copy",label:copied?"Copied":"Copy "+String(label||"").toLowerCase(),size:"sm",tone:copied?"success":undefined,onClick:copy}));
  if(extra)actions.push(h(Fragment,{key:"e"},extra));
  return h("div",{className:cx("apm-sf",pinned&&"is-pinned")},
    h("div",{className:"apm-sf-label"},icon&&h(Icon,{name:icon,size:14}),h("span",null,label)),
    h("div",{className:"apm-sf-body"},(display!=null&&display!=="")&&h("div",{key:secret?(shown?"s":"m"):"v",className:valueCls,onClick:href?undefined:copy,title:copyable&&!href?"Click to copy":undefined},display),children),
    h("div",{className:"apm-sf-actions"},actions),
    copied&&h("span",{className:"apm-sf-copied",role:"status"},h(Icon,{name:"check",size:12,strokeWidth:2.25}),"Copied"));
}

function base32(s){
  const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const c of String(s).toUpperCase().replace(/[\s=]/g,"")){const v=A.indexOf(c);if(v<0)continue;bits+=v.toString(2).padStart(5,"0");}
  const out=new Uint8Array(Math.floor(bits.length/8));
  for(let i=0;i<out.length;i++)out[i]=parseInt(bits.slice(i*8,i*8+8),2);
  return out;
}
async function totp(secret,period=30,digits=6,at=Date.now()){
  const key=await crypto.subtle.importKey("raw",base32(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const ctr=Math.floor(at/1000/period);
  const buf=new ArrayBuffer(8);const dv=new DataView(buf);
  dv.setUint32(0,Math.floor(ctr/4294967296));dv.setUint32(4,ctr>>>0);
  const mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,buf));
  const o=mac[mac.length-1]&15;
  const n=(((mac[o]&127)<<24)|(mac[o+1]<<16)|(mac[o+2]<<8)|mac[o+3])%Math.pow(10,digits);
  return String(n).padStart(digits,"0");
}

function TotpCode({secret,code,period=30,digits=6,size="md",className,onCode}){
  const [now,setNow]=useState(()=>Date.now());
  const [live,setLive]=useState("");
  useEffect(()=>{let t;const tick=()=>{setNow(Date.now());t=setTimeout(tick,250);};tick();return()=>clearTimeout(t);},[]);
  const step=Math.floor(now/1000/period);
  useEffect(()=>{
    if(!secret||!(window.crypto&&window.crypto.subtle))return;
    let ok=true;totp(secret,period,digits).then(c=>{if(ok){setLive(c);onCode&&onCode(c);}}).catch(()=>{});
    return()=>{ok=false;};
  },[secret,step,period,digits]);
  const shown=(live||code||"").padEnd(digits,"\u00b7").slice(0,digits);
  const half=Math.ceil(digits/2);
  const remaining=period-((now/1000)%period);
  const frac=remaining/period;
  const r=6.5,C=2*Math.PI*r;
  const low=remaining<=7;
  const wrap=frac>0.985;
  return h("span",{className:cx("apm-totp","apm-totp-"+size,low&&"is-low",wrap&&"is-wrap",className),"aria-live":"polite"},
    h("span",{key:step,className:"apm-totp-code","aria-label":"One-time code "+shown},shown.slice(0,half),h("span",{className:"apm-totp-gap"}),shown.slice(half)),
    h("span",{className:"apm-totp-timer",title:Math.ceil(remaining)+" seconds left"},
      h("svg",{width:16,height:16,viewBox:"0 0 16 16",fill:"none","aria-hidden":true},
        h("circle",{className:"apm-totp-track",cx:8,cy:8,r,strokeWidth:2}),
        h("circle",{className:"apm-totp-arc",cx:8,cy:8,r,strokeWidth:2,strokeLinecap:"round",strokeDasharray:C,strokeDashoffset:C*(1-frac)})),
      h("span",{className:"apm-totp-sec"},Math.ceil(remaining)+"s")));
}

const WORDS=["Very weak","Weak","Fair","Good","Strong"];
function StrengthMeter({score=4,bits,label,detail,className}){
  const s=Math.max(0,Math.min(4,Math.round(score)));
  const on=Math.max(1,s);
  const [armed,setArmed]=useState(false);
  useEffect(()=>{const t=requestAnimationFrame(()=>setArmed(true));return()=>cancelAnimationFrame(t);},[]);
  return h("span",{className:cx("apm-strength",className),"data-score":s},
    h("span",{className:"apm-strength-bars","aria-hidden":true},[0,1,2,3].map(i=>h("i",{key:i,className:armed&&i<on?"on":undefined,style:{transitionDelay:(i*70)+"ms"}}))),
    h("span",{className:"apm-strength-word"},label||WORDS[s]),
    bits!=null&&h("span",null,bits+" bits"),
    detail&&h("span",null,"\u00b7 "+detail));
}

function Toast({title,description,tone="success",icon,countdown,onDone,action,className,style}){
  const [left,setLeft]=useState(countdown||0);
  useEffect(()=>{if(!countdown)return;setLeft(countdown);const t=setInterval(()=>setLeft(v=>{if(v<=1){clearInterval(t);onDone&&onDone();return 0;}return v-1;}),1000);return()=>clearInterval(t);},[countdown]);
  const ic=icon||(tone==="danger"?"triangle-alert":tone==="neutral"?"info":"check");
  const r=7,C=2*Math.PI*r;
  const desc=countdown?(description?description+" \u00b7 ":"")+"Clears in "+left+"s":description;
  return h("div",{className:cx("apm-toast","apm-toast-"+tone,className),style,role:"status"},
    h("span",{className:"apm-toast-icon"},h(Icon,{name:ic,size:13,strokeWidth:2.25})),
    h("span",{className:"apm-toast-text"},h("span",{className:"apm-toast-title"},title),desc&&h("span",{className:"apm-toast-desc"},desc)),
    action,
    countdown?h("svg",{className:"apm-toast-ring",width:18,height:18,viewBox:"0 0 18 18",fill:"none","aria-hidden":true},
      h("circle",{cx:9,cy:9,r,strokeWidth:2}),
      h("circle",{cx:9,cy:9,r,strokeWidth:2,strokeLinecap:"round",strokeDasharray:C,strokeDashoffset:C*(1-left/countdown)})):null);
}

function useEscape(active,fn){
  const ref=useRef(fn);ref.current=fn;
  useEffect(()=>{if(!active)return;const k=(e)=>{if(e.key==="Escape"){e.stopPropagation();ref.current&&ref.current(e);}};window.addEventListener("keydown",k,true);return()=>window.removeEventListener("keydown",k,true);},[active]);
}

function Tooltip({label,kbd,side="bottom",delay=420,children,className}){
  const [show,setShow]=useState(false);
  const t=useRef(null);
  useEffect(()=>()=>clearTimeout(t.current),[]);
  if(!label)return children;
  const on=()=>{clearTimeout(t.current);t.current=setTimeout(()=>setShow(true),delay);};
  const off=()=>{clearTimeout(t.current);setShow(false);};
  return h("span",{className:cx("apm-tip-wrap",className),onMouseEnter:on,onMouseLeave:off,onFocus:on,onBlur:off,onMouseDown:off},children,
    show&&h("span",{className:cx("apm-tip","is-"+side),role:"tooltip"},h("span",null,label),kbd&&h(Kbd,{keys:Array.isArray(kbd)?kbd:String(kbd).split(/\s+/)})));
}

function Dialog({open=true,onClose,title,description,icon,tone,size="md",footer,footerStart,children,layer="portal",className,bodyClassName,autoFocus=true}){
  const panel=useRef(null);
  useEscape(open&&layer!=="none"&&!!onClose,onClose);
  useEffect(()=>{
    if(!open||layer==="none"||!autoFocus)return;
    const prev=document.activeElement;
    const t=setTimeout(()=>{const p=panel.current;if(!p)return;const el=p.querySelector("[data-autofocus],input:not([type=hidden]),textarea,select")||p.querySelector("button:not([data-close])");el&&el.focus();},40);
    return()=>{clearTimeout(t);if(prev&&prev.focus)try{prev.focus();}catch(e){}};
  },[open]);
  if(!open)return null;
  const trap=(e)=>{
    if(e.key!=="Tab"||!panel.current)return;
    const f=[...panel.current.querySelectorAll("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])")].filter(x=>!x.disabled&&x.offsetParent!==null);
    if(!f.length)return;const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  const box=h("div",{ref:panel,className:cx("apm-dialog","apm-dialog-"+size,className),role:"dialog","aria-modal":layer==="none"?undefined:"true","aria-label":typeof title==="string"?title:undefined,onMouseDown:(e)=>e.stopPropagation(),onKeyDown:trap},
    (title||icon)&&h("div",{className:"apm-dialog-head"},
      icon&&h("span",{className:cx("apm-dialog-icon",tone&&"is-"+tone)},h(Icon,{name:icon,size:18})),
      h("div",{className:"apm-dialog-titles"},title&&h("h2",{className:"apm-dialog-title"},title),description&&h("p",{className:"apm-dialog-desc"},description)),
      onClose&&h(IconButton,{icon:"x",label:"Close",kbd:"Esc",size:"sm",className:"apm-dialog-close","data-close":true,onClick:onClose})),
    children!=null&&h("div",{className:cx("apm-dialog-body",bodyClassName)},children),
    (footer||footerStart)&&h("div",{className:"apm-dialog-foot"},h("div",{className:"apm-dialog-foot-start"},footerStart),h("div",{className:"apm-dialog-foot-end"},footer)));
  if(layer==="none")return box;
  const overlay=h("div",{className:cx("apm-overlay",layer==="contained"&&"is-contained"),onMouseDown:()=>onClose&&onClose()},box);
  if(layer==="contained"||!window.ReactDOM||!window.ReactDOM.createPortal)return overlay;
  return window.ReactDOM.createPortal(overlay,document.body);
}

function MenuList({items=[],onSelect,className,style,autoFocus=false,label}){
  const ref=useRef(null);
  useEffect(()=>{if(autoFocus&&ref.current){const f=ref.current.querySelector(".apm-menu-item:not([disabled])");f&&f.focus();}},[]);
  const onKey=(e)=>{
    const els=[...ref.current.querySelectorAll(".apm-menu-item:not([disabled])")];
    const i=els.indexOf(document.activeElement);
    if(e.key==="ArrowDown"){e.preventDefault();(els[i+1]||els[0]).focus();}
    else if(e.key==="ArrowUp"){e.preventDefault();(els[i-1]||els[els.length-1]).focus();}
    else if(e.key==="Home"){e.preventDefault();els[0]&&els[0].focus();}
    else if(e.key==="End"){e.preventDefault();els[els.length-1]&&els[els.length-1].focus();}
  };
  return h("div",{ref,className:cx("apm-menu",className),style,role:"menu","aria-label":label,onKeyDown:onKey},
    items.filter(Boolean).map((it,i)=>{
      if(it.separator)return h("div",{key:i,className:"apm-menu-sep",role:"separator"});
      if(it.section)return h("div",{key:i,className:"apm-menu-section"},it.section);
      const lead=it.icon?h(Icon,{name:it.icon,size:15}):(it.checked!=null?h("span",{className:"apm-menu-check"},it.checked?h(Icon,{name:"check",size:14,strokeWidth:2.25}):null):null);
      return h("button",{key:i,type:"button",role:it.checked!=null?"menuitemcheckbox":"menuitem","aria-checked":it.checked!=null?String(!!it.checked):undefined,className:cx("apm-menu-item",it.danger&&"is-danger"),disabled:it.disabled,
        onClick:()=>{it.onSelect&&it.onSelect();onSelect&&onSelect(it);}},
        lead,h("span",{className:"apm-menu-label"},it.label),
        it.hint&&h("span",{className:"apm-menu-hint"},it.hint),
        it.kbd&&h(Kbd,{keys:Array.isArray(it.kbd)?it.kbd:String(it.kbd).split(/\s+/)}),
        it.submenu&&h(Icon,{name:"chevron-right",size:14,className:"apm-menu-sub"}));
    }));
}

function Menu({trigger,items,align="start",side="bottom",width=224,open:ctrl,onOpenChange,label}){
  const [inner,setInner]=useState(false);
  const open=ctrl!=null?ctrl:inner;
  const set=(v)=>{if(ctrl==null)setInner(v);onOpenChange&&onOpenChange(v);};
  const wrap=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const d=(e)=>{if(wrap.current&&!wrap.current.contains(e.target))set(false);};
    const k=(e)=>{if(e.key==="Escape"){e.stopPropagation();set(false);}};
    document.addEventListener("mousedown",d);window.addEventListener("keydown",k,true);
    return()=>{document.removeEventListener("mousedown",d);window.removeEventListener("keydown",k,true);};
  },[open]);
  const trig=React.cloneElement(trigger,{onClick:(e)=>{trigger.props.onClick&&trigger.props.onClick(e);set(!open);},"aria-haspopup":"menu","aria-expanded":open?"true":"false"});
  return h("span",{className:"apm-menu-wrap",ref:wrap},trig,
    open&&h(MenuList,{items,label,autoFocus:true,onSelect:()=>set(false),className:cx("apm-menu-pop","is-"+align,"is-"+side),style:{width}}));
}

const Select=forwardRef(function Select({label,hint,options=[],value,defaultValue,onChange,size="md",icon,id,className,style,disabled,ariaLabel},ref){
  const fid=id||"apm-sel-"+safeId(useId());
  return h("div",{className:cx("apm-field",className),style},
    label&&h("label",{className:"apm-label",htmlFor:fid},label),
    h("div",{className:cx("apm-input","apm-select",size!=="md"&&"apm-input-"+size),"data-disabled":disabled?"true":undefined},
      icon&&h(Icon,{name:icon,size:16}),
      h("select",{ref,id:fid,value,defaultValue,disabled,"aria-label":ariaLabel,onChange:(e)=>onChange&&onChange(e.target.value,e)},
        options.map(o=>{const x=typeof o==="string"?{value:o,label:o}:o;return h("option",{key:x.value,value:x.value},x.label);})),
      h(Icon,{name:"chevrons-up-down",size:14,className:"apm-select-chev"})),
    hint&&h(Hint,null,hint));
});

const Textarea=forwardRef(function Textarea({label,hint,invalid=false,mono=false,rows=4,id,className,style,...rest},ref){
  const fid=id||"apm-ta-"+safeId(useId());
  return h("div",{className:cx("apm-field",className),style},
    label&&h("label",{className:"apm-label",htmlFor:fid},label),
    h("textarea",Object.assign({ref,id:fid,rows,className:cx("apm-textarea",mono&&"is-mono"),"data-invalid":invalid?"true":undefined,spellCheck:!mono},rest)),
    hint&&h(Hint,{tone:invalid?"danger":null,icon:invalid?"triangle-alert":undefined},hint));
});

function Checkbox({checked,defaultChecked=false,onChange,label,description,disabled=false,id}){
  const [inner,setInner]=useState(defaultChecked);
  const on=checked!=null?checked:inner;
  const fid=id||"apm-cb-"+safeId(useId());
  return h("label",{className:cx("apm-check",disabled&&"is-disabled"),htmlFor:fid},
    h("input",{type:"checkbox",id:fid,checked:on,disabled,onChange:(e)=>{if(checked==null)setInner(e.target.checked);onChange&&onChange(e.target.checked);}}),
    h("span",{className:"apm-check-box","aria-hidden":true},h(Icon,{name:"check",size:12,strokeWidth:2.75})),
    (label||description)&&h("span",{className:"apm-check-text"},label&&h("span",{className:"apm-check-label"},label),description&&h("span",{className:"apm-check-desc"},description)));
}

function Tabs({items=[],value,defaultValue,onChange,className,label}){
  const norm=items.map(o=>typeof o==="string"?{value:o,label:o}:o);
  const [inner,setInner]=useState(defaultValue!=null?defaultValue:(norm[0]&&norm[0].value));
  const cur=value!=null?value:inner;
  const refs=useRef({});
  const [bar,setBar]=useState(null);
  const measure=useCallback(()=>{const el=refs.current[cur];if(el)setBar({x:el.offsetLeft,w:el.offsetWidth});},[cur]);
  useLayoutEffect(()=>{measure();},[measure,items.length]);
  useEffect(()=>{if(!document.fonts||!document.fonts.ready)return;let live=true;document.fonts.ready.then(()=>{if(live)measure();});return()=>{live=false;};},[measure]);
  const onKey=(e)=>{const i=norm.findIndex(o=>o.value===cur);let n=null;if(e.key==="ArrowRight")n=norm[(i+1)%norm.length];if(e.key==="ArrowLeft")n=norm[(i-1+norm.length)%norm.length];if(n){e.preventDefault();if(value==null)setInner(n.value);onChange&&onChange(n.value);refs.current[n.value]&&refs.current[n.value].focus();}};
  return h("div",{className:cx("apm-tabs",className),role:"tablist","aria-label":label,onKeyDown:onKey},
    norm.map(o=>h("button",{key:o.value,type:"button",role:"tab","aria-selected":o.value===cur?"true":"false",tabIndex:o.value===cur?0:-1,ref:(n)=>{refs.current[o.value]=n;},onClick:()=>{if(value==null)setInner(o.value);onChange&&onChange(o.value);}},
      o.icon&&h(Icon,{name:o.icon,size:14}),o.label,o.count!=null&&h("span",{className:"apm-tabs-count"},o.count))),
    bar&&h("span",{className:"apm-tabs-bar",style:{width:bar.w,transform:"translateX("+bar.x+"px)"}}));
}

function Slider({value,defaultValue=16,min=0,max=100,step=1,onChange,label,id,className}){
  const [inner,setInner]=useState(defaultValue);
  const v=value!=null?value:inner;
  const pct=((v-min)/(max-min))*100;
  return h("input",{type:"range",id,className:cx("apm-slider",className),min,max,step,value:v,"aria-label":label,style:{"--pct":pct+"%"},
    onChange:(e)=>{const n=Number(e.target.value);if(value==null)setInner(n);onChange&&onChange(n);}});
}

function Progress({value=0,max=100,tone,indeterminate=false,label,className}){
  const f=Math.max(0,Math.min(1,value/max));
  return h("div",{className:cx("apm-progress",tone&&"is-"+tone,indeterminate&&"is-indeterminate",className),role:"progressbar","aria-label":label,"aria-valuemin":0,"aria-valuemax":max,"aria-valuenow":indeterminate?undefined:value},
    h("i",{style:indeterminate?undefined:{transform:"scaleX("+f+")"}}));
}

const CALLOUT_ICONS={warning:"triangle-alert",danger:"triangle-alert",success:"circle-check",accent:"info",neutral:"info"};
function Callout({tone="neutral",icon,title,children,action,className}){
  return h("div",{className:cx("apm-callout","apm-callout-"+tone,className),role:tone==="danger"?"alert":"note"},
    h(Icon,{name:icon||CALLOUT_ICONS[tone]||"info",size:16}),
    h("div",{className:"apm-callout-text"},title&&h("b",null,title),children&&h("span",null,children)),
    action&&h("div",{className:"apm-callout-action"},action));
}

function EmptyState({icon="search",title,children,action,className}){
  return h("div",{className:cx("apm-empty",className)},
    h("span",{className:"apm-empty-icon"},h(Icon,{name:icon,size:20})),
    title&&h("div",{className:"apm-empty-title"},title),
    children&&h("div",{className:"apm-empty-body"},children),
    action&&h("div",{className:"apm-empty-action"},action));
}

function SettingRow({title,description,icon,children,danger=false,htmlFor,className}){
  return h("div",{className:cx("apm-setting",danger&&"is-danger",className)},
    icon&&h("span",{className:"apm-setting-icon"},h(Icon,{name:icon,size:16})),
    h("div",{className:"apm-setting-text"},h(htmlFor?"label":"div",{className:"apm-setting-title",htmlFor},title),description&&h("div",{className:"apm-setting-desc"},description)),
    children!=null&&h("div",{className:"apm-setting-control"},children));
}

function Avatar({name="",size=24,tone,className}){
  const parts=String(name).trim().split(/\s+/);
  const ini=((parts[0]||"?")[0]+(parts.length>1?parts[parts.length-1][0]:"")).toUpperCase();
  return h("span",{className:cx("apm-avatar",tone&&"is-"+tone,className),style:{width:size,height:size,fontSize:Math.round(size*0.42)},"aria-hidden":true},ini);
}

function CommandMenu({open=true,onClose,groups=[],placeholder="Search items and actions",layer="portal",defaultQuery=""}){
  const [q,setQ]=useState(defaultQuery);
  const [idx,setIdx]=useState(0);
  const listRef=useRef(null);
  useEffect(()=>{if(open){setQ(defaultQuery);setIdx(0);}},[open]);
  useEffect(()=>{setIdx(0);},[q]);
  const needle=q.trim().toLowerCase();
  const score=(it)=>{const s=(it.label+" "+(it.hint||"")+" "+(it.keywords||"")).toLowerCase();if(!needle)return 1;if(it.label.toLowerCase().startsWith(needle))return 3;if(s.includes(needle))return 2;let j=0;for(const c of s){if(c===needle[j])j++;if(j===needle.length)return 1;}return 0;};
  const shown=groups.map(g=>({label:g.label,items:g.items.map(it=>({it,s:score(it)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,needle?(g.limit||8):(g.idleLimit||g.limit||6)).map(x=>x.it)})).filter(g=>g.items.length);
  const flat=shown.flatMap(g=>g.items);
  useEffect(()=>{const el=listRef.current&&listRef.current.querySelector('[data-active="true"]');el&&el.scrollIntoView({block:"nearest"});},[idx,q]);
  const run=(it)=>{if(!it)return;onClose&&onClose();it.onSelect&&setTimeout(()=>it.onSelect(),0);};
  const key=(e)=>{
    if(e.key==="ArrowDown"){e.preventDefault();setIdx(i=>Math.min(flat.length-1,i+1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setIdx(i=>Math.max(0,i-1));}
    else if(e.key==="Enter"){e.preventDefault();run(flat[idx]);}
  };
  let n=-1;
  return h(Dialog,{open,onClose,size:"cmd",layer,className:"apm-cmd"},
    h("div",{className:"apm-cmd-search"},h(Icon,{name:"search",size:18}),
      h("input",{value:q,onChange:(e)=>setQ(e.target.value),onKeyDown:key,placeholder,"data-autofocus":true,spellCheck:false,"aria-label":placeholder,role:"combobox","aria-expanded":"true"}),
      h(Kbd,{keys:["Esc"]})),
    h("div",{className:"apm-cmd-list",ref:listRef,role:"listbox"},
      flat.length===0?h("div",{className:"apm-cmd-none"},"No results for \u201c"+q+"\u201d"):
      shown.map(g=>h("div",{key:g.label,className:"apm-cmd-group",role:"group","aria-label":g.label},
        h("div",{className:"apm-cmd-glabel"},g.label),
        g.items.map(it=>{n++;const i=n;const act=i===idx;
          return h("div",{key:(it.id||it.label)+i,role:"option","aria-selected":act?"true":"false","data-active":act?"true":"false",className:"apm-cmd-item",onMouseMove:()=>{if(idx!==i)setIdx(i);},onClick:()=>run(it)},
            it.tile?h(ItemIcon,Object.assign({size:"sm"},it.tile)):h("span",{className:"apm-cmd-ic"},h(Icon,{name:it.icon||"arrow-right",size:15})),
            h("span",{className:"apm-cmd-label"},it.label),
            it.hint&&h("span",{className:"apm-cmd-hint"},it.hint),
            it.kbd?h(Kbd,{keys:Array.isArray(it.kbd)?it.kbd:String(it.kbd).split(/\s+/)}):(act&&h(Icon,{name:"arrow-right",size:14,className:"apm-cmd-go"})));})))),
    h("div",{className:"apm-cmd-foot"},
      h("span",null,h(Kbd,{keys:["\u2191","\u2193"]}),"Navigate"),
      h("span",null,h(Kbd,{keys:["\u21b5"]}),"Open"),
      h("span",{style:{marginLeft:"auto"}},h(Mark,{size:14}),"APM")));
}

function fmtBytes(n){if(n==null||n==="")return "";n=Number(n);return n<1024?n+" B":n<1048576?Math.round(n/1024)+" KB":(n/1048576).toFixed(1)+" MB";}

function FileDrop({file,title="Drop a file here or choose one",hint,icon,busy=false,disabled=false,accept,onChoose,onDrop,className}){
  const [over,setOver]=useState(false);
  const depth=useRef(0);
  const inert=disabled||busy;
  const pick=()=>{if(!inert&&onChoose)onChoose();};
  const detail=file?(file.detail!=null?file.detail:[fmtBytes(file.size),"click to choose another"].filter(Boolean).join(" · ")):hint;
  return h("div",{className:cx("apm-drop",over&&"is-over",file&&"has-file",busy&&"is-busy",disabled&&"is-disabled",className),role:"button",tabIndex:inert?-1:0,"aria-disabled":inert||undefined,"aria-busy":busy||undefined,
    onClick:pick,
    onKeyDown:(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}},
    onDragEnter:(e)=>{if(inert)return;e.preventDefault();depth.current++;setOver(true);},
    onDragOver:(e)=>{if(inert)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect="copy";},
    onDragLeave:()=>{depth.current=Math.max(0,depth.current-1);if(!depth.current)setOver(false);},
    onDrop:(e)=>{e.preventDefault();depth.current=0;setOver(false);if(inert)return;const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f&&(!accept||accepts(f,accept)))onDrop&&onDrop(f);}},
    h("span",{className:"apm-drop-icon"},busy?h(Spinner,{size:16}):h(Icon,{name:icon||(file?"file":"upload"),size:18})),
    h("span",{className:"apm-drop-text"},h("b",null,file?file.name:title),detail&&h("span",null,detail)));
}
function accepts(f,accept){
  const list=String(accept).split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!list.length)return true;
  const n=(f.name||"").toLowerCase(),t=(f.type||"").toLowerCase();
  return list.some(a=>a==="*"||(a.startsWith(".")?n.endsWith(a):a.endsWith("/*")?t.startsWith(a.slice(0,-1)):t===a));
}

function Stepper({items=[],value,onChange,label="Progress",layout="inline",className}){
  const norm=items.map(o=>typeof o==="string"?{value:o,label:o}:o);
  const cur=Math.max(0,norm.findIndex(o=>o.value===value));
  return h("ol",{className:cx("apm-steps",layout==="spread"&&"is-spread",className),"aria-label":label},
    norm.map((o,i)=>{
      const state=i<cur?"done":i===cur?"current":"todo";
      const inner=[h("span",{key:"n",className:"apm-steps-dot","aria-hidden":true},state==="done"?h(Icon,{name:"check",size:12,strokeWidth:2.5}):i+1),h("span",{key:"l",className:"apm-steps-label"},o.label)];
      return h("li",{key:o.value,className:cx("apm-steps-item","is-"+state),"aria-current":state==="current"?"step":undefined},
        state==="done"&&onChange?h("button",{type:"button",onClick:()=>onChange(o.value)},inner):h("span",{className:"apm-steps-static"},inner),
        i<norm.length-1&&h("span",{className:"apm-steps-line","aria-hidden":true}));
    }));
}

function StatGroup({items=[],label,className}){
  return h("div",{className:cx("apm-stats",className),role:"group","aria-label":label},
    items.map((s,i)=>{
      const kids=[h("span",{key:"v",className:"apm-stat-value"},s.icon&&h(Icon,{name:s.icon,size:14}),s.value),h("span",{key:"l",className:"apm-stat-label"},s.label)];
      const cls=cx("apm-stat",s.tone&&"is-"+s.tone,s.active&&"is-active",s.onClick&&"is-button");
      return s.onClick?h("button",{key:s.key||s.label||i,type:"button",className:cls,"aria-pressed":s.active?"true":"false",onClick:s.onClick},kids):h("div",{key:s.key||s.label||i,className:cls},kids);
    }));
}

const MASK="••••••••";
function CompareTable({columns={left:"Current",right:"Incoming"},rows=[],className,revealAll=false}){
  const [shown,setShown]=useState({});
  const cell=(r,side,v)=>{
    const empty=v==null||v==="";
    if(empty)return h("span",{className:"apm-cmp-empty"},"—");
    const masked=r.secret&&!(revealAll||shown[r.key]);
    return h("span",{className:cx("apm-cmp-val",(r.mono||r.secret)&&"is-mono",masked&&"is-masked")},masked?MASK:String(v));
  };
  const hasSecret=rows.some(r=>r.secret);
  return h("div",{className:cx("apm-cmp",className),role:"table"},
    h("div",{className:"apm-cmp-row is-head",role:"row"},h("span",{role:"columnheader"},"Field"),h("span",{role:"columnheader"},columns.left),h("span",{role:"columnheader"},columns.right),hasSecret&&h("span",{"aria-hidden":true})),
    rows.map(r=>h("div",{key:r.key,className:cx("apm-cmp-row",r.kind&&r.kind!=="same"&&"is-"+r.kind),role:"row"},
      h("span",{className:"apm-cmp-label",role:"rowheader"},r.label,r.kind&&r.kind!=="same"&&h("span",{className:"apm-cmp-kind"},{changed:"Changed",added:"Added",removed:"Removed"}[r.kind]||"")),
      h("span",{role:"cell"},cell(r,"left",r.left)),
      h("span",{role:"cell"},cell(r,"right",r.right)),
      hasSecret&&h("span",{className:"apm-cmp-act"},r.secret&&!revealAll&&h(IconButton,{icon:shown[r.key]?"eye-off":"eye",size:"xs",label:(shown[r.key]?"Hide ":"Show ")+String(r.label).toLowerCase(),onClick:()=>setShown(Object.assign({},shown,{[r.key]:!shown[r.key]}))})))));
}

function ChoiceGroup({value,onChange,label,columns,compact=false,children,className}){
  const ref=useRef(null);
  const onKey=(e)=>{
    if(!["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].includes(e.key))return;
    const els=Array.from(ref.current.querySelectorAll('[role="radio"]:not([aria-disabled="true"])'));
    const i=els.indexOf(document.activeElement);if(i<0)return;
    e.preventDefault();
    const n=els[(i+(e.key==="ArrowRight"||e.key==="ArrowDown"?1:-1)+els.length)%els.length];
    n.focus();n.click();
  };
  const all=React.Children.toArray(children);
  const sel=(c)=>c.props.selected!=null?c.props.selected:value===c.props.value;
  const any=all.some(c=>c&&c.type===ChoiceTile&&sel(c));
  const first=all.findIndex(c=>c&&c.type===ChoiceTile&&!c.props.disabled);
  const kids=all.map((c,i)=>c&&c.type===ChoiceTile?React.cloneElement(c,{selected:sel(c),onSelect:c.props.onSelect||c.props.onClick||(()=>onChange&&onChange(c.props.value)),_group:true,_tab:sel(c)||(!any&&i===first)}):c);
  return h("div",{ref,className:cx("apm-choices",compact&&"is-compact",className),role:"radiogroup","aria-label":label,onKeyDown:onKey,style:columns?{"--cols":columns}:undefined},kids);
}

function ChoiceTile({value,icon,tile,leading,title,badge,description,meta,trailing,children,selected=false,disabled=false,arrow=false,variant="tile",compact=false,onSelect,onClick,className,_group,_tab}){
  const list=variant==="list";
  const go=onSelect||onClick;
  const lead=leading!=null?leading:tile?h(ItemIcon,Object.assign({size:"md"},tile)):icon&&h("span",{className:"apm-choice-icon"},h(Icon,{name:icon,size:list?18:16}));
  return h("button",{type:"button",role:_group?"radio":undefined,"aria-checked":_group?(selected?"true":"false"):undefined,"aria-pressed":_group||arrow?undefined:(selected?"true":"false"),"aria-disabled":disabled||undefined,disabled,tabIndex:_group&&!_tab?-1:0,
    className:cx("apm-choice",list&&"is-list",compact&&"is-compact",arrow&&"is-arrow",selected&&"is-selected",disabled&&"is-disabled",className),onClick:()=>{if(!disabled&&go)go(value);}},
    lead,
    h("span",{className:"apm-choice-text"},h("span",{className:cx("apm-choice-title",badge&&"has-badge")},title,badge),description&&h("span",{className:"apm-choice-desc"},description),meta&&h("span",{className:"apm-choice-meta"},meta),children),
    trailing,
    arrow?h(Icon,{name:"chevron-right",size:16,className:"apm-choice-arrow"}):h("span",{className:"apm-choice-mark","aria-hidden":true},selected&&h(Icon,{name:"check",size:12,strokeWidth:2.75})));
}

function ReviewRow({checked,onCheck,disabled=false,name,letter,icon,src,solid,title,subtitle,badges,trailing,tone,expanded=false,onToggle,children,className}){
  const fid="apm-rv-"+safeId(useId());
  const canExpand=!!(onToggle&&children!=null&&children!==false);
  return h("div",{className:cx("apm-review",tone&&"is-"+tone,expanded&&"is-expanded",disabled&&"is-disabled",className)},
    h("div",{className:"apm-review-main"},
      onCheck!==undefined&&h("label",{className:"apm-check apm-review-check",htmlFor:fid},
        h("input",{type:"checkbox",id:fid,checked:!!checked,disabled,onChange:(e)=>onCheck&&onCheck(e.target.checked),"aria-label":"Include "+title}),
        h("span",{className:"apm-check-box","aria-hidden":true},h(Icon,{name:"check",size:12,strokeWidth:2.75}))),
      h(ItemIcon,{name:name!=null?name:title,letter,icon,src,solid,size:"sm"}),
      h(canExpand?"button":"span",Object.assign({className:"apm-review-text"},canExpand?{type:"button",onClick:onToggle,"aria-expanded":expanded?"true":"false"}:{}),
        h("span",{className:"apm-review-title"},title),subtitle&&h("span",{className:"apm-review-sub"},subtitle)),
      badges&&h("span",{className:"apm-review-badges"},badges),
      trailing&&h("span",{className:"apm-review-trail"},trailing),
      canExpand?h(IconButton,{icon:expanded?"chevron-up":"chevron-down",size:"xs",label:expanded?"Hide details":"Show details",onClick:onToggle,tip:false}):(trailing||badges)&&h("span",{className:"apm-review-spacer","aria-hidden":true})),
    expanded&&canExpand&&h("div",{className:"apm-review-body"},children));
}

function PageHeader({title,description,actions,badge,size="md",children,className}){
  return h("header",{className:cx("apm-page-head",size==="lg"&&"is-lg",className)},
    h("div",{className:"apm-page-head-text"},
      h("h1",{className:"apm-page-head-title"},title,badge),
      description&&h("p",{className:"apm-page-head-desc"},description),
      children!=null&&children!==false&&h("div",{className:"apm-page-head-extra"},children)),
    actions&&h("div",{className:"apm-page-head-actions"},actions));
}

function Card({title,description,actions,footer,footNote,danger=false,flush=false,id,className,style,children}){
  return h("section",{className:cx("apm-card",danger&&"is-danger",className),id,style},
    (title||actions)&&h("div",{className:"apm-card-head"},
      h("div",{className:"apm-card-head-text"},title&&h("h3",{className:"apm-card-title"},title),description&&h("p",{className:"apm-card-desc"},description)),
      actions&&h("div",{className:"apm-card-actions"},actions)),
    children!=null&&h("div",{className:cx("apm-card-body",flush&&"is-flush")},children),
    (footer||footNote)&&h("div",{className:"apm-card-foot"},
      h("span",{className:"apm-card-foot-note"},footNote),
      footer&&h("div",{className:"apm-card-foot-actions"},footer)));
}

function KeyValueList({children,className,style}){
  return h("div",{className:cx("apm-kvs",className),style},children);
}

function KeyValue({label,mono=false,copy,children,className}){
  return h("div",{className:cx("apm-kv",className)},
    h("div",{className:"apm-kv-label"},label),
    h("div",{className:cx("apm-kv-value",mono&&"is-mono")},children),
    copy!=null&&copy!==false&&h(IconButton,{icon:"copy",label:"Copy "+String(label).toLowerCase(),size:"xs",onClick:()=>copyText(copy)}));
}

function Status({tone="neutral",pulse=false,children,className}){
  return h("span",{className:cx("apm-status",tone&&tone!=="neutral"&&"is-"+tone,className)},
    h("i",{className:cx("apm-status-dot",pulse&&"is-pulse"),"aria-hidden":true}),children);
}

function Chip({selected,icon,disabled=false,onClick,children,className,title}){
  return h("button",{type:"button",className:cx("apm-chip",selected&&"is-selected",className),"aria-pressed":selected==null?undefined:(selected?"true":"false"),disabled,onClick,title},
    icon&&h(Icon,{name:icon,size:14}),children);
}

function CodeBlock({children,label,copy,wrap=false,maxHeight,className}){
  const [done,setDone]=useState(false);
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const canCopy=copy!==false;
  const doCopy=()=>{copyText(typeof copy==="string"?copy:String(children));setDone(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setDone(false),1400);};
  return h("div",{className:cx("apm-codeblock",className)},
    (label||canCopy)&&h("div",{className:"apm-codeblock-head"},h("span",null,label),
      canCopy&&h(Button,{variant:"ghost",size:"sm",icon:done?"check":"copy",onClick:doCopy},done?"Copied":"Copy")),
    h("pre",{className:cx("apm-codeblock-pre",wrap&&"is-wrap"),style:maxHeight?{maxHeight}:undefined},children));
}

function StepList({items=[],className}){
  return h("ol",{className:cx("apm-steplist",className)},
    items.map((x,i)=>h("li",{key:i},h("span",{className:"apm-steplist-n","aria-hidden":true},i+1),h("div",{className:"apm-steplist-body"},x))));
}

function Meter({value=0,max=100,tone,size=120,stroke=10,label,sub,className}){
  const r=(size-stroke)/2,C=2*Math.PI*r;
  const [shown,setShown]=useState(0);
  useEffect(()=>{const t=requestAnimationFrame(()=>setShown(value));return()=>cancelAnimationFrame(t);},[value]);
  const f=Math.max(0,Math.min(1,shown/max));
  return h("div",{className:cx("apm-meter",tone&&tone!=="neutral"&&"is-"+tone,className),style:{width:size,height:size},role:"meter","aria-valuemin":0,"aria-valuemax":max,"aria-valuenow":value},
    h("svg",{width:size,height:size,viewBox:"0 0 "+size+" "+size,"aria-hidden":true},
      h("circle",{className:"apm-meter-track",cx:size/2,cy:size/2,r,strokeWidth:stroke,fill:"none"}),
      h("circle",{className:"apm-meter-arc",cx:size/2,cy:size/2,r,strokeWidth:stroke,fill:"none",strokeLinecap:"round",strokeDasharray:C,strokeDashoffset:C*(1-f)})),
    h("div",{className:"apm-meter-center"},h("span",{className:"apm-meter-value"},label!=null?label:value),sub&&h("span",{className:"apm-meter-sub"},sub)));
}

const APM={Icon,Mark,Spinner,Kbd,Command,Button,IconButton,Tooltip,Input,PasswordInput,SearchField,Select,Textarea,Checkbox,Switch,SegmentedControl,Tabs,Slider,Badge,ItemIcon,Avatar,NavItem,ItemRow,FieldGroup,SecretField,SettingRow,TotpCode,StrengthMeter,Progress,Callout,EmptyState,Toast,Dialog,Menu,MenuList,CommandMenu,FileDrop,Stepper,StatGroup,CompareTable,ChoiceGroup,ChoiceTile,ReviewRow,Hint,PageHeader,Card,KeyValueList,KeyValue,Status,Chip,CodeBlock,StepList,Meter,icons:Object.keys(ICONS),totp,copyText};
window.APM=Object.assign(window.APM||{},APM);
})();
