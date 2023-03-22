// ==UserScript==
// @name         FMS6
// @version      1.0.0
// @description  Nach dem Kauf von einem Fahrzeug muss man es editieren.
// @             Wenn die Besatzung eine Ausbildung braucht wird dann der Status automatisch auf FMS6 gesetzt.
// @             Die Besatzung muss dem Fahrzeug zugewiesen werden.
// @             Wenn man im Hauptfenster bei der Gebäudeübersicht den Button Ausbildungskontrolle drückt, wird überprüft
// @             welche Besatzung der auf FMS6 gesetzten Fahrzeugen die Ausbildung haben und im positiven Fall wird das Fahrzeug
// @             auf FMS2 gesetzt.
// @author       LaLeLu4153
// @copyright    by LaLeLu4153
// @match        *://www.leitstellenspiel.de/*
// @match        *://leitstellenspiel.de/*
// @connect      *://www.leitstellenspiel.de/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==
/* global $, user_premium*/


(async function() {
    'use strict';

    GM_addStyle( '.btn-fms6 { border-radius: 3px !important; margin-top: 10px; }' );

    var cssHide = { "display": "none" };
    var cssShow = { "display": "inline-block" };

    if (!localStorage.VehicleListNew || JSON.parse(localStorage.VehicleListNew).lastUpdate < (new Date().getTime() - 24 * 1 * 3600)) {
        await $.getJSON("https://api.lss-manager.de/de_DE/vehicles.json").done(data => localStorage.setItem('VehicleListNew', JSON.stringify({ lastUpdate: new Date().getTime(), value: data })));
    }

    $("#building-list-header-search")
        .append(`<div id="myContainer">
                    <a id="wait" class="btn btn-danger btn-xs btn-fms6" style="display:none">---- Bitte warten ----</a>
                    <a id="button_fms6" class="btn btn-success btn-xs btn-fms6" style="display:inline-block">Ausbildungskontrolle</a>
                 </div>`);


    $("body").on("click", "#button_fms6", async function(){
        $('#button_fms6').css(cssHide);
        $('#wait').css(cssShow);
        var fms_6 = document.querySelectorAll('.building_list_fms_6');
        for(var i=0; i<fms_6.length;i++){
            var vehicleType = fms_6[i].parentNode.querySelector('a');
            var vehicleLink = vehicleType.getAttribute('href');
            const VehicleList = JSON.parse(localStorage.VehicleListNew).value;
            const VehicleApi = await $.getJSON("https://www.leitstellenspiel.de/api"+vehicleLink);
            var vehicleTypeId = VehicleApi.vehicle_type;
            var vehicle = VehicleList[vehicleTypeId];

            await fms6fms2(VehicleList,VehicleApi,vehicleLink,2);
        }

        $('#wait').css(cssHide);
        $('#button_fms6').css(cssShow);
    });

    if(document.querySelector('form').getAttribute('id').indexOf('edit_vehicle') > -1){
        var vehicleLink = document.querySelector('form').getAttribute('action');
        const VehicleList = JSON.parse(localStorage.VehicleListNew).value;
        const VehicleApi = await $.getJSON("https://www.leitstellenspiel.de/api"+vehicleLink);
        var vehicleTypeId = VehicleApi.vehicle_type;
        var vehicle = VehicleList[vehicleTypeId];

        if(vehicle.schooling){
            await fms6fms2(VehicleList,VehicleApi,vehicleLink,6);
        }
    }
})();

function makeGetRequest(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      onload: function(response) {
        resolve(response);
      },
      onerror: function(error) {
        reject(error);
      }
    });
  });
}

async function fms6fms2(VehicleList,VehicleApi,vehicleLink,fms) {
    var personnelRetention = 0;
    var personnelEducation = 0;
    var min = 0;
    var VehiclePersonnel = VehicleApi.max_personnel_override;
    var vehicleTypeId = VehicleApi.vehicle_type;
    var vehicle = VehicleList[vehicleTypeId];
    var url = "https://www.leitstellenspiel.de"+vehicleLink+"/zuweisung"

    try {
                const response = await makeGetRequest(url);
                const parser = new DOMParser();
                var zuweisung = response.responseText;
                var training = vehicle.staff.training;
                for(var key1 in training){
                    for(var key2 in training[key1]){
                        var lesson = key2;
                        if(training[key1][key2].min){
                            min = training[key1][key2].min;
                        }
                    }
                }

                var element = document.createElement("div");
                const doc = parser.parseFromString(zuweisung, "text/html");
                element.appendChild(doc.documentElement);

                var personal_table = element.querySelector("table[id='personal_table']");
                var personal_tr = personal_table.getElementsByTagName('tr');
                if(personal_tr.length > 0){
                    for(var i=1;i<personal_tr.length;i++){
                        var personal_td = personal_tr[i].getElementsByTagName('td');
                        var vehicleAssigned = personal_td[3].querySelector('a').getAttribute('href');
                        if (vehicleAssigned === vehicleLink){
                            var existing = 0;
                            var failure = 0;
                            personnelRetention += 1;
                            var educationArray = personal_tr[i].getAttribute('data-filterable-by');
                            educationArray = educationArray.substring(2,educationArray.length-2);
                            educationArray = educationArray.replaceAll('"','');
                            educationArray = educationArray.split(/[,()-]/,3);
                            for(var key3 in educationArray){
                                if(educationArray[key3].indexOf(' ') == 0){
                                    educationArray[key3] = educationArray[key3].substring(1);
                                }
                                if(lesson.indexOf(educationArray[key3]) > -1){
                                    existing += 1;
                                    if(educationArray[key3].length < 3){
                                        failure += 1;
                                    }
                                }
                            }
                            if(existing == 1 && failure){
                                existing = 0;
                            }
                            if(personal_td[1].textContent && existing){
                                var lesson1 = lesson.substring(0,personal_td[1].textContent.length);
                                personnelEducation += 1;
                            }
                            await new Promise(resolve => setTimeout(resolve, 100+Math.random()*400));
                        }
                    }
                }

                switch(fms){
                    case 6:
                        if(!min){
                            if(personnelEducation != VehiclePersonnel){
                                if(VehicleApi.fms_real != 6){
                                    await $.get(`${ vehicleLink }/set_fms/6`);
                                }
                            }
                        } else {
                            if(!(personnelEducation >= min)){
                                if(VehicleApi.fms_real != 6){
                                    await $.get(`${ vehicleLink }/set_fms/6`);
                                }
                            }
                        }
                        break;
                    case 2:
                        if(!min){
                            if(personnelEducation == VehiclePersonnel){
                                if(VehicleApi.fms_real != 2){
                                    await $.get(`${ vehicleLink }/set_fms/2`);
                                }
                            }
                        } else {
                            if(personnelEducation >= min){
                                if(VehicleApi.fms_real != 2){
                                    await $.get(`${ vehicleLink }/set_fms/2`);
                                }
                            }
                        }
                        break;
                }
    }

    catch (error) { // in case the GET request fails
        console.error("Request failed with error code", error.status, ". Message is ", error.responseText);
    }
}
