import './index.css';
import React from "react";
import { render } from "react-dom";
import { App } from "./App";

const GA_MEASUREMENT_ID = "G-NLS0H7PMCY";

const initGoogleAnalytics = () => {
  if (!import.meta.env.PROD) {
    return;
  }

  const gtagScript = document.createElement("script");
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(gtagScript);

  const gaWindow = window as Window & { dataLayer?: unknown[] };
  gaWindow.dataLayer = gaWindow.dataLayer || [];

  const gtag = (...args: unknown[]) => {
    gaWindow.dataLayer?.push(args);
  };

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
};

initGoogleAnalytics();

render(<App />, document.getElementById("root"));
