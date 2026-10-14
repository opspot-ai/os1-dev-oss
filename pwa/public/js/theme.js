/* OS1 theme applier.
 *
 * Loads before the app so a customer's colors are on screen at first paint.
 * Resolution order:
 *   1. window.__OS1_THEME__  — inlined by the server when OS1_THEME is configured
 *                              (zero flash; this is the path an installed customer app takes)
 *   2. ?theme=<id>           — preview/QA override for one page load
 *   3. localStorage cache    — instant repaint on subsequent loads, then revalidated
 *   4. GET /theme.json       — the server's answer, cached for next time
 *
 * With no theme configured this file writes nothing: no inline styles, no meta
 * changes, no storage. The app renders exactly as it did before theming existed.
 */
(function () {
  'use strict';

  var core = self.OS1ThemeCore;
  if (!core) return;

  var CACHE_KEY = 'os1.theme.v1';
  var applied = null;
  var darkQuery = self.matchMedia ? self.matchMedia('(prefers-color-scheme: dark)') : null;

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeCache(theme) {
    try {
      if (theme) localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
      else localStorage.removeItem(CACHE_KEY);
    } catch (e) { /* private mode, quota — theming is cosmetic, never block on it */ }
  }

  function setMeta(name, value) {
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  /* Only same-origin absolute paths. Keeps a theme file from pointing the app at a
     third-party host (a themed install must not leak a request off-box). */
  function safeAssetPath(src) {
    if (typeof src !== 'string') return null;
    var v = src.trim();
    if (!/^\/[^/\\]/.test(v)) return null;
    if (/[<>"'\s]/.test(v)) return null;
    return v;
  }

  function applyBranding(theme, tokens) {
    if (theme.app_name) {
      var name = String(theme.app_name).slice(0, 40);
      document.title = name;
      setMeta('apple-mobile-web-app-title', name);
      var wordmark = document.querySelector('.wordmark');
      if (wordmark) wordmark.textContent = name;
    }

    var logo = theme.logo && safeAssetPath(theme.logo.src);
    if (logo) {
      var host = document.querySelector('.wordmark');
      if (host) {
        var img = document.createElement('img');
        img.src = logo;
        img.alt = String((theme.logo && theme.logo.alt) || theme.app_name || 'logo').slice(0, 80);
        img.className = 'wordmark-logo';
        host.textContent = '';
        host.appendChild(img);
      }
    }

    if (tokens['brand']) {
      setMeta('theme-color', tokens['brand']);
    }

    /* The installed app's own colors and name come from the manifest, so point it
       at the themed variant the server generates. */
    var manifest = document.querySelector('link[rel="manifest"]');
    if (manifest && theme.id) {
      manifest.setAttribute('href', '/manifest.json?theme=' + encodeURIComponent(theme.id));
    }
  }

  function apply(theme) {
    if (!theme || typeof theme !== 'object') return;

    var prefersDark = !!(darkQuery && darkQuery.matches);
    var palette = core.paletteFor(theme, prefersDark);
    if (!palette) return;

    var resolved = core.resolve(palette, theme.radius);
    if (!resolved.tokens) {
      if (self.console) console.warn('OS1 theme rejected:', resolved.errors.join('; '));
      return;
    }

    var vars = core.toCssVars(resolved.tokens);
    var style = document.documentElement.style;
    Object.keys(vars).forEach(function (name) {
      style.setProperty(name, vars[name]);
    });

    if (theme.colors && theme.colors.dark) {
      style.setProperty('color-scheme', 'light dark');
    }

    document.documentElement.setAttribute('data-os1-theme', String(theme.id || 'custom'));
    applied = theme;

    if (document.head) applyBranding(theme, resolved.tokens);
    else document.addEventListener('DOMContentLoaded', function () {
      applyBranding(theme, resolved.tokens);
    });
  }

  function queryTheme() {
    var m = /[?&]theme=([a-z0-9-]{1,40})(?:&|$)/i.exec(self.location.search || '');
    return m ? m[1].toLowerCase() : null;
  }

  /* Drop every inline override and fall back to the stylesheet's own :root. Used when
     the server says this install has no theme any more. Clearing beats reloading: the
     shell cache can hold an inlined theme, and a reload would just serve it again. */
  function clearTheme() {
    var style = document.documentElement.style;
    Object.keys(core.TOKEN_TO_VAR).forEach(function (key) {
      style.removeProperty(core.TOKEN_TO_VAR[key]);
    });
    style.removeProperty('color-scheme');
    document.documentElement.removeAttribute('data-os1-theme');
    applied = null;
  }

  function fetchTheme(id) {
    var url = '/theme.json' + (id ? '?theme=' + encodeURIComponent(id) : '');
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        if (!payload) return;
        var theme = payload.theme || null;
        writeCache(theme);
        if (theme) apply(theme);
        else if (applied) clearTheme();
      })
      .catch(function () { /* offline: whatever the cache already painted stands */ });
  }

  /* 1. Server-inlined theme paints with no network at all. Still revalidate after,
     because the shell cache can serve an HTML document with a since-changed theme
     baked into it, and an installed app would otherwise never see the new one. */
  if (self.__OS1_THEME__) {
    apply(self.__OS1_THEME__);
    writeCache(self.__OS1_THEME__);
    fetchTheme(queryTheme());
    return;
  }

  var requested = queryTheme();

  /* 3. Paint the cached theme first so a warm load never flashes the default. */
  if (!requested) {
    var cached = readCache();
    if (cached) apply(cached);
  }

  /* 2 and 4. Ask the server what this install should actually be wearing. */
  fetchTheme(requested);

  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', function () {
      if (applied) apply(applied);
    });
  }
})();
