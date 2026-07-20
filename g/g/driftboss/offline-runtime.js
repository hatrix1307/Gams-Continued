(function () {
  "use strict";

  var assets = window.DRIFT_ASSETS || {};
  var completed = Object.create(null);
  var requested = Object.create(null);
  var criticalTotal = Object.keys(assets).filter(function (key) {
    return key === "media/scenes/game-scene.babylon" ||
      key.indexOf("media/scenes/") === 0;
  }).length;

  function assetRequested(key) {
    if (!key || requested[key] || key.indexOf("media/scenes/") !== 0) return;
    requested[key] = true;
    var count = Object.keys(requested).length;
    if (window.DRIFT_LOADING_PROGRESS) {
      window.DRIFT_LOADING_PROGRESS(60 + (count / criticalTotal) * 16, "Preparing game resources…");
    }
  }

  function assetComplete(key) {
    if (!key || completed[key] || key.indexOf("media/scenes/") !== 0) return;
    completed[key] = true;
    var count = Object.keys(completed).length;
    var percent = criticalTotal ? 76 + (count / criticalTotal) * 24 : 100;
    if (window.DRIFT_LOADING_PROGRESS) {
      window.DRIFT_LOADING_PROGRESS(percent, "Loading game resources…");
    }
    if (count >= criticalTotal) {
      var overlay = document.getElementById("offlineLoading");
      if (overlay) {
        overlay.classList.add("done");
        setTimeout(function () { overlay.remove(); }, 350);
      }
    }
  }

  function assetKey(value) {
    if (typeof value !== "string" || /^(?:data|blob):/i.test(value)) return null;
    var clean = value.split("#", 1)[0].split("?", 1)[0].replace(/\\/g, "/");
    try { clean = decodeURIComponent(clean); } catch (_) {}
    var marker = "/driftboss/";
    var originalMarker = "/game/owner/drift-boss-gm/";
    var index = clean.toLowerCase().lastIndexOf(marker);
    if (index >= 0) clean = clean.slice(index + marker.length);
    index = clean.toLowerCase().lastIndexOf(originalMarker);
    if (index >= 0) clean = clean.slice(index + originalMarker.length);
    clean = clean.replace(/^(?:\.\/|\/)+/, "");
    return Object.prototype.hasOwnProperty.call(assets, clean) ? clean : null;
  }

  function localUrl(value) {
    var key = assetKey(value);
    if (!key) return value;
    var asset = assets[key];
    return "data:" + (asset.mime || "application/octet-stream") + ";base64," + asset.data;
  }

  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var key = assetKey(String(url));
    if (key) {
      assetRequested(key);
      this.addEventListener("loadend", function () { assetComplete(key); }, { once: true });
    }
    arguments[1] = localUrl(String(url));
    return nativeOpen.apply(this, arguments);
  };

  // Babylon loads scene textures through HTMLImageElement with
  // crossOrigin="anonymous". Chrome rejects those file: URLs because each
  // local file has an opaque origin, so substitute the captured data before
  // the browser starts the image request.
  var imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (imageSrc && imageSrc.get && imageSrc.set) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: imageSrc.configurable,
      enumerable: imageSrc.enumerable,
      get: imageSrc.get,
      set: function (value) {
        var key = assetKey(String(value));
        if (key) {
          assetRequested(key);
          this.addEventListener("load", function () { assetComplete(key); }, { once: true });
        }
        imageSrc.set.call(this, localUrl(String(value)));
      }
    });
  }

  var nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (this instanceof HTMLImageElement && String(name).toLowerCase() === "src") {
      var key = assetKey(String(value));
      if (key) {
        assetRequested(key);
        this.addEventListener("load", function () { assetComplete(key); }, { once: true });
      }
      value = localUrl(String(value));
    }
    return nativeSetAttribute.call(this, name, value);
  };

  var nativeFetch = window.fetch && window.fetch.bind(window);
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url;
      if (url && /(?:^|\/)null\.html\?/i.test(url)) {
        return Promise.resolve(new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }));
      }
      var replacement = url && localUrl(url);
      return nativeFetch(replacement !== url ? replacement : input, init);
    };
  }

  window.DRIFT_ASSET_URL = localUrl;
  if (!criticalTotal) assetComplete(null);
})();
