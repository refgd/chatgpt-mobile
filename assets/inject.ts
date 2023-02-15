//outfile: inject.js, compress: true, surround: (function (){ ${code} })()

(function (win: any) {
    let __DEV__ = false;
    let __VER__ = '';

    enum WebViewMessageType {
        GetIsDrawerOpen,
        SyncTheme,
        DismissKeyboard,
        ScrollStarted,
        ScrollEnded,
        ReloadPage,
    }

    const refreshIcon = /* html */ `
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="25" viewBox="0 0 48 48">
    <path d="M24 40q-6.65 0-11.325-4.675Q8 30.65 8 24q0-6.65 4.675-11.325Q17.35 8 24 8q4.25 0 7.45 1.725T37 14.45V9.5q0-.65.425-1.075Q37.85 8 38.5 8q.65 0 1.075.425Q40 8.85 40 9.5v9.7q0 .65-.425 1.075-.425.425-1.075.425h-9.7q-.65 0-1.075-.425-.425-.425-.425-1.075 0-.65.425-1.075.425-.425 1.075-.425h6.9q-1.9-3-4.85-4.85Q27.9 11 24 11q-5.45 0-9.225 3.775Q11 18.55 11 24q0 5.45 3.775 9.225Q18.55 37 24 37q3.9 0 7.15-2.075Q34.4 32.85 36 29.35q.2-.4.65-.7.45-.3.9-.3.85 0 1.225.55.375.55.075 1.3-1.85 4.45-5.875 7.125T24 40Z"/>
    </svg>
`;


    const postMessage = (msg: any) => {
        if (win.ReactNativeWebView) {
            win.ReactNativeWebView.postMessage(
                JSON.stringify(msg),
            );
        }
    }

    const isDrawerOpen = () => {
        return !!document.querySelector('div[data-headlessui-state="open"]');
    }

    const checkIsOpen = () => {
        postMessage({ type: WebViewMessageType.GetIsDrawerOpen, value: isDrawerOpen() });
    }

    const openDrawler = () => {
        try {
            if (!isDrawerOpen()) {
                var drawerButton = document.querySelector('button');
                // console.log('Drawer button: ', drawerButton);
                if (drawerButton) drawerButton.click();
            }
        } catch (error) {
            console.error(error);
        }
    }

    const closeDrawler = () => {
        try {
            if (isDrawerOpen()) {
                var drawerButton = document.querySelector('button');
                // console.log('Drawer button: ', drawerButton);
                if (drawerButton) drawerButton.click();
            }
        } catch (error) {
            console.error(error);
        }
    }

    const insertRefreshButtonScript = () => {
        var oldRefreshButton = document.querySelector("#refresh");
        console.log('oldRefreshButton', oldRefreshButton);

        if (!oldRefreshButton) {
            var headerSelector = "#__next > div:nth-of-type(1) > div > div";
            var plusButtonSelector = `${headerSelector} > button:last-of-type`;

            var header: any = document.querySelector(`${headerSelector}`);
            var plusButton = document.querySelector(`${plusButtonSelector}`);
            var refreshButton = document.createElement("button");
            refreshButton.id = "refresh";
            refreshButton.className = "px-3";
            refreshButton.innerHTML = `${refreshIcon}`;
            refreshButton.addEventListener("click", () => {
                postMessage({
                    type: WebViewMessageType.ReloadPage,
                });
            });

            header.insertBefore(refreshButton, plusButton);
            console.log('inserted refresh button');
        }
    }

    const cssScript = () => {
        if (__DEV__) return;

        const linkElement = document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.href = 'https://raw.githubusercontent.com/refgd/chatgpt-mobile/master/assets/inject.css?t=' + __VER__;
        document.head.appendChild(linkElement);
    }

    const hrefChangeHandlerScript = () => {
        let oldHref = document.location.href;
        const body = document.querySelector('body');
        let rafId: number | null = null;
        if(body){
            const observer = new MutationObserver((mutations) => {
                if (rafId) {
                    window.cancelAnimationFrame(rafId);
                }
                rafId = window.requestAnimationFrame(() => {
                    const currentHref = document.location.href;
                    if (oldHref !== currentHref) {
                        oldHref = currentHref;

                        // If chat page
                        const url = new URL(currentHref);
                        if (url.pathname !== '/chat') {
                            postMessage({ type: WebViewMessageType.DismissKeyboard });
                        }else{
                            // Delay DOM modifications while DOM is rerendering
                            setTimeout(() => {
                                insertRefreshButtonScript();
                            }, 500);
                        }
                    }
                });
            });
    
            observer.observe(body, { childList: true, subtree: true });
        }
    };

    const scrollScript = () => {
        var scrollEndTimeoutId: any;
        window.addEventListener('scroll', (event: any) => {
            if (event.target.scrollLeft > 0) {
                if (scrollEndTimeoutId) {
                    clearTimeout(scrollEndTimeoutId);
                } else {
                    // console.log('Scroll started');
                    postMessage({ type: WebViewMessageType.ScrollStarted });
                }
                scrollEndTimeoutId = setTimeout(() => {
                    // console.log('Scroll ended');
                    postMessage({ type: WebViewMessageType.ScrollEnded });
                    scrollEndTimeoutId = 0;
                }, 1000);
            }
        }, true);
    }

    const cloudflareRefreshScript = () => {
        setInterval(() => {
            location.reload();
        }, 3600000); // 1 hours (though it expires after 2 hours from issuing time)
    }

    // cohtml2canvasScriptnst drawer

    const mainScript = () => {
        cssScript();

        hrefChangeHandlerScript();

        scrollScript();

        cloudflareRefreshScript();

        insertRefreshButtonScript();

        // Sync theme on init
        // postMessage({
        //     type: WebViewMessageType.SyncTheme,
        //     value: localStorage.getItem('theme') || light,
        // };
    }

    win.RNJAVA = {
        message: (data: any) => {
            if (data.type == 'openDrawler') {
                openDrawler();
            } else if (data.type == 'closeDrawler') {
                closeDrawler();
            } else if (data.type == 'checkIsOpen') {
                checkIsOpen();
            } else if (data.type == 'load') {
                __DEV__ = data.ver === 'dev';
                __VER__ = data.ver;
                mainScript();
            }
        }
    }
})(window)