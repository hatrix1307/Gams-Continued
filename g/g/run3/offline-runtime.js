(function () {
  "use strict";
  var assets = window.RUN3_ASSETS || {};

  // Chromium's OTS parser rejects the site's old Permanent Marker WOFF even
  // though other font parsers accept it. Serve the captured TTF for both URLs.
  if (assets["font/PERMANENTMARKER.TTF"]) {
    assets["font/PERMANENTMARKER.woff"] = assets["font/PERMANENTMARKER.TTF"];
  }

  function keyFor(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (!raw || /^(data|blob):/i.test(raw)) return null;
    try {
      var path = decodeURIComponent(new URL(raw, location.href).pathname).replace(/\\/g, "/");
      var markers = ["/run3/", "/public_games/49436/"];
      for (var i = 0; i < markers.length; i++) {
        var at = path.toLowerCase().lastIndexOf(markers[i]);
        if (at >= 0) return path.slice(at + markers[i].length).replace(/^\//, "");
      }
    } catch (error) {}
    return raw.replace(/^\.\//, "").split(/[?#]/)[0].replace(/^\//, "");
  }

  function lookup(value) {
    var key = keyFor(value);
    return key && (assets[key] || assets["img/" + key] || assets["text/" + key] || null);
  }

  function bytes(entry) {
    var binary = atob(entry.data);
    var result = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
    return result;
  }

  function dataUrl(entry) { return "data:" + entry.mime + ";base64," + entry.data; }

  // CSS font requests are made before the normal asset loaders run. Inject the
  // captured fonts as data URLs so they also work when the site is opened with
  // the file: protocol.
  var fontRules = [
    ["Comfortaa", "font/Comfortaa.woff", "normal"],
    ["Comfortaa Bold", "font/COMFORTAA-BOLD.woff", "normal"],
    ["Permanent Marker", "font/PERMANENTMARKER.TTF", "normal"]
  ];
  var fontCss = "";
  for (var fontIndex = 0; fontIndex < fontRules.length; fontIndex++) {
    var font = fontRules[fontIndex];
    var fontEntry = assets[font[1]];
    if (fontEntry) fontCss += "@font-face{font-family:'" + font[0] + "';src:url('" + dataUrl(fontEntry) + "');font-weight:" + font[2] + ";font-style:normal;}";
  }
  if (fontCss) {
    var fontStyle = document.createElement("style");
    fontStyle.textContent = fontCss;
    document.head.appendChild(fontStyle);
  }

  function shimSource(prototype) {
    if (!prototype) return;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, "src");
    if (!descriptor || !descriptor.get || !descriptor.set) return;
    Object.defineProperty(prototype, "src", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (value) {
        var entry = lookup(value);
        return descriptor.set.call(this, entry ? dataUrl(entry) : value);
      }
    });
  }

  shimSource(window.HTMLImageElement && HTMLImageElement.prototype);
  shimSource(window.HTMLAudioElement && HTMLAudioElement.prototype);
  shimSource(window.HTMLSourceElement && HTMLSourceElement.prototype);

  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var entry = lookup(url);
    if (entry) arguments[1] = dataUrl(entry);
    return nativeOpen.apply(this, arguments);
  };

  var nativeFetch = window.fetch && window.fetch.bind(window);
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var entry = lookup(input);
      if (entry) return Promise.resolve(new Response(bytes(entry), { status: 200, headers: { "Content-Type": entry.mime } }));
      return nativeFetch(input, init);
    };
  }
})();
