import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  body: { fontSize: 16 },
  muted: { fontSize: 13, color: '#666' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  alert: { borderWidth: 2, borderRadius: 12, padding: 16, gap: 12 },
  alertTitle: { fontSize: 18, fontWeight: '700' },
  button: { borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  code: { fontSize: 56, fontWeight: '800', letterSpacing: 8 },
  codeInput: { minWidth: 160, fontSize: 18 },
  small: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
});
