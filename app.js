/*
 * ==========================================================
 * SCA-CCP ATTENDANCE SCANNER
 * Scanner Build: OPT-02B
 * ==========================================================
 *
 * OPT-02B = DIAGNOSTIC-ONLY BUILD
 *
 * BASE:
 *   Verified OPT-01
 *
 * IMPORTANT:
 *   The JSONP transport mechanism is intentionally preserved.
 *
 * NO BACKEND CHANGES.
 *
 * NO DATABASE CHANGES.
 *
 * NO ATTENDANCE LOGIC CHANGES.
 *
 * NO ID SERVICE CHANGES.
 *
 * NO SCANNER PERFORMANCE CHANGES.
 *
 * ONLY ADDITION:
 *   Detailed timing instrumentation.
 *
 * ==========================================================
 */


/*
 * ==========================================================
 * BUILD IDENTIFICATION
 * ==========================================================
 */

const SCANNER_BUILD =
    "OPT-02B";


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
 * GLOBAL STATE
 * ==========================================================
 */

let scanner;

let busy = false;

let lastScannedQR = "";

let lastScanTime = 0;


/*
 * ==========================================================
 * SCANNER DIAGNOSTICS
 * ==========================================================
 */

let scanDebugReadyTime = 0;

let scanDebugDetectedTime = 0;

let scanDebugRequestStartTime = 0;


/*
 * ==========================================================
 * JSONP DIAGNOSTICS
 * ==========================================================
 */

let jsonpDebugStartTime = 0;

let jsonpDebugScriptAppendTime = 0;

