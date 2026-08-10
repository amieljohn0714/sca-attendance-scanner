const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";


/*
 * ==========================================================
 * INTERNAL API CONFIGURATION
 * ==========================================================
 *
 * The endpoint is intentionally NOT exposed in the UI.
 *
 * The scanner is a controlled production client.
 * Users should not modify the Attendance API endpoint.
 *
 * If the deployment URL changes, update this constant
 * and redeploy the scanner.
 * ==========================================================
 */

const API_URL = DEFAULT_API_URL;


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

function showMessage(html) {

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
        () => {

            button.disabled =
                true;

            button.textContent =
                "Starting...";


            startScanner()
                .catch(() => {})
                .finally(() => {

                    button.disabled =
                        false;

                    button.textContent =
                        "Start Scanner";

                });

        }
    );

}


/*
 * ==========================================================
 * UTILITY
 * ==========================================================
 */

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


/*
 * ==========================================================
 * iOS SAFARI
 * ==========================================================
 */

function isIosSafari() {

    var ua =
        navigator.userAgent ||
        "";

    return (
        /iP(ad|od|hone)/i.test(ua) &&
        /Safari/i.test(ua) &&
        !/CriOS|FxiOS|OPiOS/i.test(ua)
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
            camera =>
                /back|rear|environment/i.test(
                    camera.label || ""
                )
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

        const frontCamera =
            cameras.find(
                camera =>
                    /front|user/i.test(
                        camera.label || ""
                    )
            );


        const otherCamera =
            cameras.find(
                camera =>
                    !/front|user/i.test(
                        camera.label || ""
                    )
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

function jsonpGet(url) {

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
            ] = function (
                data
            ) {

                resolve(data);

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

    catch (error) {

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
                    ? JSON.parse(text)
                    : {};

        }

        catch (error) {

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
        ) &&
        isLockError &&
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
        ) ||
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
        busy ||
        (
            qrID === lastScannedQR &&
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
     * ACTUAL QR DETECTION TIMER
     * ========================================================
     *
     * This starts AFTER the camera has become ready.
     *
     * Therefore this measurement excludes:
     *
     *   - camera permission
     *   - getCameras()
     *   - camera initialization
     *   - scanner.start()
     *
     * It measures the actual waiting period from
     * scanner-ready state until QR detection.
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

            <b>QR DETECTED</b>

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
         * API REQUEST TIMER
         * ====================================================
         */

        scanDebugRequestStartTime =
            Date.now();


        const result =
            await postAttendance(
                qrID
            );


        /*
         * ====================================================
         * API RESPONSE TIMER
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

    catch (error) {

        const errorMessage =
            error &&
            error.message
                ? error.message
                : String(error);


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
            () => {

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

                Open the scanner page in Safari
                and check your internet connection.

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
         * CAMERA / QR CONFIGURATION
         * ====================================================
         *
         * Optimization test:
         *
         *   FPS: 15
         *   QR box: 60%
         *
         * QR_CODE only.
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
         *
         * IMPORTANT:
         * The QR detection timer begins HERE.
         * ====================================================
         */

        scanDebugReadyTime =
            Date.now();


        console.log(
            "[SCANNER READY]",
            new Date().toISOString()
        );


        showMessage(
            "Ready to Scan..."
        );

    }


    catch (error) {

        const errorText =
            String(error);


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
                open the scanner from a secure address.

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


        showMessage(
            "Press Start Scanner to begin."
        );

    };
