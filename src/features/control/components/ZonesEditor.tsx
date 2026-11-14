/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";

import { tokens } from "@shared/theme/tokens";
import HueSlider from "@shared/components/ParamControls/HueSlider";
import SaturationSlider from "@shared/components/ParamControls/SaturationSlider";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";
import { useDraftParam } from "@features/control/hooks/useDraftParam";
import {
  MAX_ZONES,
  STRIP_PARAM_ZONES_TYPE,
  StripZones,
  colorAt,
  defaultZones,
  encodeZones,
  hsToRgb,
  parseZones,
  rgbToCss,
} from "@features/control/utils/stripZones";
import StripPowerBrightness from "./StripPowerBrightness";

const PREVIEW_SLICES = 48;
/**
 * Zones editor for LED strip controllers.
 *
 * Editing model: the screen edits a local draft that is sent to the device after
 * a short pause and ignores device echoes while you edit (see useDraftParam).
 *
 * Zone colours use the same Hue / Saturation scales as the standard colour
 * controls, so a zone looks exactly like the same colour on the Light tab.
 * @param props - Node, device and parent scroll-lock callback
 * @returns Zones editor
 */
const ZonesEditor: React.FC<ControlPanelProps> = (props) => {
  const { node, device, setScrollEnabled } = props;
  const isConnected = useDeviceConnected(node);
  const params = device?.params ?? [];

  const zonesParam = params.find((p) => p.type === STRIP_PARAM_ZONES_TYPE);

  const deviceZones = useMemo(
    () => parseZones(zonesParam?.value) ?? defaultZones(),
    [zonesParam?.value],
  );
  const [zones, edit] = useDraftParam<StripZones>(
    zonesParam,
    deviceZones,
    encodeZones,
    isConnected,
    "ZonesEditor",
  );
  const [selected, setSelected] = useState(0);
  const sel = Math.min(selected, zones.zones.length - 1);

  // --- edits ---
  const setCount = (count: number) => {
    const n = Math.max(1, Math.min(MAX_ZONES, count));
    if (n === zones.zones.length) return;
    const list = zones.zones.slice(0, n);
    while (list.length < n) list.push({ ...list[list.length - 1] });
    edit({ ...zones, zones: list });
  };

  const setBlend = (blend: number) =>
    edit({ ...zones, blend: Math.max(0, Math.min(100, blend)) });

  const setZone = (patch: Partial<{ h: number; s: number }>) =>
    edit({
      ...zones,
      zones: zones.zones.map((z, i) => (i === sel ? { ...z, ...patch } : z)),
    });

  const rainbow = () => {
    const n = zones.zones.length;
    edit({
      ...zones,
      zones: zones.zones.map((_, i) => ({ h: Math.round((360 * i) / n), s: 100 })),
    });
  };

  // Sliders here are not wrapped by ParamControlWrap, so lock the page scroll by touch.
  const lockScroll = () => setScrollEnabled?.(false);
  const unlockScroll = () => setScrollEnabled?.(true);

  const stepper = (
    label: string,
    value: string,
    onMinus: () => void,
    onPlus: () => void,
    testId: string,
  ) => (
    <View style={styles.stepper} {...testProps(testId)}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={styles.stepBtn} onPress={onMinus} hitSlop={8}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable style={styles.stepBtn} onPress={onPlus} hitSlop={8}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  const current = zones.zones[sel];

  return (
    <View style={styles.container} {...testProps("view_zones")}>
      <StripPowerBrightness {...props} />

      {/* Live preview, same maths as the firmware */}
      <View style={styles.preview} {...testProps("view_zones_preview")}>
        {Array.from({ length: PREVIEW_SLICES }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: rgbToCss(colorAt(zones, (i + 0.5) / PREVIEW_SLICES)),
            }}
          />
        ))}
      </View>

      <View style={styles.card}>
        {stepper(
          "Zones",
          String(zones.zones.length),
          () => setCount(zones.zones.length - 1),
          () => setCount(zones.zones.length + 1),
          "stepper_zone_count",
        )}
        {stepper(
          "Blend",
          `${zones.blend}%`,
          () => setBlend(zones.blend - 10),
          () => setBlend(zones.blend + 10),
          "stepper_zone_blend",
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.chipHeader}>
          <Text style={styles.sectionTitle}>Zone {sel + 1} colour</Text>
          <Pressable onPress={rainbow} hitSlop={8}>
            <Text style={styles.link}>Rainbow</Text>
          </Pressable>
        </View>

        <View style={styles.chips}>
          {zones.zones.map((z, i) => (
            <Pressable
              key={i}
              onPress={() => setSelected(i)}
              style={[
                styles.chip,
                { backgroundColor: rgbToCss(hsToRgb(z.h, z.s)) },
                i === sel && styles.chipSelected,
              ]}
            >
              <Text style={styles.chipText}>{i + 1}</Text>
            </Pressable>
          ))}
        </View>

        <View
          onTouchStart={lockScroll}
          onTouchEnd={unlockScroll}
          onTouchCancel={unlockScroll}
        >
          <HueSlider
            label="Hue"
            value={current.h}
            onValueChange={(_e: unknown, v: number) => setZone({ h: Math.round(v) })}
            disabled={!isConnected}
            meta={{ min: 0, max: 360, step: 1 }}
            compact
          />
          <SaturationSlider
            label="Saturation"
            value={current.s}
            onValueChange={(_e: unknown, v: number) => setZone({ s: Math.round(v) })}
            disabled={!isConnected}
            meta={{ min: 0, max: 100, step: 1, hue: current.h, brightness: 50 }}
            compact
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: tokens.spacing._10 },
  preview: {
    flexDirection: "row",
    height: 36,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#00000022",
  },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  stepperLabel: { fontSize: 15, fontWeight: "500" },
  stepperControls: { flexDirection: "row", alignItems: "center" },
  stepperValue: { minWidth: 56, textAlign: "center", fontSize: 15 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.bg5,
  },
  stepBtnText: { fontSize: 20, fontWeight: "600" },
  chipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  link: { fontSize: 15, color: tokens.colors.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: { borderColor: tokens.colors.primary },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "#000",
    textShadowRadius: 2,
  },
});

export default observer(ZonesEditor);
