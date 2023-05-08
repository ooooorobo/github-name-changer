chrome.tabs.onUpdated.addListener(
    (tabId, changeInfo) => {
        if (changeInfo.status === 'complete' || changeInfo.url) {
            chrome.tabs.sendMessage(tabId, {
                message: 'load-complete',
                url: changeInfo.url
            })
        }
    }
);
