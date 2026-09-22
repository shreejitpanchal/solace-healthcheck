import { createApp } from "./ui.js";

const root = document.querySelector("#app");
if (root) {
  globalThis.solaceReadiness = createApp(root);
}
