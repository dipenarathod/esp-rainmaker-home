/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPCDFDeviceParam, type ESPCDFDeviceParamOperation } from "@store";
import type { ESPRMNeoDeviceParam } from "@espressif/rainmaker-neo-base-sdk";
import {
  DATA_TYPE_STRING,
  ESPRM_PARAM_READ_PROPERTY,
  ESPRM_PARAM_WRITE_PROPERTY,
} from "@shared/utils/constants";
import { attachTimeSeriesProvider } from "@shared/timeSeries";

import { createNeoTimeSeriesProvider } from "../utils/timeSeriesProvider";

/** Default access properties when the SDK omits `properties` on a param. */
const ESPRMNEO_DEFAULT_PARAM_PROPERTIES = [
  ESPRM_PARAM_READ_PROPERTY,
  ESPRM_PARAM_WRITE_PROPERTY,
] as const;

/**
 * Maps a Neo device param to an `ESPCDFDeviceParam`. Params declaring
 * `time_series` get a time series provider attached (raw samples and
 * pre-computed aggregates), which the chart reads through
 * `getTimeSeriesProvider`.
 * @param param - Raw Neo device param from the SDK.
 * @returns CDF device param with mapped fields and bound operations.
 */
export function transformToESPCDFDeviceParam(
  param: ESPRMNeoDeviceParam,
): ESPCDFDeviceParam {
  const provider = createNeoTimeSeriesProvider(param);
  const operations: ESPCDFDeviceParamOperation = {
    setValue: async (value: unknown) => param.setValue(value),
  };
  const cdfParam = new ESPCDFDeviceParam({
    name: param.id || "",
    dataType: param.dataType || DATA_TYPE_STRING,
    type: param.type || "",
    value: param.value,
    properties: param.properties || [...ESPRMNEO_DEFAULT_PARAM_PROPERTIES],
    uiType: param.uiType,
    bounds: param.bounds,
    deviceName: param.deviceName,
    operations,
    _raw: param,
  });
  if (provider) {
    attachTimeSeriesProvider(cdfParam, provider);
  }
  return cdfParam;
}
