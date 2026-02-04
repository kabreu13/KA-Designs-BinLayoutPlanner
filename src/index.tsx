import './index.css';
import React from "react";
import { render } from "react-dom";
import { App } from "./App";

const GA_MEASUREMENT_ID = "G-NLS0H7PMCY";

const initGoogleAnalytics = () => {
  const shouldTrack = import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";
  if (!shouldTrack) {
    return;
  }

  const gaScriptSrc = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  if (!document.querySelector(`script[src="${gaScriptSrc}"]`)) {
    const gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src = gaScriptSrc;
    document.head.appendChild(gtagScript);
  }

  const gaWindow = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __gaInitialized?: boolean;
  };
  if (gaWindow.__gaInitialized) {
    return;
  }
  gaWindow.__gaInitialized = true;

  gaWindow.dataLayer = gaWindow.dataLayer || [];

  gaWindow.gtag = function () {
    // GA expects queued entries in the same shape as the official snippet.
    // eslint-disable-next-line prefer-rest-params
    gaWindow.dataLayer?.push(arguments);
  };

  gaWindow.gtag("js", new Date());
  gaWindow.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: true,
    debug_mode: import.meta.env.VITE_GA_DEBUG === "true",
  });
};

initGoogleAnalytics();

render(<App />, document.getElementById("root"));
