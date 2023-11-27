    const fastPrbSpd = 500;
    const slowPrbSpd = 100;
    const maxTravel = 20;
    const toolStrLocal = `G0 X-700 Y-700 Z-50` // Location of the tool setter, this must be at a safe height for any tool you might have.
    const toolChngLocal = `G0 X-600 Y-600 Z-50` // Location that you will perform the manual tool change. It can be same location as the tool setter.
    
function semiAutoToolChange(fastPrbSpd,slowPrbSpd,maxTravel,toolStrLocal,toolChngLocal) {

    var step = 0;
    var initialZOffset = 0;
    socket.off('status');
    socket.off('prbResult');

    socket.on(`status`, function(status){
      console.log(status);
      initialZOffset=status.machine.position.offset.z;
      console.log(`i think the work offset is ${initialZOffset}`)
    })
    // socket.off('status');
  
    var step1 = `
        ; Header

        G21 ; mm mode` 
  
    socket.emit('runJob', {
      data: step1,

      isJob: false,
      completedMsg: false,
      fileName: ""
    });
  
    socket.on('prbResult', function(prbdata) {
      if (prbdata.state > 0) {
        step++;
        console.log("Step " + step, prbdata);
  
        // Steps 1-3 just positions endmill for probes that count
  
        if (step == 1) {
  
          var holefindermacroStep5 = `
          ${toolStrLocal}
          M0
          G38.2 Z-10 F${fastPrbSpd} ; Probe towards negative Z direction at the fast speed
          G90
          G38.2 X-` + approxCircleDia / 2 + ` F` + probeFeed + ` ; Probe X` // find left side of circle
  
          socket.emit('runJob', {
            data: holefindermacroStep5,
            isJob: false,
            completedMsg: false,
            fileName: ""
          });
        }
  
        if (step == 2) {
          leftside = prbdata.x
          var centerdistance = (rightside - leftside);
          var holefindermacroStep6 = `
          G4 P0.3
          G91
          G0 X` + centerdistance / 2 + `
          G90
          G10 P1 L20 X0
          G38.2 Y` + approxCircleDia / 2 + ` F` + probeFeed + ` ; Probe Y` // find far side of circle
  
          socket.emit('runJob', {
            data: holefindermacroStep6,
            isJob: false,
            completedMsg: false,
            fileName: ""
          });
        }
  
        if (step == 3) {
          farside = prbdata.y
  
          var holefindermacroStep7 = `
          G4 P0.3
          G91
          G0 Y-1
          G90
          G38.2 Y-` + approxCircleDia / 2 + ` F` + probeFeed + ` ; Probe Y` // find near side of circle
  
          socket.emit('runJob', {
            data: holefindermacroStep7,
            isJob: false,
            completedMsg: false,
            fileName: ""
          });
        }
  
        if (step == 4) {
          nearside = prbdata.y
          centerYdistance = (farside - nearside);
          centerXdistance = (rightside - leftside);
          console.log(centerXdistance, centerYdistance)
          var holefindermacroStep7 = `
          G4 P0.3
          G91
          G0 Y` + centerYdistance / 2 + `
          G90
          G10 P1 L20 Y0
          `
  
          socket.emit('runJob', {
            data: holefindermacroStep7,
            isJob: false,
            completedMsg: `Probe Complete: Remove the Probe Clip and Probe GND before continuing... <hr>
            Probed dimension X: ` + (centerXdistance + endmillDiameter).toFixed(3) + `<br>
            Probed dimension Y: ` + (centerYdistance + endmillDiameter).toFixed(3) + `<br>
            <hr>`,
            fileName: ""
          });
        }
  
      } else {
        console.log("Probe Failed")
      }
  
    })
  }
  
  // Metro.dialog.create({
  //   title: "Center Finding Macro",
  //   content: `
  //     <div class="row mb-0">
  //       <label class="cell-sm-6">Maximum Distance between edges</label>
  //       <div class="cell-sm-6">
  //           <input id="centerProbeDistance" type="number" value="100" data-role="input" data-append="mm" data-prepend="<i class='fas fa-ruler-combined'></i>" data-clear-button="false">
  //       </div>
  //     </div>
  
  //     <small>This is the approximate diameter of the circle, or the maximum width between edges of the rectangular/square hole you are probing inside</small>
  //     <hr>
  //     <div class="row mb-0">
  //       <label class="cell-sm-6">Endmill Diameter</label>
  //       <div class="cell-sm-6">
  //           <input id="centerProbeEndmill" type="number" value="6.35" data-role="input" data-append="mm" data-prepend="<i class='fas fa-arrows-alt-h'></i>" data-clear-button="false">
  //       </div>
  //     </div>
  //     <small>Enter the Endmill Diameter</small>
  //     <hr>
  //     <div class="row mb-0">
  //       <label class="cell-sm-6">Probe Feedrate</label>
  //       <div class="cell-sm-6">
  //           <input id="centerProbeFeedrate" type="number" value="100" data-role="input" data-append="mm/min" data-prepend="<i class='fas fa-running'></i>" data-clear-button="false">
  //       </div>
  //     </div>
  //     <small>How fast the probe will move - slower is safer/more accurate</small>
  //     `,
  //   actions: [{
  //       caption: "Run center finding Probe",
  //       cls: "js-dialog-close success",
  //       onclick: function() {
  //         var approxCircleDia = parseFloat($("#centerProbeDistance").val())
  //         var endmillDiameter = parseFloat($("#centerProbeEndmill").val())
  //         var probeFeed = parseInt($("#centerProbeFeedrate").val())
  //         findCircleCenter(approxCircleDia, endmillDiameter, probeFeed)
  //       }
  //     },
  //     {
  //       caption: "Cancel",
  //       cls: "js-dialog-close alert",
  //       onclick: function() {
  //         //
  //       }
  //     }
  //   ]
  // });