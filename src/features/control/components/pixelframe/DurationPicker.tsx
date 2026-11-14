/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Hms, fromHms, toHms } from "@features/control/utils/pixelFrame";
import WheelPicker from "./WheelPicker";

interface DurationPickerProps {
  /** Countdown length in seconds. */
  seconds: number;
  /** Called with the new length, already clamped to what the frame accepts. */
  onChange: (seconds: number) => void;
  disabled?: boolean;
  /** Called while a wheel is touched, so the page does not scroll with it. */
  onTouchActive?: (active: boolean) => void;
}

/**
 * Hours : minutes : seconds picker for the countdown length, three wheels side
 * by side. Each wheel changes one part; the parts are joined back into
 * seconds and clamped (at least 1 s, at most 24 h).
 *
 * Example: 0 h 25 min 00 s. Turning the minutes wheel to 05 gives
 * { h: 0, m: 5, s: 0 } and onChange(300). The 24 h maximum (86400 s) shows as
 * 24 : 00 : 00; the hour wheel goes up to 24 for that one value.
 * @param props - Current seconds, change callback and touch callback
 * @returns The three-wheel picker
 */
const DurationPicker: React.FC<DurationPickerProps> = ({
  seconds,
  onChange,
  disabled,
  onTouchActive,
}) => {
  const hms = toHms(seconds);
  /** Replaces one part and reports the joined, clamped length. */
  const set = (patch: Partial<Hms>) => onChange(fromHms({ ...hms, ...patch }));

  return (
    <View
      style={styles.row}
      onTouchStart={() => onTouchActive?.(true)}
      onTouchEnd={() => onTouchActive?.(false)}
      onTouchCancel={() => onTouchActive?.(false)}
    >
      <WheelPicker count={25} value={hms.h} unit="h" onChange={(h) => set({ h })} disabled={disabled} qaId="wheel_timer_hours" />
      <Text style={styles.colon}>:</Text>
      <WheelPicker count={60} value={hms.m} unit="min" onChange={(m) => set({ m })} disabled={disabled} qaId="wheel_timer_minutes" />
      <Text style={styles.colon}>:</Text>
      <WheelPicker count={60} value={hms.s} unit="s" onChange={(s) => set({ s })} disabled={disabled} qaId="wheel_timer_seconds" />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 4,
  },
  colon: { fontSize: 24, fontWeight: "600", marginTop: 44 },
});

export default DurationPicker;
