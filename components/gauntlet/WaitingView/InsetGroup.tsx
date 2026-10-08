/**
 * InsetGroup — iOS inset-grouped yüzey: tek charcoal kutu, satırlar arası
 * hairline ayraç. Çocuk yoksa (hepsi false/null) HİÇ çizilmez.
 *
 * Satırın kendisi (dokunma, basılı durum, içerik) çağıranındır; burası yalnız
 * yüzey + ayraç.
 */
import React from 'react';
import { View } from 'react-native';

import { styles } from './styles';

interface InsetGroupProps {
  children: React.ReactNode;
  /** Ayracın sol boşluğu (pt). */
  separatorInset: number;
}

export function InsetGroup({ children, separatorInset }: InsetGroupProps): React.JSX.Element | null {
  const rows = React.Children.toArray(children);
  if (rows.length === 0) return null;
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={[styles.separator, { marginLeft: separatorInset }]} /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}
