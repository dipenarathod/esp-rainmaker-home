/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { observer } from "mobx-react-lite";

import { Header, ScreenWrapper, DeviceOfflineBanner } from "@shared/components";
import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { testProps } from "@shared/utils/testProps";
import { useControl } from "@features/control/hooks";
import MusicPanel from "@features/control/components/MusicPanel";
import { toSyncMember } from "@features/control/utils/stripSync";

/**
 * Full-screen Music Sync, route `/(control)/MusicSync?id=<node>&device=<name>`.
 *
 * The LED strip panel now shows the same content as its "Music" tab, so this
 * screen is only a wrapper around MusicPanel. It stays as a route so other
 * screens (or a future panel without tabs, such as the Pixel Frame) can link
 * straight to music sync.
 * @returns Music sync screen
 */
const MusicSync = () => {
  const { node, device, isConnected } = useControl();
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const supported = !!toSyncMember(node, device);

  if (!node || !device || !supported) {
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
          <MusicPanel node={node} device={device} setScrollEnabled={setScrollEnabled} />
        </ScrollView>
      </ScreenWrapper>
    </>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingTop: tokens.spacing._10, paddingBottom: tokens.spacing._15 },
  banner: { marginHorizontal: tokens.spacing._10, marginBottom: tokens.spacing._10 },
});

export default observer(MusicSync);
