/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { View } from "react-native";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";

import { CollapsibleCard, ParamControlWrap } from "@shared/components";
import NumberInput from "@shared/components/ParamControls/NumberInput";
import { PARAM_CONTROLS } from "@/config/params.config";
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { tokens } from "@shared/theme/tokens";
import { resolveParamControl } from "@shared/utils/deviceParams";
import { shouldHideParamRow } from "@shared/utils/paramUtils";
import {
  DATA_TYPE_FLOAT,
  DATA_TYPE_INT,
  ESPRM_PARAM_WRITE_PROPERTY,
  ESPRM_UI_HIDDEN_PARAM_TYPE,
} from "@shared/utils/constants";
import { testProps } from "@shared/utils/testProps";
import type { ESPCDFDevice } from "@store";

/** Params owned by the strip controller firmware share this type prefix. */
const STRIP_PARAM_PREFIX = "custom.strip.";

interface StripSetupProps {
  device: ESPCDFDevice | undefined;
  /** True when the device is offline or the user may not change settings. */
  disabled?: boolean;
}

/**
 * Strip Setup settings card for LED strip controllers.
 *
 * Lists every `custom.strip.*` param of the device (LED count, PSU volts and
 * amps as number inputs, power-limiter status as read-only text). Renders
 * nothing for devices without such params, so it is safe on any device.
 * @param props - Device whose params to show and a disabled flag
 * @returns Collapsible settings card or null
 */
const StripSetup: React.FC<StripSetupProps> = ({ device, disabled = false }) => {
  const { t } = useTranslation();

  const paramsMap = useMemo(() => {
    const map: Record<string, any> = {};
    PARAM_CONTROLS.forEach((control) => {
      if (control.types.includes("esp.ui.hidden")) return;
      control.types.forEach((type) => {
        map[type] = control;
      });
    });
    return map;
  }, []);

  const stripParams = (device?.params ?? []).filter(
    (p) => typeof p.type === "string" && p.type.startsWith(STRIP_PARAM_PREFIX),
  );
  if (stripParams.length === 0) return null;

  return (
    <CollapsibleCard
      title={t("device.settings.stripSetupTitle", {
        defaultValue: "Strip Setup",
      })}
      style={{
        ...globalStyles.shadowElevationForLightTheme,
        backgroundColor: tokens.colors.white,
      }}
    >
      <View {...testProps("view_strip_setup")}>
        {stripParams.map((param) => {
          // zones / mode are edited by the strip panel, not listed here
          if (param.uiType === ESPRM_UI_HIDDEN_PARAM_TYPE) return null;
          if (shouldHideParamRow(param)) return null;

          const isWritable =
            param.properties?.includes(ESPRM_PARAM_WRITE_PROPERTY) ?? false;
          const isNumeric =
            param.dataType === DATA_TYPE_INT ||
            param.dataType === DATA_TYPE_FLOAT;

          // A writable number must go out as a number; the generic text
          // control sends a string, which the device ignores.
          // resolveParamControl may return null as well as undefined, so
          // `?? undefined` folds both into one "no control" value.
          const ControlComponent: React.ComponentType<any> | undefined =
            isNumeric && isWritable
              ? NumberInput
              : (resolveParamControl(param, paramsMap)?.control ?? undefined);
          if (!ControlComponent) return null;

          return (
            <ParamControlWrap
              key={param.name}
              param={param}
              disabled={disabled}
              setUpdating={() => {}}
              style={{ marginBottom: 10 }}
            >
              <ControlComponent compact />
            </ParamControlWrap>
          );
        })}
      </View>
    </CollapsibleCard>
  );
};

export default observer(StripSetup);
