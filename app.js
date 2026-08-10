const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";


/*
==================================================
API CONFIGURATION
==================================================
*/

function getConfiguredApiUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const fromQuery =
        params.get("apiUrl");

    const fromStorage =
        window.localStorage.getItem(
            "attendanceApiUrlV5"
        );

    return (
        fromQuery ||
        fromStorage ||
        DEFAULT_API_URL
    );
}


let API_URL =
    getConfiguredApiUrl();


/*
==================================================
SCANNER STATE
==================================================
*/

let scanner = null;

let busy = false;

let lastScannedQR = "";

let lastScanTime = 0;


/*
==================================================
DIAGNOSTIC STATE
==================================================
*/

let scanDebugStartTime = 0;

let scanDebugDetectedTime = 0;

let scanDebugRequestStartTime = 0;


/*
==================================================
DISPLAY
==================================================
*/

function showMessage(html) {

    const result =
        document.getElementById(
            "result"
        );

    if (result) {

        result.innerHTML = html;

    }

}


/*
==================================================
API URL CONTROL
==================================================
*/

function setupApiUrlControl() {

    const input =
        document.getElementById(
            "apiUrlInput"
        );

    const button =
        document.getElementById(
            "saveApiUrlBtn"
        );

    if (!input || !button) {

        return;

    }


    input.value = API_URL;


    button.addEventListener(
        "click",
        () => {

            const value =
                input.value.trim();


            if (!value) {

                showMessage(`

                    <div class="error">

                        Please enter an attendance endpoint.

                    </div>

                `);

                return;

            }


            if (
                /docs\.google\.com\/spreadsheets/i
                    .test(value)
            ) {

                showMessage(`

                    <div class="error">

                        Google Sheets link detected

                    </div>

                    <br>

                    Please use the Google Apps Script
                    Web App URL ending in /exec,
                    not the Google Sheets document link.

                `);

                return;

            }


            API_URL = value;


            window.localStorage.setItem(
                "attendanceApiUrlV5",
                value
            );


            showMessage(`

                <div class="success">

                    Endpoint saved.

                </div>

                <br>

                You can now scan again.

            `);

        }
    );


    input.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Enter") {

                event.preventDefault();

                button.click();

            }

        }
    );

}


/*
==================================================
START BUTTON
==================================================
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

            button.disabled = true;

            button.textContent =
                "Starting...";


            startScanner()
                .catch(() => {})
                .finally(() => {

                    button.disabled = false;

                    button.textContent =
                        "Start Scanner";

                });

        }
    );

}


/*
==================================================
SLEEP
==================================================
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
==================================================
IOS SAFARI
==================================================
*/

function isIosSafari() {

    const ua =
        navigator.userAgent || "";


    return (
        /iP(ad|od|hone)/i.test(ua) &&
        /Safari/i.test(ua) &&
        !/CriOS|FxiOS|OPiOS/i.test(ua)
    );

}


/*
==================================================
CAMERA SELECTION
==================================================
*/

