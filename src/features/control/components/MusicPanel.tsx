/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { observer } from "mobx-react-lite";
import { Mic, Radio, CircleOff, Crown } from "lucide-react-native";

import { tokens } from "@shared/theme/tokens";
import VolumeSlider from "@shared/components/ParamControls/VolumeSlider";
import { useCDF } from "@shared/hooks/useCDF";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { useToast } from "@shared/hooks/useToast";
import { extractErrorMessage } from "@shared/utils/common";
import { getDeviceDisplayName } from "@shared/utils/deviceDisplayName";
import { testProps } from "@shared/utils/testProps";
import { ControlPanelProps } from "@src/types/global";
import { useDraftParam } from "@features/control/hooks/useDraftParam";
import {
  DEFAULT_MUSIC_FX_ID,
  MUSIC_EFFECTS,
  STRIP_PARAM_FX_TYPE,
  defaultFx,
  encodeFx,
  isMusicFx,
  parseFx,
} from "@features/control/utils/stripFx";
import {
  STRIP_MODE_EFFECT,
  STRIP_PARAM_MODE_TYPE,
} from "@features/control/utils/stripZones";
import {
  AUDIO_SENS_MAX,
  AUDIO_SENS_MIN,
  ROLE_LABEL,
  SYNC_GROUP_MAX,
  SYNC_GROUP_MIN,
  SYNC_ROLE_FOLLOW,
  SYNC_ROLE_LEAD,
  SYNC_ROLE_OFF,
  SyncMember,
  SyncRole,
  clampSens,
  findGroupParam,
  findParam,
  findRoleParam,
  findSensParam,
  listSyncMembers,
  toSyncMember,
  writeNumber,
} from "@features/control/utils/stripSync";
import EffectsEditor from "./EffectsEditor";

const GROUPS = Array.from(
  { length: SYNC_GROUP_MAX - SYNC_GROUP_MIN + 1 },
  (_, i) => SYNC_GROUP_MIN + i,
);

const ROLE_HELP: Record<SyncRole, string> = {
  0: "Not syncing. A device with a mic still reacts to its own mic.",
  1: "Reacts to the leader of its group. No mic needed.",
  2: "Listens with its mic and drives every follower in its group.",
};

/**
 * Makes a device a follower in a group. On an LED strip it also starts a
 * music effect, so it visibly reacts straight away (its own speed / colour are
 * kept; only the effect id changes, and only if it is not already a music
 * effect). Devices without the strip effect params, such as the Pixel Frame,
 * only get group + role: the frame switches itself to an audio mode on Follow.
 * @param m - Device to add
 * @param group - Target group
 */
const joinAsFollower = async (m: SyncMember, group: number) => {
  await writeNumber(findGroupParam(m.device), group);
  await writeNumber(findRoleParam(m.device), SYNC_ROLE_FOLLOW);

  const fxParam = findParam(m.device, STRIP_PARAM_FX_TYPE);
  if (!fxParam) return;
  const fx = parseFx(fxParam.value) ?? defaultFx();
  if (!isMusicFx(fx.id)) {
    const str = encodeFx({ ...fx, id: DEFAULT_MUSIC_FX_ID });
    await fxParam.setValue(str);
    fxParam.value = str;
  }
  await writeNumber(findParam(m.device, STRIP_PARAM_MODE_TYPE), STRIP_MODE_EFFECT);
};

interface MemberRowProps {
  member: SyncMember;
  inGroup: boolean;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

/**
 * One device in the members list. Its own component so each row can track
 * that device's connectivity (a hook per device).
 */
const MemberRow = observer(
  ({ member, inGroup, busy, onAdd, onRemove }: MemberRowProps) => {
    const connected = useDeviceConnected(member.node);
    const name =
      getDeviceDisplayName(member.device, member.node) || member.device.name;
    const status = !connected
      ? "Offline"
      : member.role === SYNC_ROLE_OFF
        ? "Not syncing"
        : `${ROLE_LABEL[member.role]} · Group ${member.group}`;
    // Firmware without the group param is fixed to group 1.
    const canMove = !!findGroupParam(member.device);

    return (
      <View style={styles.memberRow} {...testProps(`view_sync_member_${member.key}`)}>
        {member.role === SYNC_ROLE_LEAD ? (
          <Crown size={18} color={tokens.colors.primary} />
        ) : member.role === SYNC_ROLE_FOLLOW ? (
          <Radio size={18} color={tokens.colors.primary} />
        ) : (
          <CircleOff size={18} color={tokens.colors.gray} />
        )}
        <View style={styles.memberText}>
          <Text style={styles.memberName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.hint}>{status}</Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={tokens.colors.primary} />
        ) : inGroup ? (
          <Pressable
            onPress={onRemove}
            disabled={!connected}
            style={[styles.smallButton, !connected && styles.disabled]}
            {...testProps(`button_sync_remove_${member.key}`)}
          >
            <Text style={styles.smallButtonText}>Remove</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onAdd}
            disabled={!connected || !canMove}
            style={[
              styles.smallButton,
              styles.smallButtonPrimary,
              (!connected || !canMove) && styles.disabled,
            ]}
            {...testProps(`button_sync_add_${member.key}`)}
          >
            <Text style={[styles.smallButtonText, styles.smallButtonTextPrimary]}>
              Add
            </Text>
          </Pressable>
        )}
      </View>
    );
  },
);

