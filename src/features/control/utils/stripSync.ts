/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPCDFDevice, ESPCDFNode } from "@store";
import { getDeviceCaps } from "@features/control/utils/deviceAttributes";

/**
 * Music sync (audio-reactive leader / follower) shared with the LED strip
 * firmware (strip_types.h, audio_sync.c).
 *
 * - `custom.strip.sync_role`: 0 off, 1 follow, 2 lead. Lead only on devices
 *   whose `cdf.caps` lists `mic`.
 * - `custom.strip.sync_group`: 1..8. Devices sync only within one group
 *   (each group is its own UDP port on the local network).
 * - A device takes part only when `cdf.caps` lists `sync`. Zigbee / Thread
 *   lights and older firmware never do, so they never show the Music screen.
 * Sync runs on the local Wi-Fi only; leader and followers must share it.
 */
export const STRIP_PARAM_SYNC_ROLE_TYPE = "custom.strip.sync_role";
export const STRIP_PARAM_SYNC_GROUP_TYPE = "custom.strip.sync_group";

export const SYNC_ROLE_OFF = 0;
export const SYNC_ROLE_FOLLOW = 1;
export const SYNC_ROLE_LEAD = 2;
export type SyncRole = 0 | 1 | 2;

export const SYNC_GROUP_MIN = 1;
export const SYNC_GROUP_MAX = 8;

export const ROLE_LABEL: Record<SyncRole, string> = {
  0: "Off",
  1: "Follow",
  2: "Lead",
};

/** One sync-capable device, flattened for the Music screen. */
export interface SyncMember {
  node: ESPCDFNode;
  device: ESPCDFDevice;
  /** Unique key: node id + device name. */
  key: string;
  role: SyncRole;
  /** undefined on firmware that predates groups (it is always in group 1). */
  group: number;
  canLead: boolean;
}

type Param = NonNullable<ESPCDFDevice["params"]>[number];

/**
 * Finds a device param by type.
 * @param device - Device to search
 * @param type - Param type, e.g. `custom.strip.sync_role`
 * @returns The param, or undefined
 */
export const findParam = (
  device: ESPCDFDevice | undefined,
  type: string,
): Param | undefined => device?.params?.find((p) => p.type === type);

const clampRole = (v: unknown): SyncRole => {
  const n = Number(v);
  return n === SYNC_ROLE_FOLLOW || n === SYNC_ROLE_LEAD ? n : SYNC_ROLE_OFF;
};

const clampGroup = (v: unknown): number => {
  const n = Math.round(Number(v));
  return n >= SYNC_GROUP_MIN && n <= SYNC_GROUP_MAX ? n : SYNC_GROUP_MIN;
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
  const roleParam = findParam(device, STRIP_PARAM_SYNC_ROLE_TYPE);
  if (!caps.has("sync") || !roleParam) return null;
  const groupParam = findParam(device, STRIP_PARAM_SYNC_GROUP_TYPE);
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
