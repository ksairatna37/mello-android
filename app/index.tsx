/**
 * Mello entry point — placeholder for the route "/".
 *
 * Routing is handled by RouterGate (see app/_components/RouterGate.tsx).
 * This component renders a brief loading view while the gate decides
 * where the user should go on boot. Once the gate computes a
 * destination, it calls router.replace and this screen unmounts.
 *
 * Notes:
 *  - The fresh-start wipe (clearOnboardingData on every boot) was
 *    removed deliberately. Local onboarding answers now persist across
 *    reboots until either:
 *      (a) the user finishes onboarding (server flips
 *          onboarding_completed=true), at which point we no longer
 *          need the local data; or
 *      (b) the user explicitly signs out (signOut clears local data).
 *    Resumption-from-anywhere is the new default, owned by
 *    deriveOnboardingStep + RouterGate.
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { BRAND } from '@/components/common/BrandGlyphs';

export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={BRAND.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.cream,
  },
});
