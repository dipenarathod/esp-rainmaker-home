/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tokens } from "@shared/theme/tokens";
import { testProps } from "@shared/utils/testProps";

interface FrameModePillsProps {
  /** Card heading. */
  title: string;
  /** Mode values to offer, in display order. */
  modes: number[];
  /** Names indexed by mode value (from `cdf.modes`). */
  names: string[];
  /** Mode the frame is showing. */
  active: number;
  disabled?: boolean;
  onSelect: (mode: number) => void;
  /** Optional line under the pills. */
  hint?: string;
}

/**
 * A card of mode pills for one Pixel Frame tab (patterns, audio modes, ...).
 * The active pill is the frame's current mode; when the frame shows a mode
 * from another tab, no pill is highlighted.
 * @param props - Title, modes, names, active mode and selection callback
 * @returns Mode picker card
 */
const FrameModePills: React.FC<FrameModePillsProps> = ({
  title,
  modes,
  names,
  active,
  disabled,
  onSelect,
  hint,
}) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.pills}>
      {modes.map((m) => {
        const on = m === active;
        const name = names[m] ?? `Mode ${m}`;
        return (
          <Pressable
            key={m}
            onPress={() => !on && onSelect(m)}
            disabled={disabled}
            style={[styles.pill, on && styles.pillActive, disabled && styles.disabled]}
            {...testProps(`button_frame_mode_${name.toLowerCase().replace(/\s+/g, "_")}`)}
          >
            <Text style={[styles.pillText, on && styles.pillTextActive]}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
    {hint && <Text style={styles.hint}>{hint}</Text>}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: tokens.colors.bg5,
  },
  pillActive: { backgroundColor: tokens.colors.primary },
  pillText: { fontSize: 14, fontWeight: "500" },
  pillTextActive: { color: tokens.colors.white },
  disabled: { opacity: 0.5 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 8 },
});

export default FrameModePills;
