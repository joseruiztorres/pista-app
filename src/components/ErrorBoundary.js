import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, shape } from '../lib/theme';

// Red de seguridad para toda la app: si algo revienta al renderizar una
// pantalla, esto evita que la web se quede en blanco y ofrece reintentar
// en vez de dejar al usuario atascado sin explicación.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado en la app:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.screen}>
          <Text style={styles.title}>Algo ha ido mal</Text>
          <Text style={styles.body}>Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.</Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  body: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, ...shape.button, marginTop: 8 },
  buttonText: { color: colors.bg, fontWeight: '900', fontSize: 14 },
});
