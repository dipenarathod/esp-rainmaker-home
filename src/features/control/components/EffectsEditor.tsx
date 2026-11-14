/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";

import { tokens } from "@shared/theme/tokens";
import HueSlider from "@shared/components/ParamControls/HueSlider";
import SaturationSlider from "@shared/components/ParamControls/SaturationSlider";
import SpeedSlider from "@shared/components/ParamControls/SpeedSlider";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";
import { useDraftParam } from "@features/control/hooks/useDraftParam";
import {
  ANIMATED_EFFECTS,
  EffectInfo,
  FX_SPEED_MAX,
  FX_SPEED_MIN,
  STRIP_PARAM_FX_TYPE,
  StripFx,
  defaultFx,
  encodeFx,
  fxPreview,
  parseFx,
} from "@features/control/utils/stripFx";
import {
  STRIP_MODE_EFFECT,
  STRIP_PARAM_MODE_TYPE,
  STRIP_PARAM_ZONES_TYPE,
  defaultZones,
  hsToRgb,
  parseZones,
  rgbToCss,
} from "@features/control/utils/stripZones";
import StripPowerBrightness from "./StripPowerBrightness";

const PREVIEW_SLICES = 48;

interface EffectsEditorProps extends ControlPanelProps {
  /** Effects offered as pills. Default: the animated effects (Effects tab). */
  effects?: EffectInfo[];
  /** Label of the speed slider; music effects use it as "how fast levels fall". */
  speedLabel?: string;
  /** Show power and brightness on top (default true). */
  showPowerBrightness?: boolean;
  /**
   * Also switch the strip to effect mode on the first edit. Used by the Music
   * screen, which is not one of the strip-mode tabs.
   */
  forceEffectMode?: boolean;
}

/**
 * Effects editor for LED strip controllers.
 *
 * Choose one of the offered effects, set its speed, and pick its colour:
 * either one colour (hue / saturation sliders) or the zone colours from the
 * Zones tab. Rainbow and Fire have their own colours, so the colour card is
 * hidden for them. Edits use a local draft and are sent after a short pause
 * (see useDraftParam). The Effects tab and the Music screen both use this,
 * with different effect lists.
 * @param props - Node, device, scroll-lock callback and the options above
 * @returns Effects editor
 */
const EffectsEditor: React.FC<EffectsEditorProps> = (props) => {
  const {
    node,
    device,
    setScrollEnabled,
    effects = ANIMATED_EFFECTS,
    speedLabel = "Speed",
    showPowerBrightness = true,
    forceEffectMode = false,
  } = props;
  const isConnected = useDeviceConnected(node);
  const params = device?.params ?? [];

  const fxParam = params.find((p) => p.type === STRIP_PARAM_FX_TYPE);
  const zonesParam = params.find((p) => p.type === STRIP_PARAM_ZONES_TYPE);
  const modeParam = params.find((p) => p.type === STRIP_PARAM_MODE_TYPE);

  const deviceFx = useMemo(
    () => parseFx(fxParam?.value) ?? defaultFx(),
    [fxParam?.value],
  );
  const [fx, edit] = useDraftParam<StripFx>(
    fxParam,
    deviceFx,
    encodeFx,
    isConnected,
    "EffectsEditor",
  );

  const zones = useMemo(
    () => parseZones(zonesParam?.value) ?? defaultZones(),
    [zonesParam?.value],
  );

  // The device may be running an effect from the other list (e.g. a music
  // effect while on the Effects tab): then no pill is selected and the
  // colour card follows the first offered effect until the user picks one.
  const active = effects.find((e) => e.id === fx.id);
  const info = active ?? effects[0];
  const shown: StripFx = active ? fx : { ...fx, id: info.id };
  const preview = useMemo(
    () => fxPreview(active ? fx : { ...fx, id: info.id }, zones, PREVIEW_SLICES),
    [fx, active, info.id, zones],
  );
  const canUseZones = !!zonesParam;

  const set = (patch: Partial<StripFx>) => {
    edit({ ...shown, ...patch });
    if (forceEffectMode && modeParam && Number(modeParam.value) !== STRIP_MODE_EFFECT) {
      Promise.resolve(modeParam.setValue(STRIP_MODE_EFFECT))
        .then(() => {
          modeParam.value = STRIP_MODE_EFFECT;
        })
        .catch((e: unknown) => console.error("[EffectsEditor] mode change failed:", e));
    }
  };

  // Sliders here are not wrapped by ParamControlWrap, so lock the page scroll by touch.
  const lockScroll = () => setScrollEnabled?.(false);
  const unlockScroll = () => setScrollEnabled?.(true);

  return (
    <View style={styles.container} {...testProps("view_effects")}>
      {showPowerBrightness && <StripPowerBrightness {...props} />}

      <View style={styles.preview} {...testProps("view_effects_preview")}>
        {preview.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: rgbToCss(c) }} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Effect</Text>
        <View style={styles.pills}>
          {effects.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => set({ id: e.id })}
              disabled={!isConnected}
              style={[styles.pill, e.id === fx.id && styles.pillActive]}
              {...testProps(`button_effect_${e.name.toLowerCase()}`)}
            >
              <Text style={[styles.pillText, e.id === fx.id && styles.pillTextActive]}>
                {e.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={styles.card}
        onTouchStart={lockScroll}
        onTouchEnd={unlockScroll}
        onTouchCancel={unlockScroll}
      >
        <SpeedSlider
          label={speedLabel}
          value={fx.speed}
          onValueChange={(_e: unknown, v: number) => set({ speed: Math.round(v) })}
          disabled={!isConnected}
          meta={{ min: FX_SPEED_MIN, max: FX_SPEED_MAX, step: 1 }}
          compact
        />
      </View>

      {info.colour && (
        <View style={styles.card}>
          {canUseZones && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Use zone colours</Text>
              <Switch
                value={fx.palette}
                onValueChange={(v) => set({ palette: v })}
                disabled={!isConnected}
              />
            </View>
          )}

          {fx.palette ? (
            <>
              <View style={styles.zoneChips}>
                {zones.zones.map((z, i) => (
                  <View
                    key={i}
                    style={[styles.zoneChip, { backgroundColor: rgbToCss(hsToRgb(z.h, z.s)) }]}
                  />
                ))}
              </View>
              <Text style={styles.hint}>Change these colours on the Zones tab.</Text>
            </>
          ) : (
            <View
              onTouchStart={lockScroll}
              onTouchEnd={unlockScroll}
              onTouchCancel={unlockScroll}
            >
              <HueSlider
                label="Hue"
                value={fx.h}
                onValueChange={(_e: unknown, v: number) => set({ h: Math.round(v) })}
                disabled={!isConnected}
                meta={{ min: 0, max: 360, step: 1 }}
                compact
              />
              <SaturationSlider
                label="Saturation"
                value={fx.s}
                onValueChange={(_e: unknown, v: number) => set({ s: Math.round(v) })}
                disabled={!isConnected}
                meta={{ min: 0, max: 100, step: 1, hue: fx.h, brightness: 50 }}
                compact
              />
            </View>
          )}
        </View>
      )}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  zoneChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  zoneChip: { width: 26, height: 26, borderRadius: 6 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 8 },
});

export default observer(EffectsEditor);
