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
      text: 'Applicants hear whether their pre-proposal is selected. Companies can express their interest in one or more projects by submitting a Letter of Intent (LOI).'
    },
    {
      iso: '2027-08-31',
      current: 'Evaluation of Letters of Intent',
      short: 'Closure LOI phase',
      title: 'Closure LOI phase',
      text: 'Final deadline for companies to submit Letters of Intent (LOIs).'
    },
    {
      iso: '2027-09-30',
      label: 'September 2027',
      current: 'IGNITE results announced',
      short: 'IGNITE results announced',
      title: 'IGNITE results announced',
      text: 'The selected IGNITE projects are announced. Selection is made by VLAIO (HBC).'
    },
    {
      iso: '2027-11-30',
      label: 'November 2027',
      current: 'ESI results announced',
      short: 'ESI results announced',
      title: 'ESI results announced',
      text: 'The selected Early Stage Innovation (ESI) projects are announced. Selection is made by VLAIO (HBC).'
    },
    {
      iso: '2027-12-31',
      label: 'December 2027',
      current: 'All results announced',
      short: 'LSI results announced',
      title: 'LSI results announced',
      text: 'The selected Later Stage Innovation (LSI) projects are announced. Selection is made by the Flemish Government.'
    }
  ];

  // ---------------------------------------------------------------------------
  // Scene geometry (SVG viewBox units) — the drawing itself is in index.html
  // ---------------------------------------------------------------------------

  var VIEW = { w: 1200, h: 400, margin: 8 };
  var MOON = { cx: 1192, cy: 200, r: 80 };    // labels keep clear of the moon's centre (may overlap its edge)
  var DATE_TO_TITLE = 30;        // date line to first title line
  var LINE_HEIGHT = 26;          // extra height per additional title line
  var MAX_LINE = 16;             // titles longer than this are split over two lines
  var INFO_OFFSET = 26;          // distance from a dot to its (i) badge
  var ROCKET_SCALE = 1.05;
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
  // Every label sits directly above or below its own dot, centred on it. Where two dots are
  // close together, their labels go on opposite sides of the path.
  // ---------------------------------------------------------------------------

  var placed = [];      // label boxes already placed
  var pathSamples = []; // points along the path, the dots and their (i) badges: labels keep clear

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
      pathSamples.push({ cx: p.x, cy: p.y, r: 10 });
    }
    // The rocket waits at the start of the path before the call opens: keep that spot clear.
    var start = path.getPointAtLength(0);
    pathSamples.push({ cx: start.x, cy: start.y, r: 40 });
    PHASES.forEach(function (phase) {
      var pt = pointForDate(phase.ts);
      pathSamples.push({ cx: pt.x, cy: pt.y, r: 14 });
      pathSamples.push({ cx: pt.x + INFO_OFFSET, cy: pt.y, r: 15 });
    });
  }

  // Splits a title longer than MAX_LINE characters over two lines (at the space nearest the
  // middle). A manual \n in `short` is respected.
  function wrapTitle(text) {
    if (text.indexOf('\n') !== -1 || text.length <= MAX_LINE) return text.split('\n');
    var mid = text.length / 2;
    var best = -1;
    for (var i = 0; i < text.length; i++) {
      if (text[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    }
    return best === -1 ? [text] : [text.slice(0, best), text.slice(best + 1)];
  }

  // Chooses whether a label of width w and given height goes above or below the dot at pt,
  // and how far from it: the free spot closest to the dot wins (below wins a tie).
  function placeLabel(pt, w, height) {
    var centre = clamp(pt.x, VIEW.margin + w / 2, VIEW.w - VIEW.margin - w / 2);
    var best = null;
    // A label may shift sideways a little (it always stays under/over its own dot)
    [0, -20, 20, -40, 40].forEach(function (shift) {
      var cx = centre + shift;
      if (Math.abs(cx - pt.x) > w / 2 - 10) return;
      [14, 24, 36, 50, 66].forEach(function (gap) {
        [1, -1].forEach(function (side) { // 1 = below, -1 = above
          var top = side === 1 ? pt.y + gap : pt.y - gap - height;
          var box = { x0: cx - w / 2 - 6, x1: cx + w / 2 + 6, y0: top, y1: top + height };
          if (box.y0 < VIEW.margin || box.y1 > VIEW.h - VIEW.margin) return;
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
      console.warn('no free label spot', Math.round(pt.x));
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
      tabindex: '0',
      role: 'button',
      'aria-label': dateText + ': ' + phase.title + '. ' + phase.text
    });

    g.appendChild(el('circle', { class: 'halo', cx: pt.x, cy: pt.y, r: 14 }));
    g.appendChild(el('circle', { class: 'dot', cx: pt.x, cy: pt.y, r: 8 }));

    var info = el('g', { class: 'info', transform: 'translate(' + (pt.x + INFO_OFFSET) + ',' + pt.y + ')' });
    info.appendChild(el('circle', { r: 13 }));
    var iText = el('text', { y: 5.4 });
    iText.textContent = 'i';
    info.appendChild(iText);
    g.appendChild(info);

    var dateEl = el('text', { class: 'phase-date' });
    dateEl.textContent = dateText;
    var titleEl = el('text', { class: 'phase-title' });
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
    var height = 13 + DATE_TO_TITLE + (lines.length - 1) * LINE_HEIGHT + 12;
    var spot = placeLabel(pt, w, height);

    dateEl.setAttribute('x', spot.cx);
    dateEl.setAttribute('y', spot.top + 12);
    titleEl.setAttribute('y', spot.top + 12 + DATE_TO_TITLE);
    tspans.forEach(function (t) { t.setAttribute('x', spot.cx); });

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
    rocket.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') rotate(' + angle + ') scale(' + ROCKET_SCALE + ')');
    progress.setAttribute('stroke-dasharray', len + ' ' + (pathLength + 10));
  }

  // On small screens the drawing scrolls sideways: bring the rocket into view.
  function scrollToRocket() {
    if (sceneScroll.scrollWidth <= sceneScroll.clientWidth) return;
    var x = pointForDate(today()).x / VIEW.w * sceneScroll.scrollWidth;
    sceneScroll.scrollLeft = clamp(x - sceneScroll.clientWidth / 2, 0, sceneScroll.scrollWidth);
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
    collectPathSamples();
    // The stages near the Moon are closest together, so their labels are placed first.
    // The dots are then put back in date order for keyboard (Tab) navigation.
    for (var i = PHASES.length - 1; i >= 0; i--) buildPhase(PHASES[i], i);
    PHASES.forEach(function (phase) { phasesG.appendChild(phase.svgEl); });
    buildList();
    placeRocketAtLength(0);
    update(true);
    scrollToRocket();

    // Check once a minute whether the day has changed (e.g. a page left open overnight),
    // and immediately when the visitor returns to the tab.
    setInterval(function () { update(false); }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) update(false);
    });

    document.addEventListener('click', hideTooltip); // tap elsewhere closes the tooltip (touch)
    sceneScroll.addEventListener('scroll', hideTooltip);
    window.addEventListener('resize', function () {
      if (openAnchor) positionTooltip(openAnchor);
    });
  }

  // Wait for the web font so that label widths are measured with the right font.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init, init);
  } else {
    init();
  }
})();
