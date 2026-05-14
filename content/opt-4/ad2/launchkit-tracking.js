(function () {
  'use strict';

  var config = window.LAUNCHKIT_TRACKING;
  if (!config || !config.lpId || !config.apiBase) {
    return;
  }

  var apiBase = config.apiBase.replace(/\/+$/, '');
  var endpoint = apiBase + '/api/launchkit/events';

  function getUtm() {
    try {
      var params = new URLSearchParams(window.location.search);
      return {
        source: params.get('utm_source') || undefined,
        medium: params.get('utm_medium') || undefined,
        campaign: params.get('utm_campaign') || undefined
      };
    } catch (e) {
      return {};
    }
  }

  function getFbclid() {
    try {
      return new URLSearchParams(window.location.search).get('fbclid') || undefined;
    } catch (e) {
      return undefined;
    }
  }

  function sendEvent(eventType, opts) {
    var payload = {
      lpId: config.lpId,
      eventType: eventType,
      url: window.location.href,
      utm: getUtm(),
      fbclid: getFbclid()
    };

    var body = JSON.stringify(payload);

    try {
      // keepalive: ページ遷移直前でも送信完了させる
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        mode: 'cors'
      });
    } catch (e) {
      // 失敗しても遷移は止めない
      return Promise.resolve();
    }
  }

  // ---- page_view ----
  var pageViewSent = false;
  function trackPageView() {
    if (pageViewSent) return;
    pageViewSent = true;
    try {
      sendEvent('page_view');
    } catch (e) {
      // 握りつぶす
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView, { once: true });
  } else {
    trackPageView();
  }

  // ---- line_cta_click ----
  function attachCTAListeners() {
    var elements = document.querySelectorAll('[data-launchkit-line-cta]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (el.__launchkitBound) continue;
      el.__launchkitBound = true;
      el.addEventListener('click', handleCTAClick, { capture: false });
    }
  }

  function handleCTAClick(e) {
    var target = e.currentTarget;
    if (!target) return;

    // 遷移優先: 計測は keepalive で投げて、遷移は止めない
    try {
      try { if (typeof window.fbq === 'function') { fbq('track', 'Lead'); } } catch(e){}
      sendEvent('line_cta_click');
    } catch (err) {
      // 失敗しても無視
    }
    // 何もせずブラウザ標準のリンク遷移に任せる
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCTAListeners, { once: true });
  } else {
    attachCTAListeners();
  }

  // 動的に追加されたCTAボタン対応(必要な場合のみ。MutationObserverで監視)
  if (typeof MutationObserver !== 'undefined') {
    try {
      var observer = new MutationObserver(function () {
        attachCTAListeners();
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      // 監視失敗しても致命傷ではない
    }
  }
})();