/**
 * Sensitivity slider (`custom.audio.sens`, 1..100, 50 = normal). Uses a local
 * draft so a drag is one write, and sends a real number (the device ignores
 * strings for numeric params). Renders nothing on firmware without the param.
 */
const SensitivityCard = observer(
  ({ node, device, setScrollEnabled }: ControlPanelProps) => {
    const isConnected = useDeviceConnected(node);
    const sensParam = findSensParam(device);
    const deviceSens = useMemo(() => clampSens(sensParam?.value), [sensParam?.value]);
    const [sens, editSens] = useDraftParam<number>(
      sensParam,
      deviceSens,
      (v) => Math.round(v),
      isConnected,
      "MusicPanel.sens",
    );
    if (!sensParam) return null;

    const lockScroll = () => setScrollEnabled?.(false);
    const unlockScroll = () => setScrollEnabled?.(true);

    return (
      <View
        style={styles.card}
        onTouchStart={lockScroll}
        onTouchEnd={unlockScroll}
        onTouchCancel={unlockScroll}
        {...testProps("view_music_sensitivity")}
      >
        <VolumeSlider
          label="Sensitivity"
          value={sens}
          onValueChange={(_e: unknown, v: number) => editSens(v)}
          disabled={!isConnected}
          meta={{ min: AUDIO_SENS_MIN, max: AUDIO_SENS_MAX, step: 1 }}
          compact
        />
        <Text style={styles.hint}>
          How strongly this light reacts to music. 50 is normal. It does not change
          what a leader sends to other lights.
        </Text>
      </View>
    );
  },
);

interface MusicPanelProps extends ControlPanelProps {
  /** Show power and brightness above the music effects (default true). */
  showPowerBrightness?: boolean;
  /**
   * Show the LED strip music effects (Pulse / Spectrum / VU, default true).
   * The Pixel Frame turns this off: its audio modes are its own Mode values,
   * picked on its Audio tab above this panel.
   */
  showStripEffects?: boolean;
}

/**
 * Music panel for audio-reactive LED controllers: the "Music" tab of the LED
 * strip panel, the lower half of the Pixel Frame's "Audio" tab, and the body
 * of the standalone Music Sync screen.
 *
 * Sections, top to bottom:
 *  1. Music effect (Pulse, Spectrum, VU Meter) with power and brightness,
 *     reusing the effects editor. Picking one switches the strip to effect mode.
 *     Hidden with `showStripEffects={false}`.
 *  2. Sensitivity (`custom.audio.sens`), when the firmware has it.
 *  3. Role of this device: off / follow / lead (lead needs `mic`).
 *  4. Sync group 1..8: leader and followers must share one.
 *  5. Group members: every sync-capable device the user has, with Add (joins
 *     as follower) and Remove (role off).
 * All values are device params, so they survive app restarts and are shared
 * by everyone with access to the home.
 * @param props - Node, device, scroll-lock callback and display options
 * @returns Music panel, or null when the device cannot sync
 */
