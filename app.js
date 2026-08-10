/*
 * ==========================================================
 * SCA-CCP ATTENDANCE SCANNER
 * Scanner Build: OPT-02
 * ==========================================================
 *
 * OPT-02 — API / CLIENT TRANSPORT OPTIMIZATION
 *
 * Based directly on the verified OPT-01 scanner.
 *
 * Changes:
 *
 * 1. API endpoint remains internal.
 * 2. JSONP remains available for cross-origin operation.
 * 3. JSONP now has a timeout and guaranteed cleanup.
 * 4. Apps Script connection preconnect hints are added.
 * 5. API transport mode is determined once.
 * 6. Artificial 2-second post-response busy delay removed.
 * 7. Existing 2.5-second same-QR duplicate protection retained.
 * 8. QR-only detection retained.
 * 9. 15 FPS retained for controlled comparison.
 * 10. 60% QR processing box retained for controlled comparison.
 * 11. Existing transaction-lock retry behavior retained.
 * 12. Backend is NOT modified by this build.
 *
 * IMPORTANT:
 * This build is intended to measure CLIENT/API behavior.
 * ==========================================================
 */


/*
 * ==========================================================
 * BUILD IDENTIFICATION
 * ==========================================================
 */

const SCANNER_BUILD =
    "OPT-02";


console.log(
    "=========================================="
);

console.log(
    "SCA-CCP ATTENDANCE SCANNER"
);

console.log(
    "SCANNER BUILD:",
    SCANNER_BUILD
);

console.log(
    "=========================================="
);


/*
 * ==========================================================
 * INTERNAL API CONFIGURATION
 * ==========================================================
 */

const API_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";


/*
 * ==========================================================
 * API CONFIGURATION
 * ==========================================================
 */

const JSONP_TIMEOUT_MS =
    15000;

const LOCK_RETRY_LIMIT =
    3;


/*
 * ==========================================================
 * GLOBAL STATE
 * ==========================================================
 */

let scanner = null;

let busy = false;

let lastScannedQR = "";

let lastScanTime = 0;


/*
 * ==========================================================
 * TRANSPORT STATE
 * ==========================================================
 */

let useJsonpTransport =
    true;


/*
 * ==========================================================
 * SCANNER DIAGNOSTICS
 * ==========================================================
 */

let scanDebugReadyTime =
    0;

let scanDebugDetectedTime =
    0;

let scanDebugRequestStartTime =
    0;


/*
 * ==========================================================
 * UI HELPER
 * ==========================================================
 */

function showMessage(
    html
) {

    const element =
        document.getElementById(
            "result"
        );


    if (!element) {

        return;

    }


    element.innerHTML =
        html;

}


/*
 * ==========================================================
 * BUILD MARKER
 * ==========================================================
 */

function showBuildMarker() {

    const element =
        document.getElementById(
            "scannerBuild"
        );


    if (element) {

        element.textContent =
            "Build: " +
            SCANNER_BUILD;

    }

}


/*
 * ==========================================================
 * PRECONNECT
 * ==========================================================
 *
 * This does not call the attendance endpoint.
 *
 * It only gives the browser permission to prepare
 * the connection to the Apps Script infrastructure.
 *
 * This is safe because no Attendance operation is invoked.
 * ==========================================================
 */

function setupPreconnect() {

    const origins = [

        "https://script.google.com",

        "https://script.googleusercontent.com"

    ];


    origins.forEach(
        function (
            origin
        ) {

            const existing =
                document.querySelector(
                    'link[rel="preconnect"][href="' +
                    origin +
                    '"]'
                );


            if (existing) {

                return;

            }


            const link =
                document.createElement(
                    "link"
                );


            link.rel =
                "preconnect";

            link.href =
                origin;

            link.crossOrigin =
                "";


            document.head.appendChild(
                link
            );

        }
    );

}


/*
 * ==========================================================
 * TRANSPORT DETECTION
 * ==========================================================
 */

