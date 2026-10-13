/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPCDFDeviceParam } from "@store";
import {
  ESPRM_BRIGHTNESS_PARAM_TYPE,
  ESPRM_CCT_PARAM_TYPE,
  ESPRM_ENERGY_PARAM_TYPE,
  ESPRM_HUE_PARAM_TYPE,
  ESPRM_SATURATION_PARAM_TYPE,
  ESPRM_TEMPERATURE_PARAM_TYPE,
} from "@shared/utils/constants";
import { PARAM_BOUNDS_VALUE_SUFFIX } from "@shared/utils/paramUtils";

/** Display unit per standard RainMaker param type. */
const UNIT_BY_PARAM_TYPE: Record<string, string> = {
  [ESPRM_TEMPERATURE_PARAM_TYPE]: "°C",
  [ESPRM_ENERGY_PARAM_TYPE]: "kWh",
  [ESPRM_BRIGHTNESS_PARAM_TYPE]: "%",
  [ESPRM_SATURATION_PARAM_TYPE]: "%",
  [ESPRM_CCT_PARAM_TYPE]: "K",
  [ESPRM_HUE_PARAM_TYPE]: "°",
};

/**
 * Resolves the display unit of a param: an explicit `valueSuffix` bound wins,
 * then the standard param type (native devices set `type`, Matter cluster
 * params set `uiType`), otherwise none.
 * @param param - Device param
 * @returns Unit symbol, or an empty string
 */
export const getParamUnit = (
  param: Pick<ESPCDFDeviceParam, "type" | "uiType" | "bounds"> | null | undefined,
): string => {
  if (!param) return "";
  const suffix = param.bounds?.[PARAM_BOUNDS_VALUE_SUFFIX];
  if (typeof suffix === "string" && suffix.length > 0) return suffix;
  return (
    (param.type && UNIT_BY_PARAM_TYPE[param.type]) ||
    (param.uiType && UNIT_BY_PARAM_TYPE[param.uiType]) ||
    ""
  );
};
