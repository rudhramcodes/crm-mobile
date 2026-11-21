import { Component, useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useStore } from "react-redux";
import { CloudOff, Smartphone } from "lucide-react-native";
import { EmptyState, PdfActions, Screen, SheetHeader, fetchServerHtml } from "@/components";
import { useTheme } from "@/constants/theme";

// The server lays documents out as an A4 page 794px wide: ask the web view to fit that width, pinch to zoom.
const fitToPhone = (html) =>
  `<meta name="viewport" content="width=820, user-scalable=yes">${String(html).replace(/<meta[^>]+name=["']viewport["'][^>]*>/gi, "")}`;

// react-native-webview looks up its native module as soon as it is imported, so on a build made before it was
// added a top-level import would crash this screen. Requiring it while rendering lets NeedsUpdate catch that.
function DocWebView(props) {
  const { WebView } = require("react-native-webview");
  return <WebView {...props} />;
}

// A build made before react-native-webview was added has no native web view; show a note instead of crashing.
class NeedsUpdate extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <EmptyState icon={Smartphone} title="Preview needs the app update" message="Install the latest app build to see documents here. Download PDF below works now." />;
  }
}

// In-app preview of a server-rendered document (invoice, quotation version): the same page the website shows.
// Params: title, htmlPath, path + fileName (the PDF, for the Share button), label.
export default function DocumentPreview() {
  const theme = useTheme();
  const store = useStore();
  const { title, htmlPath, path, fileName, label } = useLocalSearchParams();
  const [html, setHtml] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchServerHtml(htmlPath, store.getState().auth.accessToken)
      .then((h) => live && setHtml(fitToPhone(h)))
      .catch((e) => live && setError(e?.message || "Couldn't load the preview."));
    return () => {
      live = false;
    };
  }, [htmlPath, store, attempt]);

  const retry = () => {
    setError("");
    setHtml(null);
    setAttempt((n) => n + 1);
  };

  return (
    <Screen edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-4 pt-6">
      <SheetHeader title={title || "Preview"} sub="Pinch to zoom" closeLabel="Close" />
      <View className="flex-1 overflow-hidden rounded-2xl border border-line bg-white">
        {error ? (
          <EmptyState icon={CloudOff} title="Couldn't load the preview" message={error} actionTitle="Try again" onAction={retry} />
        ) : !html ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <NeedsUpdate>
            <DocWebView
              source={{ html }}
              originWhitelist={["*"]}
              style={{ flex: 1, backgroundColor: "#ffffff" }}
              scalesPageToFit
              setBuiltInZoomControls
              setDisplayZoomControls={false}
              javaScriptEnabled={false}
              startInLoadingState
              renderLoading={() => (
                <View className="absolute inset-0 items-center justify-center bg-white">
                  <ActivityIndicator color={theme.accent} />
                </View>
              )}
            />
          </NeedsUpdate>
        )}
      </View>
      {!!path && <PdfActions path={path} fileName={fileName} label={label || "document"} />}
    </Screen>
  );
}
