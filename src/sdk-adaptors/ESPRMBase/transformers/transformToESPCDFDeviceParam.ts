/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPCDFDeviceParam, type ESPCDFDeviceParamOperation } from "@store";
import type { ESPRMDeviceParam } from "@espressif/rainmaker-base-sdk";
import { attachTimeSeriesProvider } from "@shared/timeSeries";

import { createRMTimeSeriesProvider } from "../utils/timeSeriesProvider";

/**
 * Maps a classic RainMaker device param to an `ESPCDFDeviceParam`. Params
 * declaring `time_series` (Timestream) or `simple_ts` (DynamoDB pre-compute)
 * get a time series provider attached, which the chart reads through
 * `getTimeSeriesProvider`.
 * @param param - Classic SDK device param
 * @returns CDF device param with bound operations
 */
export function transformToESPCDFDeviceParam(
    param: ESPRMDeviceParam,
): ESPCDFDeviceParam {
    const provider = createRMTimeSeriesProvider(param);
    const operations: ESPCDFDeviceParamOperation = {
        setValue: async (value: unknown) => param.setValue(value),
    };
    const cdfParam = new ESPCDFDeviceParam({
        name: param.name || "",
        dataType: param.dataType || "string",
        type: param.type || "",
        value: param.value,
        properties: Array.isArray(param.properties) ? param.properties : [],
        uiType: param.uiType,
        bounds: param.bounds,
        deviceName: (param as { deviceName?: string }).deviceName, // Preserve deviceName
        operations,
        _raw: param,
    });
    if (provider) {
        attachTimeSeriesProvider(cdfParam, provider);
    }
    return cdfParam;
}
