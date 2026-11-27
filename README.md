# Moonshot Flanders — Call 2027 Timeline

Interactive timeline for Moonshot Flanders Call 2027. A rocket travels from the Earth (bottom left) to the Moon (top right) along a dotted path. Each dot marks a stage of the call, and the rocket's position follows the visitor's current date.

## Files

- `index.html`: page structure and the illustration (ovals, moon, path, rocket)
- `style.css`: Moonshot house style (colours and the League Spartan typeface)
- `script.js`: stages, dates and texts, label placement and rocket position
- `assets/rocket.png`: Moonshot rocket
- `assets/moon.webp`: moon picture (add it to this folder; a drawn moon is shown until it is there)

## Editing dates and texts

All stages are in the `PHASES` list at the top of `script.js`:

- `iso`: the date (YYYY-MM-DD). For stages with only a month, use the last day of the month.
- `label`: optional text shown instead of the date, for example `November 2027`.
- `short`: the label on the timeline. Use `\n` to split it over two lines.
- `title` and `text`: read out by screen readers.
- `current`: shown after "Current:" at the top, from this date until the next stage.

## Previewing another date

Add `?date=YYYY-MM-DD` to the page address, for example `index.html?date=2027-06-01`.

## Embedding

The timeline reports its own height to the page it is embedded in, so the iframe can always fit it exactly. On narrow screens the drawing keeps a readable size and can be scrolled sideways. Paste this into the page (Drupal: Full HTML text format):

```html
<iframe id="moonshot-timeline" src="https://catalisti-vzw.github.io/moonshot-flanders-call-2027-timeline/"
        title="Call 2027 timeline" style="width:100%;height:420px;border:0;display:block" loading="lazy"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'moonshot-timeline-height') {
      document.getElementById('moonshot-timeline').style.height = e.data.height + 'px';
    }
  });
</script>
```
