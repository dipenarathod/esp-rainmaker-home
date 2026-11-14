/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { observer } from "mobx-react-lite";
import { Mic, Radio, CircleOff, Crown } from "lucide-react-native";

import { Header, ScreenWrapper, DeviceOfflineBanner } from "@shared/components";
import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { useCDF } from "@shared/hooks/useCDF";
import { useDeviceConnected } from "@shared/hooks/useDeviceConnected";
import { useToast } from "@shared/hooks/useToast";
import { extractErrorMessage } from "@shared/utils/common";
import { getSubDeviceInitialDisplayName } from "@shared/utils/device";
import { testProps } from "@shared/utils/testProps";
import { useControl } from "@features/control/hooks";
import EffectsEditor from "@features/control/components/EffectsEditor";
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
  ROLE_LABEL,
  STRIP_PARAM_SYNC_GROUP_TYPE,
  STRIP_PARAM_SYNC_ROLE_TYPE,
  SYNC_GROUP_MAX,
  SYNC_GROUP_MIN,
  SYNC_ROLE_FOLLOW,
  SYNC_ROLE_LEAD,
  SYNC_ROLE_OFF,
  SyncMember,
  SyncRole,
  findParam,
  listSyncMembers,
  toSyncMember,
  writeNumber,
} from "@features/control/utils/stripSync";

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
 * Makes a device a follower in a group and starts a music effect on it, so it
 * visibly reacts straight away. Its own effect speed / colour are kept; only
 * the effect id changes, and only if it is not already a music effect.
 * @param m - Device to add
 * @param group - Target group
 */
const joinAsFollower = async (m: SyncMember, group: number) => {
  await writeNumber(findParam(m.device, STRIP_PARAM_SYNC_GROUP_TYPE), group);
  await writeNumber(findParam(m.device, STRIP_PARAM_SYNC_ROLE_TYPE), SYNC_ROLE_FOLLOW);

  const fxParam = findParam(m.device, STRIP_PARAM_FX_TYPE);
  const fx = parseFx(fxParam?.value) ?? defaultFx();
  if (fxParam && !isMusicFx(fx.id)) {
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
      getSubDeviceInitialDisplayName(member.device, member.node) ||
      member.device.name;
    const status = !connected
      ? "Offline"
      : member.role === SYNC_ROLE_OFF
        ? "Not syncing"
        : `${ROLE_LABEL[member.role]} · Group ${member.group}`;
    // Firmware without the group param is fixed to group 1.
    const canMove = !!findParam(member.device, STRIP_PARAM_SYNC_GROUP_TYPE);

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
 * Music Sync screen for audio-reactive LED controllers.
 *
 * Opened from the LED strip panel, and only for devices whose `cdf.caps`
 * lists `sync` (so Zigbee / Thread lights and older firmware never see it).
 * Sections:
 *  1. Role of this device: off / follow / lead (lead needs `mic`).
 *  2. Sync group 1..8: leader and followers must share one.
 *  3. Group members: every sync-capable device the user has, with Add (joins
 *     as follower and starts a music effect) and Remove (role off).
 *  4. Music effect of this device (Pulse, Spectrum, VU Meter), reusing the
 *     effects editor. Picking one switches the strip to effect mode.
 * All values are device params, so they survive app restarts and are shared
 * by everyone with access to the home.
 * @returns Music sync screen
 */
const MusicSync = () => {
  const { node, device, displayName, isConnected } = useControl();
  const { store } = useCDF();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const self = toSyncMember(node, device);
  const all = listSyncMembers(store?.nodeStore?.nodesByIDMap);
  const others = all.filter((m) => m.key !== self?.key);
  const group = self?.group ?? SYNC_GROUP_MIN;
  const inGroup = (m: SyncMember) => m.role !== SYNC_ROLE_OFF && m.group === group;
  const members = others.filter(inGroup);
  const outside = others.filter((m) => !inGroup(m));

  // Leaders in this group, counting this device only while it is syncing.
  const leaders =
    members.filter((m) => m.role === SYNC_ROLE_LEAD).length +
    (self && self.role === SYNC_ROLE_LEAD ? 1 : 0);
  const syncing = (self?.role ?? SYNC_ROLE_OFF) !== SYNC_ROLE_OFF || members.length > 0;

  /** Runs one write sequence with a spinner and an error toast. */
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (e) {
      console.error("[MusicSync] update failed:", e);
      toast.showError("Music Sync", extractErrorMessage(e) || "Could not update the device.");
    } finally {
      setBusy(null);
    }
  };

  const setRole = (role: SyncRole) =>
    run("self", () => writeNumber(findParam(device, STRIP_PARAM_SYNC_ROLE_TYPE), role));
  const setGroup = (g: number) =>
    run("self", () => writeNumber(findParam(device, STRIP_PARAM_SYNC_GROUP_TYPE), g));

  if (!node || !device || !self) {
    return (
      <>
        <Header label="Music Sync" showBack={true} qaId="header_music_sync" />
        <ScreenWrapper style={globalStyles.container} excludeTop={true} qaId="screen_wrapper_music_sync">
          <View style={globalStyles.errorContainer}>
            <Text style={globalStyles.errorText}>
              This device does not support music sync.
            </Text>
          </View>
        </ScreenWrapper>
      </>
    );
  }

  const hasGroupParam = !!findParam(device, STRIP_PARAM_SYNC_GROUP_TYPE);
  const disabled = !isConnected || busy !== null;

  return (
    <>
      <Header label="Music Sync" showBack={true} qaId="header_music_sync" />
      <ScreenWrapper
        style={{ ...globalStyles.container, backgroundColor: tokens.colors.bg5 }}
        excludeTop={true}
        dismissKeyboard={false}
        qaId="screen_wrapper_music_sync"
      >
        <ScrollView
          style={{ flex: 1, opacity: isConnected ? 1 : 0.5 }}
          contentContainerStyle={styles.scroll}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          {...testProps("scroll_music_sync")}
        >
          <DeviceOfflineBanner node={node} qaId="music_sync_offline" containerStyle={styles.banner} />

          {/* 1. Role */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{displayName}</Text>
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
            {!self.canLead && (
              <Text style={styles.hint}>
                This device has no microphone, so it can only follow.
              </Text>
            )}
            {self.canLead && (
              <View style={styles.inline}>
                <Mic size={14} color={tokens.colors.gray} />
                <Text style={styles.hint}> Built-in microphone</Text>
              </View>
            )}
          </View>

          {/* 2. Group */}
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

          {/* 3. Members */}
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
                    void run(m.key, () =>
                      writeNumber(findParam(m.device, STRIP_PARAM_SYNC_ROLE_TYPE), SYNC_ROLE_OFF),
                    )
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
                  Add makes a light a follower in group {group} and starts a music effect on it.
                </Text>
              </>
            )}
          </View>

          {/* 4. Music effect of this device */}
          <Text style={[styles.sectionTitle, styles.outerTitle]}>Music effect</Text>
          <EffectsEditor
            node={node}
            device={device}
            setScrollEnabled={setScrollEnabled}
            effects={MUSIC_EFFECTS}
            speedLabel="Fall speed"
            forceEffectMode
          />
        </ScrollView>
      </ScreenWrapper>
    </>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingTop: tokens.spacing._10, paddingBottom: tokens.spacing._15 },
  banner: { marginHorizontal: tokens.spacing._10, marginBottom: tokens.spacing._10 },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginHorizontal: tokens.spacing._10,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  subTitle: { marginTop: 14 },
  outerTitle: { marginHorizontal: tokens.spacing._10 + 2, marginTop: 6, marginBottom: 0 },
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

export default observer(MusicSync);
