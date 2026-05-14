/*!
 * LaunchKit Meta Pixel (CVR トラッキング)
 * 全LPで共通に読み込む。Pixel IDの変更はこのファイル1箇所だけ。
 */
(function () {
  'use strict';
  if (window.fbq) return;

  var PIXEL_ID = '1428099569345627';

  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;
    n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments) };
    if(!f._fbq)f._fbq=n;
    n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[];
    t=b.createElement(e); t.async=!0;
    t.src=v;
    s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  // noscript fallback
  try {
    var img = document.createElement('img');
    img.height = 1; img.width = 1; img.style.display = 'none';
    img.src = 'https://www.facebook.com/tr?id=' + PIXEL_ID + '&ev=PageView&noscript=1';
    document.body && document.body.appendChild(img);
  } catch (e) {}
})();
