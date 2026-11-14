import React from "react";
import { createRoot } from "react-dom/client";
import "./desktop-window.css";
import { App } from "./App.jsx";
import "./styles.css";
import "./handdrawn.css";
import "./desktop.js";
import { GamepadSupport } from "./input/GamepadSupport.jsx";

if (window.gardenDesktop) document.body.classList.add('is-desktop');

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <GamepadSupport />
  </React.StrictMode>,
);
