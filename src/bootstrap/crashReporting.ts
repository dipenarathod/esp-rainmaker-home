/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Crashlytics bootstrap. Without this, a JS crash reaches Crashlytics as a
 * `JavascriptException` of RN bridge frames naming no application code.
 *
 * The module CONSTRUCTOR installs the JS global error handler and the rejection
 * tracker, so `getCrashlytics()` must be called — importing is not enough.
 *
 * Skipped in the CN region, where no Firebase app exists to attach to.
 */

import { isCnRegion } from "@config/region.config";

function initCrashReporting(): void {
  if (isCnRegion()) return;

  try {
    // Required, not imported: never look the native module up where Firebase is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCrashlytics } = require("@react-native-firebase/crashlytics");
    getCrashlytics();
  } catch (error) {
    // Crash reporting must never be the reason the app fails to start.
    console.warn("[crashReporting] Crashlytics init skipped:", error);
  }
}

initCrashReporting();
