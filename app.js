const API_URL =
"https://script.google.com/macros/s/AKfycbyunRcLrGqxqZVmsj6BMiMsS4ga1FnO951o7bHS9_OdpySAGqJiX164DCRL1avxLmIK4A/exec";


let scanner;
let busy = false;


function showMessage(html){

    document.getElementById("result").innerHTML = html;

}


function sleep(ms){

    return new Promise(resolve => setTimeout(resolve, ms));

}


async function postAttendance(qrID, attempt = 1){

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

        throw new Error(result.message || "Unable to record attendance");

    }


    return result;

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

        showMessage(`

        <div class="error">

        ❌ Connection Error

        </div>

        <br>

        ${error.message}

        `);

    }


    setTimeout(()=>{

        busy=false;

        showMessage("Ready to Scan...");


    },2000);


}



async function startScanner(){

    try{


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

        showMessage(`

        <div class="error">

        Camera Error

        </div>

        <br>

        ${error}

        `);

        console.error(error);

    }

}



window.onload=function(){

    startScanner();

};
