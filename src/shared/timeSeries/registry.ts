/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TimeSeriesProvider } from "./types";

/**
 * Shape of the CDF param fields the registry keys on. `_raw` (the SDK param)
 * and `operations` are copied by reference every time the CDF re-instantiates
 * a param, so they identify the param across those copies.
 */
interface ProviderHost {
  _raw?: unknown;
  operations?: unknown;
}

/**
 * Providers keyed by the SDK param behind a CDF param. The CDF constructors
 * (`ESPCDFGroup` → `ESPCDFNode` → `ESPCDFDevice`) rebuild their children on
 * every pass, so keying on the CDF param object itself loses the provider as
 * soon as a node is re-wrapped by group sync or a store merge. `_raw` and
 * `operations` survive those passes by reference; `_raw` is preferred, and a
 * param without either falls back to its own identity.
 */
const providers = new WeakMap<object, TimeSeriesProvider>();

/**
 * Resolves the stable object a param's provider is registered under.
 * @param param - CDF device param (or the data it was built from)
 * @returns Registry key
 */
const providerKey = (param: ProviderHost): object => {
  if (param._raw !== null && typeof param._raw === "object") {
    return param._raw;
  }
  if (param.operations !== null && typeof param.operations === "object") {
    return param.operations;
  }
  return param;
};

/**
 * Attaches a time series provider to a CDF param. Called by SDK adaptors
 * right after the param is transformed.
 * @param param - CDF device param
 * @param provider - Provider serving that param
 */
export const attachTimeSeriesProvider = (
  param: ProviderHost,
  provider: TimeSeriesProvider,
): void => {
  providers.set(providerKey(param), provider);
};

/**
 * Resolves the provider attached to a CDF param, across CDF re-instantiation.
 * @param param - CDF device param
 * @returns The provider, or undefined when the param has no time series
 */
export const getTimeSeriesProvider = (
  param: ProviderHost | null | undefined,
): TimeSeriesProvider | undefined =>
  param ? providers.get(providerKey(param)) : undefined;