function determineTransport() {

    try {

        const apiOrigin =
            new URL(
                API_URL
            ).origin;


        useJsonpTransport =
            apiOrigin !==
            window.location.origin;

    }

    catch (
        error
    ) {

        /*
         * Safe fallback.
         *
         * Apps Script endpoint is expected to be
         * cross-origin from a normal scanner page.
         */

        useJsonpTransport =
            true;

    }


    console.log(
        "[TRANSPORT]",
        useJsonpTransport
            ? "JSONP"
            : "FETCH"
    );

}


/*
 * ==========================================================
 * START BUTTON
 * ==========================================================
 */

function setupStartButton() {

    const button =
        document.getElementById(
            "startScannerBtn"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        function () {

            button.disabled =
                true;

            button.textContent =
                "Starting...";


            startScanner()
                .catch(
                    function () {}
                )
                .finally(
                    function () {

                        button.disabled =
                            false;

                        button.textContent =
                            "Start Scanner";

                    }
                );

        }
    );

}


/*
 * ==========================================================
 * SLEEP
 * ==========================================================
 */

function sleep(
    ms
) {

    return new Promise(
        function (
            resolve
        ) {

            setTimeout(
                resolve,
                ms
            );

        }
    );

}


/*
 * ==========================================================
 * iOS SAFARI DETECTION
 * ==========================================================
 */

function isIosSafari() {

    var ua =
        navigator.userAgent ||
        "";


    return (

        /iP(ad|od|hone)/i.test(
            ua
        )

        &&

        /Safari/i.test(
            ua
        )

        &&

        !/CriOS|FxiOS|OPiOS/i.test(
            ua
        )

    );

}


/*
 * ==========================================================
 * CAMERA SELECTION
 * ==========================================================
 */

function getCameraIdOrConfig(
    cameras
) {

    if (
        !cameras ||
        cameras.length === 0
    ) {

        return {

            facingMode: {

                exact:
                    "environment"

            }

        };

    }


    const backCamera =
        cameras.find(
            function (
                camera
            ) {

                return /back|rear|environment/i.test(
                    camera.label || ""
                );

            }
        );


    if (
        backCamera &&
        backCamera.id
    ) {

        return backCamera.id;

    }


    if (
        cameras.length > 1
    ) {

        const otherCamera =
            cameras.find(
                function (
                    camera
                ) {

                    return !/front|user/i.test(
                        camera.label || ""
                    );

                }
            );


        if (
            otherCamera &&
            otherCamera.id
        ) {

            return otherCamera.id;

        }


        return (

            cameras[
                cameras.length - 1
            ].id ||

            cameras[0].id

        );

    }


    if (
        isIosSafari()
    ) {

        return cameras[0].id;

    }


    return {

        facingMode: {

            exact:
                "environment"

        }

    };

}


/*
 * ==========================================================
 * JSONP TRANSPORT
 * ==========================================================
 *
 * OPT-02:
 *
 * - Timeout protection
 * - Cleanup on success
 * - Cleanup on error
 * - Cleanup on timeout
 * - No orphaned callbacks
 * ==========================================================
 */

function jsonpGet(
    url
) {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            var callbackName =
                "jsonp_callback_" +
                Date.now() +
                "_" +
                Math.floor(
                    Math.random() *
                    100000
                );


            var script =
                document.createElement(
                    "script"
                );


            var finished =
                false;


            var timeoutId =
                null;


            function cleanup() {

                if (
                    timeoutId !== null
                ) {

                    clearTimeout(
                        timeoutId
                    );

                    timeoutId =
                        null;

                }


                try {

                    delete window[
                        callbackName
                    ];

                }

                catch (
                    ignored
                ) {}


                if (
                    script &&
                    script.parentNode
                ) {

                    script.parentNode.removeChild(
                        script
                    );

                }

            }


            function finishSuccess(
                data
            ) {

                if (finished) {

                    return;

                }


                finished =
                    true;


                cleanup();


                resolve(
                    data
                );

            }


            function finishError(
                error
            ) {

                if (finished) {

                    return;

                }


                finished =
                    true;


                cleanup();


                reject(
                    error
                );

            }


            window[
                callbackName
            ] =
                function (
                    data
                ) {

                    finishSuccess(
                        data
                    );

                };


            script.async =
                true;


            script.src =
                url +

                (
                    url.indexOf("?") === -1
                        ? "?"
                        : "&"
                ) +

                "callback=" +
                encodeURIComponent(
                    callbackName
                );


            script.onerror =
                function () {

                    finishError(

                        new Error(
                            "Network error while calling Apps Script endpoint."
                        )

                    );

                };


            timeoutId =
                setTimeout(
                    function () {

                        finishError(

                            new Error(
                                "Apps Script request timed out after " +
                                (
                                    JSONP_TIMEOUT_MS /
                                    1000
                                ) +
                                " seconds."
                            )

                        );

                    },
                    JSONP_TIMEOUT_MS
                );


            document.body.appendChild(
                script
            );

        }
    );

}


