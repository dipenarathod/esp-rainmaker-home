/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { observer } from "mobx-react-lite";
import { Pause, Play, RotateCcw } from "lucide-react-native";

import { tokens } from "@shared/theme/tokens";
import { testProps } from "@shared/utils/testProps";
import StripPowerBrightness from "@features/control/components/StripPowerBrightness";
import { useDraftParam } from "@features/control/hooks/useDraftParam";
import { findParam } from "@features/control/utils/stripSync";
import {
  FRAME_MODE_CLOCK,
  FRAME_MODE_COUNTDOWN,
  FRAME_MODE_STOPWATCH,
  FRAME_PARAM_CLOCK24_TYPE,
  FRAME_PARAM_RESET_TYPE,
  FRAME_PARAM_RUN_TYPE,
  FRAME_PARAM_TIMER_TYPE,
  FRAME_TIMER_MAX_S,
  FRAME_TIMER_MIN_S,
  TIME_MODES,
  formatDuration,
} from "@features/control/utils/pixelFrame";
import DurationPicker from "./DurationPicker";
import FrameColourCard from "./FrameColourCard";
import { FrameTabProps } from "./types";

/** Quick countdown lengths, in seconds. */
const PRESETS = [60, 300, 600, 900, 1500, 3600];

/**
 * Start / Pause and Reset for the Countdown and Stopwatch modes.
 *
 * `custom.frame.run` is a bool the frame reports (it falls back to false when
 * a finished countdown is dismissed), so the button always shows the real
 * state. `custom.frame.reset` is a trigger: the app writes true, the frame
 * puts the timer back to zero, stops it and reports both params as false.
 * @param props - Tab props
 * @returns Timer buttons with a status line
 */
const TimerControls: React.FC<FrameTabProps> = observer(({ device, isConnected }: FrameTabProps) => {
  const runParam = findParam(device, FRAME_PARAM_RUN_TYPE);
  const resetParam = findParam(device, FRAME_PARAM_RESET_TYPE);
  const running = runParam?.value === true;

  /** Writes a bool param and mirrors it so the button flips at once. */
  const write = async (param: typeof runParam, value: boolean, mirror = value) => {
    if (!param) return;
    try {
      await param.setValue(value);
      param.value = mirror;
    } catch (e) {
      console.error("[FrameTime] timer write failed:", e);
    }
  };

  return (
    <>
      <View style={styles.buttons}>
        <Pressable
          onPress={() => void write(runParam, !running)}
          disabled={!isConnected || !runParam}
          style={[styles.bigButton, styles.primary, (!isConnected || !runParam) && styles.disabled]}
          {...testProps("button_frame_timer_run")}
        >
          {running ? (
            <Pause size={18} color={tokens.colors.white} />
          ) : (
            <Play size={18} color={tokens.colors.white} />
          )}
          <Text style={[styles.bigButtonText, styles.primaryText]}>
            {running ? "Pause" : "Start"}
          </Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await write(resetParam, true, false);
            if (runParam) runParam.value = false;
          }}
          disabled={!isConnected || !resetParam}
          style={[styles.bigButton, (!isConnected || !resetParam) && styles.disabled]}
          {...testProps("button_frame_timer_reset")}
        >
          <RotateCcw size={18} color={tokens.colors.primary} />
          <Text style={styles.bigButtonText}>Reset</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{running ? "Running on the frame." : "Stopped."}</Text>
    </>
  );
});

/**
 * Countdown length with the hour / minute / second wheels and quick presets.
 * The length is the frame's `custom.frame.timer` param (1 s .. 24 h). Edits
 * use a local draft, so scrolling a wheel is one write once it settles, and
 * are sent as a number.
 * @param props - Tab props
 * @returns Countdown length card content
 */
