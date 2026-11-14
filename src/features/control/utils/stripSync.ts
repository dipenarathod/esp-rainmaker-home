/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPCDFDevice, ESPCDFNode } from "@store";
import { getDeviceCaps } from "@features/control/utils/deviceAttributes";

/**
 * Music sync (audio-reactive leader / follower) shared with the LED strip and
 * Pixel Frame firmware.
 *
 * - `custom.sync.role`: 0 off, 1 follow, 2 lead. Lead only on devices whose
 *   `cdf.caps` lists `mic`.
 * - `custom.sync.group`: 1..8. Devices sync only within one group (each group
 *   is its own UDP port on the local network).
 * - `custom.audio.sens`: 1..100, how strongly this device's own music effects
 *   react (50 = normal). It never changes what a leader sends.
 * - A device takes part only when `cdf.caps` lists `sync`. Zigbee / Thread
 *   lights and older firmware never do, so they never show the Music tab.
 * Sync runs on the local Wi-Fi only; leader and followers must share it.
 *
 * The role / group types were renamed from `custom.strip.sync_*` on
 * 2026-11-14 so strips and frames share them. Strips still on older firmware
 * report the old names, so both are read (new names first).
 */
export const SYNC_PARAM_ROLE_TYPE = "custom.sync.role";
export const SYNC_PARAM_GROUP_TYPE = "custom.sync.group";
export const AUDIO_PARAM_SENS_TYPE = "custom.audio.sens";
/** Pre-rename types, still reported by older strip firmware. */
export const LEGACY_SYNC_PARAM_ROLE_TYPE = "custom.strip.sync_role";
export const LEGACY_SYNC_PARAM_GROUP_TYPE = "custom.strip.sync_group";

export const SYNC_ROLE_OFF = 0;
export const SYNC_ROLE_FOLLOW = 1;
export const SYNC_ROLE_LEAD = 2;
export type SyncRole = 0 | 1 | 2;

export const SYNC_GROUP_MIN = 1;
export const SYNC_GROUP_MAX = 8;

export const AUDIO_SENS_MIN = 1;
export const AUDIO_SENS_MAX = 100;
export const AUDIO_SENS_DEFAULT = 50;

export const ROLE_LABEL: Record<SyncRole, string> = {
  0: "Off",
  1: "Follow",
  2: "Lead",
};

/** One sync-capable device, flattened for the Music tab. */
export interface SyncMember {
  node: ESPCDFNode;
  device: ESPCDFDevice;
  /** Unique key: node id + device name. */
  key: string;
  role: SyncRole;
  /** Group 1 on firmware that predates groups. */
  group: number;
  canLead: boolean;
}

type Param = NonNullable<ESPCDFDevice["params"]>[number];

/**
 * Finds a device param by type.
 * @param device - Device to search
 * @param type - Param type, e.g. `custom.sync.role`
 * @returns The param, or undefined
 */
export const findParam = (
  device: ESPCDFDevice | undefined,
  type: string,
): Param | undefined => device?.params?.find((p) => p.type === type);

/**
 * The sync role param, under its current or its pre-rename type.
 * @param device - Device to search
 * @returns The role param, or undefined when the device cannot sync
 */
export const findRoleParam = (device: ESPCDFDevice | undefined): Param | undefined =>
  findParam(device, SYNC_PARAM_ROLE_TYPE) ?? findParam(device, LEGACY_SYNC_PARAM_ROLE_TYPE);

/**
 * The sync group param, under its current or its pre-rename type.
 * @param device - Device to search
 * @returns The group param, or undefined on firmware without groups
 */
export const findGroupParam = (device: ESPCDFDevice | undefined): Param | undefined =>
  findParam(device, SYNC_PARAM_GROUP_TYPE) ?? findParam(device, LEGACY_SYNC_PARAM_GROUP_TYPE);

/**
 * The audio sensitivity param.
 * @param device - Device to search
 * @returns The sensitivity param, or undefined on firmware without it
 */
export const findSensParam = (device: ESPCDFDevice | undefined): Param | undefined =>
  findParam(device, AUDIO_PARAM_SENS_TYPE);

const clampRole = (v: unknown): SyncRole => {
  const n = Number(v);
  return n === SYNC_ROLE_FOLLOW || n === SYNC_ROLE_LEAD ? n : SYNC_ROLE_OFF;
};

const clampGroup = (v: unknown): number => {
  const n = Math.round(Number(v));
  return n >= SYNC_GROUP_MIN && n <= SYNC_GROUP_MAX ? n : SYNC_GROUP_MIN;
};

/**
 * Reads a sensitivity value, falling back to the default when it is missing
 * or out of range.
 * @param v - Param value as reported by the device
 * @returns Sensitivity 1..100
 */
export const clampSens = (v: unknown): number => {
  const n = Math.round(Number(v));
  return n >= AUDIO_SENS_MIN && n <= AUDIO_SENS_MAX ? n : AUDIO_SENS_DEFAULT;
};

/**
 * Reads the sync state of one device.
 * @param node - Node that owns the device
 * @param device - Device to inspect
 * @returns The member, or null when the device cannot take part in music sync
 */
export const toSyncMember = (
  node: ESPCDFNode | undefined,
  device: ESPCDFDevice | undefined,
): SyncMember | null => {
  if (!node || !device) return null;
  const caps = getDeviceCaps(device);
  const roleParam = findRoleParam(device);
  if (!caps.has("sync") || !roleParam) return null;
  const groupParam = findGroupParam(device);
  return {
    node,
    device,
    key: `${node.id}/${device.name}`,
    role: clampRole(roleParam.value),
    group: groupParam ? clampGroup(groupParam.value) : SYNC_GROUP_MIN,
    canLead: caps.has("mic"),
  };
};

/**
 * Every sync-capable device the user has, across all nodes.
 * @param nodesByIDMap - The node store map
 * @returns Members in a stable order (by node id)
 */
export const listSyncMembers = (
  nodesByIDMap: Record<string, ESPCDFNode> | undefined,
): SyncMember[] => {
  const out: SyncMember[] = [];
  Object.values(nodesByIDMap ?? {}).forEach((node) => {
    (node?.devices ?? []).forEach((d) => {
      const m = toSyncMember(node, d as ESPCDFDevice);
      if (m) out.push(m);
    });
  });
  return out.sort((a, b) => a.key.localeCompare(b.key));
};

/**
 * Writes a number to a param and mirrors it locally so the UI updates at once
 * (same pattern as the Light panel).
 * @param param - Param to write; ignored when undefined
 * @param value - New value
 */
export const writeNumber = async (
  param: Param | undefined,
  value: number,
): Promise<void> => {
  if (!param) return;
  await param.setValue(value);
  param.value = value;
};
