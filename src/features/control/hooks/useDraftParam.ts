/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Wait this long after the last edit before sending, so a drag is one write. */
const SEND_DEBOUNCE_MS = 350;
/** Ignore device reports for this long after the last edit (they are echoes of older edits). */
const SETTLE_MS = 2500;

/** The part of a device param this hook needs. */
export interface WritableParam {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (value: any) => any;
  value?: unknown;
}

/**
 * Local draft of a param for rapid edits (a slider drag, a colour pick).
 *
 * Edits update the draft immediately and are sent after a short pause: one
 * write per burst, latest value wins, one write in flight at a time. While
 * editing, and for a moment afterwards, device reports are ignored because
 * they are echoes of earlier edits and would make controls jump back.
 * Anything pending is sent when the screen unmounts.
 * @param param - The device param to write (may be undefined while loading)
 * @param deviceValue - Parsed value currently reported by the device; keep it memoised
 * @param encode - Converts the value to what the device expects: the param's
 *   string format for structured params, or a number for numeric params
 * @param connected - Whether the device is reachable
 * @param tag - Name used in error logs
 * @returns [draft value, edit function]
 */
export function useDraftParam<T>(
  param: WritableParam | undefined,
  deviceValue: T,
  encode: (value: T) => string | number,
  connected: boolean,
  tag = "useDraftParam",
): [T, (next: T) => void] {
  const [draft, setDraft] = useState<T>(deviceValue);

  // refs: must not trigger renders
  const pending = useRef<T | null>(null);
  const sending = useRef(false);
  const editedAt = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDevice = useRef(deviceValue);
  latestDevice.current = deviceValue;
  const paramRef = useRef(param);
  paramRef.current = param;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const encodeRef = useRef(encode);
  encodeRef.current = encode;

  const isIdle = () =>
    pending.current === null &&
    !sending.current &&
    Date.now() - editedAt.current >= SETTLE_MS;

  // Follow the device only when we are not editing.
  useEffect(() => {
    if (isIdle()) setDraft(deviceValue);
  }, [deviceValue]);

  const armSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (isIdle()) setDraft(latestDevice.current);
    }, SETTLE_MS + 50);
  }, []);

  const flush = useCallback(async () => {
    if (sending.current) return; // the running send re-checks `pending` when done
    const next = pending.current;
    const p = paramRef.current;
    if (next === null || !p || !connectedRef.current) {
      pending.current = null;
      return;
    }
    pending.current = null;
    sending.current = true;
    const out = encodeRef.current(next);
    try {
      await p.setValue(out);
      p.value = out;
    } catch (e) {
      console.error(`[${tag}] send failed:`, e);
    } finally {
      sending.current = false;
    }
    if (pending.current !== null) {
      void flush(); // newer edits arrived while sending: send only the latest
    } else {
      armSettle();
    }
  }, [armSettle, tag]);

  const edit = useCallback(
    (next: T) => {
      setDraft(next);
      pending.current = next;
      editedAt.current = Date.now();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => void flush(), SEND_DEBOUNCE_MS);
    },
    [flush],
  );

  // Leaving the screen: send what is pending, drop timers.
  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      void flush();
    },
    [flush],
  );

  return [draft, edit];
}
