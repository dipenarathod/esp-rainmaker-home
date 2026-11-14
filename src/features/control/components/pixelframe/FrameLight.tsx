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
import FrameColourCard from "./FrameColourCard";
import { FrameTabProps } from "./types";

/**
 * Light tab of the Pixel Frame: the whole panel in one colour (frame mode
 * Color), with power, brightness, hue and saturation, the same standard
 * params Alexa / Google use. Unlike the stock Light panel there is no White
 * tab, because the frame has no colour-temperature param.
 * @param props - Tab props
 * @returns Light tab
 */
const FrameLight: React.FC<FrameTabProps> = (props) => (
  <View style={styles.container} {...testProps("view_frame_light")}>
    <StripPowerBrightness {...props} />
    <FrameColourCard {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { paddingHorizontal: tokens.spacing._10 },
});

export default observer(FrameLight);
