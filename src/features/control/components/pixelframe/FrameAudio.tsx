/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { observer } from "mobx-react-lite";

import { tokens } from "@shared/theme/tokens";
import { testProps } from "@shared/utils/testProps";
import StripPowerBrightness from "@features/control/components/StripPowerBrightness";
import MusicPanel from "@features/control/components/MusicPanel";
import {
  AUDIO_MODES,
  FRAME_MODE_BEAT,
} from "@features/control/utils/pixelFrame";
import FrameColourCard from "./FrameColourCard";
import FrameModePills from "./FrameModePills";
import FrameSpeedCard from "./FrameSpeedCard";
import { FrameTabProps } from "./types";

/**
 * Audio tab of the Pixel Frame, laid out like the LED strips' Music tab.
 *
 * Top: power, brightness, the five audio modes (Bars, VU Ring, Beat, Sound
 * Fire, Spectrogram), fall speed (the frame's Speed param, which the audio
 * modes use for how fast levels drop) and colour.
 * Bottom: MusicPanel without the strip effects: Sensitivity, Music Sync role
 * (Lead only on frames with a mic), group and members, the same sections the
 * strips show, so a frame and a strip can be put in one group from either.
 * @param props - Tab props
 * @returns Audio tab
 */
const FrameAudio: React.FC<FrameTabProps> = (props) => {
  const { node, device, setScrollEnabled, mode, names, onMode, isConnected } = props;
  const shown = AUDIO_MODES.includes(mode) ? mode : AUDIO_MODES[0];

  return (
    <View {...testProps("view_frame_audio")}>
      <View style={styles.container}>
        <StripPowerBrightness {...props} />
        <FrameModePills
          title="Audio mode"
          modes={AUDIO_MODES}
          names={names}
          active={mode}
          disabled={!isConnected}
          onSelect={onMode}
        />
        <FrameSpeedCard
          {...props}
          label="Fall speed"
          hint="How quickly the picture drops back after a loud moment."
        />
        <FrameColourCard
          {...props}
          hint={
            shown === FRAME_MODE_BEAT
              ? "Beat starts from this colour and moves to a new one on every beat."
              : undefined
          }
        />
      </View>
      <MusicPanel
        node={node}
        device={device}
        setScrollEnabled={setScrollEnabled}
        showStripEffects={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: tokens.spacing._10 },
});

export default observer(FrameAudio);
