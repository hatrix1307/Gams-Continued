(function () {
  "use strict";

  var assets = window.RUN2_ASSETS || {};

  // AwayFL creates WebAudio before Chrome grants autoplay permission. Track
  // every context it creates and resume them on the player's first gesture.
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  var audioContexts = [];
  if (NativeAudioContext && window.Proxy) {
    var TrackedAudioContext = new Proxy(NativeAudioContext, {
      construct: function (Target, args) {
        var context = Reflect.construct(Target, args);
        audioContexts.push(context);
        return context;
      }
    });
    window.AudioContext = TrackedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = TrackedAudioContext;
  }
  function resumeAudio() {
    audioContexts.forEach(function (context) {
      if (context.state === "suspended") context.resume().catch(function () {});
    });
  }
  window.addEventListener("pointerdown", resumeAudio, true);
  window.addEventListener("keydown", resumeAudio, true);

  function keyFor(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (!raw || /^(data|blob):/i.test(raw)) return null;
    try {
      var path = decodeURIComponent(new URL(raw, location.href).pathname).replace(/\\/g, "/");
      var markers = ["/run2/", "/public_games/51503/"];
      for (var i = 0; i < markers.length; i++) {
        var at = path.toLowerCase().lastIndexOf(markers[i]);
        if (at >= 0) return path.slice(at + markers[i].length).replace(/^\//, "");
      }
    } catch (error) {}
    return raw.replace(/^\.\//, "").split(/[?#]/)[0].replace(/^\//, "");
  }

  function find(value) {
    var key = keyFor(value);
    if (!key) return null;
    if (assets[key]) return assets[key];
    if (key.indexOf("assets/builtins/") < 0 && assets["assets/builtins/" + key]) {
      return assets["assets/builtins/" + key];
    }
    return null;
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

  // The Coolmath build contains sponsor links that use Flash's
  // navigateToURL/getURL calls. AwayFL translates those calls to window.open,
  // including `_self`, which replaces the locally loaded game. Keep internal
  // and generated URLs working, but suppress external sponsor navigation.
  var nativeWindowOpen = window.open && window.open.bind(window);
  window.open = function (url, target, features) {
    var value = String(url || "");
    if (/^https?:\/\//i.test(value)) {
      console.info("Blocked external game navigation:", value);
      return null;
    }
    return nativeWindowOpen ? nativeWindowOpen(value, target, features) : null;
  };

  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var entry = find(url);
    if (entry) arguments[1] = dataUrl(entry);
    return nativeOpen.apply(this, arguments);
  };

  var nativeFetch = window.fetch && window.fetch.bind(window);
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var entry = find(input);
      if (entry) {
        return Promise.resolve(new Response(bytes(entry), {
          status: 200,
          headers: {
            "Content-Type": entry.mime,
            "Content-Length": String(entry.size)
          }
        }));
      }
      return nativeFetch(input, init);
    };
  }
})();