/*
 * ==========================================================
 * ATTENDANCE API
 * ==========================================================
 */

async function postAttendance(
    qrID,
    attempt = 1
) {

    var result;


    /*
     * --------------------------------------------------------
     * JSONP
     * --------------------------------------------------------
     */

    if (
        useJsonpTransport
    ) {

        result =
            await jsonpGet(

                API_URL +
                "?qrID=" +
                encodeURIComponent(
                    qrID
                )

            );

    }


    /*
     * --------------------------------------------------------
     * SAME-ORIGIN FETCH
     * --------------------------------------------------------
     */

    else {

        const response =
            await fetch(
                API_URL,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            qrID:
                                qrID

                        })

                }
            );


        const text =
            await response.text();


        try {

            result =
                text
                    ? JSON.parse(
                        text
                    )
                    : {};

        }

        catch (
            error
        ) {

            result = {

                success:
                    false,

                message:
                    text ||
                    "Invalid server response"

            };

        }


        result.__httpStatus =
            response.status;

    }


    /*
     * --------------------------------------------------------
     * LOCK / TEMPORARY ERROR DETECTION
     * --------------------------------------------------------
     */

    const isLockError =
        /transaction lock|temporarily|locked|database repository/i.test(

            `${result.message || ""} ${result.__httpStatus || ""}`

        );


    /*
     * --------------------------------------------------------
     * RETRY ONLY FOR LOCK/TEMPORARY CONDITIONS
     * --------------------------------------------------------
     */

    const failedRequest =
        (

            result.__httpStatus &&
            result.__httpStatus !== 200

        )

        ||

        !result.success;


    if (

        failedRequest

        &&

        isLockError

        &&

        attempt < LOCK_RETRY_LIMIT

    ) {

        console.warn(
            "[API RETRY]",
            "Attempt:",
            attempt + 1
        );


        await sleep(
            1000 *
            attempt
        );


        return postAttendance(
            qrID,
            attempt + 1
        );

    }


    /*
     * --------------------------------------------------------
     * FINAL FAILURE
     * --------------------------------------------------------
     */

    if (
        failedRequest
    ) {

        throw new Error(
            result.message ||
            "Unable to record attendance"
        );

    }


    return result;

}


/*
 * ==========================================================
 * CONNECTION ERROR
 * ==========================================================
 */

function showConnectionError(
    message
) {

    showMessage(`

        <div class="error">

            ❌ Connection Error

        </div>

        <br>

        ${message}

    `);

}


/*
 * ==========================================================
 * QR SCAN SUCCESS
 * ==========================================================
 */

