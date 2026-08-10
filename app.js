const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";


function getConfiguredApiUrl(){

    const params = new URLSearchParams(window.location.search);

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

let scanner;

let busy = false;

let lastScannedQR = "";

let lastScanTime = 0;


/*
==================================================
DIAGNOSTIC TIMERS
==================================================
*/

let scanDebugStartTime = 0;

let scanDebugDetectedTime = 0;

let scanDebugRequestStartTime = 0;


/*
==================================================
DISPLAY MESSAGE
==================================================
*/

function showMessage(html){

    const result =
        document.getElementById("result");

    if(result){

        result.innerHTML = html;

    }

}


/*
==================================================
API URL CONTROL
==================================================
*/

function setupApiUrlControl(){

    const input =
        document.getElementById(
            "apiUrlInput"
        );

    const button =
        document.getElementById(
            "saveApiUrlBtn"
        );

    if(!input || !button){

        return;

    }


    input.value = API_URL;


    button.addEventListener(
        "click",
        () => {

            const value =
                input.value.trim();


            if(!value){

                showMessage(`
                    <div class="error">
                        Please enter an attendance endpoint.
                    </div>
                `);

                return;

            }


            if(
                /docs\.google\.com\/spreadsheets/i
                .test(value)
            ){

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

            if(event.key === "Enter"){

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

function setupStartButton(){

    const button =
        document.getElementById(
            "startScannerBtn"
        );


    if(!button){

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

function sleep(ms){

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

function isIosSafari(){

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

function getCameraIdOrConfig(cameras){

    if(
        !cameras ||
        cameras.length === 0
    ){

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


    if(
        backCamera &&
        backCamera.id
    ){

        return backCamera.id;

    }


    if(cameras.length > 1){

        const frontCamera =
            cameras.find(
                camera =>
                    /front|user/i
                    .test(
                        camera.label || ""
                    )
            );


        const otherCamera =
            cameras.find(
                camera =>
                    !/front|user/i
                    .test(
                        camera.label || ""
                    )
            );


        if(
            otherCamera &&
            otherCamera.id
        ){

            return otherCamera.id;

        }


        return (
            cameras[cameras.length - 1].id ||
            cameras[0].id
        );

    }


    if(isIosSafari()){

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
JSONP GET
==================================================
*/

function jsonpGet(url){

    return new Promise(
        function(resolve, reject){

            const callbackName =
                "jsonp_callback_" +
                Date.now() +
                "_" +
                Math.floor(
                    Math.random() * 10000
                );


            window[callbackName] =
                function(data){

                    resolve(data);

                    delete window[callbackName];

                    script.remove();

                };


            const script =
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
                function(){

                    delete window[callbackName];

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
==================================================
POST ATTENDANCE
==================================================
*/

async function postAttendance(
    qrID,
    attempt = 1
){

    if(
        /docs\.google\.com\/spreadsheets/i
        .test(
            API_URL || ""
        )
    ){

        throw new Error(
            "This looks like a Google Sheets document link. Please use the Apps Script Web App URL instead."
        );

    }


    let result;

    let useJsonp = true;


    try{

        const apiOrigin =
            new URL(
                API_URL
            ).origin;


        useJsonp =
            apiOrigin !==
            window.location.origin;

    }

    catch(error){

        useJsonp = true;

    }


    /*
    ==============================================
    JSONP REQUEST
    ==============================================
    */

    if(useJsonp){

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
    ==============================================
    NORMAL FETCH
    ==============================================
    */

    else{

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


        try{

            result =
                text
                    ? JSON.parse(text)
                    : {};

        }

        catch(error){

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


    /*
    ==============================================
    TRANSACTION LOCK DETECTION
    ==============================================
    */

    const isLockError =
        /transaction lock|temporarily|locked|database repository/i
        .test(
            `${result.message || ""} ${result.__httpStatus || ""}`
        );


    /*
    ==============================================
    RETRY
    ==============================================
    */

    if(

        (
            result.__httpStatus &&
            result.__httpStatus !== 200 ||
            !result.success
        )

        &&

        isLockError

        &&

        attempt < 3

    ){

        await sleep(
            1000 * attempt
        );


        return postAttendance(
            qrID,
            attempt + 1
        );

    }


    /*
    ==============================================
    FINAL ERROR
    ==============================================
    */

    if(

        (
            result.__httpStatus &&
            result.__httpStatus !== 200
        )

        ||

        !result.success

    ){

        throw new Error(
            result.message ||
            "Unable to record attendance"
        );

    }


    return result;

}


/*
==================================================
CONNECTION ERROR
==================================================
*/

function showConnectionError(
    message
){

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
){

    const qrID =
        String(
            decodedText || ""
        ).trim();


    if(!qrID){

        return;

    }


    const currentTime =
        Date.now();


    /*
    ==============================================
    DUPLICATE SCAN PROTECTION
    ==============================================
    */

    if(

        busy

        ||

        (
            qrID === lastScannedQR

            &&

            currentTime -
            lastScanTime <
            2500
        )

    ){

        return;

    }


    busy = true;

    lastScannedQR =
        qrID;

    lastScanTime =
        currentTime;


    /*
    ==============================================
    QR DETECTION TIMER
    ==============================================
    */

    scanDebugDetectedTime =
        Date.now();


    const detectionSeconds =
        (
            scanDebugDetectedTime -
            scanDebugStartTime
        ) / 1000;


    /*
    ==============================================
    SHOW QR DETECTION
    ==============================================
    */

    showMessage(`

        <div class="success">

            <b>🔎 QR DETECTED</b>

        </div>

        <br>

        QR:

        <b>
            ${qrID}
        </b>

        <br><br>

        Decoder Time:

        <b>
            ${detectionSeconds.toFixed(2)}
            seconds
        </b>

        <br><br>

        <b>
            Contacting server...
        </b>

    `);


    try{

        /*
        ==========================================
        API REQUEST TIMER
        ==========================================
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

                <b>🔎 QR DETECTED</b>

                <br><br>

                QR:

                <b>
                    ${qrID}
                </b>

                <br><br>

                Decoder Time:

                <b>
                    ${detectionSeconds.toFixed(2)}s
                </b>

                <br>

                Request Start:

                <b>
                    ${requestDelay.toFixed(2)}s
                </b>

                <br><br>

                <b>
                    Contacting server...
                </b>

            </div>

        `);


        /*
        ==========================================
        SEND TO APPS SCRIPT
        ==========================================
        */

        const result =
            await postAttendance(
                qrID
            );


        /*
        ==========================================
        API RESPONSE TIMER
        ==========================================
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
                scanDebugStartTime
            ) / 1000;


        /*
        ==========================================
        SUCCESS
        ==========================================
        */

        if(result.success){

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

                    <br>

                    Server Response:

                    <b>
                        ${apiSeconds.toFixed(2)}s
                    </b>

                    <br>

                    Total:

                    <b>
                        ${totalSeconds.toFixed(2)}s
                    </b>

                </small>

            `);

        }


        /*
        ==========================================
        SERVER ERROR
        ==========================================
        */

        else{

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


    /*
    ==============================================
    ERROR
    ==============================================
    */

    catch(error){

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


    /*
    ==============================================
    FINALLY
    ==============================================
    */

    finally{

        setTimeout(
            () => {

                busy = false;

                showMessage(
                    "Ready to Scan..."
                );

            },
            2000
        );

    }

}


/*
==================================================
START SCANNER
==================================================
*/

async function startScanner(){

    try{

        /*
        ==========================================
        CHECK LIBRARY
        ==========================================
        */

        if(
            typeof Html5Qrcode ===
            "undefined"
        ){

            showMessage(`

                <div class="error">

                    Scanner library failed to load

                </div>

                <br>

                Open the Apps Script web app
                directly in the browser on your phone
                or check your internet connection.

            `);

            return;

        }


        /*
        ==========================================
        CREATE SCANNER
        ==========================================
        */

        scanner =
            new Html5Qrcode(
                "reader"
            );


        console.log(
            "[SCANNER INITIALIZING]",
            new Date().toISOString()
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
        ==========================================
        GET CAMERAS
        ==========================================
        */

        const cameras =
            await Html5Qrcode.getCameras();


        if(
            !cameras ||
            cameras.length === 0
        ){

            throw new Error(
                "No camera found."
            );

        }


        /*
        ==========================================
        SELECT BACK CAMERA
        ==========================================
        */

        const cameraIdOrConfig =
            getCameraIdOrConfig(
                cameras
            );


        /*
        ==========================================
        START CAMERA
        ==========================================
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
                    ){

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
                NO FLIP
                ==================================
                */

                disableFlip: true

            },

            onScanSuccess

        );


        /*
        ==========================================
        IMPORTANT:
        TIMER STARTS ONLY WHEN CAMERA IS READY
        ==========================================
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
    ==============================================
    CAMERA ERROR
    ==============================================
    */

    catch(error){

        const errorText =
            String(error);


        if(
            /not allowed|permission|secure context|camera/i
            .test(errorText)
        ){

            showMessage(`

                <div class="error">

                    Camera access blocked

                </div>

                <br>

                Allow camera permission and
                open the app from a secure address.

            `);

        }


        else{

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
    function(){

        setupApiUrlControl();

        setupStartButton();

        showMessage(`

            Press Start Scanner to begin
            and ensure the correct Apps Script
            endpoint is saved.

        `);

    };
