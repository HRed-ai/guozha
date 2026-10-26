/* 过闸 · 编辑存档
   八闸（s01…s08）被改写后的内容存这里，不改动原始数据文件。
   结构：{ s01: { name, text:[], facts:[], scene:'data:...', figure:'data:...', poem:'...' } } */
(function () {
  var KEY = 'guozha.edits';
  var V = 1;

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || d.v !== V) return { v: V, nodes: {} };
      if (!d.nodes) d.nodes = {};
      return d;
    } catch (_) { return { v: V, nodes: {} }; }
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d || load())); }
    catch (e) { alert('保存失败：浏览器存储已满。可先「匯出」备份。'); }
  }

  function get(id) {
    return load().nodes[id] || null;
  }

  function patch(id, obj) {
    var d = load();
    d.nodes[id] = Object.assign({}, d.nodes[id] || {}, obj);
    save(d);
    return d.nodes[id];
  }

  function clear(id) {
    var d = load();
    delete d.nodes[id];
    save(d);
  }

  function any() {
    return Object.keys(load().nodes).length;
  }

  window.EDITS = {
    get: get,
    patch: patch,
    clear: clear,
    all: function () { return load().nodes; },
    count: any,
    exportJSON: function () { return JSON.stringify(load(), null, 1); },
    reset: function () { try { localStorage.removeItem(KEY); } catch (_) {} }
  };
})();
