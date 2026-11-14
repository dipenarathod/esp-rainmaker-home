/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";

import { tokens } from "@shared/theme/tokens";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";
import { getDeviceCaps } from "@features/control/utils/deviceAttributes";
import { findParam } from "@features/control/utils/stripSync";
import {
  DEFAULT_MODE_OF_TAB,
  FRAME_PARAM_MODE_TYPE,
  FrameTab,
  readModeNames,
  tabOfMode,
} from "@features/control/utils/pixelFrame";
import FrameLight from "@features/control/components/pixelframe/FrameLight";
import FrameEffects from "@features/control/components/pixelframe/FrameEffects";
import FrameTime from "@features/control/components/pixelframe/FrameTime";
import FrameAudio from "@features/control/components/pixelframe/FrameAudio";

const LABEL_OF: Record<FrameTab, string> = {
  light: "Light",
  effects: "Effects",
  time: "Time",
  audio: "Audio",
};

/**
 * Pixel Frame control panel.
 *
 * Opened when the firmware sets `cdf.panel = pixelframe`. Tabs, each shown
 * only when `cdf.caps` lists the feature (all of them on older firmware that
 * sends no caps):
 *  - "Light": one colour on the whole panel (mode Color)
 *  - "Effects": patterns, Text and Test (caps `patterns` / `text`)
 *  - "Time": Clock, Countdown, Stopwatch (caps `clock` / `timer`)
 *  - "Audio": the audio modes plus Music Sync (caps `audio`)
 * A Draw tab joins later.
 *
 * The selected tab follows the frame's Mode param, so a change from the
 * encoder, a schedule or Music Sync (Follow switches the frame to Bars) moves
 * the panel to the right tab. Picking a tab switches the frame to the mode it
 * last showed on that tab in this session, or to the tab's default (Color,
 * Rainbow, Clock, Bars).
 * @param props - Node, device and parent scroll-lock callback
 * @returns Pixel Frame panel
 */
const PixelFrame: React.FC<ControlPanelProps> = (props) => {
  const { node, device } = props;
  const isConnected = useDeviceConnected(node);
  const modeParam = findParam(device, FRAME_PARAM_MODE_TYPE);
  const names = readModeNames(device);

  const caps = getDeviceCaps(device);
  const all = caps.size === 0;
  const tabs: FrameTab[] = [
    "light",
    ...(all || caps.has("patterns") || caps.has("text") ? (["effects"] as FrameTab[]) : []),
    ...(all || caps.has("clock") || caps.has("timer") ? (["time"] as FrameTab[]) : []),
    ...(all || caps.has("audio") ? (["audio"] as FrameTab[]) : []),
  ];

  const raw = Number(modeParam?.value);
  const mode = Number.isFinite(raw) ? raw : DEFAULT_MODE_OF_TAB.light;
  const deviceTab = tabOfMode(mode);
  const [tab, setTab] = useState<FrameTab>(deviceTab);
  useEffect(() => setTab(deviceTab), [deviceTab]);

  // Last mode seen on each tab, so coming back to a tab restores it.
  const lastMode = useRef<Record<FrameTab, number>>({ ...DEFAULT_MODE_OF_TAB });
  lastMode.current[deviceTab] = mode;

  /**
   * Writes the frame's Mode and mirrors it locally so the UI moves at once.
   * @param next - Mode value
   */
  const writeMode = async (next: number) => {
    if (!modeParam || !isConnected || Number(modeParam.value) === next) return;
    try {
      await modeParam.setValue(next);
      modeParam.value = next;
    } catch (e) {
      console.error("[PixelFrame] mode change failed:", e);
    }
  };

  /**
   * Opens a tab and, if the frame shows another tab's mode, switches it.
   * @param next - Tab the user picked
   */
  const choose = (next: FrameTab) => {
    setTab(next);
    if (tabOfMode(mode) !== next) void writeMode(lastMode.current[next]);
  };

  const tabProps = {
    ...props,
    mode,
    names,
    isConnected,
    onMode: (m: number) => void writeMode(m),
  };

  return (
    <View {...testProps("view_pixelframe")}>
      {tabs.length > 1 && (
        <View style={styles.tabs} {...testProps("view_pixelframe_tabs")}>
          {tabs.map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => choose(t)}
              {...testProps(`button_pixelframe_${t}`)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {LABEL_OF[t]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {tab === "effects" ? (
        <FrameEffects {...tabProps} />
      ) : tab === "time" ? (
        <FrameTime {...tabProps} />
      ) : tab === "audio" ? (
        <FrameAudio {...tabProps} />
      ) : (
        <FrameLight {...tabProps} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    marginHorizontal: tokens.spacing._10,
    marginBottom: 10,
    padding: 3,
    borderRadius: 20,
    backgroundColor: tokens.colors.white,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 17,
    alignItems: "center",
  },
  tabActive: { backgroundColor: tokens.colors.primary },
  tabText: { fontSize: 15, fontWeight: "500" },
  tabTextActive: { color: tokens.colors.white },
});

export default observer(PixelFrame);
