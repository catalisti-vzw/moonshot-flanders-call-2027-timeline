(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Content — edit dates and texts here
  // ---------------------------------------------------------------------------

  var BEFORE_START_TEXT = 'Call 2027 opens soon'; // shown as "Current:" before the call opens
  var START = '2026-12-07'; // opening of Call 2027: the rocket leaves Earth
  var END = '2028-01-08';   // just after the final results (end of December 2027): the rocket reaches the Moon

  // `short` is the label on the timeline; use \n to split it over two lines.
  // `label` (optional) replaces the formatted date when only the month is known;
  // `iso` then sets where the dot sits on the path (end of the month) and when "Current:" switches.
  // `current` is shown after "Current:" at the top, from this milestone until the next one.
  var PHASES = [
    {
      iso: '2026-12-07',
      current: 'Pre-proposal submission',
      short: 'Call opening',
      title: 'Opening of Call 2027',
      text: 'Call 2027 opens: pre-proposals can be submitted from this date.'
    },
    {
      iso: '2027-02-19',
      current: 'Evaluation of pre-proposals',
      short: 'Pre-proposal deadline',
      title: 'Pre-proposals deadline',
      text: 'Final deadline to submit your pre-proposal for Call 2027.'
    },
    {
      iso: '2027-04-05',
      current: 'Writing the Letter of Intent',
      short: 'Pre-proposal selection &\nopening LOI phase',
      title: 'Pre-proposal selection & opening LOI phase',
      text: 'Applicants hear whether their pre-proposal is selected. Selected applicants can now start writing their Letter of Intent (LOI).'
    },
    {
      iso: '2027-08-31',
      current: 'Evaluation of Letters of Intent',
      short: 'Closure LOI phase',
      title: 'Closure LOI phase',
      text: 'Final deadline to submit your Letter of Intent (LOI).'
    },
    {
      iso: '2027-09-30',
      label: 'September 2027',
      current: 'IGNITE results announced',
      short: 'IGNITE results announced',
      title: 'IGNITE results announced',
      text: 'Results of the IGNITE projects are announced.'
    },
    {
      iso: '2027-11-30',
      label: 'November 2027',
      current: 'ESI results announced',
      short: 'ESI results announced',
      title: 'ESI results announced',
      text: 'Results of the Early Stage Innovation (ESI) projects are announced. These proposals are evaluated by HBC.'
    },
    {
      iso: '2027-12-31',
      label: 'December 2027',
      current: 'All results announced',
      short: 'LSI results announced',
      title: 'LSI results announced',
      text: 'Results of the Later Stage Innovation (LSI) projects are announced. These proposals are evaluated by the Flemish Government.'
    }
  ];

  // ---------------------------------------------------------------------------
  // Scene geometry — keep in sync with index.html (SVG viewBox units)
  // ---------------------------------------------------------------------------

  var VIEW = { w: 1200, h: 720, margin: 8 };

  // Areas phase labels must stay clear of (labels may overlap the pale ovals).
  var OBSTACLES = {
    circles: [
      { cx: 1200, cy: 0, r: 240 }  // moon (quarter in the top right corner)
    ],
    rects: [
      { x0: 0, y0: 0, x1: 300, y1: 120 } // TODAY badge (HTML overlay, top left)
    ]
  };

  var LABEL_HEIGHT = { above: 12, below: 38 }; // date line at y, first title line at y + 26
  var LINE_HEIGHT = 23; // extra height per additional title line
    var INTRO_DURATION_MS = 2200;
  var LAST_PHASE_AT = 0.92; // share of the path where the last phase sits; the rest is the final glide to the Moon

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  // Dates are handled as UTC midnights so that day counts never shift with DST.
  function parseISO(s) {
    var p = s.split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDate(ts) {
    var d = new Date(ts);
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  }

  function phaseDateText(phase) {
    return phase.label || formatDate(phase.ts);
  }

  // Today's date in the visitor's own time zone.
  // For previewing, add ?date=YYYY-MM-DD to the page URL.
  function today() {
    var override = new URLSearchParams(window.location.search).get('date');
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
      return parseISO(override);
    }
    var n = new Date();
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Shows the image once it has loaded; otherwise the drawn fallback stays.
  function useImageWhenAvailable(imageEl, fallbackEl) {
    var test = new Image();
    test.onload = function () {
      imageEl.removeAttribute('hidden');
      fallbackEl.setAttribute('hidden', '');
    };
    test.src = imageEl.getAttribute('href');
  }

  // ---------------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------------

  var path = document.getElementById('trajectory');
  var progress = document.getElementById('progress');
  var phasesG = document.getElementById('phases');
  var rocket = document.getElementById('rocket');
  var stage = document.getElementById('stage');
  var tooltip = document.getElementById('tooltip');
  var ttDate = tooltip.querySelector('.tt-date');
  var ttTitle = tooltip.querySelector('.tt-title');
  var ttText = tooltip.querySelector('.tt-text');
  var currentDateEl = document.getElementById('currentDate');
  var currentPhaseEl = document.getElementById('currentPhase');
  var phaseList = document.getElementById('phaseList');

  var startTs = parseISO(START);
  var endTs = parseISO(END);
  var pathLength = path.getTotalLength();

  PHASES.forEach(function (phase) {
    phase.ts = parseISO(phase.iso);
  });

  useImageWhenAvailable(document.getElementById('moonImage'), document.getElementById('moonFallback'));
  useImageWhenAvailable(document.getElementById('rocketImage'), document.getElementById('rocketFallback'));

  // Point on the trajectory for a given date, plus the direction of travel there.
  // The phases are spread evenly along the path (not to scale in time), so dots never bunch up.
  // Between two phases the rocket moves a little every day, at whatever pace fits that stretch.
  var anchors = [];

  function buildAnchors() {
    var n = PHASES.length;
    if (startTs < PHASES[0].ts) anchors.push({ ts: startTs, f: 0 });
    PHASES.forEach(function (phase, i) {
      anchors.push({ ts: phase.ts, f: n === 1 ? 0 : (i / (n - 1)) * LAST_PHASE_AT });
    });
    anchors.push({ ts: endTs, f: 1 });
  }

  function fractionForDate(ts) {
    if (ts <= anchors[0].ts) return anchors[0].f;
    for (var i = 1; i < anchors.length; i++) {
      var a = anchors[i - 1];
      var b = anchors[i];
      if (ts <= b.ts) return a.f + (b.f - a.f) * (ts - a.ts) / (b.ts - a.ts);
    }
    return 1;
  }

  function pointForDate(ts) {
    var len = fractionForDate(ts) * pathLength;
    var p = path.getPointAtLength(len);
    var ahead = path.getPointAtLength(Math.min(pathLength, len + 1));
    var behind = path.getPointAtLength(Math.max(0, len - 1));
    var dx = ahead.x - behind.x;
    var dy = ahead.y - behind.y;
    var m = Math.hypot(dx, dy) || 1;
    return { len: len, x: p.x, y: p.y, tx: dx / m, ty: dy / m };
  }

  // ---------------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------------

  var openAnchor = null;

  function positionTooltip(anchor) {
    var r = anchor.getBoundingClientRect();
    var c = stage.getBoundingClientRect();
    tooltip.hidden = false;

    var half = tooltip.offsetWidth / 2;
    var left = clamp(r.left - c.left + r.width / 2, half + 8, c.width - half - 8);
    var roomAbove = r.top - c.top - 10;
    var below = roomAbove < tooltip.offsetHeight + 8;

    tooltip.classList.toggle('below', below);
    tooltip.style.left = left + 'px';
    tooltip.style.top = (below ? r.bottom - c.top + 10 : roomAbove) + 'px';
  }

  function showTooltip(phase, anchor) {
    ttDate.textContent = phaseDateText(phase);
    ttTitle.textContent = phase.title;
    ttText.textContent = phase.text;
    openAnchor = anchor;
    positionTooltip(anchor);
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
    tooltip.hidden = true;
    openAnchor = null;
  }

  // ---------------------------------------------------------------------------
  // Phase dots and labels
  // ---------------------------------------------------------------------------

  var placedLabels = [];

  function rectHitsCircle(x0, y0, x1, y1, c) {
    var qx = clamp(c.cx, x0, x1);
    var qy = clamp(c.cy, y0, y1);
    return Math.hypot(c.cx - qx, c.cy - qy) < c.r;
  }

  function rectsOverlap(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  }

  // True when a label block centred on (lx, ly) with width w would collide with something.
  var pathSamples = []; // points along the trajectory + every phase dot and its info badge

  function collectPathObstacles() {
    for (var len = 0; len <= pathLength; len += 18) {
      var p = path.getPointAtLength(len);
      pathSamples.push({ cx: p.x, cy: p.y, r: 24 }); // wide enough for the rocket to pass
    }
    PHASES.forEach(function (phase) {
      var pt = pointForDate(phase.ts);
      pathSamples.push({ cx: pt.x, cy: pt.y, r: 20 });
      pathSamples.push({ cx: pt.x + 28, cy: pt.y, r: 16 });
    });
  }

  function labelBox(lx, ly, w, below) {
    return { x0: lx - w / 2, x1: lx + w / 2, y0: ly - LABEL_HEIGHT.above, y1: ly + below };
  }

  function labelClashes(lx, ly, w, below) {
    var box = labelBox(lx, ly, w, below);

    if (box.x0 < VIEW.margin || box.x1 > VIEW.w - VIEW.margin ||
        box.y0 < VIEW.margin || box.y1 > VIEW.h - VIEW.margin) {
      return true;
    }
    var circles = OBSTACLES.circles.concat(pathSamples);
    if (circles.some(function (c) { return rectHitsCircle(box.x0, box.y0, box.x1, box.y1, c); })) {
      return true;
    }
    if (OBSTACLES.rects.some(function (r) { return rectsOverlap(box, r); })) {
      return true;
    }
    return placedLabels.some(function (q) {
      return rectsOverlap({ x0: box.x0 - 6, x1: box.x1 + 6, y0: box.y0 - 6, y1: box.y1 + 6 }, q);
    });
  }

  // Distance from the dot (0,0) to the nearest point of a label block centred on (rx, ry).
  function gapToDot(rx, ry, w, below) {
    var qx = clamp(0, rx - w / 2, rx + w / 2);
    var qy = clamp(0, ry - LABEL_HEIGHT.above, ry + below);
    return Math.hypot(qx, qy);
  }

  // Without connector lines a label must sit right next to its own dot, so every candidate
  // spot is tried and the free one closest to the dot wins.
  function findLabelOffset(pt, w, below, index) {
    var nx = -pt.ty;
    var ny = pt.tx;
    var side = index % 2 === 0 ? 1 : -1;
    var midY = (below - LABEL_HEIGHT.above) / 2; // vertical centre of the block
    var candidates = [];

    // Either side of the path, perpendicular to it
    [side, -side].forEach(function (s, k) {
      [36, 48, 62, 78, 96, 120].forEach(function (o) {
        candidates.push({ rx: nx * s * o, ry: ny * s * o - midY, pref: k * 4 });
      });
    });
    // Straight above / below
    [34, 46, 60, 80, 100, 124].forEach(function (o) {
      candidates.push({ rx: 0, ry: -o - below + 12, pref: 2 });
      candidates.push({ rx: 0, ry: o, pref: 2 });
    });
    // Beside the dot (right side leaves room for the info badge)
    candidates.push({ rx: 48 + w / 2, ry: -midY, pref: 2 });
    candidates.push({ rx: -(20 + w / 2), ry: -midY, pref: 2 });

    // Wider search around the dot, used when the spots above are all taken
    for (var gx = -280; gx <= 280; gx += 20) {
      for (var gy = -150; gy <= 150; gy += 12) {
        candidates.push({ rx: gx, ry: gy, pref: 10 });
      }
    }

    var best = null;
    candidates.forEach(function (c) {
      if (labelClashes(pt.x + c.rx, pt.y + c.ry, w, below)) return;
      // Prefer spots close to the dot AND centred on it, so it is clear which dot a label belongs to
      var score = gapToDot(c.rx, c.ry, w, below) + 0.6 * Math.abs(c.rx) + c.pref;
      if (!best || score < best.score) best = { rx: c.rx, ry: c.ry, score: score };
    });
    return best || candidates[0];
  }

  function buildPhase(phase, index) {
    var pt = pointForDate(phase.ts);
    var dateText = phaseDateText(phase);

    var g = el('g', {
      class: 'phase',
      transform: 'translate(' + pt.x + ',' + pt.y + ')',
      tabindex: '0',
      role: 'button',
      'aria-label': dateText + ': ' + phase.title + '. ' + phase.text
    });

    g.appendChild(el('circle', { class: 'halo', r: 14 }));
    g.appendChild(el('circle', { class: 'dot', r: 8 }));

    var info = el('g', { class: 'info', transform: 'translate(28,0)' });
    info.appendChild(el('circle', { r: 13 }));
    var iText = el('text', { y: 5.4 });
    iText.textContent = 'i';
    info.appendChild(iText);
    g.appendChild(info);

    var dateEl = el('text', { class: 'phase-date' });
    dateEl.textContent = dateText;
    var titleEl = el('text', { class: 'phase-title' });
    var lines = phase.short.split('\n');
    var tspans = lines.map(function (line, k) {
      var t = el('tspan', { dy: k === 0 ? 0 : LINE_HEIGHT });
      t.textContent = line;
      titleEl.appendChild(t);
      return t;
    });
    var below = LABEL_HEIGHT.below + (lines.length - 1) * LINE_HEIGHT;
    g.appendChild(dateEl);
    g.appendChild(titleEl);
    phasesG.appendChild(g);

    // Measure the real text width (after the web font has loaded), then place the label.
    var w = Math.max.apply(null, [dateEl.getComputedTextLength()].concat(
      tspans.map(function (t) { return t.getComputedTextLength(); }))) + 16;
    if (!w || w < 20) {
      w = Math.max.apply(null, [dateText.length].concat(lines.map(function (l) { return l.length; }))) * 10 + 24; // fallback when hidden (small screens)
    }
    var offset = findLabelOffset(pt, w, below, index);
    placedLabels.push(labelBox(pt.x + offset.rx, pt.y + offset.ry, w, below));

    dateEl.setAttribute('x', offset.rx);
    dateEl.setAttribute('y', offset.ry);
    titleEl.setAttribute('y', offset.ry + 26);
    tspans.forEach(function (t) { t.setAttribute('x', offset.rx); });


    g.addEventListener('mouseenter', function () { showTooltip(phase, info); });
    g.addEventListener('mouseleave', hideTooltip);
    g.addEventListener('focus', function () { showTooltip(phase, info); });
    g.addEventListener('blur', hideTooltip);
    g.addEventListener('click', function (e) {
      e.stopPropagation(); // keeps the document click handler from closing it again
      showTooltip(phase, info);
    });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (openAnchor === info) hideTooltip(); else showTooltip(phase, info);
      } else if (e.key === 'Escape') {
        hideTooltip();
      }
    });

    phase.svgEl = g;
  }

  function buildList() {
    PHASES.forEach(function (phase) {
      var li = document.createElement('li');
      [['pl-date', phaseDateText(phase)], ['pl-title', phase.title], ['pl-text', phase.text]]
        .forEach(function (part) {
          var span = document.createElement('span');
          span.className = part[0];
          span.textContent = part[1];
          li.appendChild(span);
        });
      phaseList.appendChild(li);
      phase.listEl = li;
    });
  }

  // ---------------------------------------------------------------------------
  // Rocket and status
  // ---------------------------------------------------------------------------

  function placeRocketAtLength(len) {
    var p = path.getPointAtLength(len);
    var a = path.getPointAtLength(Math.min(pathLength, len + 1));
    var b = path.getPointAtLength(Math.max(0, len - 1));
    var angle = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;
    rocket.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') rotate(' + angle + ')');
    progress.setAttribute('stroke-dasharray', len + ' ' + (pathLength + 10));
  }

  function updateStatus(now) {
    currentDateEl.textContent = formatDate(now);
    currentDateEl.setAttribute('datetime', new Date(now).toISOString().slice(0, 10));

    var next = null;
    PHASES.forEach(function (phase) {
      var done = phase.ts < now;
      var isNext = !done && !next;
      if (isNext) next = phase;
      [phase.svgEl, phase.listEl].forEach(function (node) {
        node.classList.toggle('is-done', done);
        node.classList.toggle('is-next', isNext);
      });
    });

    // The current stage is set by the latest milestone that has been reached.
    var reached = PHASES.filter(function (phase) { return phase.ts <= now; });
    var current = reached.length ? reached[reached.length - 1].current : BEFORE_START_TEXT;
    var strong = document.createElement('strong');
    strong.textContent = current;
    currentPhaseEl.textContent = '';
    currentPhaseEl.append('Current: ', strong);
  }

  var lastDay = null;

  function update(animate) {
    var now = today();
    if (now === lastDay) return; // the rocket only moves once a day
    lastDay = now;

    updateStatus(now);
    var target = pointForDate(now).len;

    if (!animate || prefersReducedMotion() || target === 0) {
      placeRocketAtLength(target);
      return;
    }

    // First load: let the rocket fly from Earth to today's position.
    var t0 = null;
    function frame(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / INTRO_DURATION_MS);
      var eased = 1 - Math.pow(1 - k, 3); // ease-out
      placeRocketAtLength(target * eased);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  function init() {
    buildAnchors();
    collectPathObstacles();
    PHASES.forEach(buildPhase);
    buildList();
    placeRocketAtLength(0);
    update(true);

    // Check once a minute whether the day has changed (e.g. a page left open overnight),
    // and immediately when the visitor returns to the tab.
    setInterval(function () { update(false); }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) update(false);
    });

    document.addEventListener('click', hideTooltip); // tap elsewhere closes the tooltip (touch)
    window.addEventListener('resize', function () {
      if (openAnchor) positionTooltip(openAnchor);
    });
  }

  // Wait for Lato so that label widths are measured with the right font.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init, init);
  } else {
    init();
  }
})();
