#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const DEFAULT_SNIPPETS = {
  gtm: "<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\nnew Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\nj=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-XXXX');</script>\n<!-- End Google Tag Manager -->",
  fb: "<!-- Meta Pixel -->\n<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod? n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '000000000000000');fbq('track', 'PageView');</script>\n<!-- End Meta Pixel -->"
};

async function main() {
  const [, , slug, type] = process.argv;
  if (!slug || !type || !DEFAULT_SNIPPETS[type]) {
    console.error('Usage: node scripts/add-analytics.js <slug> <gtm|fb>');
    process.exit(1);
  }
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = path.join(projectRoot, 'configs', `${slug}.json`);
  if (!(await fs.pathExists(configPath))) {
    console.error('Config not found:', configPath);
    process.exit(1);
  }
  const config = await fs.readJson(configPath);
  config.tag_manager = config.tag_manager || { head: [], body: [] };
  if (!Array.isArray(config.tag_manager.head)) config.tag_manager.head = [];
  config.tag_manager.head.push(DEFAULT_SNIPPETS[type]);
  await fs.outputJson(configPath, config, { spaces: 2 });
  console.log(`Added ${type.toUpperCase()} snippet to ${slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
