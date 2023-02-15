import { throttle } from "lodash";
import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Image,
  PanResponder,
  BackHandler,
  StatusBar,
  TextInput,
  useColorScheme,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { setBackgroundColorAsync } from "expo-navigation-bar";

let iconUri: string = Image.resolveAssetSource(require('./assets/icon.png')).uri;
const assetsUri = iconUri.substring(0, iconUri.indexOf('/assets/'));

enum WebViewMessageType {
  GetIsDrawerOpen,
  SyncTheme,
  DismissKeyboard,
  ScrollStarted,
  ScrollEnded,
  ReloadPage,
  LoadMainScript,
}

type MessageData = {
  type: WebViewMessageType;
  value: any;
};

const useUpdateEffect = (
  effect: React.EffectCallback,
  deps: React.DependencyList
) => {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      return effect();
    }
  }, deps);
};



const COLOR_LIGHT = "#FFFFFF";
const COLOR_DARK = "#343541";

const App: React.FC = () => {
  const systemTheme = useColorScheme(); // dark mode

  const webviewRef = useRef<null | WebView>(null);
  const textInputRef = useRef<null | TextInput>(null);
  const messageHandler = useRef<((data: MessageData) => void) | null>(null);
  const wasLoaded = useRef(false);
  const isWebappScrollingX = useRef(false);

  const dismissKeyboard = useCallback(() => {
    textInputRef.current?.focus();
    textInputRef.current?.blur();
  }, []);

  const handleOpenDrawler = () => {
    // console.log("open drawer");
    webviewRef.current?.injectJavaScript(/* javascript */ `
        if(RNJAVA){RNJAVA.message({"type":"openDrawler"})}
      `);
  };

  const handleCloseDrawler = useCallback(() => {
    webviewRef.current?.injectJavaScript(/* javascript */ `
        if(RNJAVA){RNJAVA.message({"type":"closeDrawler"})}
      `);
  }, []);

  const handleHorizontalSwipe = useRef(
    throttle(
      (dx: number) => (dx > 0 ? handleOpenDrawler() : handleCloseDrawler()),
      500,
      { trailing: false }
    )
  ).current;

  const checkIsOpen = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      messageHandler.current = (data: MessageData) => {
        resolve(data.value);
      };

      webviewRef.current?.injectJavaScript(/* javascript */ `
          if(RNJAVA){RNJAVA.message({"type":"checkIsOpen"})}
        `);

      setTimeout(() => resolve(false), 10000);
    });
  };

  const handleBackButtonAsync = async () => {
    const isDrawerOpen = await checkIsOpen();

    if (isDrawerOpen) {
      handleCloseDrawler();
    } else {
      BackHandler.exitApp();
    }
  };

  const handleBackButton = () => {
    handleBackButtonAsync();
    return true;
  };

  useEffect(() => {
    BackHandler.addEventListener("hardwareBackPress", handleBackButton);

    return () =>
      BackHandler.removeEventListener("hardwareBackPress", handleBackButton);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        !isWebappScrollingX.current &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        // Swipe delta
        Math.sqrt(
          Math.pow(Math.abs(gestureState.dx), 2) +
          Math.pow(Math.abs(gestureState.dy), 2)
        ) > 70,
      onPanResponderMove: (_event, gestureState) => {
        handleHorizontalSwipe(gestureState.dx);
      },
    })
  ).current;

  // const handleSyncTheme = async (data: MessageData) => {
  //   try {
  //     // Sync system and webapp themes
  //     // console.log("System theme:", systemTheme);
  //     // console.log("Webapp theme:", data.value);
  //     if (systemTheme !== data.value) {
  //       // console.log("Switching theme");
  //       setTimeout(() => switchTheme(), 1000);
  //     }
  //   } catch (error) {
  //     console.error(error);
  //   }
  // };

  const getUserAgentForUrl = (url: string | string[]) => {
    // Logic to determine the user agent based on the URL
    if (url.includes('google.com')) {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1';
    }
    // Add more cases for other websites
    return 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.65 Mobile Safari/537.36';
  }

  const uaState = {
    userAgent: getUserAgentForUrl(''),
  }

  const onNavigationStateChange = (navState: { url: any; }) => {
    const url = navState.url;
    uaState.userAgent = getUserAgentForUrl(url);
  }

  const handleMessage = (event: WebViewMessageEvent) => {
    const data: MessageData = JSON.parse(event.nativeEvent.data);

    if (data.type === WebViewMessageType.LoadMainScript) {
      loadMainScript();
      return;
    }

    if (data.type === WebViewMessageType.ReloadPage) {
      webviewRef.current?.reload();
      return;
    }

    if (data.type === WebViewMessageType.SyncTheme) {
      // handleSyncTheme(data);
      return;
    }

    if (data.type === WebViewMessageType.DismissKeyboard) {
      dismissKeyboard();
      return;
    }

    if (data.type === WebViewMessageType.ScrollStarted) {
      isWebappScrollingX.current = true;
      return;
    }

    if (data.type === WebViewMessageType.ScrollEnded) {
      isWebappScrollingX.current = false;
      return;
    }

    if (data.type === WebViewMessageType.GetIsDrawerOpen) {
      messageHandler.current?.(data);
    }
  };

  const handleWebViewLoaded = useCallback(async () => {
    if (!wasLoaded.current) {
      webviewRef.current?.requestFocus();

      await setBackgroundColorAsync(
        systemTheme === "light" ? COLOR_LIGHT : COLOR_DARK
      );
      wasLoaded.current = true;
    }
  }, []);

  useUpdateEffect(() => {
    // switchTheme();
    setBackgroundColorAsync(systemTheme === "light" ? COLOR_LIGHT : COLOR_DARK);
  }, [systemTheme]);

  const loadMainScript = async () => {
    const ver = (new Date).getTime();
    const jsPath = `${__DEV__?assetsUri:'https://raw.githubusercontent.com/refgd/chatgpt-mobile/master'}/assets/inject.js?t=${ver}`;
    const cssPath = `${__DEV__?assetsUri:'https://raw.githubusercontent.com/refgd/chatgpt-mobile/master'}/assets/inject.css?t=${ver}`;

    try {
      const jsResponse = await fetch(jsPath);
      const jsContent = await jsResponse.text();

      const cssResponse = await fetch(cssPath);
      const cssContent = await cssResponse.text();

      webviewRef.current?.injectJavaScript(/* javascript */ `
        var style = document.createElement('style');
        style.innerHTML = \`${cssContent}\`;
        document.head.appendChild(style);

        ${jsContent}

        window.RNJAVA.message({"type":"load","ver":"dev"});
      `);

    } catch (error) {
      console.log(error);
    }
  }

  const mainScript = /* javascript */ `
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: ${WebViewMessageType.LoadMainScript},
      }),
    );
`;

  const erudaScript = /* javascript */ `
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    document.body.appendChild(script);
    script.onload = () => {
      try {
        eruda.init();

        ${mainScript}
      } catch (error) {
        console.error(error);
      }
    }
`;

  const injectedScript = /* javascript */ `
  try {
    window.addEventListener('load', () => {
      try {
        ${__DEV__ ? erudaScript : mainScript}
      } catch (error) {
        console.error(error);
      }
    });
  } catch (error) {
    console.error(error);
  }
`;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "white",
      }}
      {...panResponder.panHandlers}
    >
      <StatusBar
        backgroundColor="black"
        barStyle="light-content"
      />
      <WebView
        ref={webviewRef}
        source={{ uri: "https://chat.openai.com/auth/ext_callback?next=" }}
        originWhitelist={["*"]}
        domStorageEnabled
        // cacheEnabled={false}
        cacheMode="LOAD_DEFAULT"
        // cacheMode="LOAD_NO_CACHE"
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        keyboardDisplayRequiresUserAction={false}
        onLoad={handleWebViewLoaded}
        bounces
        pullToRefreshEnabled
        overScrollMode="never"
        userAgent={uaState.userAgent}
        onNavigationStateChange={onNavigationStateChange}
      />
      <TextInput ref={textInputRef} autoFocus style={{ display: "none" }} />
    </View>
  );
};

export default App;