function getCameraIdOrConfig(cameras) {

    if (
        !cameras ||
        cameras.length === 0
    ) {

        return {

            facingMode: {
                exact: "environment"
            }

        };

    }


    const backCamera =
        cameras.find(
            camera =>
                /back|rear|environment/i
                    .test(
                        camera.label || ""
                    )
        );


    if (
        backCamera &&
        backCamera.id
    ) {

        return backCamera.id;

    }


    if (cameras.length > 1) {

        const otherCamera =
            cameras.find(
                camera =>
                    !/front|user/i
                        .test(
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


    if (isIosSafari()) {

        return cameras[0].id;

    }


    return {

        facingMode: {
            exact: "environment"
        }

    };

}


/*
==================================================
JSONP REQUEST
==================================================
*/

function jsonpGet(url) {

    return new Promise(
        function(resolve, reject) {

            const callbackName =
                "jsonp_callback_" +
                Date.now() +
                "_" +
                Math.floor(
                    Math.random() * 10000
                );


            let script = null;


            window[callbackName] =
                function(data) {

                    resolve(data);

                    delete window[callbackName];

                    if (script) {

                        script.remove();

                    }

                };


            script =
                document.createElement(
                    "script"
                );


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
                function() {

                    delete window[callbackName];

                    if (script) {

                        script.remove();

                    }

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
==================================================
POST ATTENDANCE
==================================================

IMPORTANT:
This version records every API attempt.

It does NOT change the backend behavior.

It only tells us:

Attempt 1 = how long?
Retry? = yes/no
Attempt 2 = how long?
Final response = how long?
==================================================
*/

async function postAttendance(
    qrID,
    attempt = 1,
    diagnostic = null
) {

    /*
    ----------------------------------------------
    INITIALIZE DIAGNOSTIC OBJECT
    ----------------------------------------------
    */

    if (!diagnostic) {

        diagnostic = {

            startedAt:
                Date.now(),

            attempts: [],

            retryCount: 0

        };

    }


    /*
    ----------------------------------------------
    CHECK API URL
    ----------------------------------------------
    */

    if (
        /docs\.google\.com\/spreadsheets/i
            .test(
                API_URL || ""
            )
    ) {

        throw new Error(
            "This looks like a Google Sheets document link. Please use the Apps Script Web App URL instead."
        );

    }


    /*
    ----------------------------------------------
    START THIS ATTEMPT
    ----------------------------------------------
    */

    const attemptStart =
        Date.now();


    let result;

    let useJsonp = true;


    /*
    ----------------------------------------------
    DETERMINE REQUEST METHOD
    ----------------------------------------------
    */

    try {

        const apiOrigin =
            new URL(
                API_URL
            ).origin;


        useJsonp =
            apiOrigin !==
            window.location.origin;

    }

    catch (error) {

        useJsonp = true;

    }


    /*
    ----------------------------------------------
    SEND REQUEST
    ----------------------------------------------
    */

    try {

        if (useJsonp) {

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

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({
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

                    success: false,

                    message:
                        text ||
                        "Invalid server response"

                };

            }


            result.__httpStatus =
                response.status;

        }

    }

    catch (error) {

        const attemptEnd =
            Date.now();


        diagnostic.attempts.push({

            attempt: attempt,

            duration:
                (
                    attemptEnd -
                    attemptStart
                ) / 1000,

            success: false,

            error:
                error.message ||
                String(error)

        });


        throw error;

    }


    /*
    ----------------------------------------------
    END THIS ATTEMPT
    ----------------------------------------------
    */

    const attemptEnd =
        Date.now();


    const attemptSeconds =
        (
            attemptEnd -
            attemptStart
        ) / 1000;


    /*
    ----------------------------------------------
    CHECK TRANSACTION/LOCK ERROR
    ----------------------------------------------
    */

    const isLockError =
        /transaction lock|temporarily|locked|database repository/i
            .test(
                `${result.message || ""} ${
                    result.__httpStatus || ""
                }`
            );


    /*
    ----------------------------------------------
    SAVE ATTEMPT RESULT
    ----------------------------------------------
    */

    diagnostic.attempts.push({

        attempt: attempt,

        duration:
            attemptSeconds,

        success:
            !!result.success,

        code:
            result.code ||
            "",

        message:
            result.message ||
            "",

        lockError:
            isLockError

    });


    /*
    ----------------------------------------------
    RETRY IF NEEDED
    ----------------------------------------------
    */

    if (

        (
            (
                result.__httpStatus &&
                result.__httpStatus !== 200
            )

            ||

            !result.success
        )

        &&

        isLockError

        &&

        attempt < 3

    ) {

        diagnostic.retryCount += 1;


        /*
        ------------------------------------------
        WAIT BEFORE NEXT ATTEMPT
        ------------------------------------------
        */

        const retryDelay =
            1000 * attempt;


        await sleep(
            retryDelay
        );


        /*
        ------------------------------------------
        RETRY
        ------------------------------------------
        */

        return postAttendance(
            qrID,
            attempt + 1,
            diagnostic
        );

    }


    /*
    ----------------------------------------------
    FINAL ERROR
    ----------------------------------------------
    */

    if (

        (
            result.__httpStatus &&
            result.__httpStatus !== 200
        )

        ||

        !result.success

    ) {

        const error =
            new Error(
                result.message ||
                "Unable to record attendance"
            );


        error.__diagnostic =
            diagnostic;


        throw error;

    }


    /*
    ----------------------------------------------
    FINAL DIAGNOSTIC
    ----------------------------------------------
    */

    diagnostic.completedAt =
        Date.now();


    diagnostic.totalSeconds =
        (
            diagnostic.completedAt -
            diagnostic.startedAt
        ) / 1000;


    /*
    Attach diagnostic information
    without changing normal result fields.
    */

    result.__diagnostic =
        diagnostic;


    return result;

}


/*
==================================================
CONNECTION ERROR
==================================================
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
==================================================
QR SCAN SUCCESS
==================================================
*/

async function onScanSuccess(
    decodedText
) {

    const qrID =
        String(
            decodedText || ""
        ).trim();


    if (!qrID) {

        return;

    }


    const currentTime =
        Date.now();


    /*
    ----------------------------------------------
    DUPLICATE SCAN PROTECTION
    ----------------------------------------------
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


    busy = true;

    lastScannedQR =
        qrID;

    lastScanTime =
        currentTime;


    /*
    ----------------------------------------------
    QR DETECTION TIMER
    ----------------------------------------------
    */

    scanDebugDetectedTime =
        Date.now();


    const detectionSeconds =
        (
            scanDebugDetectedTime -
            scanDebugStartTime
        ) / 1000;


    /*
    ----------------------------------------------
    SHOW QR DETECTION
    ----------------------------------------------
    */

    showMessage(`

        <div class="success">

            <b>
                🔎 QR DETECTED
            </b>

        </div>

        <br>

        QR:

        <b>
            ${qrID}
        </b>

        <br><br>

        QR Detection:

        <b>
            ${detectionSeconds.toFixed(2)}s
        </b>

        <br><br>

        Contacting server...

    `);


    try {

        /*
        ------------------------------------------
        API REQUEST TIMER
        ------------------------------------------
        */

        scanDebugRequestStartTime =
            Date.now();


        showMessage(`

            <div>

                <b>
                    🔎 QR DETECTED
                </b>

                <br><br>

                QR:

                <b>
                    ${qrID}
                </b>

                <br><br>

                QR Detection:

                <b>
                    ${detectionSeconds.toFixed(2)}s
                </b>

                <br><br>

                <b>
                    Contacting server...
                </b>

            </div>

        `);


        /*
        ------------------------------------------
        CALL SERVER
        ------------------------------------------
        */

        const result =
            await postAttendance(
                qrID
            );


        /*
        ------------------------------------------
        RESPONSE TIMING
        ------------------------------------------
        */

        const apiResponseTime =
            Date.now();


        const totalSeconds =
            (
                apiResponseTime -
                scanDebugStartTime
            ) / 1000;


        const diagnostic =
            result.__diagnostic || {

                attempts: [],

                retryCount: 0,

                totalSeconds:
                    0

            };


        /*
        ------------------------------------------
        CALCULATE API TIME
        ------------------------------------------
        */

        const apiSeconds =
            (
                apiResponseTime -
                scanDebugRequestStartTime
            ) / 1000;


        /*
        ------------------------------------------
        BUILD ATTEMPT DETAILS
        ------------------------------------------
        */

        let attemptDetails = "";


        if (
            diagnostic.attempts &&
            diagnostic.attempts.length
        ) {

            attemptDetails =
                diagnostic.attempts
                    .map(
                        item => `

                            Attempt ${item.attempt}:
                            <b>
                                ${Number(
                                    item.duration
                                ).toFixed(2)}s
                            </b>

                            <br>

                            Result:
                            ${
                                item.success
                                    ? "SUCCESS"
                                    : "FAILED"
                            }

                            ${
                                item.lockError
                                    ? "<br>Lock/transaction issue detected"
                                    : ""
                            }

                        `
                    )
                    .join(
                        "<hr>"
                    );

        }


        /*
        ------------------------------------------
        SUCCESS RESPONSE
        ------------------------------------------
        */

        if (result.success) {

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

                    <b>
                        ${detectionSeconds.toFixed(2)}s
                    </b>

                    <br><br>

                    API Request:

                    <b>
                        ${apiSeconds.toFixed(2)}s
                    </b>

                    <br><br>

                    Total:

                    <b>
                        ${totalSeconds.toFixed(2)}s
                    </b>

                    <br><br>

                    Retries:

                    <b>
                        ${diagnostic.retryCount}
                    </b>

                    <br><br>

                    <hr>

                    <b>
                        API ATTEMPTS
                    </b>

                    <br><br>

                    ${attemptDetails}

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

                    API:

                    ${apiSeconds.toFixed(2)}s

                    <br>

                    Total:

                    ${totalSeconds.toFixed(2)}s

                    <br><br>

                    Retries:

                    ${diagnostic.retryCount}

                    <br><br>

                    ${attemptDetails}

                </small>

            `);

        }

    }


    /*
    ----------------------------------------------
    ERROR
    ----------------------------------------------
    */

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
                scanDebugStartTime
            ) / 1000;


        let diagnosticHTML = "";


        if (
            error.__diagnostic
        ) {

            const diagnostic =
                error.__diagnostic;


            diagnosticHTML =

                `

                <br><br>

                <b>
                    API ATTEMPTS
                </b>

                <br><br>

                ${
                    diagnostic.attempts
                        .map(
                            item => `

                                Attempt
                                ${item.attempt}:

                                <b>
                                    ${Number(
                                        item.duration
                                    ).toFixed(2)}s
                                </b>

                                <br>

                                ${
                                    item.lockError
                                        ? "Transaction/lock issue"
                                        : ""
                                }

                                <br><br>

                            `
                        )
                        .join("")
                }

                `;

        }


        showConnectionError(`

            ${errorMessage}

            <br><br>

            <small>

                QR Detection:

                ${detectionSeconds.toFixed(2)}s

                <br>

                Total:

                ${totalSeconds.toFixed(2)}s

                ${diagnosticHTML}

            </small>

        `);

    }


    /*
    ----------------------------------------------
    READY AGAIN
    ----------------------------------------------
    */

    finally {

        setTimeout(
            () => {

                busy = false;

                showMessage(
                    "Ready to Scan..."
                );

            },
            4000
        );

    }

}


/*
==================================================
START SCANNER
==================================================
*/

async function startScanner() {

    try {

        /*
        ------------------------------------------
        CHECK LIBRARY
        ------------------------------------------
        */

        if (
            typeof Html5Qrcode ===
            "undefined"
        ) {

            showMessage(`

                <div class="error">

                    Scanner library failed to load

                </div>

                <br>

                Open the Apps Script web app directly
                in the browser on your phone.

            `);

            return;

        }


        /*
        ------------------------------------------
        CREATE SCANNER
        ------------------------------------------
        */

        scanner =
            new Html5Qrcode(
                "reader"
            );


        showMessage(`

            <div>

                Camera initializing...

                <br><br>

                <small>
                    Please wait.
                </small>

            </div>

        `);


        /*
        ------------------------------------------
        GET CAMERAS
        ------------------------------------------
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


        /*
        ------------------------------------------
        SELECT CAMERA
        ------------------------------------------
        */

        const cameraIdOrConfig =
            getCameraIdOrConfig(
                cameras
            );


        /*
        ------------------------------------------
        START CAMERA
        ------------------------------------------
        */

        await scanner.start(

            cameraIdOrConfig,

            {

                /*
                ==================================
                SCAN FREQUENCY
                ==================================
                */

                fps: 25,


                /*
                ==================================
                QR BOX
                ==================================
                */

                qrbox:
                    function(
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
                                minEdge * 0.70
                            );


                        return {

                            width:
                                boxSize,

                            height:
                                boxSize

                        };

                    },


                /*
                ==================================
                QR ONLY
                ==================================
                */

                formatsToSupport: [

                    Html5QrcodeSupportedFormats
                        .QR_CODE

                ],


                /*
                ==================================
                DISABLE FLIP
                ==================================
                */

                disableFlip: true

            },

            onScanSuccess

        );


        /*
        ------------------------------------------
        IMPORTANT:
        START TIMER ONLY WHEN CAMERA IS READY
        ------------------------------------------
        */

        scanDebugStartTime =
            Date.now();


        console.log(
            "[SCANNER READY]",
            new Date().toISOString()
        );


        showMessage(`

            <div>

                <b>
                    Ready to Scan...
                </b>

                <br><br>

                Point the camera at the QR code.

            </div>

        `);

    }


    /*
    ----------------------------------------------
    CAMERA ERROR
    ----------------------------------------------
    */

    catch (error) {

        const errorText =
            String(error);


        if (
            /not allowed|permission|secure context|camera/i
                .test(errorText)
        ) {

            showMessage(`

                <div class="error">

                    Camera Access Blocked

                </div>

                <br>

                Allow camera permission and
                open the web app directly
                over HTTPS.

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


        console.error(error);

    }

}


/*
==================================================
PAGE LOAD
==================================================
*/

window.onload =
    function() {

        setupApiUrlControl();

        setupStartButton();


        showMessage(`

            Press Start Scanner to begin.

            <br><br>

            Ensure the correct Apps Script
            endpoint is saved.

        `);

    };
