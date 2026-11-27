(function () {
  'use strict';

  // Inside an iframe (e.g. on the Moonshot website) the timeline drops its own outer padding,
  // so it lines up with the page text and leaves no extra space around it.
  if (window.parent !== window) document.documentElement.classList.add('embedded');

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
      short: 'Call opens',
      title: 'Call opens',
      text: 'Call 2027 opens: pre-proposals can be submitted from this date.'
    },
    {
      iso: '2027-02-19',
      current: 'Evaluation of pre-proposals',
      short: 'Pre-proposal deadline',
      title: 'Pre-proposal deadline',
      text: 'Final deadline to submit your pre-proposal for Call 2027.'
    },
    {
      iso: '2027-04-05',
      current: 'Writing the Letter of Intent',
      short: 'Selected pre-proposals announced\n& LOI phase opens',
      title: 'Selected pre-proposals announced & LOI phase opens',
      text: 'Applicants hear whether their pre-proposal is selected. Companies can express their interest in one or more projects by submitting a Letter of Intent (LOI).'
    },
    {
      iso: '2027-08-31',
      current: 'Evaluation of Letters of Intent',
      short: 'LOI phase closes',
      title: 'LOI phase closes',
      text: 'Final deadline for companies to submit Letters of Intent (LOIs).'
    },
    {
      iso: '2027-09-30',
      label: 'Sept. 2027',
      current: 'IGNITE results announced',
      short: 'IGNITE results announced',
      title: 'IGNITE results announced',
      text: 'The selected IGNITE projects are announced. Selection is made by VLAIO (HBC).'
    },
    {
      iso: '2027-11-30',
      label: 'Nov. 2027',
      current: 'ESI results announced',
      short: 'ESI results announced',
      title: 'ESI results announced',
      text: 'The selected Early Stage Innovation (ESI) projects are announced. Selection is made by VLAIO (HBC).'
    },
    {
      iso: '2027-12-31',
      label: 'Dec. 2027',
      current: 'All results announced',
      short: 'LSI results announced',
      title: 'LSI results announced',
      text: 'The selected Later Stage Innovation (LSI) projects are announced. Selection is made by the Flemish Government.'
    }
  ];

  // ---------------------------------------------------------------------------
  // Scene geometry (SVG viewBox units) — the drawing itself is in index.html
  // ---------------------------------------------------------------------------

  var VIEW = { w: 1200, h: 400, margin: 8, top: 0, bottom: 400 };
  var MOON = { cx: 1192, cy: 200, r: 80 };    // labels keep clear of the moon's centre (may overlap its edge)
  // Label sizes on a wide screen. On narrow screens the drawing is scaled down to fit, so the
  // labels are drawn larger (factor K) to stay readable; see layout().
  var BASE_FONT = 23;            // label font size (SVG units) on wide screens
  var MIN_FONT_PX = 13;          // labels never get smaller than this on screen
  var MAX_LINE = 16;             // titles longer than this are split over two lines (wide screens)
  var K = 1;                     // current label scale factor
  var DATE_TO_TITLE, LINE_HEIGHT, ROCKET_SCALE;
  var INTRO_DURATION_MS = 2200;

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
  var scene = document.getElementById('scene');
  var trajectory = path;
  var ovalA = document.querySelector('.oval-a');
  var ovalB = document.querySelector('.oval-b');
  var stage = document.getElementById('stage');
  var currentDateEl = document.getElementById('currentDate');
  var currentPhaseEl = document.getElementById('currentPhase');

  var startTs = parseISO(START);
  var endTs = parseISO(END);
  var pathLength = path.getTotalLength();
  var sceneScroll = document.getElementById('sceneScroll');

  PHASES.forEach(function (phase) {
    phase.ts = parseISO(phase.iso);
  });

  useImageWhenAvailable(document.getElementById('moonImage'), document.getElementById('moonFallback'));
  useImageWhenAvailable(document.getElementById('rocketImage'), document.getElementById('rocketFallback'));

  // Point on the trajectory for a given date, plus the direction of travel there.
  function pointForDate(ts) {
    // Positions are in proportion to time: each day moves the rocket the same distance.
    var f = clamp((ts - startTs) / (endTs - startTs), 0, 1);
    var len = f * pathLength;
    var p = path.getPointAtLength(len);
    var ahead = path.getPointAtLength(Math.min(pathLength, len + 1));
    var behind = path.getPointAtLength(Math.max(0, len - 1));
    var dx = ahead.x - behind.x;
    var dy = ahead.y - behind.y;
    var m = Math.hypot(dx, dy) || 1;
    return { len: len, x: p.x, y: p.y, tx: dx / m, ty: dy / m };
  }

  // ---------------------------------------------------------------------------
  // Phase dots and labels
  // Every label sits directly above or below its own dot, centred on it. Where two dots are
  // close together, their labels go on opposite sides of the path.
  // ---------------------------------------------------------------------------

  var placed = [];      // label boxes already placed
  var labelMisses = 0;  // labels that found no free spot in the current layout
  var pathSamples = []; // points along the path and the dots: labels keep clear

  function rectsOverlap(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  }

  function rectHitsCircle(box, c) {
    var qx = clamp(c.cx, box.x0, box.x1);
    var qy = clamp(c.cy, box.y0, box.y1);
    return Math.hypot(c.cx - qx, c.cy - qy) < c.r;
  }

  function collectPathSamples() {
    for (var len = 0; len <= pathLength; len += 12) {
      var p = path.getPointAtLength(len);
      pathSamples.push({ cx: p.x, cy: p.y, r: 10 * Math.sqrt(K) });
    }
    // The rocket waits at the start of the path before the call opens: keep that spot clear.
    var start = path.getPointAtLength(0);
    pathSamples.push({ cx: start.x, cy: start.y, r: 40 * Math.sqrt(K) });
    PHASES.forEach(function (phase) {
      var pt = pointForDate(phase.ts);
      pathSamples.push({ cx: pt.x, cy: pt.y, r: 14 * Math.sqrt(K) });
    });
  }

  // Splits a title over lines. On wide screens a manual \n in `short` is respected and longer
  // titles are split in two; on narrow screens the words are wrapped to short lines.
  function wrapTitle(text) {
    if (K === 1) {
      if (text.indexOf('\n') !== -1 || text.length <= MAX_LINE) return text.split('\n');
      var mid = text.length / 2;
      var best = -1;
      for (var i = 0; i < text.length; i++) {
        if (text[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
      }
      return best === -1 ? [text] : [text.slice(0, best), text.slice(best + 1)];
    }
    var max = 14;
    var lines = [];
    text.replace(/\n/g, ' ').split(' ').forEach(function (word) {
      var last = lines[lines.length - 1];
      if (last !== undefined && (last + ' ' + word).length <= max) lines[lines.length - 1] = last + ' ' + word;
      else lines.push(word);
    });
    return lines;
  }

  // Chooses whether a label of width w and given height goes above or below the dot at pt,
  // and how far from it: the free spot closest to the dot wins (below wins a tie).
  function placeLabel(pt, w, height) {
    var centre = clamp(pt.x, VIEW.margin + w / 2, VIEW.w - VIEW.margin - w / 2);
    var gaps = [14, 24, 36, 50, 66, 85, 105, 130].map(function (g) { return g * K; });
    var best = null;
    // A label may shift sideways a little (it always stays under/over its own dot)
    [0, -20, 20, -40, 40, -60, 60, -80, 80].forEach(function (shift) {
      var cx = centre + shift;
      if (Math.abs(cx - pt.x) > w / 2 - 10) return;
      gaps.forEach(function (gap) {
        [1, -1].forEach(function (side) { // 1 = below, -1 = above
          var top = side === 1 ? pt.y + gap : pt.y - gap - height;
          var box = { x0: cx - w / 2 - 6, x1: cx + w / 2 + 6, y0: top, y1: top + height };
          if (box.y0 < VIEW.top + VIEW.margin || box.y1 > VIEW.bottom - VIEW.margin) return;
          if (box.x0 < 0 || box.x1 > VIEW.w) return;
          if (rectHitsCircle(box, MOON)) return;
          if (pathSamples.some(function (c) { return rectHitsCircle(box, c); })) return;
          if (placed.some(function (q) { return rectsOverlap(box, q); })) return;
          var score = gap + (side === 1 ? 0 : 1) + Math.abs(shift) * 0.8;
          if (!best || score < best.score) best = { cx: cx, top: top, box: box, score: score };
        });
      });
    });
    if (!best) { // no free spot: fall back to just below the dot
      labelMisses++;
      var top = pt.y + 14;
      best = { cx: centre, top: top, box: { x0: centre - w / 2, x1: centre + w / 2, y0: top, y1: top + height } };
    }
    placed.push(best.box);
    return { cx: best.cx, top: best.top };
  }

  function buildPhase(phase, index) {
    var pt = pointForDate(phase.ts);
    var dateText = phaseDateText(phase);

    var g = el('g', {
      class: 'phase',
      role: 'img',
      'aria-label': dateText + ': ' + phase.title + '. ' + phase.text
    });

    var dotScale = Math.sqrt(K);
    g.appendChild(el('circle', { class: 'halo', cx: pt.x, cy: pt.y, r: 14 * dotScale }));
    g.appendChild(el('circle', { class: 'dot', cx: pt.x, cy: pt.y, r: 8 * dotScale, style: 'stroke-width:' + 3 * dotScale + 'px' }));

    var textStyle = 'font-size:' + BASE_FONT * K + 'px;stroke-width:' + 6 * K + 'px';
    var dateEl = el('text', { class: 'phase-date', style: textStyle });
    dateEl.textContent = dateText;
    var titleEl = el('text', { class: 'phase-title', style: textStyle });
    var lines = wrapTitle(phase.short);
    var tspans = lines.map(function (line, k) {
      var t = el('tspan', { dy: k === 0 ? 0 : LINE_HEIGHT });
      t.textContent = line;
      titleEl.appendChild(t);
      return t;
    });
    g.appendChild(dateEl);
    g.appendChild(titleEl);
    phasesG.appendChild(g);

    // Measure the real text width (after the web font has loaded), then place the label.
    var w = Math.max.apply(null, [dateEl.getComputedTextLength()].concat(
      tspans.map(function (t) { return t.getComputedTextLength(); })));
    if (!w) w = Math.max.apply(null, [dateText.length].concat(lines.map(function (l) { return l.length; }))) * 10;
    var height = 13 * K + DATE_TO_TITLE + (lines.length - 1) * LINE_HEIGHT + 12 * K;
    var spot = placeLabel(pt, w, height);

    dateEl.setAttribute('x', spot.cx);
    dateEl.setAttribute('y', spot.top + 12 * K);
    titleEl.setAttribute('y', spot.top + 12 * K + DATE_TO_TITLE);
    tspans.forEach(function (t) { t.setAttribute('x', spot.cx); });

    phase.svgEl = g;
  }

  // ---------------------------------------------------------------------------
  // Rocket and status
  // ---------------------------------------------------------------------------

  function placeRocketAtLength(len) {
    var p = path.getPointAtLength(len);
    var a = path.getPointAtLength(Math.min(pathLength, len + 1));
    var b = path.getPointAtLength(Math.max(0, len - 1));
    var angle = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;
    rocket.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') rotate(' + angle + ') scale(' + ROCKET_SCALE + ')');
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
      phase.svgEl.classList.toggle('is-done', done);
      phase.svgEl.classList.toggle('is-next', isNext);
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

  // The drawing always fits the width of the screen. On narrow screens it gets more room above
  // and below the path, and the labels, dots and rocket are drawn larger so they stay readable.
  function layout() {
    var px = scene.getBoundingClientRect().width || VIEW.w;
    var k = clamp((MIN_FONT_PX / (px / VIEW.w)) / BASE_FONT, 1, 2.6);
    k = Math.round(k * 10) / 10;
    if (k === K && phasesG.childNodes.length) return false;
    K = k;
    DATE_TO_TITLE = 30 * K;
    LINE_HEIGHT = 26 * K;
    ROCKET_SCALE = 1.05 * Math.sqrt(K);

    // Try to fit all labels; if one finds no free spot, give the drawing a bit more height.
    for (var room = 1; room <= 2.2; room += 0.3) {
      var extraTop = Math.round((K - 1) * 200 * room);
      var extraBottom = Math.round((K - 1) * 170 * room);
      VIEW.top = -extraTop;
      VIEW.bottom = VIEW.h + extraBottom;
      scene.setAttribute('viewBox', '0 ' + VIEW.top + ' ' + VIEW.w + ' ' + (VIEW.bottom - VIEW.top));
      // The Earth ovals grow so they still run off the bottom edge
      ovalA.setAttribute('r', 150 + extraBottom);
      ovalB.setAttribute('r', 150 + extraBottom);
      progress.style.strokeWidth = trajectory.style.strokeWidth = 4 * Math.sqrt(K);

      phasesG.textContent = '';
      placed = [];
      pathSamples = [];
      labelMisses = 0;
      collectPathSamples();
      // The first stage (squeezed against the left edge) and the stages near the Moon (closest
      // together) have the fewest free spots, so their labels are placed first.
      // The dots are then put back in date order.
      buildPhase(PHASES[0], 0);
      for (var i = PHASES.length - 1; i >= 1; i--) buildPhase(PHASES[i], i);
      PHASES.forEach(function (phase) { phasesG.appendChild(phase.svgEl); });
      if (!labelMisses || K === 1) break;
    }
    return true;
  }

  function init() {
    layout();
    placeRocketAtLength(0);
    update(true);

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (layout()) { lastDay = null; update(false); }
      }, 150);
    });

    // Check once a minute whether the day has changed (e.g. a page left open overnight),
    // and immediately when the visitor returns to the tab.
    setInterval(function () { update(false); }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) update(false);
    });

    reportHeight();
  }

  // When the timeline is embedded in an iframe, tell the parent page how tall it is,
  // so the iframe can fit the content exactly (see README: "Embedding").
  function reportHeight() {
    if (window.parent === window) return;
    var last = 0;
    function send() {
      var h = Math.ceil(document.querySelector('.page').getBoundingClientRect().height);
      if (h && h !== last) {
        last = h;
        window.parent.postMessage({ type: 'moonshot-timeline-height', height: h }, '*');
      }
    }
    send();
    window.addEventListener('resize', send);
    if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
  }

  // Wait for the web font so that label widths are measured with the right font.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init, init);
  } else {
    init();
  }
})();
