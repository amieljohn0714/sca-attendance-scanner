const API_URL =
"https://script.google.com/macros/s/AKfycbyunRcLrGqxqZVmsj6BMiMsS4ga1FnO951o7bHS9_OdpySAGqJiX164DCRL1avxLmIK4A/exec";

let scanner;
let busy = false;

function showMessage(html){
    document.getElementById("result").innerHTML = html;
}
async function onScanSuccess(decodedText){
    if(busy){
        return;
    }
    busy = true;
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers:{
             "Content-Type":"application/json"
            }
            body: JSON.stringify({
             qrID: decodedText
            })
        });
        const result = await response.json();

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
                facingMode:{
                    exact:"environment"
                }
            },

            {
                fps:10,

                qrbox:function(
                    viewfinderWidth,
                    viewfinderHeight
                ){

                    let minEdge = Math.min(
                        viewfinderWidth,
                        viewfinderHeight
                    );

                    return {
                        width:minEdge * 0.7,
                        height:minEdge * 0.7
                    };

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

        ${error.message}

        `);

        console.error(error);

    }

}

window.onload=function(){
    startScanner();
};
