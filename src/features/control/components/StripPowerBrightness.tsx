/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";

import { ParamControlWrap } from "@shared/components";
import { PowerButton, BrightnessSlider } from "@shared/components/ParamControls";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import {
  ESPRM_BRIGHTNESS_PARAM_TYPE,
  ESPRM_POWER_PARAM_TYPE,
  ESPRM_UI_TOGGLE_PARAM_TYPE,
} from "@shared/utils/constants";
import { ControlPanelProps } from "@src/types/global";

/**
 * Power button and brightness slider (the standard params), shared by the
 * Zones and Effects editors so every LED strip view has the same top controls.
 * @param props - Node, device and parent scroll-lock callback
 * @returns Power and brightness controls
 */
const StripPowerBrightness: React.FC<ControlPanelProps> = ({
  node,
  device,
  setScrollEnabled,
}) => {
  const isConnected = useDeviceConnected(node);
  const params = device?.params ?? [];
  const powerParam = params.find(
    (p) =>
      p.type === ESPRM_POWER_PARAM_TYPE || p.uiType === ESPRM_UI_TOGGLE_PARAM_TYPE,
  );
  const brightnessParam = params.find(
    (p) => p.type === ESPRM_BRIGHTNESS_PARAM_TYPE,
  );
  const onSetUpdating = (updating: boolean) => setScrollEnabled?.(!updating);

  return (
    <>
      {powerParam && (
        <ParamControlWrap
          key={powerParam.name}
          param={powerParam}
          disabled={!isConnected}
          setUpdating={onSetUpdating}
          style={styles.block}
        >
          <PowerButton />
        </ParamControlWrap>
      )}
      {brightnessParam && (
        <ParamControlWrap
          key={brightnessParam.name}
          param={brightnessParam}
          disabled={!isConnected}
          setUpdating={onSetUpdating}
          style={styles.block}
        >
          <BrightnessSlider />
        </ParamControlWrap>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  block: { marginBottom: 10 },
});

export default observer(StripPowerBrightness);
