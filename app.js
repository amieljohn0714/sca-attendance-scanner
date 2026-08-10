/*
 * ==========================================================
 * SCA-CCP ATTENDANCE SCANNER
 * Scanner Build: OPT-01
 * ==========================================================
 *
 * OPT-01 changes:
 *
 * 1. API endpoint is internal and no longer user-editable.
 * 2. Removed API URL query override.
 * 3. Removed API URL localStorage override.
 * 4. Scanner timing starts AFTER camera/scanner is ready.
 * 5. QR scanner FPS reduced from 25 → 15.
 * 6. QR processing box reduced from 70% → 60%.
 * 7. QR_CODE-only detection retained.
 * 8. Existing JSONP/API transport retained.
 * 9. Existing retry behavior retained.
 *
 * DO NOT MODIFY BACKEND FOR THIS BUILD.
 * ==========================================================
 */


/*
 * ==========================================================
 * BUILD IDENTIFICATION
 * ==========================================================
 */

const SCANNER_BUILD =
    "OPT-01";


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


            window[
                callbackName
            ] =
                function (
                    data
                ) {

                    resolve(
                        data
                    );


                    delete window[
                        callbackName
                    ];


                    script.remove();

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
     * ACTUAL QR DETECTION TIME
     * ========================================================
     *
     * IMPORTANT:
     *
     * scanDebugReadyTime is recorded only after
     * scanner.start() has completed.
     *
     * Therefore this measurement excludes:
     *
     * - camera permission
     * - camera enumeration
     * - camera initialization
     * - scanner startup
     *
     * It measures:
     *
     * SCANNER READY → QR DETECTED
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
         * API REQUEST START
         * ====================================================
         */

        scanDebugRequestStartTime =
            Date.now();


        const requestDelay =
            (

                scanDebugRequestStartTime -
                scanDebugDetectedTime

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
         */

        await scanner.start(

            cameraIdOrConfig,

            {

                /*
                 * Previous:
                 * 25 FPS
                 *
                 * OPT-01:
                 * 15 FPS
                 */

                fps:
                    15,


                /*
                 * Previous:
                 * 70%
                 *
                 * OPT-01:
                 * 60%
                 */

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


                /*
                 * QR ONLY
                 */

                formatsToSupport: [

                    Html5QrcodeSupportedFormats
                        .QR_CODE

                ],


                /*
                 * Do not mirror the camera.
                 */

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
         * ONLY NOW does the QR timing begin.
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
