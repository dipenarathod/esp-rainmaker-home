/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { tokens } from "@shared/theme/tokens";
import { testProps } from "@shared/utils/testProps";

/** Height of one row; the wheel shows three rows with the middle one selected. */
export const WHEEL_ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 3;

interface WheelPickerProps {
  /** Number of values: the wheel offers 0 .. count-1. */
  count: number;
  /** Selected value. */
  value: number;
  onChange: (value: number) => void;
  /** Unit under the wheel, e.g. "h". */
  unit: string;
  disabled?: boolean;
  qaId: string;
}

/**
 * Scroll wheel for one number (hours, minutes or seconds), like the native
 * time pickers: drag or fling, it snaps to a row, and the middle row is the
 * value. Built on ScrollView so it behaves the same on Android, iOS and web
 * without a native picker library.
 *
 * How it works:
 *  - Rows are WHEEL_ITEM_HEIGHT tall; one empty row of padding above and below
 *    lets the first and last values reach the middle.
 *  - `snapToInterval` makes every scroll stop exactly on a row, so the value is
 *    simply `round(offsetY / WHEEL_ITEM_HEIGHT)`.
 *  - A new `value` from outside (e.g. a preset, or the device reporting) scrolls
 *    the wheel, except while the user is touching it.
 * @param props - Range, value, change callback, unit label and test id
 * @returns One wheel column
 */
const WheelPicker: React.FC<WheelPickerProps> = ({
  count,
  value,
  onChange,
  unit,
  disabled,
  qaId,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const touching = useRef(false);
  const lastSent = useRef(value);

  // Follow outside changes (presets, device reports) unless the user is scrolling.
  useEffect(() => {
    if (touching.current) return;
    lastSent.current = value;
    scrollRef.current?.scrollTo({ y: value * WHEEL_ITEM_HEIGHT, animated: true });
  }, [value]);

  /** Reads the row under the middle line and reports it if it changed. */
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const v = Math.min(count - 1, Math.max(0, i));
    if (v !== lastSent.current) {
      lastSent.current = v;
      onChange(v);
    }
  };

  return (
    <View style={styles.column}>
      <View style={styles.wheel} {...testProps(qaId)}>
        <View pointerEvents="none" style={styles.selection} />
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          scrollEnabled={!disabled}
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ITEM_HEIGHT}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: value * WHEEL_ITEM_HEIGHT }}
          contentContainerStyle={styles.content}
          onTouchStart={() => {
            touching.current = true;
          }}
          onScrollEndDrag={(e) => {
            // No fling: this is the final position. With a fling, the
            // momentum end below fires later and wins.
            if (!e.nativeEvent.velocity?.y) {
              touching.current = false;
              settle(e);
            }
          }}
          onMomentumScrollEnd={(e) => {
            touching.current = false;
            settle(e);
          }}
        >
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.rowText, i === value && styles.rowTextActive]}>
                {String(i).padStart(2, "0")}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  column: { alignItems: "center" },
  wheel: {
    height: WHEEL_ITEM_HEIGHT * VISIBLE_ROWS,
    width: 64,
    overflow: "hidden",
  },
  selection: {
    position: "absolute",
    top: WHEEL_ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: tokens.colors.bg5,
  },
  content: { paddingVertical: WHEEL_ITEM_HEIGHT },
  row: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { fontSize: 20, opacity: 0.35, fontVariant: ["tabular-nums"] },
  rowTextActive: { fontSize: 24, fontWeight: "600", opacity: 1 },
  unit: { fontSize: 12, opacity: 0.6, marginTop: 4 },
});

export default WheelPicker;