async function onScanSuccess(
    decodedText
) {

    const qrID =
        String(
            decodedText ||
            ""
        ).trim();


    if (!qrID) {

        return;

    }


    const currentTime =
        Date.now();


    /*
     * --------------------------------------------------------
     * DUPLICATE / BUSY PROTECTION
     * --------------------------------------------------------
     *
     * Same QR within 2.5 seconds is ignored.
     *
     * This replaces the previous artificial 2-second
     * post-response lock as the primary duplicate guard.
     */

    if (

        busy

        ||

        (

            qrID === lastScannedQR

            &&

            currentTime -
            lastScanTime <
            2500

        )

    ) {

        return;

    }


    busy =
        true;


    lastScannedQR =
        qrID;


    lastScanTime =
        currentTime;


    /*
     * ========================================================
     * QR DETECTION DIAGNOSTIC
     * ========================================================
     */

    scanDebugDetectedTime =
        Date.now();


    const detectionSeconds =
        (

            scanDebugDetectedTime -
            scanDebugReadyTime

        ) / 1000;


    showMessage(`

        <div>

            <b>
                QR DETECTED
            </b>

            <br><br>

            QR:
            ${qrID}

            <br><br>

            Detection:
            <b>
                ${detectionSeconds.toFixed(2)}s
            </b>

            <br><br>

            Contacting server...

        </div>

    `);


    try {

        /*
         * ====================================================
         * API REQUEST START
         * ====================================================
         */

        scanDebugRequestStartTime =
            Date.now();


        /*
         * ====================================================
         * SEND TO APPS SCRIPT
         * ====================================================
         */

        const result =
            await postAttendance(
                qrID
            );


        /*
         * ====================================================
         * API RESPONSE
         * ====================================================
         */

        const apiResponseTime =
            Date.now();


        const apiSeconds =
            (

                apiResponseTime -
                scanDebugRequestStartTime

            ) / 1000;


        const totalSeconds =
            (

                apiResponseTime -
                scanDebugReadyTime

            ) / 1000;


        console.log(
            "=========================================="
        );

        console.log(
            "SCAN COMPLETE"
        );

        console.log(
            "BUILD:",
            SCANNER_BUILD
        );

        console.log(
            "TRANSPORT:",
            useJsonpTransport
                ? "JSONP"
                : "FETCH"
        );

        console.log(
            "QR:",
            qrID
        );

        console.log(
            "QR DETECTION:",
            detectionSeconds.toFixed(2) +
            "s"
        );

        console.log(
            "API REQUEST:",
            apiSeconds.toFixed(2) +
            "s"
        );

        console.log(
            "TOTAL:",
            totalSeconds.toFixed(2) +
            "s"
        );

        console.log(
            "=========================================="
        );


        /*
         * ====================================================
         * SUCCESS
         * ====================================================
         */

        if (
            result.success
        ) {

            showMessage(`

                <div class="success">

                    <b>
                        ✅ Attendance Recorded
                    </b>

                </div>

                <br>

                ${result.message}

                <br><br>

                <hr>

                <small>

                    <b>
                        BUILD:
                        ${SCANNER_BUILD}
                    </b>

                    <br>

                    <b>
                        TRANSPORT:
                        ${
                            useJsonpTransport
                                ? "JSONP"
                                : "FETCH"
                        }
                    </b>

                    <br><br>

                    <b>
                        DIAGNOSTIC
                    </b>

                    <br><br>

                    QR Detection:
                    ${detectionSeconds.toFixed(2)}s

                    <br>

                    Server Response:
                    ${apiSeconds.toFixed(2)}s

                    <br>

                    Total:
                    <b>
                        ${totalSeconds.toFixed(2)}s
                    </b>

                </small>

            `);

        }


        /*
         * ====================================================
         * SERVER-SIDE FAILURE
         * ====================================================
         */

        else {

            showMessage(`

                <div class="error">

                    ❌
                    ${result.message}

                </div>

                <br>

                <small>

                    BUILD:
                    ${SCANNER_BUILD}

                    <br><br>

                    QR Detection:
                    ${detectionSeconds.toFixed(2)}s

                    <br>

                    Server Response:
                    ${apiSeconds.toFixed(2)}s

                    <br>

                    Total:
                    ${totalSeconds.toFixed(2)}s

                </small>

            `);

        }

    }


    catch (
        error
    ) {

        const errorMessage =
            error &&
            error.message
                ? error.message
                : String(
                    error
                );


        const errorTime =
            Date.now();


        const totalSeconds =
            (

                errorTime -
                scanDebugReadyTime

            ) / 1000;


        console.error(
            "[SCAN ERROR]",
            error
        );


        showConnectionError(`

            ${errorMessage}

            <br><br>

            <small>

                BUILD:
                ${SCANNER_BUILD}

                <br><br>

                TRANSPORT:
                ${
                    useJsonpTransport
                        ? "JSONP"
                        : "FETCH"
                }

                <br><br>

                QR Detection:
                ${detectionSeconds.toFixed(2)}s

                <br>

                Total:
                ${totalSeconds.toFixed(2)}s

            </small>

        `);

    }


    finally {

        /*
         * IMPORTANT:
         *
         * OPT-01 had an additional 2-second delay here.
         *
         * OPT-02 removes that artificial delay.
         *
         * Duplicate protection is still maintained through:
         *
         *   lastScannedQR
         *   lastScanTime
         *   2500 ms window
         */

        busy =
            false;


        showMessage(
            "Ready to Scan..."
        );

    }

}


