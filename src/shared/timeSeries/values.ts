/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** Textual booleans some backends emit for bool params instead of JSON booleans. */
const BOOL_STRINGS: Record<string, number> = { true: 1, false: 0 };

/**
 * Reduces a reported value to a plottable number: booleans (and the strings
 * `"true"`/`"false"`) plot as 1/0, numeric strings are parsed, anything else
 * is dropped. Shared by the chart (raw samples) and the adaptors (Timestream
 * bucket values), so every backend coerces the same way.
 * @param value - Reported value
 * @returns Finite number, or undefined when the value is not plottable
 */
export const toPlottableNumber = (value: unknown): number | undefined => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed in BOOL_STRINGS) return BOOL_STRINGS[trimmed];
    if (trimmed === "") return undefined;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};
