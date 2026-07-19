(function () {
  "use strict";

  var assets = window.__SPACE_WAVES_ASSETS__ || {};
  var NativeXHR = window.XMLHttpRequest;

  function assetKey(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (!raw || /^(?:data|blob):/.test(raw)) return null;
    raw = raw.replace(/\\/g, "/").split(/[?#]/)[0];
    var marker = "/spacewaves/";
    var markerIndex = raw.toLowerCase().lastIndexOf(marker);
    if (markerIndex >= 0) raw = raw.slice(markerIndex + marker.length);
    return raw.replace(/^.*\/Build\//i, "Build/").replace(/^\.\//, "");
  }

  function decode(asset) {
    var binary = atob(asset.data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function findAsset(value) {
    var key = assetKey(value);
    return key && assets[key] ? assets[key] : null;
  }

  if (window.fetch) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var asset = findAsset(input);
      if (!asset) return nativeFetch(input, init);
      return Promise.resolve(new Response(decode(asset), {
        status: 200,
        headers: { "Content-Type": asset.mime }
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
    this._asset = findAsset(url);
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
      this._copyHandlers();
      this._native.responseType = this.responseType;
      this._native.send(body);
      return;
    }
    setTimeout(function () {
      var bytes = decode(self._asset);
      self.status = 200;
      self.statusText = "OK";
      self.readyState = 4;
      if (self.responseType === "arraybuffer") {
        self.response = bytes.buffer;
      } else if (self.responseType === "blob") {
        self.response = new Blob([bytes], { type: self._asset.mime });
      } else {
        self.responseText = new TextDecoder().decode(bytes);
        self.response = self.responseText;
      }
      self._emit("readystatechange");
      self._emit("load");
      self._emit("loadend");
    }, 0);
  };

  OfflineXHR.prototype.abort = function () { if (this._native) this._native.abort(); };
  OfflineXHR.prototype.setRequestHeader = function (name, value) { if (this._native) this._native.setRequestHeader(name, value); };
  OfflineXHR.prototype.getResponseHeader = function (name) {
    if (this._native) return this._native.getResponseHeader(name);
    return name.toLowerCase() === "content-type" && this._asset ? this._asset.mime : null;
  };
  OfflineXHR.prototype.getAllResponseHeaders = function () {
    return this._native ? this._native.getAllResponseHeaders() : "Content-Type: " + (this._asset ? this._asset.mime : "") + "\r\n";
  };
  OfflineXHR.prototype.addEventListener = function (type, listener) {
    (this._listeners[type] || (this._listeners[type] = [])).push(listener);
  };
  OfflineXHR.prototype.removeEventListener = function (type, listener) {
    var list = this._listeners[type] || [];
    var index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
  };
  OfflineXHR.prototype._emit = function (type) {
    var event = { type: type, target: this, currentTarget: this };
    if (typeof this["on" + type] === "function") this["on" + type](event);
    (this._listeners[type] || []).slice().forEach(function (listener) { listener.call(this, event); }, this);
  };
  OfflineXHR.prototype._copyHandlers = function () {
    var self = this;
    ["readystatechange", "load", "loadend", "error", "abort", "progress", "timeout"].forEach(function (type) {
      self._native.addEventListener(type, function (event) {
        self.readyState = self._native.readyState;
        self.status = self._native.status;
        self.statusText = self._native.statusText;
        self.response = self._native.response;
        if (!self.responseType || self.responseType === "text") self.responseText = self._native.responseText;
        self._emit(type);
      });
    });
  };

  window.XMLHttpRequest = OfflineXHR;
})();
