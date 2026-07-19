(function () {
  "use strict";

  var assets = window.__POLYTRACK_ASSETS__ || {};
  var NativeXHR = window.XMLHttpRequest;
  var NativeWorker = window.Worker;
  var NativeFontFace = window.FontFace;
  var imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");

  // The browser's audio decoder does not settle for these captured audio files
  // when PolyTrack is opened offline. PolyTrack already supports running without
  // an AudioContext; using that path lets all startup resources finish and keeps
  // the simulation worker initialization in the correct order.
  try { window.AudioContext = undefined; } catch (error) {}
  try { window.webkitAudioContext = undefined; } catch (error) {}
  function keyFor(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (!raw || /^(?:data|blob):/i.test(raw)) return null;
    raw = raw.replace(/\\/g, "/").split(/[?#]/)[0];
    var marker = "/polytrack/";
    var index = raw.toLowerCase().lastIndexOf(marker);
    if (index >= 0) raw = raw.slice(index + marker.length);
    return raw.replace(/^\.\//, "");
  }

  function find(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (raw && /^https:\/\/vps\.kodub\.com\/v6\/user(?:\?|$)/i.test(raw)) {
      return { mime: "application/json", size: 4, data: "bnVsbA==" };
    }
    var key = keyFor(value);
    return key && assets[key] ? assets[key] : null;
  }

  function bytes(asset) {
    var binary = atob(asset.data);
    var result = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
    return result;
  }

  function text(asset) {
    return new TextDecoder().decode(bytes(asset));
  }

  function dataUrl(asset) {
    return "data:" + asset.mime + ";base64," + asset.data;
  }

  if (window.fetch) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var asset = find(input);
      if (!asset) return nativeFetch(input, init);
      return Promise.resolve(new Response(bytes(asset), {
        status: 200,
        headers: {
          "Content-Type": asset.mime,
          "Content-Length": String(asset.size)
        }
      }));
    };
  }

  function OfflineXHR() {
    this._native = null;
    this._asset = null;
    this._listeners = {};
    this.readyState = 0;
    this.status = 0;
    this.statusText = "";
    this.responseType = "";
    this.response = null;
    this.responseText = "";
  }

  OfflineXHR.prototype.open = function (method, url, async, user, password) {
    this._asset = find(url);
    if (!this._asset) {
      this._native = new NativeXHR();
      this._native.open(method, url, async !== false, user, password);
      return;
    }
    this.readyState = 1;
    this._emit("readystatechange");
  };

  OfflineXHR.prototype.send = function (body) {
    var self = this;
    if (this._native) {
      this._forwardNative();
      this._native.responseType = this.responseType;
      this._native.send(body);
      return;
    }
    setTimeout(function () {
      var content = bytes(self._asset);
      self.status = 200;
      self.statusText = "OK";
      self.readyState = 4;
      if (self.responseType === "arraybuffer") self.response = content.buffer;
      else if (self.responseType === "blob") self.response = new Blob([content], { type: self._asset.mime });
      else {
        self.responseText = new TextDecoder().decode(content);
        self.response = self.responseText;
      }
      self._emit("progress", { loaded: content.length, total: content.length, lengthComputable: true });
      self._emit("readystatechange");
      self._emit("load");
      self._emit("loadend");
    }, 0);
  };

  OfflineXHR.prototype.abort = function () { if (this._native) this._native.abort(); };
  OfflineXHR.prototype.overrideMimeType = function (type) { if (this._native) this._native.overrideMimeType(type); };
  OfflineXHR.prototype.setRequestHeader = function (name, value) { if (this._native) this._native.setRequestHeader(name, value); };
  OfflineXHR.prototype.getResponseHeader = function (name) {
    if (this._native) return this._native.getResponseHeader(name);
    if (!this._asset) return null;
    name = name.toLowerCase();
    if (name === "content-type") return this._asset.mime;
    if (name === "content-length") return String(this._asset.size);
    return null;
  };
  OfflineXHR.prototype.getAllResponseHeaders = function () {
    if (this._native) return this._native.getAllResponseHeaders();
    return this._asset ? "Content-Type: " + this._asset.mime + "\r\nContent-Length: " + this._asset.size + "\r\n" : "";
  };
  OfflineXHR.prototype.addEventListener = function (type, listener) {
    (this._listeners[type] || (this._listeners[type] = [])).push(listener);
  };
  OfflineXHR.prototype.removeEventListener = function (type, listener) {
    var list = this._listeners[type] || [];
    var index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
  };
  OfflineXHR.prototype._emit = function (type, details) {
    var event = Object.assign({ type: type, target: this, currentTarget: this }, details || {});
    if (typeof this["on" + type] === "function") this["on" + type](event);
    (this._listeners[type] || []).slice().forEach(function (listener) { listener.call(this, event); }, this);
  };
  OfflineXHR.prototype._forwardNative = function () {
    var self = this;
    ["readystatechange", "load", "loadend", "error", "abort", "progress", "timeout"].forEach(function (type) {
      self._native.addEventListener(type, function (event) {
        self.readyState = self._native.readyState;
        self.status = self._native.status;
        self.statusText = self._native.statusText;
        self.response = self._native.response;
        if (!self.responseType || self.responseType === "text") self.responseText = self._native.responseText;
        self._emit(type, event);
      });
    });
  };
  window.XMLHttpRequest = OfflineXHR;

  if (imageSrc && imageSrc.set) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: imageSrc.configurable,
      enumerable: imageSrc.enumerable,
      get: imageSrc.get,
      set: function (value) {
        var asset = find(value);
        imageSrc.set.call(this, asset ? dataUrl(asset) : value);
      }
    });
  }

  if (NativeFontFace) {
    window.FontFace = function (family, source, descriptors) {
      var match = typeof source === "string" && source.match(/url\(["']?([^"')]+)["']?\)/);
      var asset = match && find(match[1]);
      if (asset) source = source.replace(match[1], dataUrl(asset));
      return new NativeFontFace(family, source, descriptors);
    };
    window.FontFace.prototype = NativeFontFace.prototype;
  }

  window.Worker = function (url, options) {
    if (keyFor(url) !== "simulation_worker.bundle.js") return new NativeWorker(url, options);
    var worker = find("simulation_worker.bundle.js");
    var physics = find("lib/polytrack_physics.js");
    var physicsWasm = find("polytrack_physics.wasm");
    var physicsSource = text(physics);
    var workerSource = text(worker).replace('importScripts("lib/polytrack_physics.js");', "0;");
    workerSource = workerSource.replace(
      "PolyTrackPhysics()",
      'PolyTrackPhysics({wasmBinary:Uint8Array.from(atob("' + physicsWasm.data + '"),function(c){return c.charCodeAt(0)})})'
    );
    var source = physicsSource + "\n" + workerSource;
    var blobUrl = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
    return new NativeWorker(blobUrl, options);
  };
  window.Worker.prototype = NativeWorker.prototype;
})();
