// Shared scripts for the Void pages: the animated void background (a port of the game's
// WavyBackground shader) and the Altar perk constellation (a port of PrestigeTree + PrestigeTreeLayout).
(function () {
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Void background ----------

  var WAVE_FRAG = [
    "precision mediump float;",
    "uniform vec2 resolution;",
    "uniform float time;",
    "const vec3 baseColor = vec3(16.0, 16.0, 24.0) / 255.0;",
    "const vec3 color1 = vec3(38.0, 23.0, 69.0) / 255.0;",
    "const vec3 color2 = vec3(13.0, 17.0, 48.0) / 255.0;",
    "void main() {",
    "  vec2 fragCoord = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);",
    "  vec2 uv = (fragCoord * 2.0 - resolution) / min(resolution.x, resolution.y);",
    "  for (int i = 1; i < 8; i++) {",
    "    float fi = float(i);",
    "    uv.x += 0.6 / fi * cos(fi * 2.5 * uv.y + time);",
    "    uv.y += 0.6 / fi * cos(fi * 1.5 * uv.x + time);",
    "  }",
    "  float pattern = 0.5 + 0.5 * sin(uv.x + uv.y);",
    "  float pattern2 = 0.5 + 0.5 * sin(uv.x * 1.3 - uv.y * 0.7 + time * 0.3);",
    "  vec3 wave = mix(color1, color2, pattern);",
    "  gl_FragColor = vec4(mix(baseColor, wave, 0.5 + 0.2 * pattern2), 1.0);",
    "}"
  ].join("\n");

  var VERT = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";

  // The game snaps the waves to 4dp pixels. Rendering at a quarter of the CSS size and scaling up
  // with nearest-neighbour sampling gives the same blocky look for a fraction of the GPU work.
  var PIXEL_SIZE = 4;
  var FRAME_MS = 1000 / 30;
  // Slower than the game's default speed, which feels too busy behind a page of text.
  var SPEED = 0.4;

  function startBackground() {
    var canvas = document.createElement("canvas");
    canvas.className = "void-bg";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);

    var gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) { canvas.remove(); return; }

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, WAVE_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, "resolution");
    var uTime = gl.getUniformLocation(prog, "time");

    function resize() {
      var w = Math.max(1, Math.ceil(window.innerWidth / PIXEL_SIZE));
      var h = Math.max(1, Math.ceil(window.innerHeight / PIXEL_SIZE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function draw(t) {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    document.documentElement.classList.add("has-void-bg");

    if (reducedMotion) {
      draw(2.0);
      window.addEventListener("resize", function () { draw(2.0); });
      return;
    }

    var last = 0;
    var time = 0;
    var prev = 0;
    function frame(now) {
      if (prev) time += Math.min(now - prev, 100) / 1000 * SPEED;
      prev = now;
      if (now - last >= FRAME_MS) {
        last = now;
        draw(time);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Perk constellation ----------

  var BRANCH = {
    Warpath: { angle: 225, color: "#EF5350" },
    Fortune: { angle: 315, color: "#FFCA28" },
    Echoes: { angle: 45, color: "#7E57C2" },
    Forge: { angle: 135, color: "#42A5F5" }
  };
  var HUB_COLOR = "#FF7043";
  var HUB_SIZE = 140;
  var NODE_SIZE = { m: 56, n: 76, k: 104 };
  var RING_UNLOCK_RANK = [0, 1, 3, 6, 10, 15, 25];

  function ringRadius(ring) { return 160 + ring * 150; }

  // [name, branch, ring, slot, kind, parents, bridgedBranch]
  var TREE = [
    ["Sharpened Edge", "Warpath", 0, 0, "m", []],
    ["Fortitude", "Warpath", 1, 1, "m", ["Sharpened Edge"]],
    ["Execute", "Warpath", 1, -1, "n", ["Sharpened Edge"]],
    ["Resilience", "Warpath", 2, 1, "n", ["Fortitude"]],
    ["Power Strike", "Warpath", 2, -1, "n", ["Execute"]],
    ["Elite Ward", "Warpath", 3, 1, "m", ["Resilience"]],
    ["Evasion", "Warpath", 3, 0, "n", ["Resilience", "Power Strike"]],
    ["Brutal Criticals", "Warpath", 3, -1, "m", ["Power Strike"]],
    ["Champion Ward", "Warpath", 4, 1, "m", ["Elite Ward"]],
    ["Cripple", "Warpath", 4, 0, "n", ["Evasion"]],
    ["Vengeance", "Warpath", 4, -1, "n", ["Brutal Criticals"]],
    ["Champion Banishment", "Warpath", 5, 2, "n", ["Champion Ward"]],
    ["Stunning Blow", "Warpath", 5, 1, "n", ["Cripple"]],
    ["Double Strike", "Warpath", 5, -1, "n", ["Cripple"]],
    ["Veteran's Might", "Warpath", 5, -2, "m", ["Vengeance"]],
    ["Unbroken Oath", "Warpath", 6, 2, "k", ["Champion Banishment", "Stunning Blow"]],
    ["First Strike", "Warpath", 6, -2, "k", ["Double Strike", "Veteran's Might"]],

    ["Merchant's Acumen", "Fortune", 0, 0, "m", []],
    ["Expanded Inventory", "Fortune", 1, 1, "m", ["Merchant's Acumen"]],
    ["Scholar's Mark", "Fortune", 1, -1, "m", ["Merchant's Acumen"]],
    ["Fortune's Edge", "Fortune", 2, 1, "m", ["Expanded Inventory"]],
    ["Scavenger's Eye", "Fortune", 2, -1, "m", ["Scholar's Mark"]],
    ["Gambler's Instinct", "Fortune", 3, 1, "m", ["Fortune's Edge"]],
    ["Bounty Hunter's Cut", "Fortune", 3, -1, "m", ["Scavenger's Eye"]],
    ["Remembered Odds", "Fortune", 4, 1, "n", ["Gambler's Instinct"]],
    ["Treasure Hunter", "Fortune", 5, -1, "m", ["Bounty Hunter's Cut"]],
    ["Fortune's Echo", "Fortune", 6, 0, "k", ["Remembered Odds", "Treasure Hunter"]],

    ["Altar's Favor", "Echoes", 0, 0, "m", []],
    ["Echoed Strength", "Echoes", 1, -1, "m", ["Altar's Favor"]],
    ["Swift Return", "Echoes", 1, 1, "m", ["Altar's Favor"]],
    ["Golden Hoard", "Echoes", 2, -1, "m", ["Echoed Strength"]],
    ["Bargain with Death", "Echoes", 2, 1, "m", ["Swift Return"]],
    ["Trailblazer", "Echoes", 3, -1, "m", ["Golden Hoard"]],
    ["Dream Harvester", "Echoes", 3, 1, "m", ["Bargain with Death"]],
    ["Kindled Altar", "Echoes", 5, 0, "n", ["Trailblazer", "Heirloom"]],
    ["Unfaded Heirlooms", "Echoes", 6, 1, "k", ["Heirloom"]],

    ["Master Craftsman", "Forge", 0, 0, "m", []],
    ["Frugal Smith", "Forge", 1, 1, "m", ["Master Craftsman"]],
    ["Salvage Master", "Forge", 1, -1, "m", ["Master Craftsman"]],
    ["Thrifty Hammer", "Forge", 2, 1, "m", ["Frugal Smith"]],
    ["Material Transmutation", "Forge", 2, -1, "n", ["Salvage Master"]],
    ["Thorough Craftsmanship", "Forge", 3, 1, "n", ["Thrifty Hammer"]],
    ["Preserved Reagents", "Forge", 3, -1, "m", ["Material Transmutation"]],
    ["Masterwork", "Forge", 4, 1, "m", ["Thorough Craftsmanship"]],
    ["Salvage Alchemy", "Forge", 5, -1, "m", ["Preserved Reagents"]],
    ["The Patient Forge", "Forge", 6, 0, "k", ["Masterwork", "Salvage Alchemy"]],

    ["Elite Attraction", "Warpath", 4, 0, "n", ["Elite Ward", "Scavenger's Eye"], "Fortune"],
    ["Kept Fortune", "Fortune", 4, 0, "m", ["Gambler's Instinct", "Trailblazer"], "Echoes"],
    ["Heirloom", "Echoes", 4, 0, "n", ["Dream Harvester", "Preserved Reagents"], "Forge"],
    ["Arms Master", "Forge", 4, 0, "m", ["Thorough Craftsmanship", "Brutal Criticals"], "Warpath"]
  ];

  function boundaryDegrees(a, b) {
    var diff = ((b - a + 540) % 360) - 180;
    return (a + diff / 2 + 360) % 360;
  }

  var NODES = TREE.map(function (e) {
    var base = e[6] ? boundaryDegrees(BRANCH[e[1]].angle, BRANCH[e[6]].angle) : BRANCH[e[1]].angle;
    var r = ringRadius(e[2]);
    var slotArc = 110 + e[2] * 15;
    var deg = base + (e[3] * slotArc / r) * 180 / Math.PI;
    var rad = deg * Math.PI / 180;
    return {
      name: e[0], branch: e[1], ring: e[2], kind: e[4], parents: e[5],
      x: r * Math.cos(rad), y: r * Math.sin(rad), size: NODE_SIZE[e[4]],
      color: BRANCH[e[1]].color
    };
  });
  var BY_NAME = {};
  NODES.forEach(function (n) { BY_NAME[n.name] = n; });

  var TREE_RADIUS = ringRadius(6) + NODE_SIZE.k / 2;

  // Each node lights in ring order, with a small stagger inside the ring.
  NODES.forEach(function (n) {
    var inRing = NODES.filter(function (o) { return o.ring === n.ring; });
    n.order = inRing.indexOf(n) / inRing.length;
  });

  function hexToRgba(hex, a) {
    var v = parseInt(hex.slice(1), 16);
    return "rgba(" + (v >> 16) + "," + ((v >> 8) & 255) + "," + (v & 255) + "," + a + ")";
  }

  function easeOut(t) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }

  // Timeline: ring k opens at k * RING_STEP seconds, then holds, then fades back to start over.
  var RING_STEP = 1.8;
  var HOLD = 5;
  var FADE = 1.2;
  var CYCLE = 7 * RING_STEP + HOLD + FADE;

  function Constellation(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.labels = !!opts.labels;
    this.onRank = opts.onRank || function () {};
    this.hover = null;
    this.start = performance.now();
    this.lastRank = -1;
    var self = this;

    if (opts.interactive) {
      canvas.addEventListener("pointermove", function (ev) { self.pick(ev); });
      canvas.addEventListener("pointerdown", function (ev) { self.pick(ev); });
      canvas.addEventListener("pointerleave", function () { self.hover = null; if (reducedMotion) self.draw(); });
    }

    var ro = new ResizeObserver(function () { self.resize(); });
    ro.observe(canvas);
    this.resize();

    if (reducedMotion) {
      this.fixedTime = 7 * RING_STEP + 1;
      this.draw();
    } else {
      this.visible = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          self.visible = entries[0].isIntersecting;
        }).observe(canvas);
      }
      requestAnimationFrame(function loop() {
        if (self.visible) self.draw();
        requestAnimationFrame(loop);
      });
    }
  }

  Constellation.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.dpr = dpr;
    var pad = this.labels ? 1.16 : 1.04;
    this.scale = Math.min(rect.width, rect.height) / (2 * TREE_RADIUS * pad);
    if (reducedMotion) this.draw();
  };

  Constellation.prototype.toScreen = function (x, y) {
    return [this.cssW / 2 + x * this.scale, this.cssH / 2 + y * this.scale];
  };

  Constellation.prototype.pick = function (ev) {
    var rect = this.canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < NODES.length; i++) {
      var n = NODES[i];
      var p = this.toScreen(n.x, n.y);
      var d = Math.hypot(p[0] - px, p[1] - py);
      var hit = Math.max(n.size * this.scale * 0.5, 12);
      if (d < hit && d < bestD) { best = n; bestD = d; }
    }
    this.hover = best;
    if (reducedMotion) this.draw();
  };

  Constellation.prototype.draw = function () {
    var ctx = this.ctx;
    var s = this.scale;
    var t = this.fixedTime != null ? this.fixedTime : ((performance.now() - this.start) / 1000) % CYCLE;
    var now = performance.now() / 1000;
    var fade = t > CYCLE - FADE ? 1 - (t - (CYCLE - FADE)) / FADE : 1;

    // Lit amount for a ring, and for a single node inside its ring.
    function ringLit(ring) { return easeOut((t - ring * RING_STEP) / 0.6) * fade; }
    function nodeLit(n) { return easeOut((t - n.ring * RING_STEP - 0.3 - n.order * 1.0) / 0.5) * fade; }

    var openRings = 0;
    for (var r = 0; r < 7; r++) if (t >= r * RING_STEP) openRings = r + 1;
    var rank = fade < 1 ? 0 : RING_UNLOCK_RANK[Math.max(openRings - 1, 0)];
    if (rank !== this.lastRank) {
      this.lastRank = rank;
      this.onRank(rank, openRings);
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    var c = this.toScreen(0, 0);

    // Rings
    for (r = 0; r < 7; r++) {
      var lit = ringLit(r);
      ctx.beginPath();
      ctx.arc(c[0], c[1], ringRadius(r) * s, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255," + (0.06 + 0.12 * lit) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Edges
    var self = this;
    NODES.forEach(function (n) {
      var lit = nodeLit(n);
      var targets = n.parents.length ? n.parents.map(function (p) { return BY_NAME[p]; }) : [null];
      targets.forEach(function (p) {
        var a = self.toScreen(n.x, n.y);
        var b = p ? self.toScreen(p.x, p.y) : c;
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(a[0], a[1]);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = Math.max(1, 6 * s);
        ctx.stroke();
        if (lit > 0) {
          ctx.beginPath();
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(b[0] + (a[0] - b[0]) * lit, b[1] + (a[1] - b[1]) * lit);
          ctx.strokeStyle = hexToRgba(n.color, 0.85);
          ctx.lineWidth = Math.max(1.5, 8 * s);
          ctx.stroke();
        }
      });
    });

    // Nodes
    NODES.forEach(function (n) {
      var lit = nodeLit(n);
      var p = self.toScreen(n.x, n.y);
      var rad = Math.max(n.size * s * 0.5, 2.5);
      if (n.kind === "k" && lit > 0) {
        var pulse = 0.5 + 0.5 * Math.sin(now * 2 + n.x);
        var g = ctx.createRadialGradient(p[0], p[1], rad * 0.6, p[0], p[1], rad * (2.4 + 0.4 * pulse));
        g.addColorStop(0, hexToRgba(n.color, 0.45 * lit));
        g.addColorStop(1, hexToRgba(n.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(p[0], p[1], rad, 0, Math.PI * 2);
      ctx.fillStyle = "#2a2833";
      ctx.fill();
      if (lit > 0) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(n.color, lit);
        ctx.fill();
      }
      if (self.hover === n) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Altar hub
    var hubR = HUB_SIZE * s * 0.5;
    var hubPulse = 0.5 + 0.5 * Math.sin(now * 1.6);
    var hg = ctx.createRadialGradient(c[0], c[1], hubR * 0.5, c[0], c[1], hubR * (3 + hubPulse));
    hg.addColorStop(0, hexToRgba(HUB_COLOR, 0.5));
    hg.addColorStop(1, hexToRgba(HUB_COLOR, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(c[0], c[1], hubR * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c[0], c[1], hubR, 0, Math.PI * 2);
    ctx.fillStyle = HUB_COLOR;
    ctx.fill();

    if (this.labels) {
      ctx.font = "500 " + Math.max(12, Math.round(34 * s)) + "px 'Pixelify Sans', sans-serif";
      ctx.textBaseline = "middle";
      Object.keys(BRANCH).forEach(function (b) {
        var deg = BRANCH[b].angle * Math.PI / 180;
        var R = TREE_RADIUS + 30;
        var lp = self.toScreen(R * Math.cos(deg), R * Math.sin(deg));
        ctx.fillStyle = hexToRgba(BRANCH[b].color, 0.9);
        ctx.textAlign = Math.cos(deg) < 0 ? "right" : "left";
        ctx.textBaseline = Math.sin(deg) < 0 ? "bottom" : "top";
        ctx.fillText(b, lp[0], lp[1]);
      });
    }

    if (this.hover) {
      var h = this.hover;
      var hp = this.toScreen(h.x, h.y);
      ctx.font = "500 14px 'Pixelify Sans', sans-serif";
      var label = h.name;
      var w = ctx.measureText(label).width + 16;
      var bx = Math.min(Math.max(hp[0] - w / 2, 4), this.cssW - w - 4);
      var by = hp[1] - Math.max(h.size * s * 0.5, 4) - 34;
      if (by < 4) by = hp[1] + Math.max(h.size * s * 0.5, 4) + 8;
      ctx.fillStyle = "rgba(28,27,31,0.95)";
      ctx.strokeStyle = hexToRgba(h.color, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, w, 26, 8); else ctx.rect(bx, by, w, 26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + 8, by + 13);
    }
  };

  // ---------- Screenshot lightbox ----------

  function setupLightbox() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".gallery a.shot"));
    if (!links.length || typeof HTMLDialogElement !== "function") return;

    var dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    dialog.setAttribute("aria-label", "Screenshot viewer");
    dialog.innerHTML =
      '<div class="lightbox-stage"><img alt="" /></div>' +
      '<button class="lb-close" type="button" aria-label="Close">&times;</button>' +
      '<button class="lb-prev" type="button" aria-label="Previous screenshot">&lsaquo;</button>' +
      '<button class="lb-next" type="button" aria-label="Next screenshot">&rsaquo;</button>' +
      '<div class="lb-count" aria-live="polite"></div>';
    document.body.appendChild(dialog);

    var img = dialog.querySelector("img");
    var count = dialog.querySelector(".lb-count");
    var stage = dialog.querySelector(".lightbox-stage");
    var index = 0;

    function show(i) {
      index = (i + links.length) % links.length;
      var thumb = links[index].querySelector("img");
      img.src = links[index].getAttribute("href");
      img.alt = thumb ? thumb.alt : "";
      count.textContent = (index + 1) + " / " + links.length;
      // Warm the neighbours so stepping through feels instant.
      [index + 1, index - 1].forEach(function (n) {
        new Image().src = links[(n + links.length) % links.length].getAttribute("href");
      });
    }

    links.forEach(function (link, i) {
      link.addEventListener("click", function (ev) {
        ev.preventDefault();
        show(i);
        document.documentElement.style.overflow = "hidden";
        dialog.showModal();
      });
    });

    dialog.querySelector(".lb-close").addEventListener("click", function () { dialog.close(); });
    dialog.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
    dialog.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });

    // A click on the dim area around the image closes it.
    stage.addEventListener("click", function (ev) { if (ev.target === stage) dialog.close(); });

    dialog.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") show(index - 1);
      else if (ev.key === "ArrowRight") show(index + 1);
    });

    var touchX = null;
    stage.addEventListener("touchstart", function (ev) { touchX = ev.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (ev) {
      if (touchX === null) return;
      var dx = ev.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    });

    dialog.addEventListener("close", function () {
      document.documentElement.style.overflow = "";
      links[index].focus();
    });
  }

  // ---------- Page setup ----------

  function init() {
    startBackground();
    setupLightbox();

    document.querySelectorAll("canvas[data-constellation]").forEach(function (canvas) {
      var rankEl = document.getElementById(canvas.getAttribute("data-rank-label") || "");
      var ringEl = document.getElementById(canvas.getAttribute("data-ring-label") || "");
      new Constellation(canvas, {
        labels: canvas.hasAttribute("data-labels"),
        interactive: canvas.hasAttribute("data-interactive"),
        onRank: function (rank, openRings) {
          if (rankEl) rankEl.textContent = rank;
          if (ringEl) {
            ringEl.textContent = openRings >= 7
              ? "Every ring is open"
              : "Ring " + openRings + " opens at Rank " + RING_UNLOCK_RANK[openRings];
          }
        }
      });
    });

    var flavor = document.getElementById("flavor");
    if (flavor && window.VOID_FLAVORS) {
      flavor.textContent = window.VOID_FLAVORS[Math.floor(Math.random() * window.VOID_FLAVORS.length)];
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
