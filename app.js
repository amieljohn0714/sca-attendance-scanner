    const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbyO5afPbnMP54PlrjHF73v5PWf2Qo-mVmxr9h33FP7s_Flml6DBva8xShp1i395aMB9Vg/exec";

    function getConfiguredApiUrl(){

        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("apiUrl");
        const fromStorage = window.localStorage.getItem("attendanceApiUrl");

        return fromQuery || fromStorage || DEFAULT_API_URL;

    }

    let API_URL = getConfiguredApiUrl();
    let scanner;
    let busy = false;


    function showMessage(html){

        document.getElementById("result").innerHTML = html;

    }


    function setupApiUrlControl(){

        const input = document.getElementById("apiUrlInput");
        const button = document.getElementById("saveApiUrlBtn");

        if(!input || !button){
            return;
        }

        input.value = API_URL;

        button.addEventListener("click", ()=>{

            const value = input.value.trim();

            if(!value){
                showMessage(`<div class="error">Please enter an attendance endpoint.</div>`);
                return;
            }

            if(/docs\.google\.com\/spreadsheets/i.test(value)){

                showMessage(`

                <div class="error">

                Google Sheets link detected

                </div>

                <br>

                Please use the Google Apps Script Web App URL ending in /exec, not the Google Sheets document link.

                `);

                return;

            }

            API_URL = value;
            window.localStorage.setItem("attendanceApiUrl", value);
            showMessage(`<div class="success">Endpoint saved. You can now scan again.</div>`);

        });

        input.addEventListener("keydown", (event)=>{

            if(event.key === "Enter"){
                event.preventDefault();
                button.click();
            }

        });

    }

    function setupStartButton() {
        const button = document.getElementById('startScannerBtn');

        if (!button) {
            return;
        }

        button.addEventListener('click', () => {
            button.disabled = true;
            button.textContent = 'Starting...';

            startScanner()
                .catch(() => {})
                .finally(() => {
                    button.disabled = false;
                    button.textContent = 'Start Scanner';
                });
        });
    }


    function sleep(ms){

        return new Promise(resolve => setTimeout(resolve, ms));

    }

    function isIosSafari() {
        var ua = navigator.userAgent || '';
        return /iP(ad|od|hone)/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS/i.test(ua);
    }

    function getCameraIdOrConfig(cameras) {
        if (!cameras || cameras.length === 0) {
            return {
                facingMode: { exact: 'environment' }
            };
        }

        const backCamera = cameras.find(camera => /back|rear|environment/i.test(camera.label || ''));
        if (backCamera && backCamera.id) {
            return backCamera.id;
        }

        if (cameras.length > 1) {
            const frontCamera = cameras.find(camera => /front|user/i.test(camera.label || ''));
            const otherCamera = cameras.find(camera => !/front|user/i.test(camera.label || ''));
            if (otherCamera && otherCamera.id) {
                return otherCamera.id;
            }
            return cameras[cameras.length - 1].id || cameras[0].id;
        }

        if (isIosSafari()) {
            return cameras[0].id;
        }

        return {
            facingMode: { exact: 'environment' }
        };
    }

    function jsonpGet(url) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

            window[callbackName] = function(data) {
                resolve(data);
                delete window[callbackName];
                script.remove();
            };

            var script = document.createElement('script');
            script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + callbackName;
            script.onerror = function() {
                delete window[callbackName];
                script.remove();
                reject(new Error('Network error while calling Apps Script endpoint.'));
            };

            document.body.appendChild(script);
        });
    }

    async function postAttendance(qrID, attempt = 1){

        if(/docs\.google\.com\/spreadsheets/i.test(API_URL || "")){

            throw new Error("This looks like a Google Sheets document link. Please use the Apps Script Web App URL instead.");

        }

        var result;
        var useJsonp = true;

        try {
            var apiOrigin = new URL(API_URL).origin;
            useJsonp = apiOrigin !== window.location.origin;
        } catch (error) {
            useJsonp = true;
        }

        if (useJsonp) {
            result = await jsonpGet(API_URL + '?qrID=' + encodeURIComponent(qrID));
        } else {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ qrID })
            });

            const text = await response.text();

            try {
                result = text ? JSON.parse(text) : {};
            } catch (error) {
                result = {
                    success: false,
                    message: text || 'Invalid server response'
                };
            }

            result.__httpStatus = response.status;
        }

        const isLockError = /transaction lock|temporarily|locked|database repository/i.test(`${result.message || ''} ${result.__httpStatus || ''}`);

        if((result.__httpStatus && result.__httpStatus !== 200 || !result.success) && isLockError && attempt < 3){
            await sleep(1000 * attempt);
            return postAttendance(qrID, attempt + 1);
        }

        if((result.__httpStatus && result.__httpStatus !== 200) || !result.success){
            throw new Error(result.message || 'Unable to record attendance');
        }

        return result;

    }


    function showConnectionError(message){

        showMessage(`

        <div class="error">

        ❌ Connection Error

        </div>

        <br>

        ${message}

        `);

    }


    async function onScanSuccess(decodedText){

        if(busy){
            return;
        }

        busy = true;


        try {

            const result = await postAttendance(decodedText);



            if(result.success){

                showMessage(`

                <div class="success">

                ✅ Attendance Recorded

                </div>

                <br>

                ${result.message}

                `);

            }

            else{

                showMessage(`

                <div class="error">

                ❌ ${result.message}

                </div>

                `);

            }


        }

        catch(error){

            const errorMessage = error && error.message ? error.message : String(error);

            if(/failed to fetch|network|load failed|fetch/i.test(errorMessage)){

                showConnectionError("The attendance server could not be reached. For mobile phones, open the Google Apps Script web app directly in the browser and use its deployed /exec URL. A local folder page may be blocked from reaching the endpoint.");

            }

            else{

                showConnectionError(errorMessage);

            }

        }


        setTimeout(()=>{

            busy=false;

            showMessage("Ready to Scan...");


        },2000);


    }



    async function startScanner(){

        try{

            if(typeof Html5Qrcode === "undefined"){

                showMessage(`

                <div class="error">

                Scanner library failed to load

                </div>

                <br>

                Open the Apps Script web app directly in the browser on your phone or check your internet connection.

                `);

                return;

            }


            scanner = new Html5Qrcode("reader");

            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                throw new Error('No camera found.');
            }

            var cameraIdOrConfig = getCameraIdOrConfig(cameras);

            await scanner.start(
                cameraIdOrConfig,
                {
                    fps:10,
                    qrbox:{
                        width:260,
                        height:260
                    }
                },
                onScanSuccess
            );

            showMessage("Ready to Scan...");


        }


        catch(error){

            const errorText = String(error);

            if(/not allowed|permission|secure context|camera/i.test(errorText)){

                showMessage(`

                <div class="error">

                Camera access blocked

                </div>

                <br>

                Allow camera permission and open the app from a secure/local address such as http://localhost.

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



    window.onload=function(){

        setupApiUrlControl();
        setupStartButton();
        showMessage('Press Start Scanner to begin and ensure the correct Apps Script endpoint is saved.');

    };
