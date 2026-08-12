const DASHBOARD_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";

const API_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";


let scanner;

let busy = false;

let lastScannedQR = "";

let lastScanTime = 0;


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


function setupStartButton() {

    const button =
        document.getElementById(
            "startScannerBtn"
        );

    if (button) {

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
}


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


function jsonpGet(url) {
    return new Promise(function(resolve,reject) {
        var callbackName =
            "jsonp_callback_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 10000);

        var script = document.createElement("script");
        var finished = false;

        var timeout = setTimeout(function() {
            if (finished) return;
            finished = true;
            delete window[callbackName];
            script.remove();
            reject(new Error("Apps Script endpoint timed out."));
        },30000);

        window[callbackName] = function(data) {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            resolve(data);
            delete window[callbackName];
            script.remove();
        };

        script.src =
            url +
            (url.indexOf("?") === -1 ? "?" : "&") +
            "callback=" +
            encodeURIComponent(callbackName);

        script.onerror = function() {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            reject(new Error("Network error while calling Apps Script endpoint."));
        };

        document.body.appendChild(script);
    });
}

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
                "?scan=1&qrID=" + encodeURIComponent(qrID));

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


function escapeHtml(
    value
) {

    return String(
        value === undefined ||
        value === null
            ? ""
            : value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function getAttendanceData(
    result
) {

    if (
        !result ||
        typeof result !== "object"
    ) {

        return {};

    }


    return (
        result.data ||
        result.student ||
        {}
    );

}


function getDisplayName(
    data
) {

    var surname =
        data.Surname ||
        data.surname ||
        "";


    var givenName =
        data["Given Name"] ||
        data.givenName ||
        data.given_name ||
        "";


    var combined =
        (
            String(
                givenName
            ).trim() +
            " " +
            String(
                surname
            ).trim()
        ).trim();


    return combined ||
        "Attendance recorded";

}


function getCurrentStatus(
    data
) {

    var status =
        String(
            data["Current Status"] ||
            data.current_status ||
            ""
        ).toLowerCase();


    if (
        status === "present"
    ) {

        return "Inside";

    }


    if (
        status === "out"
    ) {

        return "Outside";

    }


    return "Present";

}


function renderSuccess(
    result
) {

    var data =
        getAttendanceData(
            result
        );


    var name =
        getDisplayName(
            data
        );


    var department =
        data.Department ||
        data.department ||
        "";


    var committee =
        data.Committee ||
        data.committee ||
        "";


    var role =
        data.Role ||
        data.role ||
        "";


    var status =
        getCurrentStatus(
            data
        );


    var entries =
        data["Total Entries"] ||
        data.total_entries ||
        0;


    var exits =
        data["Total Exits"] ||
        data.total_exits ||
        0;


    showMessage(`

        <div class="result-success">

            <div class="result-icon">
                ✓
            </div>

            <div class="result-title">
                Attendance Recorded
            </div>

            <div class="result-message">
                ${escapeHtml(
                    result.message ||
                    "Attendance recorded successfully."
                )}
            </div>

        </div>


        <div class="result-person">

            <div class="result-name">
                ${escapeHtml(
                    name
                )}
            </div>

            ${
                department
                    ? `
                        <div class="result-detail">
                            ${escapeHtml(
                                department
                            )}
                        </div>
                      `
                    : ""
            }

            ${
                role
                    ? `
                        <div class="result-detail">
                            ${escapeHtml(
                                role
                            )}
                        </div>
                      `
                    : ""
            }

        </div>


        <div class="result-status-row">

            <div class="result-status">

                <span class="status-dot"></span>

                ${escapeHtml(
                    status
                )}

            </div>


            <div class="result-counts">

                <span>
                    IN ${escapeHtml(
                        entries
                    )}
                </span>

                <span>
                    OUT ${escapeHtml(
                        exits
                    )}
                </span>

            </div>

        </div>

    `);

}


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


    showMessage(`

        <div class="result-processing">

            <div class="processing-spinner"></div>

            <div class="processing-title">
                Recording Attendance
            </div>

            <div class="processing-text">
                Please wait...
            </div>

        </div>

    `);


    try {

        const result =
            await postAttendance(
                qrID
            );


        if (
            result.success
        ) {

            renderSuccess(
                result
            );

        }

        else {

            showMessage(`

                <div class="result-error">

                    <div class="result-icon">
                        !
                    </div>

                    <div class="result-title">
                        Attendance Not Recorded
                    </div>

                    <div class="result-message">
                        ${escapeHtml(
                            result.message ||
                            "Unable to record attendance."
                        )}
                    </div>

                </div>

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


        showMessage(`

            <div class="result-error">

                <div class="result-icon">
                    !
                </div>

                <div class="result-title">
                    Connection Error
                </div>

                <div class="result-message">
                    ${escapeHtml(
                        errorMessage
                    )}
                </div>

            </div>

        `);

    }

    finally {

        setTimeout(
            function () {

                busy =
                    false;


                showMessage(`

                    <div class="result-ready">

                        <div class="ready-icon">
                            ✓
                        </div>

                        <div class="ready-title">
                            Ready to Scan
                        </div>

                        <div class="ready-text">
                            Present the QR code inside the scanner.
                        </div>

                    </div>

                `);

            },
            2000
        );

    }

}


async function startScanner() {

    try {

        if (
            typeof Html5Qrcode ===
            "undefined"
        ) {

            showMessage(`

                <div class="result-error">

                    <div class="result-icon">
                        !
                    </div>

                    <div class="result-title">
                        Scanner Unavailable
                    </div>

                    <div class="result-message">
                        Scanner library failed to load.
                        Check your internet connection
                        and reload the page.
                    </div>

                </div>

            `);

            return;

        }


        scanner =
            new Html5Qrcode(
                "reader"
            );


        showMessage(`

            <div class="result-processing">

                <div class="processing-spinner"></div>

                <div class="processing-title">
                    Starting Camera
                </div>

                <div class="processing-text">
                    Preparing scanner...
                </div>

            </div>

        `);


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


        showMessage(`

            <div class="result-ready">

                <div class="ready-icon">
                    ✓
                </div>

                <div class="ready-title">
                    Ready to Scan
                </div>

                <div class="ready-text">
                    Present the QR code inside the scanner.
                </div>

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

                <div class="result-error">

                    <div class="result-icon">
                        !
                    </div>

                    <div class="result-title">
                        Camera Access Blocked
                    </div>

                    <div class="result-message">
                        Allow camera permission for this
                        website and reload the scanner.
                    </div>

                </div>

            `);

        }

        else {

            showMessage(`

                <div class="result-error">

                    <div class="result-icon">
                        !
                    </div>

                    <div class="result-title">
                        Camera Error
                    </div>

                    <div class="result-message">
                        ${escapeHtml(
                            errorText
                        )}
                    </div>

                </div>

            `);

        }


        console.error(
            error
        );

    }

}


window.onload =
    function () {

        setupStartButton();


        showMessage(`

            <div class="result-ready">

                <div class="ready-icon">
                    ✓
                </div>

                <div class="ready-title">
                    Ready to Start
                </div>

                <div class="ready-text">
                    Tap Start Scanner to activate the camera.
                </div>

            </div>

        `);

    };
