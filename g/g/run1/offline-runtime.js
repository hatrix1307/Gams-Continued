(function () {
  "use strict";

  var assets = window.RUN1_ASSETS || {};

  function assetKey(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (!raw || /^(data|blob):/i.test(raw)) return null;
    try {
      var path = decodeURIComponent(new URL(raw, location.href).pathname).replace(/\\/g, "/");
      var gameMarker = "/run1/";
      var sourceMarker = "/public_games/35975/";
      var index = path.toLowerCase().lastIndexOf(gameMarker);
      if (index >= 0) return path.slice(index + gameMarker.length);
      index = path.toLowerCase().lastIndexOf(sourceMarker);
      if (index >= 0) return path.slice(index + sourceMarker.length);
    } catch (error) {}
    return raw.replace(/^\.\//, "").split(/[?#]/)[0];
  }

  function lookup(value) {
    var key = assetKey(value);
    return key && assets[key] ? assets[key] : null;
  }

  function bytes(entry) {
    var binary = atob(entry.data);
    var result = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
    return result;
  }

  function dataUrl(entry) {
    return "data:" + entry.mime + ";base64," + entry.data;
  }

  function installMediaSourceShim(prototype) {
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

  installMediaSourceShim(window.HTMLImageElement && HTMLImageElement.prototype);
  installMediaSourceShim(window.HTMLAudioElement && HTMLAudioElement.prototype);
  installMediaSourceShim(window.HTMLSourceElement && HTMLSourceElement.prototype);

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
      if (entry) {
        return Promise.resolve(new Response(bytes(entry), {
          status: 200,
          headers: { "Content-Type": entry.mime }
        }));
      }
      return nativeFetch(input, init);
    };
  }

  var fonts = [
    ["Gudea Italic", "assets/ui/font/Gudea_Italic.woff", "italic", "normal"],
    ["Gudea Bold", "assets/ui/font/Gudea_Bold.woff", "normal", "bold"],
    ["Nova Slim", "assets/ui/font/Nova_Slim_Book.woff", "normal", "normal"],
    ["Gudea", "assets/ui/font/Gudea_Regular.woff", "normal", "normal"]
  ];
  var style = document.createElement("style");
  style.textContent = fonts.map(function (font) {
    var entry = assets[font[1]];
    return entry ? "@font-face{font-family:'" + font[0] + "';src:url(" + dataUrl(entry) + ") format('woff');font-style:" + font[2] + ";font-weight:" + font[3] + ";}" : "";
  }).join("\n");
  document.head.appendChild(style);
})();
