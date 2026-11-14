/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPCDFDevice } from "@store";
import { getDeviceAttribute } from "@features/control/utils/deviceAttributes";

/**
 * Pixel Frame contract, mirrored from the frame firmware
 * (esp32-c3-rainmaker-neo-8x8-frame-v1, main/pf_types.h). Change both together.
 *
 * The frame is a `custom.device.pixel-frame` device with `cdf.panel =
 * pixelframe`. Power, brightness, hue and saturation are the standard params;
 * hue / saturation colour every mode except Rainbow, Fire and Test. Mode is an
 * int whose names arrive as the `cdf.modes` attribute (position = value).
 * Mode numbers are only ever appended in firmware, never renumbered.
 */
export const FRAME_PARAM_MODE_TYPE = "custom.frame.mode";
export const FRAME_PARAM_TEXT_TYPE = "custom.frame.text";
export const FRAME_PARAM_SPEED_TYPE = "custom.frame.speed";
export const FRAME_PARAM_CLOCK24_TYPE = "custom.frame.clock24";
export const FRAME_PARAM_TIMER_TYPE = "custom.frame.timer";
/** Timer running (bool, reported by the frame, not persisted). */
export const FRAME_PARAM_RUN_TYPE = "custom.frame.run";
/** Trigger: write true to put the timer back to zero; the frame reports false. */
export const FRAME_PARAM_RESET_TYPE = "custom.frame.reset";

/** Attribute with the comma-separated mode names. */
export const FRAME_ATTR_MODES = "cdf.modes";

export const FRAME_MODE_TEST = 0;
export const FRAME_MODE_COLOR = 1;
export const FRAME_MODE_TEXT = 2;
export const FRAME_MODE_RAINBOW = 3;
export const FRAME_MODE_PLASMA = 4;
export const FRAME_MODE_FIRE = 5;
export const FRAME_MODE_TWINKLE = 6;
export const FRAME_MODE_RAIN = 7;
export const FRAME_MODE_CLOCK = 8;
export const FRAME_MODE_COUNTDOWN = 9;
export const FRAME_MODE_STOPWATCH = 10;
export const FRAME_MODE_BARS = 11;
export const FRAME_MODE_VURING = 12;
export const FRAME_MODE_BEAT = 13;
export const FRAME_MODE_SOUNDFIRE = 14;
export const FRAME_MODE_SPECTROGRAM = 15;

/** Names used when the frame does not send `cdf.modes`. */
const FALLBACK_MODE_NAMES = [
  "Test",
  "Color",
  "Text",
  "Rainbow",
  "Plasma",
  "Fire",
  "Twinkle",
  "Rain",
  "Clock",
  "Countdown",
  "Stopwatch",
  "Bars",
  "VU Ring",
  "Beat",
  "Sound Fire",
  "Spectrogram",
];

export const FRAME_SPEED_MIN = 1;
export const FRAME_SPEED_MAX = 100;
export const FRAME_TEXT_MAX = 64;
export const FRAME_TIMER_MIN_S = 1;
export const FRAME_TIMER_MAX_S = 86400;

/** The tabs of the frame panel. Draw joins later. */
export type FrameTab = "light" | "effects" | "time" | "audio";

/** Patterns and text, in the order shown on the Effects tab (Test last). */
export const EFFECT_MODES = [
  FRAME_MODE_RAINBOW,
  FRAME_MODE_PLASMA,
  FRAME_MODE_FIRE,
  FRAME_MODE_TWINKLE,
  FRAME_MODE_RAIN,
  FRAME_MODE_TEXT,
  FRAME_MODE_TEST,
];
export const TIME_MODES = [FRAME_MODE_CLOCK, FRAME_MODE_COUNTDOWN, FRAME_MODE_STOPWATCH];
export const AUDIO_MODES = [
  FRAME_MODE_BARS,
  FRAME_MODE_VURING,
  FRAME_MODE_BEAT,
  FRAME_MODE_SOUNDFIRE,
  FRAME_MODE_SPECTROGRAM,
];

/** Modes that ignore hue / saturation (they draw their own colours). */
const OWN_COLOUR_MODES = new Set([FRAME_MODE_RAINBOW, FRAME_MODE_FIRE, FRAME_MODE_TEST]);

/** Mode a tab switches to when the frame is showing something from another tab. */
export const DEFAULT_MODE_OF_TAB: Record<FrameTab, number> = {
  light: FRAME_MODE_COLOR,
  effects: FRAME_MODE_RAINBOW,
  time: FRAME_MODE_CLOCK,
  audio: FRAME_MODE_BARS,
};

/**
 * Which tab shows a mode.
 * @param mode - Mode value reported by the frame
 * @returns The tab, Light for unknown values
 */
export const tabOfMode = (mode: number): FrameTab => {
  if (EFFECT_MODES.includes(mode)) return "effects";
  if (TIME_MODES.includes(mode)) return "time";
  if (AUDIO_MODES.includes(mode)) return "audio";
  return "light";
};

/**
 * Whether a mode is coloured by the hue / saturation params.
 * @param mode - Mode value
 * @returns True when the colour card should be shown
 */
export const modeUsesColour = (mode: number): boolean =>
  mode !== FRAME_MODE_COLOR && !OWN_COLOUR_MODES.has(mode);

/**
 * Mode names from the `cdf.modes` attribute, falling back to the built-in
 * list for any position the frame does not name.
 * @param device - Frame device
 * @returns Names indexed by mode value
 */
export const readModeNames = (device: ESPCDFDevice | undefined): string[] => {
  const raw = getDeviceAttribute(device, FRAME_ATTR_MODES);
  const sent = (raw ?? "").split(",").map((n) => n.trim());
  const count = Math.max(sent.length, FALLBACK_MODE_NAMES.length);
  return Array.from({ length: count }, (_, i) => sent[i] || FALLBACK_MODE_NAMES[i] || `Mode ${i}`);
};

/**
 * Keeps only what the frame accepts in Text mode: printable ASCII, at most
 * FRAME_TEXT_MAX characters (the firmware rejects anything else).
 * @param text - Text typed by the user
 * @returns Cleaned text
 */
export const sanitizeFrameText = (text: string): string =>
  text.replace(/[^\x20-\x7E]/g, "").slice(0, FRAME_TEXT_MAX);

/** A duration split for the hour / minute / second picker. */
export interface Hms {
  h: number;
  m: number;
  s: number;
}

/**
 * Splits seconds into hours, minutes and seconds.
 * @param total - Seconds
 * @returns Parts; hours may reach 24 for the 86400 s maximum
 */
export const toHms = (total: number): Hms => {
  const t = Math.max(0, Math.round(total));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
};

/**
 * Joins hours, minutes and seconds into a countdown length the frame accepts.
 * @param hms - Parts from the picker
 * @returns Seconds, clamped to FRAME_TIMER_MIN_S..FRAME_TIMER_MAX_S
 */
export const fromHms = ({ h, m, s }: Hms): number =>
  Math.min(FRAME_TIMER_MAX_S, Math.max(FRAME_TIMER_MIN_S, h * 3600 + m * 60 + s));

/**
 * Formats seconds as a short label, e.g. "1 h 05 min" or "25 min" or "45 s".
 * @param total - Seconds
 * @returns Readable duration
 */
export const formatDuration = (total: number): string => {
  const { h, m, s } = toHms(total);
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m || (h && s)) parts.push(`${h ? String(m).padStart(2, "0") : m} min`);
  if (s || parts.length === 0) parts.push(`${s} s`);
  return parts.join(" ");
};
