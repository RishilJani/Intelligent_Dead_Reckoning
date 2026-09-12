import React, { forwardRef, useImperativeHandle, useRef, useEffect, useMemo, memo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { getMapHtml } from './mapTemplate';

export interface DisplayMapHandle {
  sendCommand: (type: string, payload?: any) => void;
}

export interface DisplayMapProps {
  onMapMessage: (data: any) => void;
}

export const DisplayMap = memo(forwardRef<DisplayMapHandle, DisplayMapProps>(({ onMapMessage }, ref) => {
  const webViewRef = useRef<WebView | null>(null);
  const mapHtml = useMemo(() => getMapHtml(), []);

  useImperativeHandle(ref, () => ({
    sendCommand: (type: string, payload: any = {}) => {
      const message = JSON.stringify({ type, ...payload });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const iframe = document.getElementById('valhalla-osm-map') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type, ...payload }, '*');
        }
      } else if (webViewRef.current) {
        webViewRef.current.postMessage(message);
      }
    },
  }));

  // Web window message listener
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onWebMessage = (e: MessageEvent) => {
        onMapMessage(e.data);
      };
      window.addEventListener('message', onWebMessage);
      return () => window.removeEventListener('message', onWebMessage);
    }
  }, [onMapMessage]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          id="valhalla-osm-map"
          title="OpenStreetMap Valhalla Live Navigation"
          srcDoc={mapHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{
            html: mapHtml,
            baseUrl: 'https://osm.navigation.local',
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          cacheEnabled={true}
          geolocationEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          mixedContentMode="always"
          onMessage={(event) => onMapMessage(event.nativeEvent.data)}
          style={styles.webView}
        />
      )}
    </View>
  );
}));

DisplayMap.displayName = 'DisplayMap';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#090d16',
    zIndex: 0,
  },
  webView: {
    flex: 1,
    backgroundColor: '#090d16',
  },
});
