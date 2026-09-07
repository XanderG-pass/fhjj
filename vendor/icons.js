// Lucide icon data, ISC license. See vendor/LICENSE-lucide.
(() => {
  const icons = {"arrow-left":[["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],"arrow-right":[["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],"arrow-up":[["path",{"d":"m5 12 7-7 7 7"}],["path",{"d":"M12 19V5"}]],"arrow-down":[["path",{"d":"M12 5v14"}],["path",{"d":"m19 12-7 7-7-7"}]],"arrow-up-right":[["path",{"d":"M7 7h10v10"}],["path",{"d":"M7 17 17 7"}]],"rotate-ccw":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]],"play":[["path",{"d":"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"}]],"skip-forward":[["path",{"d":"M21 4v16"}],["path",{"d":"M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"}]],"volume-x":[["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["line",{"x1":"22","x2":"16","y1":"9","y2":"15"}],["line",{"x1":"16","x2":"22","y1":"9","y2":"15"}]],"volume-2":[["path",{"d":"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"}],["path",{"d":"M16 9a5 5 0 0 1 0 6"}],["path",{"d":"M19.364 18.364a9 9 0 0 0 0-12.728"}]],"vibrate":[["path",{"d":"m2 8 2 2-2 2 2 2-2 2"}],["path",{"d":"m22 8-2 2 2 2-2 2 2 2"}],["rect",{"width":"8","height":"14","x":"8","y":"5","rx":"1"}]],"message-circle":[["path",{"d":"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"}]],"send":[["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]]};
  window.FHJJ_ICONS = { render(root = document) {
    root.querySelectorAll("[data-lucide]").forEach((node) => {
      const data = icons[node.dataset.lucide];
      if (!data) return;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      for (const [key, value] of Object.entries({viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", "stroke-linecap":"round", "stroke-linejoin":"round", "aria-hidden":"true"})) svg.setAttribute(key,value);
      data.forEach(([tag, attrs]) => {
        const child = document.createElementNS(svg.namespaceURI, tag);
        Object.entries(attrs).forEach(([key,value]) => child.setAttribute(key,value));
        svg.append(child);
      });
      node.replaceWith(svg);
    });
  }};
})();
