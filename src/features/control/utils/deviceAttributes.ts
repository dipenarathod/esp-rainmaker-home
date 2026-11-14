/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPCDFDevice } from "@store";

/** Device attribute (set in firmware) naming the control panel to open. */
export const CDF_ATTR_PANEL = "cdf.panel";
/** Device attribute (set in firmware) listing supported features, comma separated. */
export const CDF_ATTR_CAPS = "cdf.caps";

/**
 * Reads a firmware-set device attribute. Accepts both shapes the SDK may
 * hand back: `[{ name, value }]` and a plain `{ name: value }` object.
 * @param device - Device whose attributes to search
 * @param name - Attribute name, e.g. `cdf.panel`
 * @returns Attribute value as a string, or undefined when absent
 */
export const getDeviceAttribute = (
  device: ESPCDFDevice | undefined,
  name: string,
): string | undefined => {
  const attrs = (device as any)?.attributes;
  if (!attrs) return undefined;

  if (Array.isArray(attrs)) {
    const hit = attrs.find((a: any) => a?.name === name);
    return hit?.value !== undefined ? String(hit.value) : undefined;
  }
  if (typeof attrs === "object" && attrs[name] !== undefined) {
    return String(attrs[name]);
  }
  return undefined;
};

/**
 * Parses `cdf.caps` into a set of feature names (e.g. strip, mic).
 * @param device - Device to inspect
 * @returns Set of capability names; empty when the attribute is missing
 */
export const getDeviceCaps = (device: ESPCDFDevice | undefined): Set<string> => {
  const raw = getDeviceAttribute(device, CDF_ATTR_CAPS);
  return new Set(
    (raw ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
  );
};
