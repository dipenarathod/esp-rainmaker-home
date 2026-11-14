/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { observer } from "mobx-react-lite";

import { ParamControlWrap } from "@shared/components";
import { HueSlider, SaturationSlider } from "@shared/components/ParamControls";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import {
  ESPRM_HUE_PARAM_TYPE,
  ESPRM_SATURATION_PARAM_TYPE,
} from "@shared/utils/constants";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";

interface FrameColourCardProps extends ControlPanelProps {
  /** Line under the sliders, e.g. what the colour applies to. */
  hint?: string;
}

/**
 * Hue and saturation of the Pixel Frame (the standard params). One colour
 * serves every mode that uses it (text, clock, timers, most patterns and the
 * audio modes), so this card appears on several tabs.
 * @param props - Node, device, scroll-lock callback and an optional hint
 * @returns Colour card, or null when the frame has no hue / saturation params
 */
const FrameColourCard: React.FC<FrameColourCardProps> = ({
  node,
  device,
  setScrollEnabled,
  hint,
}) => {
  const isConnected = useDeviceConnected(node);
  const params = device?.params ?? [];
  const hueParam = params.find((p) => p.type === ESPRM_HUE_PARAM_TYPE);
  const satParam = params.find((p) => p.type === ESPRM_SATURATION_PARAM_TYPE);
  if (!hueParam && !satParam) return null;

  const onSetUpdating = (updating: boolean) => setScrollEnabled?.(!updating);

  return (
    <View {...testProps("view_frame_colour")}>
      {hueParam && (
        <ParamControlWrap
          key={hueParam.name}
          param={hueParam}
          disabled={!isConnected}
          setUpdating={onSetUpdating}
          style={styles.block}
        >
          <HueSlider />
        </ParamControlWrap>
      )}
      {satParam && (
        <ParamControlWrap
          key={satParam.name}
          param={satParam}
          disabled={!isConnected}
          setUpdating={onSetUpdating}
          style={styles.block}
        >
          <SaturationSlider />
        </ParamControlWrap>
      )}
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { marginBottom: 10 },
  hint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: -4,
    marginBottom: 10,
    marginHorizontal: 4,
  },
});

export default observer(FrameColourCard);
