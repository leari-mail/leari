import React from "react";
import ReactDOM from "react-dom/client";
import { App, AppProviders } from "@app";
import { detectPlatform } from "@lib";
import "@i18n";
import "./styles/globals.css";

// Lets CSS adapt to the native window chrome (vibrancy, traffic lights).
document.documentElement.dataset.platform = detectPlatform();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
