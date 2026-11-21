// Report document-level metrics by landing route, including navigation restored from bfcache.
import {onCLS,onINP,onLCP} from './vendor/web-vitals/web-vitals-6.2.3.js';

const landing=location.pathname.replace(/\/$/,'')||'/welcome';
if(window.top===window.self && ['/welcome','/menu','/contact'].includes(landing) &&
   !new URLSearchParams(location.search).has('preview') && typeof window.gtag==='function'){
  const report=({name,value,delta,id,rating})=>window.gtag('event',name,{
    send_to:'G-V9S0D0J0RX',value:name==='CLS'?Math.round(delta*1000):Math.round(delta),
    metric_value:value,metric_delta:delta,metric_id:id,metric_rating:rating,landing_route:landing
  });
  onCLS(report);onINP(report);onLCP(report);
}