const MusicPanel: React.FC<MusicPanelProps> = (props) => {
  const {
    node,
    device,
    setScrollEnabled,
    showPowerBrightness = true,
    showStripEffects = true,
  } = props;
  const isConnected = useDeviceConnected(node);
  const { store } = useCDF();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const self = toSyncMember(node, device);
  if (!node || !device || !self) return null;

  const all = listSyncMembers(store?.nodeStore?.nodesByIDMap);
  const others = all.filter((m) => m.key !== self.key);
  const group = self.group;
  const inGroup = (m: SyncMember) => m.role !== SYNC_ROLE_OFF && m.group === group;
  const members = others.filter(inGroup);
  const outside = others.filter((m) => !inGroup(m));

  // Leaders in this group, counting this device only while it is syncing.
  const leaders =
    members.filter((m) => m.role === SYNC_ROLE_LEAD).length +
    (self.role === SYNC_ROLE_LEAD ? 1 : 0);
  const syncing = self.role !== SYNC_ROLE_OFF || members.length > 0;

  /** Runs one write sequence with a spinner and an error toast. */
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (e) {
      console.error("[MusicPanel] update failed:", e);
      toast.showError("Music Sync", extractErrorMessage(e) || "Could not update the device.");
    } finally {
      setBusy(null);
    }
  };

  const setRole = (role: SyncRole) =>
    run("self", () => writeNumber(findRoleParam(device), role));
  const setGroup = (g: number) =>
    run("self", () => writeNumber(findGroupParam(device), g));

  const hasGroupParam = !!findGroupParam(device);
  const disabled = !isConnected || busy !== null;

  return (
    <View {...testProps("view_music_panel")}>
      {/* 1. Music effect (LED strips only) */}
      {showStripEffects && (
        <EffectsEditor
          node={node}
          device={device}
          setScrollEnabled={setScrollEnabled}
          effects={MUSIC_EFFECTS}
          speedLabel="Fall speed"
          showPowerBrightness={showPowerBrightness}
          forceEffectMode
        />
      )}

      <View style={styles.cards}>
        {/* 2. Sensitivity */}
        <SensitivityCard node={node} device={device} setScrollEnabled={setScrollEnabled} />

        {/* 3. Role */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Music Sync</Text>
          <View style={styles.segment}>
            {([SYNC_ROLE_OFF, SYNC_ROLE_FOLLOW, SYNC_ROLE_LEAD] as SyncRole[]).map((r) => {
              const blocked = r === SYNC_ROLE_LEAD && !self.canLead;
              const active = self.role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => !active && void setRole(r)}
                  disabled={disabled || blocked}
                  style={[styles.segmentItem, active && styles.segmentActive, blocked && styles.disabled]}
                  {...testProps(`button_sync_role_${ROLE_LABEL[r].toLowerCase()}`)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {ROLE_LABEL[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{ROLE_HELP[self.role]}</Text>
          {self.canLead ? (
            <View style={styles.inline}>
              <Mic size={14} color={tokens.colors.gray} />
              <Text style={styles.hint}> Built-in microphone</Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              This device has no microphone, so it can only follow.
            </Text>
          )}
        </View>

        {/* 4. Group */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sync group</Text>
          <View style={styles.pills}>
            {GROUPS.map((g) => (
              <Pressable
                key={g}
                onPress={() => g !== group && void setGroup(g)}
                disabled={disabled || !hasGroupParam}
                style={[
                  styles.groupPill,
                  g === group && styles.pillActive,
                  !hasGroupParam && g !== group && styles.disabled,
                ]}
                {...testProps(`button_sync_group_${g}`)}
              >
                <Text style={[styles.pillText, g === group && styles.pillTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            {hasGroupParam
              ? "Lights sync only with others in the same group, on the same Wi-Fi. Group 1 also works with WLED."
              : "Update this device's firmware to choose a group; it uses group 1."}
          </Text>
        </View>

        {/* 5. Members */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Group {group}</Text>
          {syncing && leaders === 0 && (
            <Text style={[styles.hint, styles.warn]}>
              No leader in this group. Set a device with a microphone to Lead.
            </Text>
          )}
          {leaders > 1 && (
            <Text style={[styles.hint, styles.warn]}>
              {leaders} leaders in this group: followers will jump between them. Keep one.
            </Text>
          )}
          {members.length === 0 ? (
            <Text style={styles.hint}>No other lights in this group yet.</Text>
          ) : (
            members.map((m) => (
              <MemberRow
                key={m.key}
                member={m}
                inGroup
                busy={busy === m.key}
                onAdd={() => {}}
                onRemove={() =>
                  void run(m.key, () => writeNumber(findRoleParam(m.device), SYNC_ROLE_OFF))
                }
              />
            ))
          )}

          {outside.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.subTitle]}>Other music lights</Text>
              {outside.map((m) => (
                <MemberRow
                  key={m.key}
                  member={m}
                  inGroup={false}
                  busy={busy === m.key}
                  onAdd={() => void run(m.key, () => joinAsFollower(m, group))}
                  onRemove={() => {}}
                />
              ))}
              <Text style={styles.hint}>
                Add makes a light a follower in group {group}. LED strips also start a
                music effect.
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cards: { paddingHorizontal: tokens.spacing._10 },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  subTitle: { marginTop: 14 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 6 },
  warn: { color: tokens.colors.red, opacity: 1 },
  inline: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 20,
    backgroundColor: tokens.colors.bg5,
  },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 17, alignItems: "center" },
  segmentActive: { backgroundColor: tokens.colors.primary },
  segmentText: { fontSize: 15, fontWeight: "500" },
  segmentTextActive: { color: tokens.colors.white },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.bg5,
  },
  pillActive: { backgroundColor: tokens.colors.primary },
  pillText: { fontSize: 15, fontWeight: "500" },
  pillTextActive: { color: tokens.colors.white },
  disabled: { opacity: 0.4 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  memberText: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "500" },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colors.bg5,
  },
  smallButtonPrimary: { backgroundColor: tokens.colors.primary },
  smallButtonText: { fontSize: 14, fontWeight: "500" },
  smallButtonTextPrimary: { color: tokens.colors.white },
});

export default observer(MusicPanel);
