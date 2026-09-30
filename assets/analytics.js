/* Vercel Web Analytics — cookieless, no consent banner needed (see /privatnost).
   Shim queues events before /_vercel/insights/script.js loads; eaiEvent() is the
   convenience wrapper used across pages for custom events (signup_submit, cta_click, founder_view). */
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.eaiEvent = function (name, data) { window.va('event', { name: name, data: data || {} }); };
