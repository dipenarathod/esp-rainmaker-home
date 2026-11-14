/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ControlPanelProps } from "@src/types/global";

/** What every Pixel Frame tab receives from the panel. */
export interface FrameTabProps extends ControlPanelProps {
  /** Mode the frame is showing (`custom.frame.mode`). */
  mode: number;
  /** Mode names indexed by value (from `cdf.modes`). */
  names: string[];
  /** Switches the frame to a mode (the panel writes and mirrors it). */
  onMode: (mode: number) => void;
  /** Frame reachable: controls are disabled when false. */
  isConnected: boolean;
}
