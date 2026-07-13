/// <reference types="vite/client" />

import type { StellaDesktopApi } from "../../../shared/contracts";

declare global {
  interface Window {
    stella: StellaDesktopApi;
  }
}

export {};
