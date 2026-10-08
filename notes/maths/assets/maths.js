/* ==========================================================================
   EF2452 數學筆記 · 前端腳本
   1) 用本地 KaTeX 渲染所有 $...$ 與 $$...$$ 公式
   2) 目錄捲動高亮（IntersectionObserver，不支援時自動略過）
   3) 目錄點擊改為平滑捲動且不跳頁
   4) 安全網：KaTeX 載入失敗時，把 LaTeX 原樣顯示，不留空白
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- 1. 渲染公式 ---------------- */
  var rendered = 0, failed = 0;

  function renderAll() {
    if (typeof window.katex === "undefined") return false;

    document.querySelectorAll(".katex-math").forEach(function (el) {
      var tex = el.getAttribute("data-tex") || "";
      var display = el.getAttribute("data-display") === "1";
      try {
        window.katex.render(tex, el, {
          displayMode: display,
          throwOnError: false,
          strict: false,
          trust: false,
          macros: { "\\R": "\\mathbb{R}" }
        });
        rendered++;
      } catch (e) {
        failed++;
        el.textContent = tex;              // 原樣顯示，至少不會空白
        el.classList.add("katex-fallback");
      }
    });
    return true;
  }

  /* 把 $...$ / $$...$$ 轉成待渲染的節點（保留 HTML 標籤不動） */
  function collect() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.indexOf("$") === -1) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        while (p && p !== document.body) {
          var t = p.tagName;
          if (t === "SCRIPT" || t === "STYLE" || t === "CODE" || t === "PRE") return NodeFilter.FILTER_REJECT;
          if (p.classList && p.classList.contains("katex")) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var targets = [];
    var n;
    while ((n = walker.nextNode())) targets.push(n);

    var re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    targets.forEach(function (node) {
      var text = node.nodeValue;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var display = m[1] !== undefined;
        var span = document.createElement("span");
        span.className = display ? "katex-math katex-display-wrap" : "katex-math";
        span.setAttribute("data-tex", (display ? m[1] : m[2]).trim());
        span.setAttribute("data-display", display ? "1" : "0");
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* ---------------- 2. 目錄高亮 ---------------- */
  function initToc() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.lec-toc a[href^="#"]'));
    if (!links.length || typeof IntersectionObserver === "undefined") return;

    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      var sec = document.getElementById(id);
      if (sec) map[id] = a;
    });

    var current = null;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = map[en.target.id];
        if (!a || a === current) return;
        if (current) current.classList.remove("is-active");
        a.classList.add("is-active");
        current = a;
      });
    }, { rootMargin: "-84px 0px -62% 0px", threshold: 0 });

    Object.keys(map).forEach(function (id) { obs.observe(document.getElementById(id)); });
  }

  /* ---------------- 3. 目錄平滑捲動 ---------------- */
  function initSmoothToc() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('.lec-toc a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute("href").slice(1);
      var t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      var se = document.scrollingElement || document.documentElement;
      var y = se.scrollTop + t.getBoundingClientRect().top - 78;
      window.scrollTo({ top: y, behavior: "auto" });   /* 先瞬間定位，確保一定到位 */
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    });
  }

  /* ---------------- 4. 深層連結：載入時定位 ---------------- */
  function initHash() {
    var id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!id) return;
    var t = document.getElementById(id);
    if (!t) return;
    requestAnimationFrame(function () {
      var se = document.scrollingElement || document.documentElement;
      var y = se.scrollTop + t.getBoundingClientRect().top - 78;
      window.scrollTo({ top: y, behavior: "auto" });
      var a = document.querySelector('.lec-toc a[href="#' + id + '"]');
      if (a) a.classList.add("is-active");
    });
  }

  /* ---------------- 啟動 ---------------- */
  function boot() {
    collect();
    if (!renderAll()) {
      /* KaTeX 尚未載入（defer 順序）——再試一次 */
      setTimeout(renderAll, 60);
    }
    initToc();
    initSmoothToc();
    initHash();
    document.documentElement.setAttribute("data-math-rendered", String(rendered));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
