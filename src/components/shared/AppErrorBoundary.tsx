import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, componentStack: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state;
      const stackTrace = error?.stack?.slice(0, 1500) || '';

      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠</Text>
          <Text style={styles.title}>Algo deu errado</Text>
          <Text style={styles.message}>
            {error?.message || 'Erro inesperado'}
          </Text>
          <Pressable style={styles.button} onPress={this.handleReload}>
            <Text style={styles.buttonText}>Recarregar</Text>
          </Pressable>
          {(stackTrace || componentStack) && (
            <ScrollView style={styles.debugScroll} contentContainerStyle={styles.debugContent}>
              {!!stackTrace && (
                <Text style={styles.debugText} selectable>{stackTrace}</Text>
              )}
              {!!componentStack && (
                <Text style={styles.debugText} selectable>{componentStack.slice(0, 1000)}</Text>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0f172a',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugScroll: {
    maxHeight: 300,
    width: '100%',
    marginTop: 16,
  },
  debugContent: {
    paddingHorizontal: 8,
  },
  debugText: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
