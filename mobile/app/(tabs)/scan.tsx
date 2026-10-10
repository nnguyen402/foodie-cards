import { ScrollView, StyleSheet, View } from 'react-native';
import { BrandHeader } from '@/components/brand-header';
import { AppText } from '@/components/ui/app-text';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ScanScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader eyebrow="Add a visit" title="Scan a receipt" subtitle="A receipt can become a lasting food memory." />
      <View style={styles.panel}>
        <View style={styles.mark}><AppText variant="title" strong style={styles.markText}>+</AppText></View>
        <AppText variant="heading" strong>Receipt scanning is coming next.</AppText>
        <AppText muted>When scanning is ready, you’ll be able to photograph or upload a receipt, review the details, and confirm before anything enters your collection.</AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.xl },
  panel: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  mark: { height: 52, width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.accentSoft },
  markText: { color: colors.accent },
});
