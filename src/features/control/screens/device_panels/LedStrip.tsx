/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";
import { useRouter } from "expo-router";
import { ChevronRight, Music } from "lucide-react-native";

import { tokens } from "@shared/theme/tokens";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";
import { getDeviceCaps } from "@features/control/utils/deviceAttributes";
import {
  STRIP_MODE_EFFECT,
  STRIP_MODE_STATIC,
  STRIP_MODE_ZONES,
  STRIP_PARAM_MODE_TYPE,
  STRIP_PARAM_ZONES_TYPE,
} from "@features/control/utils/stripZones";
import { STRIP_PARAM_FX_TYPE } from "@features/control/utils/stripFx";
import { ROLE_LABEL, SYNC_ROLE_OFF, toSyncMember } from "@features/control/utils/stripSync";
import ZonesEditor from "@features/control/components/ZonesEditor";
import EffectsEditor from "@features/control/components/EffectsEditor";

import Light from "./Light";

type View_ = "light" | "zones" | "effects";

const MODE_OF: Record<View_, number> = {
  light: STRIP_MODE_STATIC,
  zones: STRIP_MODE_ZONES,
  effects: STRIP_MODE_EFFECT,
};
const LABEL_OF: Record<View_, string> = {
  light: "Light",
  zones: "Zones",
  effects: "Effects",
};

/**
 * LedStrip control panel.
 *
 * Opened when the firmware tags a standard light with `cdf.panel = ledstrip`.
 * Alexa / Google still see an ordinary light; this panel only changes what the
 * app draws:
 *  - "Light": the stock Light panel (power, brightness, White / Color)
 *  - "Zones": per-zone colours with optional blending (when `cdf.caps` has `zones`)
 *  - "Effects": eight animated effects (when `cdf.caps` has `fx`)
 *  - a "Music Sync" row (when `cdf.caps` has `sync`) opening its own screen:
 *    role, sync group, group members and the music effects. It is a separate
 *    screen, not a tab, because only Wi-Fi controllers can sync to music;
 *    Zigbee / Thread lights simply never get the row.
 *
 * The selected view is the device's `custom.strip.mode`, so a voice command
 * (which switches the strip back to static) flips this panel back to "Light".
 * One-time setup (LED count, PSU rating) lives in Device Settings (StripSetup).
 * @param props - Node, device and parent scroll-lock callback
 * @returns Strip panel
 */
const LedStrip: React.FC<ControlPanelProps> = (props) => {
  const { node, device } = props;
  const isConnected = useDeviceConnected(node);
  const router = useRouter();
  const sync = toSyncMember(node, device);

  const params = device?.params ?? [];
  const modeParam = params.find((p) => p.type === STRIP_PARAM_MODE_TYPE);
  const zonesParam = params.find((p) => p.type === STRIP_PARAM_ZONES_TYPE);
  const fxParam = params.find((p) => p.type === STRIP_PARAM_FX_TYPE);
  const caps = getDeviceCaps(device);
  const hasZones = caps.has("zones") && !!modeParam && !!zonesParam;
  const hasEffects = caps.has("fx") && !!modeParam && !!fxParam;
  const views: View_[] = [
    "light",
    ...(hasZones ? (["zones"] as View_[]) : []),
    ...(hasEffects ? (["effects"] as View_[]) : []),
  ];

  const modeValue = Number(modeParam?.value);
  const deviceView: View_ =
    modeValue === STRIP_MODE_EFFECT && hasEffects
      ? "effects"
      : modeValue === STRIP_MODE_ZONES && hasZones
        ? "zones"
        : "light";
  const [view, setView] = useState<View_>(deviceView);
  useEffect(() => setView(deviceView), [deviceView]);

  const choose = async (next: View_) => {
    setView(next);
    if (!modeParam || !isConnected) return;
    const mode = MODE_OF[next];
    if (Number(modeParam.value) === mode) return;
    try {
      await modeParam.setValue(mode);
      modeParam.value = mode;
    } catch (e) {
      console.error("[LedStrip] mode change failed:", e);
    }
  };

  return (
    <View {...testProps("view_ledstrip")}>
      {views.length > 1 && (
        <View style={styles.tabs} {...testProps("view_ledstrip_tabs")}>
          {views.map((v) => (
            <Pressable
              key={v}
              style={[styles.tab, view === v && styles.tabActive]}
              onPress={() => void choose(v)}
              {...testProps(`button_ledstrip_${v}`)}
            >
              <Text style={[styles.tabText, view === v && styles.tabTextActive]}>
                {LABEL_OF[v]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {sync && (
        <Pressable
          style={styles.syncRow}
          onPress={() =>
            router.push(
              `/(control)/MusicSync?id=${encodeURIComponent(sync.node.id)}&device=${encodeURIComponent(sync.device.name)}`,
            )
          }
          {...testProps("button_ledstrip_music_sync")}
        >
          <Music size={20} color={tokens.colors.primary} />
          <View style={styles.syncText}>
            <Text style={styles.syncTitle}>Music Sync</Text>
            <Text style={styles.syncStatus}>
              {sync.role === SYNC_ROLE_OFF
                ? "Off"
                : `${ROLE_LABEL[sync.role]} · Group ${sync.group}`}
            </Text>
          </View>
          <ChevronRight size={20} color={tokens.colors.primary} />
        </Pressable>
      )}

      {view === "effects" && hasEffects ? (
        <EffectsEditor {...props} />
      ) : view === "zones" && hasZones ? (
        <ZonesEditor {...props} />
      ) : (
        <Light {...props} />
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
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: tokens.spacing._10,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.white,
  },
  syncText: { flex: 1 },
  syncTitle: { fontSize: 15, fontWeight: "600" },
  syncStatus: { fontSize: 12, opacity: 0.6, marginTop: 2 },
});

export default observer(LedStrip);