let jsonpDebugCallbackTime = 0;


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
 * IMPORTANT:
 *
 * THIS IS THE SAME FUNCTIONAL JSONP ARCHITECTURE
 * FROM THE VERIFIED OPT-01.
 *
 * Only diagnostic timestamps/logging are added.
 *
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
                    10000
                );


            var script =
                document.createElement(
                    "script"
                );


            /*
             * ==================================================
             * JSONP REQUEST CREATED
             * ==================================================
             */

            jsonpDebugStartTime =
                Date.now();


            console.log(
                "[JSONP T1] Request created:",
                new Date(
                    jsonpDebugStartTime
                ).toISOString()
            );


            window[
                callbackName
            ] =
                function (
                    data
                ) {

                    /*
                     * ==========================================
                     * JSONP CALLBACK RECEIVED
                     * ==========================================
                     */

                    jsonpDebugCallbackTime =
                        Date.now();


                    const jsonpSeconds =
                        (

                            jsonpDebugCallbackTime -
                            jsonpDebugScriptAppendTime

                        ) / 1000;


                    const totalJsonpSeconds =
                        (

                            jsonpDebugCallbackTime -
                            jsonpDebugStartTime

                        ) / 1000;


                    console.log(
                        "[JSONP T3] Callback received"
                    );


                    console.log(
                        "[JSONP] Browser wait:",
                        jsonpSeconds.toFixed(3) +
                        "s"
                    );


                    console.log(
                        "[JSONP] Request lifecycle:",
                        totalJsonpSeconds.toFixed(3) +
                        "s"
                    );


                    resolve(
                        data
                    );


                    delete window[
                        callbackName
                    ];


                    script.remove();


                    console.log(
                        "[JSONP T4] Callback cleanup complete"
                    );

                };


            script.src =
                url +

                (
                    url.indexOf("?") === -1
                        ? "?"
                        : "&"
                ) +

                "callback=" +
                callbackName;


            script.onerror =
                function () {

                    console.error(
                        "[JSONP ERROR] Network error"
                    );


                    delete window[
                        callbackName
                    ];


                    script.remove();


                    reject(
                        new Error(
                            "Network error while calling Apps Script endpoint."
                        )
                    );

                };


            /*
             * ==================================================
             * SCRIPT APPENDED
             * ==================================================
             */

            jsonpDebugScriptAppendTime =
                Date.now();


            console.log(
                "[JSONP T2] Script appended"
            );


            console.log(
                "[JSONP] URL:",
                url
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

    console.log(
        "[API] postAttendance() START"
    );


    console.log(
        "[API] QRID:",
        qrID
    );


    var result;

    var useJsonp =
        true;


    try {

        var apiOrigin =
            new URL(
                API_URL
            ).origin;


        useJsonp =
            apiOrigin !==
            window.location.origin;

    }

    catch (
        error
    ) {

        useJsonp =
            true;

    }


    console.log(
        "[API] Transport:",
        useJsonp
            ? "JSONP"
            : "FETCH"
    );


    if (
        useJsonp
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


    console.log(
        "[API] Result received"
    );


    console.log(
        "[API] Success:",
        result.success
    );


    const isLockError =
        /transaction lock|temporarily|locked|database repository/i.test(

            `${result.message || ""} ${result.__httpStatus || ""}`

        );


    if (

        (

            result.__httpStatus &&
            result.__httpStatus !== 200

            ||

            !result.success

        )

        &&

        isLockError

        &&

        attempt < 3

    ) {

        console.warn(
            "[API] Transaction lock retry:",
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


    if (

        (

            result.__httpStatus &&
            result.__httpStatus !== 200

        )

        ||

        !result.success

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
     * T0 — QR DETECTED
     * ========================================================
     */

    scanDebugDetectedTime =
        Date.now();


    const detectionSeconds =
        (

            scanDebugDetectedTime -
            scanDebugReadyTime

        ) / 1000;


    console.log(
        "=========================================="
    );


    console.log(
        "[SCAN T0] QR DETECTED"
    );


    console.log(
        "[SCAN] BUILD:",
        SCANNER_BUILD
    );


    console.log(
        "[SCAN] QR:",
        qrID
    );


    console.log(
        "[SCAN] Detection:",
        detectionSeconds.toFixed(3) +
        "s"
    );


    console.log(
        "=========================================="
    );


    showMessage(`

        <div>

            <b>
                QR DETECTED
            </b>

            <br><br>

            QR:
            ${qrID}

            <br><br>

            Detection Time:
            <b>
                ${detectionSeconds.toFixed(2)}
                seconds
            </b>

            <br><br>

            Sending to server...

        </div>

    `);


    try {

        /*
         * ====================================================
         * T1 — API REQUEST START
         * ====================================================
         */

        scanDebugRequestStartTime =
            Date.now();


        const requestDelay =
            (

                scanDebugRequestStartTime -
                scanDebugDetectedTime

            ) / 1000;


        console.log(
            "[SCAN T1] API REQUEST START"
        );


        console.log(
            "[SCAN] Delay after QR detection:",
            requestDelay.toFixed(3) +
            "s"
        );


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

                <br>

                Request Start:
                <b>
                    ${requestDelay.toFixed(2)}s
                </b>

                <br><br>

                Contacting server...

            </div>

        `);


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
         * T4 — API RESULT RECEIVED
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
            "[SCAN T4] API RESULT RECEIVED"
        );


        console.log(
            "[SCAN] BUILD:",
            SCANNER_BUILD
        );


        console.log(
            "[SCAN] QR:",
            qrID
        );


        console.log(
            "[SCAN] QR Detection:",
            detectionSeconds.toFixed(3) +
            "s"
        );


        console.log(
            "[SCAN] API Response:",
            apiSeconds.toFixed(3) +
            "s"
        );


        console.log(
            "[SCAN] Total:",
            totalSeconds.toFixed(3) +
            "s"
        );


        console.log(
            "[SCAN] JSONP Browser Wait:",
            (

                (

                    jsonpDebugCallbackTime -
                    jsonpDebugScriptAppendTime

                ) / 1000

            ).toFixed(3) +
            "s"
        );


        console.log(
            "=========================================="
        );


        if (
            result.success
        ) {

            /*
             * ================================================
             * T5 — SUCCESS UI
             * ================================================
             */

            const uiStartTime =
                Date.now();


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

                    <br><br>

                    <b>
                        DETAILED DIAGNOSTIC
                    </b>

                    <br><br>

                    QR Detection:
                    ${detectionSeconds.toFixed(2)}s

                    <br>

                    Request Start Delay:
                    ${requestDelay.toFixed(2)}s

                    <br>

                    Server Response:
                    ${apiSeconds.toFixed(2)}s

                    <br>

                    JSONP Browser Wait:
                    <b>
                        ${(
                            (
                                jsonpDebugCallbackTime -
                                jsonpDebugScriptAppendTime
                            ) / 1000
                        ).toFixed(2)}s
                    </b>

                    <br>

                    Total:
                    <b>
                        ${totalSeconds.toFixed(2)}s
                    </b>

                </small>

            `);


            const uiEndTime =
                Date.now();


            console.log(
                "[SCAN T5] SUCCESS UI RENDERED"
            );


            console.log(
                "[SCAN] UI render:",
                (

                    (
                        uiEndTime -
                        uiStartTime
                    ) / 1000

                ).toFixed(3) +
                "s"
            );

        }

        else {

            showMessage(`

                <div class="error">

                    ❌ ${result.message}

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
            "=========================================="
        );


        console.error(
            "[SCAN ERROR]"
        );


        console.error(
            "[SCAN ERROR MESSAGE]:",
            errorMessage
        );


        console.error(
            "[SCAN TOTAL]:",
            totalSeconds.toFixed(3) +
            "s"
        );


        console.error(
            "=========================================="
        );


        showConnectionError(`

            ${errorMessage}

            <br><br>

            <small>

                BUILD:
                ${SCANNER_BUILD}

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
         * ====================================================
         * PRESERVE OPT-01 BEHAVIOR
         * ====================================================
         *
         * The 2-second busy release is intentionally retained.
         *
         * We are NOT optimizing this yet.
         */

        setTimeout(
            function () {

                busy =
                    false;


                showMessage(
                    "Ready to Scan..."
                );

            },
            2000
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


        var cameraIdOrConfig =
            getCameraIdOrConfig(
                cameras
            );


        /*
         * ====================================================
         * OPT-01 SCANNER CONFIGURATION
         * ====================================================
         *
         * PRESERVED EXACTLY.
         * ====================================================
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

                        var minEdge =
                            Math.min(

                                viewfinderWidth,
                                viewfinderHeight

                            );


                        var boxSize =
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

                </small>

            </div>

        `);

    };