const CountdownLength: React.FC<FrameTabProps> = observer(
  ({ device, isConnected, setScrollEnabled }: FrameTabProps) => {
    const timerParam = findParam(device, FRAME_PARAM_TIMER_TYPE);
    const deviceSeconds = useMemo(() => {
      const n = Math.round(Number(timerParam?.value));
      return n >= FRAME_TIMER_MIN_S && n <= FRAME_TIMER_MAX_S ? n : 300;
    }, [timerParam?.value]);
    const [seconds, editSeconds] = useDraftParam<number>(
      timerParam,
      deviceSeconds,
      (v) => Math.round(v),
      isConnected,
      "FrameTime.timer",
    );
    if (!timerParam) return null;

    return (
      <>
        <DurationPicker
          seconds={seconds}
          onChange={editSeconds}
          disabled={!isConnected}
          onTouchActive={(active) => setScrollEnabled?.(!active)}
        />
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              onPress={() => editSeconds(p)}
              disabled={!isConnected}
              style={[styles.preset, p === seconds && styles.presetActive]}
              {...testProps(`button_frame_timer_preset_${p}`)}
            >
              <Text style={[styles.presetText, p === seconds && styles.presetTextActive]}>
                {formatDuration(p)}
              </Text>
            </Pressable>
          ))}
        </View>
      </>
    );
  },
);

/**
 * Time tab of the Pixel Frame: Clock, Countdown and Stopwatch.
 *
 * A segmented control at the top picks the mode (it is the frame's Mode
 * param, so the frame changes at once). Below it, only that mode's controls:
 *  - Clock: 12 / 24 hour switch (the time itself comes from the internet; the
 *    time zone is set in Device Settings).
 *  - Countdown: length picker with presets, then Start / Pause and Reset.
 *  - Stopwatch: Start / Pause and Reset.
 * The colour card at the bottom colours the digits.
 * @param props - Tab props
 * @returns Time tab
 */
const FrameTime: React.FC<FrameTabProps> = (props) => {
  const { device, mode, names, onMode, isConnected } = props;
  const shown = TIME_MODES.includes(mode) ? mode : FRAME_MODE_CLOCK;
  const clockParam = findParam(device, FRAME_PARAM_CLOCK24_TYPE);
  const is24 = clockParam?.value !== false;

  /** Writes the 12 / 24 hour setting and mirrors it. */
  const set24 = async (v: boolean) => {
    if (!clockParam) return;
    try {
      await clockParam.setValue(v);
      clockParam.value = v;
    } catch (e) {
      console.error("[FrameTime] clock write failed:", e);
    }
  };

  return (
    <View style={styles.container} {...testProps("view_frame_time")}>
      <StripPowerBrightness {...props} />

      <View style={styles.segment}>
        {TIME_MODES.map((m) => {
          const on = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => !on && onMode(m)}
              disabled={!isConnected}
              style={[styles.segmentItem, on && styles.segmentActive]}
              {...testProps(`button_frame_time_${m}`)}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextActive]}>
                {names[m] ?? `Mode ${m}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        {shown === FRAME_MODE_CLOCK && (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>24-hour clock</Text>
              <Switch
                value={is24}
                onValueChange={(v) => void set24(v)}
                disabled={!isConnected || !clockParam}
                {...testProps("switch_frame_clock24")}
              />
            </View>
            <Text style={styles.hint}>
              The frame gets the time from the internet. Set its time zone in Device
              Settings if the hour is wrong. On the 8x8 panel the hours and minutes take
              turns, and the bottom row fills with the seconds.
            </Text>
          </>
        )}

        {shown === FRAME_MODE_COUNTDOWN && (
          <>
            <Text style={styles.sectionTitle}>Countdown length</Text>
            <CountdownLength {...props} />
            <TimerControls {...props} />
          </>
        )}

        {shown === FRAME_MODE_STOPWATCH && (
          <>
            <Text style={styles.sectionTitle}>Stopwatch</Text>
            <TimerControls {...props} />
          </>
        )}
      </View>

      <FrameColourCard {...props} hint="Colour of the digits." />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: tokens.spacing._10 },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  segment: {
    flexDirection: "row",
    padding: 3,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: tokens.colors.white,
  },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 17, alignItems: "center" },
  segmentActive: { backgroundColor: tokens.colors.primary },
  segmentText: { fontSize: 14, fontWeight: "500" },
  segmentTextActive: { color: tokens.colors.white },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  preset: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: tokens.colors.bg5,
  },
  presetActive: { backgroundColor: tokens.colors.primary },
  presetText: { fontSize: 13, fontWeight: "500" },
  presetTextActive: { color: tokens.colors.white },
  buttons: { flexDirection: "row", gap: 10, marginTop: 14 },
  bigButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: tokens.colors.bg5,
  },
  primary: { backgroundColor: tokens.colors.primary },
  bigButtonText: { fontSize: 15, fontWeight: "600" },
  primaryText: { color: tokens.colors.white },
  disabled: { opacity: 0.5 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 8 },
});

export default observer(FrameTime);
