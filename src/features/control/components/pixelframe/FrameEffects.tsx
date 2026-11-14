/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { observer } from "mobx-react-lite";

import { tokens } from "@shared/theme/tokens";
import { testProps } from "@shared/utils/testProps";
import StripPowerBrightness from "@features/control/components/StripPowerBrightness";
import { findParam } from "@features/control/utils/stripSync";
import {
  EFFECT_MODES,
  FRAME_MODE_TEST,
  FRAME_MODE_TEXT,
  FRAME_PARAM_TEXT_TYPE,
  FRAME_TEXT_MAX,
  modeUsesColour,
  sanitizeFrameText,
} from "@features/control/utils/pixelFrame";
import FrameColourCard from "./FrameColourCard";
import FrameModePills from "./FrameModePills";
import FrameSpeedCard from "./FrameSpeedCard";
import { FrameTabProps } from "./types";

/**
 * Text shown in Text mode (`custom.frame.text`). Typed text stays local until
 * Show is pressed (or the keyboard's done key), so the frame does not redraw on
 * every keystroke. Only printable ASCII is accepted, up to 64 characters,
 * which is what the firmware's font and checks allow. Showing text also
 * switches the frame to Text mode.
 * @param props - Tab props
 * @returns Text card
 */
const FrameTextCard: React.FC<FrameTabProps> = observer(
  ({ device, mode, onMode, isConnected }: FrameTabProps) => {
    const textParam = findParam(device, FRAME_PARAM_TEXT_TYPE);
    const deviceText = typeof textParam?.value === "string" ? textParam.value : "";
    const [draft, setDraft] = useState(deviceText);
    const editing = useRef(false);

    // Follow the frame's text unless the user is typing.
    useEffect(() => {
      if (!editing.current) setDraft(deviceText);
    }, [deviceText]);

    if (!textParam) return null;
    const changed = draft !== deviceText;

    /** Sends the text and makes sure Text mode is showing. */
    const show = async () => {
      editing.current = false;
      try {
        if (changed) {
          await textParam.setValue(draft);
          textParam.value = draft;
        }
        if (mode !== FRAME_MODE_TEXT) onMode(FRAME_MODE_TEXT);
      } catch (e) {
        console.error("[FrameEffects] text write failed:", e);
      }
    };

    return (
      <View style={styles.card} {...testProps("view_frame_text")}>
        <Text style={styles.sectionTitle}>Text</Text>
        <View style={styles.textRow}>
          <TextInput
            value={draft}
            onChangeText={(t) => {
              editing.current = true;
              setDraft(sanitizeFrameText(t));
            }}
            onSubmitEditing={() => void show()}
            onBlur={() => {
              editing.current = false;
            }}
            maxLength={FRAME_TEXT_MAX}
            editable={isConnected}
            placeholder="Type something"
            returnKeyType="done"
            autoCorrect={false}
            style={styles.input}
            {...testProps("input_frame_text")}
          />
          <Pressable
            onPress={() => void show()}
            disabled={!isConnected || draft.length === 0}
            style={[styles.button, (!isConnected || draft.length === 0) && styles.disabled]}
            {...testProps("button_frame_text_show")}
          >
            <Text style={styles.buttonText}>Show</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {draft.length}/{FRAME_TEXT_MAX}. Short text stays still; longer text scrolls at the
          speed below. Letters, numbers and symbols only (no emoji).
        </Text>
      </View>
    );
  },
);

/**
 * Effects tab of the Pixel Frame: the animated patterns, Text and the Test
 * pattern. Shows only the controls the chosen mode uses:
 *  - Speed for every mode here (it also sets how fast text scrolls),
 *  - the text box in Text mode,
 *  - the colour sliders except for Rainbow, Fire and Test, which draw their
 *    own colours.
 * @param props - Tab props
 * @returns Effects tab
 */
const FrameEffects: React.FC<FrameTabProps> = (props) => {
  const { mode, names, onMode, isConnected } = props;
  const inTab = EFFECT_MODES.includes(mode);
  // While another tab's mode shows, describe the first pattern.
  const shown = inTab ? mode : EFFECT_MODES[0];

  return (
    <View style={styles.container} {...testProps("view_frame_effects")}>
      <StripPowerBrightness {...props} />
      <FrameModePills
        title="Effect"
        modes={EFFECT_MODES}
        names={names}
        active={mode}
        disabled={!isConnected}
        onSelect={onMode}
        hint={
          shown === FRAME_MODE_TEST
            ? "Test lights the corners and scans a dot across the panel, to check the wiring and orientation."
            : undefined
        }
      />
      {shown === FRAME_MODE_TEXT && <FrameTextCard {...props} />}
      <FrameSpeedCard {...props} label="Speed" />
      {modeUsesColour(shown) && <FrameColourCard {...props} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: tokens.spacing._10 },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  textRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tokens.colors.bg5,
  },
  button: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: tokens.colors.primary,
  },
  buttonText: { fontSize: 14, fontWeight: "600", color: tokens.colors.white },
  disabled: { opacity: 0.5 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 8 },
});

export default observer(FrameEffects);