/*
 * ==========================================================
 * START SCANNER
 * ==========================================================
 */

async function startScanner() {

    try {

        if (
            typeof Html5Qrcode ===
            "undefined"
        ) {

            showMessage(`

                <div class="error">

                    Scanner library failed to load

                </div>

                <br>

                Check your internet connection
                and reload the scanner.

            `);

            return;

        }


        scanner =
            new Html5Qrcode(
                "reader"
            );


        showMessage(`

            <div>

                Camera starting...

                <br><br>

                <small>

                    Preparing scanner...

                </small>

            </div>

        `);


        /*
         * ====================================================
         * CAMERA ENUMERATION
         * ====================================================
         */

        const cameras =
            await Html5Qrcode.getCameras();


        if (
            !cameras ||
            cameras.length === 0
        ) {

            throw new Error(
                "No camera found."
            );

        }


        const cameraIdOrConfig =
            getCameraIdOrConfig(
                cameras
            );


        /*
         * ====================================================
         * OPT-02 SCANNER CONFIGURATION
         * ====================================================
         *
         * Keep the same scanner settings as OPT-01
         * so this test isolates API/client changes.
         */

        await scanner.start(

            cameraIdOrConfig,

            {

                fps:
                    15,


                qrbox:
                    function (

                        viewfinderWidth,
                        viewfinderHeight

                    ) {

                        const minEdge =
                            Math.min(

                                viewfinderWidth,
                                viewfinderHeight

                            );


                        const boxSize =
                            Math.floor(

                                minEdge *
                                0.60

                            );


                        return {

                            width:
                                boxSize,

                            height:
                                boxSize

                        };

                    },


                formatsToSupport: [

                    Html5QrcodeSupportedFormats
                        .QR_CODE

                ],


                disableFlip:
                    true

            },

            onScanSuccess

        );


        /*
         * ====================================================
         * SCANNER READY
         * ====================================================
         *
         * QR timing begins only after scanner.start()
         * completes.
         */

        scanDebugReadyTime =
            Date.now();


        console.log(
            "[SCANNER READY]"
        );


        console.log(
            "BUILD:",
            SCANNER_BUILD
        );


        console.log(
            "TRANSPORT:",
            useJsonpTransport
                ? "JSONP"
                : "FETCH"
        );


        console.log(
            "QR TIMER STARTED"
        );


        showMessage(`

            <div>

                <b>
                    Ready to Scan
                </b>

                <br><br>

                <small>

                    Build:
                    ${SCANNER_BUILD}

                    <br>

                    Transport:
                    ${
                        useJsonpTransport
                            ? "JSONP"
                            : "FETCH"
                    }

                </small>

            </div>

        `);

    }


    catch (
        error
    ) {

        const errorText =
            String(
                error
            );


        if (
            /not allowed|permission|secure context|camera/i.test(
                errorText
            )
        ) {

            showMessage(`

                <div class="error">

                    Camera access blocked

                </div>

                <br>

                Allow camera permission and
                reload the scanner.

            `);

        }

        else {

            showMessage(`

                <div class="error">

                    Camera Error

                </div>

                <br>

                ${errorText}

            `);

        }


        console.error(
            error
        );

    }

}


/*
 * ==========================================================
 * PAGE INITIALIZATION
 * ==========================================================
 */

window.onload =
    function () {

        setupPreconnect();

        determineTransport();

        setupStartButton();

        showBuildMarker();


        showMessage(`

            <div>

                Press
                <b>
                    Start Scanner
                </b>
                to begin.

                <br><br>

                <small>

                    Build:
                    ${SCANNER_BUILD}

                    <br>

                    Transport:
                    ${
                        useJsonpTransport
                            ? "JSONP"
                            : "FETCH"
                    }

                </small>

            </div>

        `);

    };
