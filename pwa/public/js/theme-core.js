/* OS1 theme core — pure functions, no DOM, no Node.
 *
 * Shared by the browser applier (public/js/theme.js) and the contrast checker
 * (scripts/check-theme-contrast.mjs) so the two can never disagree about what a
 * theme actually resolves to. Attaches to the global as OS1ThemeCore.
 *
 * Contract: a theme supplies a small set of semantic tokens; everything else is
 * derived here. Values are sanitized before they ever reach CSS.
 */
(function (root) {
  'use strict';

  /* Semantic token -> the CSS custom property it drives.
     The CSS keeps its historical OS1 names ("cream", "coral"); the theme contract
     is semantic so a theme author never has to know the house palette's story. */
  var TOKEN_TO_VAR = {
    'surface': '--bg-cream',
    'surface-raised': '--bg-beige',
    'brand': '--coral',
    'brand-mid': '--coral-500',
    'brand-light': '--coral-400',
    'brand-pale': '--coral-300',
    'brand-strong': '--coral-600',
    'on-surface': '--on-cream-primary',
    'on-surface-secondary': '--on-cream-secondary',
    'on-surface-muted': '--on-cream-muted',
    'on-brand': '--on-coral-primary',
    'on-brand-secondary': '--on-coral-secondary',
    'on-brand-muted': '--on-coral-muted',
    'glass-fill': '--glass-fill',
    'glass-border': '--glass-border',
    'glass-fill-hover': '--glass-fill-hover',
    'glass-border-hover': '--glass-border-hover',
    'overlay': '--dark-overlay',
    'warning': '--warning',
    'danger': '--danger',
    'success': '--success',
    'tabbar-bg': '--tabbar-bg',
    'brand-shadow': '--brand-shadow',
    'brand-shadow-soft': '--brand-shadow-soft',
    'surface-shadow': '--surface-shadow',
    'card-alt-bg': '--card-alt-bg',
    'col-bg': '--col-bg',
    'input-bg': '--input-bg',
    'inset-highlight': '--inset-highlight',
    'on-warning': '--on-warning',
    'radius': '--radius',
    'radius-small': '--radius-sm'
  };

  /* A theme must supply these. Everything else has a derivation. */
  var REQUIRED = ['surface', 'brand', 'brand-strong', 'on-surface', 'on-brand',
    'success', 'warning', 'danger'];

  var HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  var RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/;
  var LENGTH = /^\d{1,3}(?:\.\d+)?(px|rem|em)$/;

  /* ---- sanitizing ---- */

  function safeColor(value) {
    if (typeof value !== 'string') return null;
    var v = value.trim();
    if (HEX.test(v) || RGB.test(v)) return v;
    return null;
  }

  function safeLength(value) {
    if (typeof value !== 'string') return null;
    var v = value.trim();
    return LENGTH.test(v) ? v : null;
  }

  /* ---- color math ---- */

  function parse(value) {
    var v = String(value || '').trim();
    var m = v.match(RGB);
    if (m) {
      return {
        r: Math.min(255, +m[1]), g: Math.min(255, +m[2]), b: Math.min(255, +m[3]),
        a: m[4] === undefined ? 1 : parseFloat(m[4])
      };
    }
    if (!HEX.test(v)) return null;
    var h = v.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h.split('').map(function (c) { return c + c; }).join('');
    }
    var n = parseInt(h.slice(0, 6), 16);
    var a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: a };
  }

  function css(c) {
    var r = Math.round(c.r), g = Math.round(c.g), b = Math.round(c.b);
    if (c.a >= 1) {
      return '#' + [r, g, b].map(function (x) {
        return ('0' + x.toString(16)).slice(-2).toUpperCase();
      }).join('');
    }
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.round(c.a * 100) / 100 + ')';
  }

  function withAlpha(color, a) {
    var c = parse(color);
    if (!c) return null;
    return css({ r: c.r, g: c.g, b: c.b, a: a });
  }

  function mix(color, target, amount) {
    var c = parse(color), t = parse(target);
    if (!c || !t) return null;
    return css({
      r: c.r + (t.r - c.r) * amount,
      g: c.g + (t.g - c.g) * amount,
      b: c.b + (t.b - c.b) * amount,
      a: c.a
    });
  }

  function darken(color, amount) { return mix(color, '#000000', amount); }
  function lighten(color, amount) { return mix(color, '#FFFFFF', amount); }

  /* Flatten a translucent color onto an opaque backdrop. Needed because most OS1
     text tokens are rgba over a known surface, and WCAG is defined on solid pairs. */
  function over(fg, bg) {
    var f = parse(fg), b = parse(bg);
    if (!f || !b) return null;
    if (b.a < 1) b = parse(over(bg, '#FFFFFF'));
    var a = f.a;
    return css({
      r: f.r * a + b.r * (1 - a),
      g: f.g * a + b.g * (1 - a),
      b: f.b * a + b.b * (1 - a),
      a: 1
    });
  }

  function luminance(color) {
    var c = parse(color);
    if (!c) return null;
    var ch = [c.r, c.g, c.b].map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  /* WCAG 2.1 contrast ratio. Both arguments must already be flattened via over(). */
  function contrast(fg, bg) {
    var l1 = luminance(fg), l2 = luminance(bg);
    if (l1 === null || l2 === null) return null;
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Whichever of the theme's dark/light inks reads better on a given fill. */
  function bestInkOn(bg, darkInk, lightInk) {
    var d = contrast(over(darkInk, bg), bg);
    var l = contrast(over(lightInk, bg), bg);
    return (d || 0) >= (l || 0) ? darkInk : lightInk;
  }

  /* Softest version of `ink` that still clears `target` contrast on `bg`.
     Fades ink toward `toward` and binary-searches the furthest fade that passes.
     This is why derived tiers are accessible by construction: a fixed alpha ladder
     (the old 0.72/0.50) lands wherever it lands, whereas this lands on the number.
     Fixed iteration count and integer output keep it identical in every runtime. */
  function fadeToContrast(ink, toward, bg, target) {
    var solid = over(ink, bg);
    if ((contrast(solid, bg) || 0) < target) return solid;
    var lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) {
      var mid = (lo + hi) / 2;
      var candidate = over(mix(solid, toward, mid), bg);
      if ((contrast(candidate, bg) || 0) >= target) lo = mid; else hi = mid;
    }
    return over(mix(solid, toward, lo), bg);
  }

  /* ---- resolution ---- */

  /* Take a theme's colors block and fill in every token it did not supply.
     Returns { tokens, errors }. Pure: same input, same output, in both runtimes. */
  function resolve(colors, radius) {
    var errors = [];
    var raw = colors || {};
    var t = {};

    Object.keys(TOKEN_TO_VAR).forEach(function (key) {
      if (!(key in raw)) return;
      var isLength = key === 'radius' || key === 'radius-small';
      var clean = isLength ? safeLength(raw[key]) : safeColor(raw[key]);
      if (clean === null) {
        errors.push('token "' + key + '" has an unusable value and was dropped');
        return;
      }
      t[key] = clean;
    });

    REQUIRED.forEach(function (key) {
      if (!t[key]) errors.push('missing required token: ' + key);
    });
    if (errors.length) return { tokens: null, errors: errors };

    /* Opaque ink, used as the base for every translucent on-surface tier and for
       the shadows, so a theme only ever states one text color. */
    var inkSolid = over(t['on-surface'], t['surface']);

    function fill(key, value) { if (!t[key]) t[key] = value; }

    fill('surface-raised', darken(t['surface'], 0.05));
    fill('brand-mid', darken(t['brand'], 0.03));
    fill('brand-light', lighten(t['brand'], 0.12));
    fill('brand-pale', lighten(t['brand'], 0.35));

    /* Text tiers are contrast-targeted against the WORST backdrop each one actually
       lands on, not against the nominal one. Dark ink is hardest to read on the
       darkest surface it touches (the bare page); light ink is hardest on the
       lightest brand fill it touches (the translucent input well). */
    var lightestBrand = over(t['input-bg'] || 'rgba(255, 255, 255, 0.16)', t['brand']);
    fill('on-surface-secondary', fadeToContrast(inkSolid, t['surface'], t['surface'], 7));
    fill('on-surface-muted', fadeToContrast(inkSolid, t['surface'], t['surface'], 4.6));
    fill('on-brand-secondary', fadeToContrast(t['on-brand'], t['brand'], lightestBrand, 4.6));
    fill('on-brand-muted', fadeToContrast(t['on-brand'], t['brand'], t['brand'], 3.2));
    fill('glass-fill', 'rgba(255, 255, 255, 0.1)');
    fill('glass-border', 'rgba(255, 255, 255, 0.3)');
    fill('glass-fill-hover', 'rgba(255, 255, 255, 0.2)');
    fill('glass-border-hover', 'rgba(255, 255, 255, 0.5)');
    fill('overlay', withAlpha(inkSolid, 0.18));
    fill('tabbar-bg', withAlpha(t['surface'], 0.92));
    fill('brand-shadow', withAlpha(t['brand-strong'], 0.25));
    fill('brand-shadow-soft', withAlpha(t['brand-strong'], 0.18));
    fill('surface-shadow', withAlpha(inkSolid, 0.1));
    fill('card-alt-bg', 'rgba(255, 255, 255, 0.35)');
    fill('col-bg', 'rgba(255, 255, 255, 0.3)');
    fill('input-bg', 'rgba(255, 255, 255, 0.16)');
    fill('inset-highlight', 'rgba(255, 255, 255, 0.45)');
    fill('on-warning', bestInkOn(t['warning'], withAlpha(inkSolid, 0.9), 'rgba(255, 255, 255, 0.95)'));

    if (radius && typeof radius === 'object') {
      var base = safeLength(radius.base), small = safeLength(radius.small);
      if (base) t['radius'] = base;
      if (small) t['radius-small'] = small;
    }

    return { tokens: t, errors: [] };
  }

  /* Resolved tokens -> the CSS custom properties to stamp on <html>. */
  function toCssVars(tokens) {
    var out = {};
    Object.keys(tokens).forEach(function (key) {
      var name = TOKEN_TO_VAR[key];
      if (name) out[name] = tokens[key];
    });
    return out;
  }

  /* Pick the palette for the current color scheme, falling back to light. */
  function paletteFor(theme, prefersDark) {
    var c = (theme && theme.colors) || {};
    if (prefersDark && c.dark) return c.dark;
    return c.light || null;
  }

  root.OS1ThemeCore = {
    TOKEN_TO_VAR: TOKEN_TO_VAR,
    REQUIRED: REQUIRED,
    safeColor: safeColor,
    safeLength: safeLength,
    parse: parse,
    css: css,
    withAlpha: withAlpha,
    mix: mix,
    darken: darken,
    lighten: lighten,
    over: over,
    luminance: luminance,
    contrast: contrast,
    bestInkOn: bestInkOn,
    resolve: resolve,
    toCssVars: toCssVars,
    paletteFor: paletteFor
  };
})(typeof self !== 'undefined' ? self : this);
