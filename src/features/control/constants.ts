/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** i18n key for the empty state when a device control panel has no parameters. */
export const I18N_DEVICE_CONTROL_FALLBACK_NO_PARAMS = "device.control.fallbackNoParams";

/** i18n key for the Guide screen title when markdown fails to load. */
export const I18N_DEVICE_GUIDE_LOAD_FAILED = "device.control.guideLoadFailed";

/** i18n key for the Guide screen description when markdown fails to load. */
export const I18N_DEVICE_GUIDE_LOAD_FAILED_DESCRIPTION =
  "device.control.guideLoadFailedDescription";

/** Sentinel stored on Guide fetch failure (UI copy comes from i18n, not this value). */
export const GUIDE_LOAD_FAILED = "load_failed";

/** Settings quick-action tile ids (horizontal row after node info). */
export const SETTINGS_QUICK_ACTION_AUTH_TOKEN = "auth_token";
export const SETTINGS_QUICK_ACTION_DEVICE_LIST = "device_list";

/** Settings screen section keys (visibility toggles in {@link useSettings}). */
export const SETTINGS_SECTION_NAME = "name";

/** Outcomes returned by {@link saveDeviceDisplayName}. */
export const SAVE_DEVICE_NAME_STATUS_SUCCESS = "success";
export const SAVE_DEVICE_NAME_STATUS_NO_PARAM = "no_param";
export const SAVE_DEVICE_NAME_STATUS_FAILED = "failed";

/** Toast categories for RainMaker user-auth update results. */
export const RMAKER_AUTH_TOAST_KIND_UPDATED = "updated";
export const RMAKER_AUTH_TOAST_KIND_NO_REFRESH_TOKEN = "no_refresh_token";
export const RMAKER_AUTH_TOAST_KIND_FAILED = "failed";

// TIME SERIES CHART: RANGE PRESET KEYS (labels live under `device.chart.preset.*`)
export const TS_PRESET_1H = "1h";
export const TS_PRESET_6H = "6h";
export const TS_PRESET_24H = "24h";
export const TS_PRESET_1D = "1d";
export const TS_PRESET_7D = "7d";
export const TS_PRESET_4W = "4w";
export const TS_PRESET_1Y = "1y";

// TIME SERIES CHART: ZOOM
/** Narrowest window the raw chart can be zoomed into (labels stay distinct at one minute). */
export const RAW_ZOOM_MIN_SPAN_MS = 5 * 60 * 1000;

// TIME SERIES CHART: RAW SAMPLE CAPS
/** Raw pages are followed newest-first until this many samples are held (20 classic pages of 200). */
export const RAW_MAX_SAMPLES = 4000;
/** Samples handed to the renderer at most; the series is downsampled beyond this. */
export const RAW_RENDER_SAMPLES = 600;

// TIME SERIES CHART: FETCH PLANS (how a range is served, see `resolveFetchPlan`)
/** Server-computed buckets. */
export const TS_FETCH_PLAN_SERVER = "server";
/** Raw samples plotted as-is. */
export const TS_FETCH_PLAN_RAW = "raw";
/** Range exceeds every cap of the backend. */
export const TS_FETCH_PLAN_UNSUPPORTED = "unsupported";

// TIME SERIES CHART: EMPTY STATE KINDS (i18n under `device.chart.empty.*`)
export const TS_EMPTY_KIND_NO_TIME_SERIES = "noTimeSeries";
export const TS_EMPTY_KIND_NO_DATA = "noData";
export const TS_EMPTY_KIND_UNSUPPORTED = "unsupported";
export const TS_EMPTY_KIND_ERROR = "error";

// TIME SERIES CHART: X-AXIS LABEL FORMATS (resolved from tab + range, see `resolveXLabelKind`)
/** `14:00` — hourly buckets or raw samples within one day. */
export const TS_X_LABEL_TIME = "time";
/** `Fri` — hourly buckets or raw samples over several days, up to a week of daily buckets. */
export const TS_X_LABEL_WEEKDAY = "weekday";
/** `12 Sep` — daily buckets beyond a week, weekly buckets. */
export const TS_X_LABEL_DAY_MONTH = "dayMonth";
/** `Sep` — up to a year of monthly buckets. */
export const TS_X_LABEL_MONTH = "month";
/** `Sep 26` — monthly buckets beyond a year. */
export const TS_X_LABEL_MONTH_YEAR = "monthYear";

// TIME SERIES CHART: FOOTNOTE KINDS (i18n under `device.chart.notes.*`)
export const TS_NOTE_RAW_TRUNCATED = "rawTruncated";
export const TS_NOTE_DOWNSAMPLED = "downsampled";

// RainMaker cloud command-response (cmd-resp) — canonical defs in `@shared/utils/constants`.
export {
  CAMERA_SNAPSHOT_COMMAND_ID,
  NODE_CMD_DEFAULT_TIMEOUT,
  CAMERA_CMD_JPEG_CAPTURE,
  CAMERA_CMD_ARG_UPLOAD,
  CAMERA_CMD_ARG_QUALITY,
  CAMERA_CMD_ARG_RES,
  CAMERA_CMD_ARG_AGENT_ID,
  CAMERA_CMD_ARG_CONV_ID,
  CAMERA_CAPTURE_QUALITY,
  CAMERA_CAPTURE_RESOLUTION,
  NODE_CMD_POLL_INTERVAL_MS,
  NODE_CMD_POLL_MAX_ATTEMPTS,
  NODE_CMD_POLL_LABEL_SNAPSHOT,
  NODE_CMD_STATUS_SUCCESS,
  NODE_CMD_STATUS_FAILURE,
  NODE_CMD_STATUS_TIMED_OUT,
  SNAPSHOT_SIZE_MB_THRESHOLD,
} from "@shared/utils/constants";
