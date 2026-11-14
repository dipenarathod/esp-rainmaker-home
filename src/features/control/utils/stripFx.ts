/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Rgb,
  StripZones,
  colorAt,
  defaultZones,
  hsToRgb,
} from "@features/control/utils/stripZones";

/** Param type / ids shared with the LED strip firmware (strip_types.h). */
export const STRIP_PARAM_FX_TYPE = "custom.strip.fx";
export const FX_SPEED_MIN = 1;
export const FX_SPEED_MAX = 100;

export interface EffectInfo {
  id: number;
  name: string;
  /** Uses a colour (single colour or the zone colours). Rainbow and Fire do not. */
  colour: boolean;
  /**
   * Driven by audio from a music leader (or the device's own mic). Shown on
   * the Music screen, not the Effects tab, and only on devices with the
   * `sync` capability.
   */
  music?: boolean;
}

/** In firmware id order (strip_types.h FX_*). */
export const EFFECTS: EffectInfo[] = [
  { id: 0, name: "Breathe", colour: true },
  { id: 1, name: "Rainbow", colour: false },
  { id: 2, name: "Wave", colour: true },
  { id: 3, name: "Chase", colour: true },
  { id: 4, name: "Scanner", colour: true },
  { id: 5, name: "Twinkle", colour: true },
  { id: 6, name: "Fire", colour: false },
  { id: 7, name: "Wipe", colour: true },
  // Music effects. Spectrum without zone colours uses its own rainbow.
  { id: 8, name: "Pulse", colour: true, music: true },
  { id: 9, name: "Spectrum", colour: true, music: true },
  { id: 10, name: "VU Meter", colour: true, music: true },
];

/** Clock-driven animations (Effects tab). */
export const ANIMATED_EFFECTS = EFFECTS.filter((e) => !e.music);
/** Audio-driven effects (Music screen). */
export const MUSIC_EFFECTS = EFFECTS.filter((e) => e.music);
/** Id of the effect a device starts with when it joins a music group. */
export const DEFAULT_MUSIC_FX_ID = 8;

/**
 * @param id - Effect id
 * @returns True for audio-driven effects
 */
export const isMusicFx = (id: number): boolean => !!EFFECTS[id]?.music;

export interface StripFx {
  /** Effect id, see EFFECTS. */
  id: number;
  /** 1..100 */
  speed: number;
  /** false = one colour (h, s); true = the zone colours. */
  palette: boolean;
  /** 0..360 */
  h: number;
  /** 0..100 */
  s: number;
}

/** Rainbow at medium speed. */
export const defaultFx = (): StripFx => ({
  id: 1,
  speed: 50,
  palette: false,
  h: 120,
  s: 100,
});

const hex = (n: number, digits: number) =>
  Math.max(0, Math.round(n)).toString(16).padStart(digits, "0");

/**
 * Parses the firmware effect string `"<id>:<speed>:<palette>:<HHHSS>"`.
 * @param raw - Param value as reported by the device
 * @returns Effect settings, or null when empty or malformed
 */
export const parseFx = (raw: unknown): StripFx | null => {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,3}):(\d{1,3}):([01]):([0-9a-fA-F]{5})$/.exec(raw.trim());
  if (!m) return null;
  const id = Number(m[1]);
  const speed = Number(m[2]);
  const h = parseInt(m[4].slice(0, 3), 16);
  const s = parseInt(m[4].slice(3, 5), 16);
  if (id >= EFFECTS.length || speed < FX_SPEED_MIN || speed > FX_SPEED_MAX) return null;
  if (h > 360 || s > 100) return null;
  return { id, speed, palette: m[3] === "1", h, s };
};

/**
 * Encodes effect settings into the firmware string format.
 * @param fx - Settings to encode
 * @returns `"<id>:<speed>:<palette>:<HHHSS>"`
 */
export const encodeFx = (fx: StripFx): string =>
  `${fx.id}:${Math.round(fx.speed)}:${fx.palette ? 1 : 0}:${hex(fx.h, 3)}${hex(fx.s, 2)}`;

/**
 * A static impression of an effect for the preview bar (not an animation).
 * @param fx - Effect settings
 * @param zones - Zone colours, used when `fx.palette` is on
 * @param slices - Number of colour slices
 * @returns One RGB colour per slice
 */
export const fxPreview = (fx: StripFx, zones: StripZones, slices: number): Rgb[] => {
  const out: Rgb[] = [];
  const single = hsToRgb(fx.h, fx.s);
  const z = zones.zones.length ? { ...zones, blend: Math.max(zones.blend, 60) } : defaultZones();
  for (let i = 0; i < slices; i++) {
    const t = (i + 0.5) / slices;
    if (fx.id === 1 || (fx.id === 9 && !fx.palette)) {
      // Rainbow, and Spectrum's own bass-to-treble rainbow (red .. violet)
      out.push(hsToRgb(Math.round(t * (fx.id === 9 ? 300 : 360)), 100));
    } else if (fx.id === 6) {
      // flames: red at the base, yellow-white at the tips
      out.push([255, Math.round(255 * Math.pow(1 - t, 0.5) * 0.8), Math.round(40 * (1 - t))]);
    } else {
      const c = fx.palette ? colorAt(z, t) : single;
      // VU meter: lit from the centre outwards, a frozen "half volume" look
      const dim = fx.id === 10 && Math.abs(t - 0.5) > 0.3;
      out.push(dim ? [0, 0, 0] : c);
    }
  }
  return out;
};
