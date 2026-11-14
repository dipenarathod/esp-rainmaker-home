/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** Param types / limits shared with the LED strip firmware (app_priv.h). */
export const STRIP_PARAM_MODE_TYPE = "custom.strip.mode";
export const STRIP_PARAM_ZONES_TYPE = "custom.strip.zones";
export const STRIP_MODE_STATIC = 0;
export const STRIP_MODE_ZONES = 1;
export const STRIP_MODE_EFFECT = 2;
export const MAX_ZONES = 32;

export type Rgb = [number, number, number];

/** A zone colour on the same scales as the standard Hue / Saturation params. */
export interface Zone {
  /** 0..360 */
  h: number;
  /** 0..100 */
  s: number;
}

export interface StripZones {
  /** 0 = solid segments, 100 = full gradient. */
  blend: number;
  zones: Zone[];
}

/** One green zone: the same as the default static colour. */
export const defaultZones = (): StripZones => ({
  blend: 0,
  zones: [{ h: 120, s: 100 }],
});

const hex = (n: number, digits: number) =>
  Math.max(0, Math.round(n)).toString(16).padStart(digits, "0");

/**
 * Parses the firmware zones string `"<count>:<blend>:<HHHSS x count>"`
 * (HHH = hue in 3 hex digits, SS = saturation in 2 hex digits).
 * @param raw - Param value as reported by the device
 * @returns Zones, or null when the string is empty or malformed
 */
export const parseZones = (raw: unknown): StripZones | null => {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,2}):(\d{1,3}):([0-9a-fA-F]*)$/.exec(raw.trim());
  if (!m) return null;
  const count = Number(m[1]);
  const blend = Number(m[2]);
  const body = m[3];
  if (count < 1 || count > MAX_ZONES || blend > 100 || body.length < count * 5) {
    return null;
  }
  const zones: Zone[] = [];
  for (let i = 0; i < count; i++) {
    const h = parseInt(body.slice(i * 5, i * 5 + 3), 16);
    const s = parseInt(body.slice(i * 5 + 3, i * 5 + 5), 16);
    if (h > 360 || s > 100) return null;
    zones.push({ h, s });
  }
  return { blend, zones };
};

/**
 * Encodes zones into the firmware string format.
 * @param z - Zones to encode
 * @returns `"<count>:<blend>:<HHHSS x count>"`
 */
export const encodeZones = (z: StripZones): string =>
  `${z.zones.length}:${Math.round(z.blend)}:` +
  z.zones.map((c) => hex(c.h, 3) + hex(c.s, 2)).join("");

/**
 * HSV (value = 100%) to RGB, the same maths as the firmware's hsv_to_rgb().
 * @param h - Hue 0..360
 * @param s - Saturation 0..100
 * @returns RGB colour, 0..255
 */
export const hsToRgb = (h: number, s: number): Rgb => {
  const hh = h % 360;
  const sat = s / 100;
  const x = sat * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = 1 - sat;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g] = [sat, x];
  else if (hh < 120) [r, g] = [x, sat];
  else if (hh < 180) [g, b] = [sat, x];
  else if (hh < 240) [g, b] = [x, sat];
  else if (hh < 300) [r, b] = [x, sat];
  else [r, b] = [sat, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(Math.round) as Rgb;
};

/**
 * Colour at a position along the strip. Mirrors the firmware renderer so the
 * on-screen preview matches the LEDs.
 * @param z - Zones
 * @param pos - Position 0..1 along the strip
 * @returns RGB colour
 */
export const colorAt = (z: StripZones, pos: number): Rgb => {
  const n = z.zones.length;
  const p = Math.max(0, Math.min(0.999999, pos)) * n;
  const zi = Math.min(Math.floor(p), n - 1);
  const f = p - zi;
  const w = (z.blend / 100) * 0.5;
  const rgb = (i: number) => hsToRgb(z.zones[i].h, z.zones[i].s);
  const cur = rgb(zi);
  const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  if (w > 0) {
    if (f < w && zi > 0) {
      return mix(rgb(zi - 1), cur, 0.5 + (0.5 * f) / w);
    }
    if (f > 1 - w && zi < n - 1) {
      return mix(cur, rgb(zi + 1), (0.5 * (f - (1 - w))) / w);
    }
  }
  return cur;
};

export const rgbToCss = (c: Rgb): string =>
  `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
