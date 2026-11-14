/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";

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
import {
  DEFAULT_MUSIC_FX_ID,
  STRIP_PARAM_FX_TYPE,
  defaultFx,
  encodeFx,
  isMusicFx,
  parseFx,
} from "@features/control/utils/stripFx";
import { toSyncMember } from "@features/control/utils/stripSync";
import ZonesEditor from "@features/control/components/ZonesEditor";
import EffectsEditor from "@features/control/components/EffectsEditor";
import MusicPanel from "@features/control/components/MusicPanel";

import Light from "./Light";

type View_ = "light" | "zones" | "effects" | "music";

/** Effects and Music both run in effect mode; the effect id tells them apart. */
const MODE_OF: Record<View_, number> = {
  light: STRIP_MODE_STATIC,
  zones: STRIP_MODE_ZONES,
  effects: STRIP_MODE_EFFECT,
  music: STRIP_MODE_EFFECT,
};
const LABEL_OF: Record<View_, string> = {
  light: "Light",
  zones: "Zones",
  effects: "Effects",
  music: "Music",
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
 *  - "Music": music effects, sensitivity, sync role, group and members (when
 *    `cdf.caps` has `sync` and the device reports a sync role). Zigbee /
 *    Thread lights and older firmware simply never get the tab.
 *
 * The selected view follows the device: `custom.strip.mode` picks Light,
 * Zones or effect mode, and in effect mode a music effect id (see isMusicFx)
 * means Music, any other means Effects. So a voice command (which switches
 * the strip back to static) flips this panel back to "Light".
 * One-time setup (LED count, PSU rating) lives in Device Settings (StripSetup).
 * @param props - Node, device and parent scroll-lock callback
 * @returns Strip panel
 */
const LedStrip: React.FC<ControlPanelProps> = (props) => {
  const { node, device } = props;
  const isConnected = useDeviceConnected(node);
  const sync = toSyncMember(node, device);

  const params = device?.params ?? [];
  const modeParam = params.find((p) => p.type === STRIP_PARAM_MODE_TYPE);
  const zonesParam = params.find((p) => p.type === STRIP_PARAM_ZONES_TYPE);
  const fxParam = params.find((p) => p.type === STRIP_PARAM_FX_TYPE);
  const caps = getDeviceCaps(device);
  const hasZones = caps.has("zones") && !!modeParam && !!zonesParam;
  const hasEffects = caps.has("fx") && !!modeParam && !!fxParam;
  // Music effects live in the same fx param, so Music needs it too.
  const hasMusic = !!sync && !!modeParam && !!fxParam;
  const views: View_[] = [
    "light",
    ...(hasZones ? (["zones"] as View_[]) : []),
    ...(hasEffects ? (["effects"] as View_[]) : []),
    ...(hasMusic ? (["music"] as View_[]) : []),
  ];

  const modeValue = Number(modeParam?.value);
  const fxIsMusic = isMusicFx((parseFx(fxParam?.value) ?? defaultFx()).id);
  const deviceView: View_ =
    modeValue === STRIP_MODE_EFFECT && fxIsMusic && hasMusic
      ? "music"
      : modeValue === STRIP_MODE_EFFECT && hasEffects
        ? "effects"
        : modeValue === STRIP_MODE_ZONES && hasZones
          ? "zones"
          : "light";
  const [view, setView] = useState<View_>(deviceView);
  useEffect(() => setView(deviceView), [deviceView]);

  /**
   * Switches the strip to the chosen tab's mode. Effects and Music share
   * effect mode, so moving between them also swaps the effect id (music
   * effect <-> animated effect), keeping its speed and colour. The effect is
   * written before the mode so the strip never flashes the other list's effect.
   * @param next - Tab the user picked
   */
  const choose = async (next: View_) => {
    setView(next);
    if (!modeParam || !isConnected) return;
    try {
      if (fxParam && (next === "music" || next === "effects")) {
        const fx = parseFx(fxParam.value) ?? defaultFx();
        const wantMusic = next === "music";
        if (isMusicFx(fx.id) !== wantMusic) {
          const str = encodeFx({
            ...fx,
            id: wantMusic ? DEFAULT_MUSIC_FX_ID : defaultFx().id,
          });
          await fxParam.setValue(str);
          fxParam.value = str;
        }
      }
      const mode = MODE_OF[next];
      if (Number(modeParam.value) !== mode) {
        await modeParam.setValue(mode);
        modeParam.value = mode;
      }
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

      {view === "music" && hasMusic ? (
        <MusicPanel {...props} />
      ) : view === "effects" && hasEffects ? (
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
});

export default observer(LedStrip);
