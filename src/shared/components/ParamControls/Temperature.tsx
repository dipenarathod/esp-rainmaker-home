/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";

// Styles
import { tokens } from "@shared/theme/tokens";
import { paramControlStyles as styles } from "./lib/styles";

// Icons
import { ChartNoAxesCombined } from "lucide-react-native";

// Types
import { ParamControlChildProps } from "./lib/types";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";

/**
 * Temperature
 *
 * A temperature display component that shows the temperature value.
 * On click, opens the chart for time series visualization.
 * @param param - The parameter object containing value and setValue function
 * @param disabled - Optional flag to disable the control
 * @returns Temperature readout that invokes `onOpenChart` when charts are enabled
 */
const Temperature = observer(
  ({ label, value, onOpenChart }: ParamControlChildProps) => {
    const { t } = useTranslation();
    const canOpenChart = Boolean(onOpenChart);

    /**
     * Opens the time-series chart when this param supports it.
     */
    const handlePress = () => {
      onOpenChart?.();
    };

    /**
     * Formats a temperature readout with a Celsius suffix.
     * @param val - Current param value
     * @returns Display string, or the localized "not available" when the value is missing
     */
    const formatTemperature = (val: unknown): string => {
      if (val === null || val === undefined) return t("common.notAvailable");
      return `${val}°C`;
    };

    return (
      <TouchableOpacity
        style={[styles.container, styles.containerCompact]}
        onPress={handlePress}
        disabled={!canOpenChart}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.value} numberOfLines={1}>
              {formatTemperature(value)}
            </Text>
          </View>
          {canOpenChart ? (
            <ChartNoAxesCombined size={20} color={tokens.colors.gray} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }
);

export default Temperature;
