const DEFAULT_API_URL =
"https://script.google.com/macros/s/AKfycbwqbnofxAZ0Xnkv78xPJTMwIQreMzQPoC1vBdun2tEAr5LQUIuNJKoeWvla0CXqDvMpIg/exec";

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


function sleep(ms){

    return new Promise(resolve => setTimeout(resolve, ms));

}


async function postAttendance(qrID, attempt = 1){

    if(/docs\.google\.com\/spreadsheets/i.test(API_URL || "")){

        throw new Error("This looks like a Google Sheets document link. Please use the Apps Script Web App URL instead.");

    }

    const response = await fetch(API_URL, {

        method: "POST",

        headers: {

            "Content-Type": "application/json"

        },

        body: JSON.stringify({

            qrID

        })

    });


    const text = await response.text();

    let result = {};


    try {

        result = text ? JSON.parse(text) : {};

    }

    catch(error){

        result = {

            success: false,

            message: text || "Invalid server response"

        };

    }


    const isLockError = /transaction lock|temporarily|locked|database repository/i.test(`${result.message || ""} ${text || ""}`);


    if((!response.ok || !result.success) && isLockError && attempt < 3){

        await sleep(1000 * attempt);

        return postAttendance(qrID, attempt + 1);

    }


    if(!response.ok || !result.success){

        throw new Error(result.message || `Unable to record attendance (HTTP ${response.status})`);

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

            showConnectionError("The attendance server could not be reached. Make sure the app is opened from a local server or that the API URL is reachable.");

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

            Open this project from a local server (for example, http://localhost:8000) or check your internet connection.

            `);

            return;

        }


        scanner = new Html5Qrcode("reader");


        await scanner.start(

            {

                facingMode:"environment"

            },

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
    startScanner();

};
