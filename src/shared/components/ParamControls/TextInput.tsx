/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput as RNTextInput,
} from "react-native";

// Styles
import { tokens } from "@shared/theme/tokens";
import { paramControlStyles as styles } from "./lib/styles";

// Icons
import { ChartNoAxesCombined, Edit3, Save, X } from "lucide-react-native";

// Types
import { ParamControlChildProps } from "./lib/types";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";

/**
 * Whether a text param has nothing to show yet.
 * @param value - Current param value from the wrap
 * @returns True for null, undefined or an empty string
 */
const isEmptyTextValue = (value: unknown): boolean =>
  value === null || value === undefined || value === "";

/**
 * TextInput
 *
 * `esp.ui.text` row: view the value, optionally edit it when `write` is
 * present (`disabled` is false), and open the time-series chart when
 * `onOpenChart` is set (`read` + `time_series`).
 * @param label - Param display label
 * @param value - Current param value
 * @param onValueChange - Persist handler from ParamControlWrap
 * @param disabled - True when `write` is missing or the node is unreachable
 * @param meta - Optional bounds (`maxLength`)
 * @param onOpenChart - Chart entry for time-series text params
 * @param compact - Fallback list density (vertical padding)
 * @returns Text row with optional edit modal and chart icon
 */
const TextInput = observer(
  ({
    label,
    value,
    onValueChange,
    disabled,
    meta,
    onOpenChart,
    compact = false,
  }: ParamControlChildProps) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(String(value ?? ""));

    const maxLength = meta?.maxLength ?? 50;
    const canEdit = !disabled;
    const canOpenChart = Boolean(onOpenChart);
    // Empty writable rows keep the edit placeholder; read-only telemetry shows "not available".
    const displayValue = isEmptyTextValue(value)
      ? t(canEdit ? "common.enterText" : "common.notAvailable")
      : String(value);

    /**
     * Opens the edit modal when the param is writable.
     */
    const handleEdit = () => {
      if (!canEdit) return;
      setTempValue(String(value ?? ""));
      setIsEditing(true);
    };

    /**
     * Row press: edit when writable, otherwise open the chart if available.
     */
    const handleRowPress = () => {
      if (canEdit) {
        handleEdit();
        return;
      }
      onOpenChart?.();
    };

    /**
     * Opens the time-series chart without starting an edit.
     */
    const handleChartPress = () => {
      onOpenChart?.();
    };

    /**
     * Persists the modal value and closes the editor.
     */
    const handleSave = async () => {
      onValueChange?.(null, tempValue);
      setIsEditing(false);
    };

    /**
     * Discards the modal value and closes the editor.
     */
    const handleCancel = () => {
      setTempValue(String(value ?? ""));
      setIsEditing(false);
    };

    return (
      <>
        <TouchableOpacity
          style={[styles.container, compact && styles.containerCompact]}
          onPress={handleRowPress}
          disabled={!canEdit && !canOpenChart}
        >
          <View style={styles.content}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{label}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {displayValue}
              </Text>
            </View>
            <View style={styles.iconCluster}>
              {canOpenChart && canEdit ? (
                <TouchableOpacity onPress={handleChartPress} hitSlop={8}>
                  <ChartNoAxesCombined size={20} color={tokens.colors.gray} />
                </TouchableOpacity>
              ) : canOpenChart ? (
                <ChartNoAxesCombined size={20} color={tokens.colors.gray} />
              ) : null}
              {canEdit ? <Edit3 size={20} color={tokens.colors.gray} /> : null}
            </View>
          </View>
        </TouchableOpacity>

        <Modal
          visible={isEditing}
          transparent
          animationType="fade"
          onRequestClose={handleCancel}
        >
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{label}</Text>

              <RNTextInput
                style={styles.textInput}
                value={tempValue}
                onChangeText={setTempValue}
                placeholder={t("common.enterText")}
                maxLength={maxLength}
                autoFocus
                selectTextOnFocus
              />

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                >
                  <X size={20} color={tokens.colors.gray} />
                  <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                >
                  <Save size={20} color={tokens.colors.white} />
                  <Text style={styles.saveButtonText}>{t("common.save")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }
);

export default TextInput;
