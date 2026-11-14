/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { observer } from "mobx-react-lite";

import { SpeedSlider } from "@shared/components/ParamControls";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { tokens } from "@shared/theme/tokens";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";
import { useDraftParam } from "@features/control/hooks/useDraftParam";
import { findParam } from "@features/control/utils/stripSync";
import {
  FRAME_PARAM_SPEED_TYPE,
  FRAME_SPEED_MAX,
  FRAME_SPEED_MIN,
} from "@features/control/utils/pixelFrame";

interface FrameSpeedCardProps extends ControlPanelProps {
  /** Slider label: "Speed" for patterns, "Fall speed" for the audio modes. */
  label: string;
  hint?: string;
}

/**
 * The frame's Speed param (`custom.frame.speed`, 1..100, 50 = nominal). One
 * value drives every animation: pattern speed, text scrolling, and how fast
 * audio levels fall. A local draft makes a drag one write, sent as a number.
 * @param props - Node, device, scroll-lock callback, label and hint
 * @returns Speed card, or null when the frame has no speed param
 */
const FrameSpeedCard: React.FC<FrameSpeedCardProps> = ({
  node,
  device,
  setScrollEnabled,
  label,
  hint,
}) => {
  const isConnected = useDeviceConnected(node);
  const speedParam = findParam(device, FRAME_PARAM_SPEED_TYPE);
  const deviceSpeed = useMemo(() => {
    const n = Math.round(Number(speedParam?.value));
    return n >= FRAME_SPEED_MIN && n <= FRAME_SPEED_MAX ? n : 50;
  }, [speedParam?.value]);
  const [speed, editSpeed] = useDraftParam<number>(
    speedParam,
    deviceSpeed,
    (v) => Math.round(v),
    isConnected,
    "FrameSpeedCard",
  );
  if (!speedParam) return null;

  const lockScroll = () => setScrollEnabled?.(false);
  const unlockScroll = () => setScrollEnabled?.(true);

  return (
    <View
      style={styles.card}
      onTouchStart={lockScroll}
      onTouchEnd={unlockScroll}
      onTouchCancel={unlockScroll}
      {...testProps("view_frame_speed")}
    >
      <SpeedSlider
        label={label}
        value={speed}
        onValueChange={(_e: unknown, v: number) => editSpeed(v)}
        disabled={!isConnected}
        meta={{ min: FRAME_SPEED_MIN, max: FRAME_SPEED_MAX, step: 1 }}
        compact
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 6 },
});

export default observer(FrameSpeedCard);
