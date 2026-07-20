(function () {
  "use strict";

  var files = {
    data: ["data-00.js","data-01.js","data-02.js","data-03.js","data-04.js","data-05.js","data-06.js","data-07.js","data-08.js","data-09.js","data-10.js","data-11.js","data-12.js","data-13.js","data-14.js","data-15.js"],
    wasm: ["wasm-00.js","wasm-01.js","wasm-02.js","wasm-03.js"],
    framework: ["framework-00.js"]
  };

  function loadScript(file) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "offline-parts/" + file;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Could not load " + file)); };
      document.head.appendChild(script);
    });
  }

  function decodeParts(parts) {
    return parts.map(function (part) {
      var binary = atob(part);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    });
  }

  async function inflate(parts, type) {
    var compressed = new Blob(decodeParts(parts));
    var stream = compressed.stream().pipeThrough(new DecompressionStream("gzip"));
    var blob = await new Response(stream).blob();
    return URL.createObjectURL(new Blob([blob], { type: type }));
  }

  window.prepareCrossyRoadFiles = async function (config, progress) {
    if (location.protocol !== "file:") return config;
    window.CROSSY_PARTS = {};
    var queue = files.data.concat(files.wasm, files.framework);
    for (var i = 0; i < queue.length; i++) {
      await loadScript(queue[i]);
      if (progress) progress((i + 1) / queue.length * 0.32);
    }
    config.dataUrl = await inflate(window.CROSSY_PARTS.data, "application/octet-stream");
    if (progress) progress(0.36);
    config.codeUrl = await inflate(window.CROSSY_PARTS.wasm, "application/wasm");
    if (progress) progress(0.40);
    config.frameworkUrl = await inflate(window.CROSSY_PARTS.framework, "application/javascript");
    window.CROSSY_PARTS = null;
    return config;
  };
})();
