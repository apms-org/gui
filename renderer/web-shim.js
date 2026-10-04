(function () {
  if (window.apm) return;

  function toError(e) {
    var src = e || {};
    var err = new Error(src.message || "Something went wrong.");
    err.code = src.code || "internal";
    if (src.data !== undefined) err.data = src.data;
    return err;
  }

  function unwrap(promise) {
    return Promise.resolve(promise).then(function (r) {
      if (r && r.ok) return r.result === undefined ? null : r.result;
      throw toError(r && r.error);
    });
  }

  var native = window.apmNative;

  if (native) {
    window.apm = Object.freeze({
      mode: "desktop",
      platform: native.platform,
      call: function (method, params) { return unwrap(native.call(method, params === undefined ? {} : params)); },
      on: function (event, cb) { return native.on(event, cb); },
      clipboard: Object.freeze({
        write: function (text, opts) { return unwrap(native.clipboard.write(text, opts || {})); },
        clear: function () { return unwrap(native.clipboard.clear()); }
      }),
      dialog: Object.freeze({
        save: function (opts) { return unwrap(native.dialog.save(opts || {})); },
        open: function (opts) { return unwrap(native.dialog.open(opts || {})); }
      }),
      files: Object.freeze({
        write: function (path, data, opts) { return unwrap(native.files.write(path, data, opts || {})); },
        read: function (path) { return unwrap(native.files.read(path)); }
      }),
      shell: Object.freeze({
        openExternal: function (url) { return unwrap(native.shell.openExternal(url)); },
        showItemInFolder: function (path) { return unwrap(native.shell.showItemInFolder(path)); }
      }),
      app: Object.freeze({
        info: function () { return unwrap(native.app.info()); },
        getVaultPath: function () { return unwrap(native.app.getVaultPath()); },
        defaultVaultPath: function () { return unwrap(native.app.defaultVaultPath()); },
        setVaultPath: function (path) { return unwrap(native.app.setVaultPath(path)); },
        relaunch: function () { return unwrap(native.app.relaunch()); },
        quit: function () { return unwrap(native.app.quit()); }
      }),
      menu: Object.freeze({
        setState: function (state) { native.menu.setState(state || {}); }
      }),
      touchId: Object.freeze({
        info: function () { return unwrap(native.touchId.info()); },
        slot: function (slot) { native.touchId.slot(slot || null); },
        cancel: function () { native.touchId.cancel(); }
      })
    });
    return;
  }

  var listeners = {};
  var source = null;

  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (res) { return res.json().catch(function () { return { error: { code: "internal", message: "The web bridge returned " + res.status + "." } }; }); })
      .then(function (r) {
        if (r && r.error) throw toError(r.error);
        return r ? (r.result === undefined ? null : r.result) : null;
      }, function (err) {
        if (err && err.code) throw err;
        throw toError({ code: "network", message: "The web bridge is not reachable." });
      });
  }

  function nativeOp(op, args) {
    return post("/native", { op: op, args: args || [] });
  }

  function ensureSource() {
    if (source || typeof EventSource === "undefined") return;
    source = new EventSource("/events");
    source.onmessage = function (m) {
      var msg;
      try { msg = JSON.parse(m.data); } catch (err) { return; }
      if (!msg || typeof msg.event !== "string") return;
      var set = listeners[msg.event];
      if (!set) return;
      set.slice().forEach(function (cb) {
        try { cb(msg.data === undefined ? null : msg.data); } catch (err) { console.error(err); }
      });
    };
  }

  window.apm = Object.freeze({
    mode: "web",
    platform: /Mac/.test(navigator.platform || "") ? "darwin" : /Win/.test(navigator.platform || "") ? "win32" : "linux",
    call: function (method, params) { return post("/rpc", { method: method, params: params === undefined ? {} : params }); },
    on: function (event, cb) {
      if (typeof event !== "string" || typeof cb !== "function") return function () {};
      ensureSource();
      (listeners[event] = listeners[event] || []).push(cb);
      return function () {
        var set = listeners[event];
        if (!set) return;
        var i = set.indexOf(cb);
        if (i >= 0) set.splice(i, 1);
      };
    },
    clipboard: Object.freeze({
      write: function (text, opts) { return nativeOp("clipboard.write", [text, opts || {}]); },
      clear: function () { return nativeOp("clipboard.clear"); }
    }),
    dialog: Object.freeze({
      save: function (opts) { return nativeOp("dialog.save", [opts || {}]); },
      open: function (opts) { return nativeOp("dialog.open", [opts || {}]); }
    }),
    files: Object.freeze({
      write: function (path, data, opts) { return nativeOp("files.write", [path, data, opts || {}]); },
      read: function (path) { return nativeOp("files.read", [path]); }
    }),
    shell: Object.freeze({
      openExternal: function (url) { return nativeOp("shell.openExternal", [url]); },
      showItemInFolder: function (path) { return nativeOp("shell.showItemInFolder", [path]); }
    }),
    app: Object.freeze({
      info: function () { return nativeOp("app.info"); },
      getVaultPath: function () { return nativeOp("app.getVaultPath"); },
      defaultVaultPath: function () { return nativeOp("app.defaultVaultPath"); },
      setVaultPath: function (path) { return nativeOp("app.setVaultPath", [path]); },
      relaunch: function () { return nativeOp("app.relaunch"); },
      quit: function () { return nativeOp("app.quit"); }
    }),
    menu: Object.freeze({
      setState: function (state) { nativeOp("menu.setState", [state || {}]).catch(function () {}); }
    })
  });
})();
