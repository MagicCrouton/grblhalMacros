// Tool Length Control Macro For OpenBuilds Control
// V 2.2
// 
// ***IMPORTANT***
// G30 (Starting point for probing) and G28 (Tool change location) ***MUST*** be set prior to using this macro. 
// 
// How to set these:
// Jog the machine until it is directly above the tool setting probe, at an appropriate height, and send 'G30.1'
// Jog the machine until it is at your chosen location for tool change and send 'G28.1'
// (If you have already set G28 as a safe location, then you can just ignore the tool setting location.)
// 
// Use at own risk!
// DAG 27/2/23
// V1.1 1/3/23 	tc_probedistance variable added / console output from reference tool probe added
// V1.2 4/4/23 	Checks for machine state added (tc_safetycheck() & tc_homecheck() functions)
//				Home check can be disabled by setting tc_ignorehomestatus to "yes"
//				Default values for probing revised (shorter & slower)
//				Macro can be re-run without adding menu button which allows feed rates, etc. to be changed without having to restart Control
// V1.3	11/4/23	Added console log for undefined tool status
//				Corrected message for reporting change to WCS after probing new tool when WCS offset has changed
//				Added actual measurement to new tool message & reformatted text in messages
// V1.4 4/9/23	Bug fix for Error 9 when setting new WCS offset (added tc_status 5)
//				Added 'ignorehomestatus' message to console log
//				Added Z clearance check before returning to home position (to catch machine Z>0)
//				Default tc_ignorehomestatus to "no"
// V1.5 ... 2.1 Trial versions for troubleshooting
// V2.2 15/9/23	Revised probing GCode strings to avoid $J command and use G0 for probe retract for compatability with GRBLHal
//


// Change these before running to customise basic operation:

window.tc_seekdistance = "45";			// Distance (mm) of initial probe to locate tool setter
window.tc_seekspeed = "150";			// Speed (mm/min) of initial probe to locate tool setter
window.tc_retract = "2";				// Distance (mm) to retract before tool length probing
window.tc_probespeed = "30";			// Speed (mm/min) for tool length probing
window.tc_probedistance = "5";			// Distance (mm) for tool length probing - must be greater than tc_retract
window.tc_ignorehomestatus = "yes"		// Ignores status of 'laststatus.machine.modals.homedRecently' if "yes".
window.tc_finalzfeed = "500";			// Speed (mm/min) used when the Z axis returns to the original tool position
										// ...make this slow enough to get to the E-stop if it goes wrong!

//The rest of it...

// Declare variables
window.tc_version = "2.2.0";		// Macro version for debugging
window.tc_status = 0;				// 0 = Waiting
									// 1 = Probe requested
									// 2 = Ready to probe
									// 3 = Locate tool setter
									// 4 = Probe tool
									// 5 = Set WCS offset
									// 6 = Move to tool change requested
									// 7 = Arrived at tool change
									// 8 = Return to original location requested
									// 9 = Arrived at original location
									// 99 = finished with dialog

window.tc_needstorun = "no";		// Is there Gcode pending?
window.tc_waitingOK = "no";			// Are we waiting for confirmation?
window.tc_refset = "no";			// Has the reference tool been set?
window.tc_xpos = "";				// Store current position
window.tc_ypos = "";				//
window.tc_zpos = "";				//
window.tc_unitsmode = "";			// Store current modal settings that we might change 
window.tc_distmode = "";			//
window.tc_coordsys = "";			// For reference
window.tc_offset = 0;				// Measured reference tool offset - WCS is adjusted to maintain this for new tools
window.tc_refWCSz = "";				// WCS Z offset at time of tool measurement
window.tc_newz = "";				// Calculated Z offset for new tool
window.tc_message = "Initialising";	// Dialog text
window.tc_ref = "Reference";		// Identifiers to steer flow for reference or new tools
window.tc_new = "New";				//

//Add "tool offset" button to toolbar

if (!document.getElementById('grbltc_tlo')) {		//If the macro has run, the button will be present, so we don't want to run it again
//if (1==1){										//(Comment out the line above and un-comment this one to disable run-once protection for debugging, etc.)

	var tc_tlo = `<button id="grbltc_tlo" class="ribbon-button" onclick="tc_homecheck();">
					 <span class="icon">
					   <span class="fa-layers fa-fw">
						 <i class="fas fa-ruler-vertical fa-rotate-180 fg-black"></i>
					   </span>
					 </span>
					 <span class="caption grblmode">Tool<br>Length</span>
				   </button>`
	$( "#grblProbeMenu" ).after( tc_tlo );
}
else 
{
	alert('Macro has already been run - no new button created.')
};

//End of Initialisation


window.tc_initiate = function(){				// Main body of program

//Initialise variables
tc_status = 0;
tc_needstorun = "no";
tc_waitingOK = "no";
tc_xpos ="";
tc_ypos ="";
tc_zpos ="";
tc_unitsmode = "";
tc_distmode = "";
window.tc_xpos = laststatus.machine.position.work["x"]; 		//save the current tool position
window.tc_ypos = laststatus.machine.position.work["y"];
window.tc_zpos = laststatus.machine.position.work["z"];
window.tc_unitsmode = laststatus.machine.modals["unitsmode"]; 	//save any modal settings that we might change or reference
window.tc_distmode = laststatus.machine.modals["distancemode"];
window.tc_coordsys = laststatus.machine.modals["coordinatesys"];

if (tc_refset=="no"){tc_message = "No reference stored - Please set Reference Tool";}
else {tc_message="Reference offset (" + tc_offset + ")";}	

if (tc_safetycheck() ==1){										// Check that machine state is OK to run the macro

// Create & show dialog

Metro.dialog.create({
    title: "Tool Length Compensation via WCS",
    content: `
		   <span>Tool Setting station is at G28, Probe starting point at G30. These locations must be set up before using this macro. Be prepared for the machine to move immediately that the buttons below are clicked.</span>
		   <hr>
		   <button class="button success " onclick="tc_tool = tc_ref; tc_status=1;">Set Reference Tool</button>
		   <button class="button warning " onclick="tc_tool = tc_new; tc_status=6">Go To Tool Change</button>
           <button class="button primary  disabled" id="tc_changetool" onclick="tc_tool = tc_new; tc_status=1">Set New Tool</button>
		   <hr>
           <span id="tc_log">Please Select An Action</span>
		   <hr>
           <button style="text-align:center" id="tc_ok" class="button large success  disabled " onclick="tc_crackon();">Proceed</button>
       `,
    actions: [{
        caption: "Close",
        cls: "js-dialog-close alert ",
        onclick: function() {
            tc_status=99;
            printLog("Tool Offset Dialog Exited")
			}
		}]
	});
// Add this line back into the dialog above for debug info: <button class="button" onclick="tc_debug()">Debug</button>	

printLog("Tool Offset Dialog Opened");
console.log("Tool offset dialog V" + tc_version + " opened");

// Set up loop that handles the whole process
	window.tc_refinterval = setInterval(function() {
	
        tc_updateui();
		
		if (tc_needstorun == "yes"){
			if(laststatus.comms.runStatus == "Run") {		//Make sure that any actions have started
				tc_needstorun = "no"; }
			}
		else if(laststatus.comms.runStatus != "Run")		//wait for action to finish before going back into the loop
		{		
			
		switch (tc_status) 
		{
		case 0:	//Waiting
		{
			break;
		}
		case 1:	//Tool probe requested		
		{
			tc_message = "Moving to probe location (G30)";
			tc_waitingOK = "no"
			
			var tc_prep =  `
			G21 		;set mm mode
			G53 G0 Z-5	;Raise to safe height in machine coordinates
			G30 G91 X0 Y0	;Traverse to X & Y position for G30
			G30 G91 Z0	;Lower to Z position for G30
			`
			socket.emit('runJob', {
				data: tc_prep,
				isJob: "no",
				completedMsg: "",
				fileName: ""
			});	

			tc_needstorun = "yes";
			tc_status=2;
			break;
		}
		case 2: 	//ready to probe
		{
			tc_message = "Ready to measure " + tc_tool + " Tool<br><br>Position probe and connect wires if required before pressing Proceed";
			tc_waitingOK = "yes";
			tc_status = 3;
			break;
        }
		case 3:	  //Find tool setter
		{
		if (tc_waitingOK == "yes"){break;}
				tc_message = "Locating tool setter in Z";
				var tc_probe =  `
					G21					;set mm mode
					G38.3 Z-` + tc_seekdistance + ` F` + tc_seekspeed + ` ;probe using parameters at the top of the macro
					G4 P0.4				;pause
					G91 G0 Z` + tc_retract

				socket.off('prbResult'); // Disable old listeners
				socket.emit('runJob', {
					data: tc_probe,
					isJob: false,
					completedMsg: "",
					fileName: ""
				});
				
				socket.on('prbResult', function(prbdata) {
				if (prbdata.state > 0) {
					tc_message = "Located tool setter at " + prbdata.z;
					printLog("Located tool setter at " + prbdata.z);
					socket.off('prbResult');
					tc_status=4;
					//tc_waitingOK = "yes";
					}

				else {
					tc_message= "Failed to locate tool setter - Operation cancelled<br><br>Remove probe / probe wire (if used) before moving away";
					printLog("Failed to locate tool setter - Operation cancelled");
					socket.off('prbResult');
					tc_status=0;
					}
				})
			tc_needstorun = "yes";
			break;
		}
		case 4:	  //probe tool
		{
		if (tc_waitingOK == "yes"){break;}
		
				tc_message = "Measuring " + tc_tool + " Tool";
								
				var tc_probe =  `
					G21					;set mm mode
					G38.3 Z-` + tc_probedistance + ` F` + tc_probespeed + `	;probe at slow speed
					G4 P0.4				;pause
					G91 G0 Z` + tc_retract
					
				socket.off('prbResult'); // Disable old listeners
				socket.emit('runJob', {
					data: tc_probe,
					isJob: false,
					completedMsg: "",
					fileName: ""
				});
				
				socket.on('prbResult', function(prbdata) {
					if (prbdata.state > 0) {
						tc_message = "Measured " +tc_tool +" Tool offset at " + prbdata.z + "mm<br><br>Remove probe / probe wire (if used).<br><br>Press Proceed to return to the original position or choose another action";
						printLog("Measured " +tc_tool +" Tool Offset At " + prbdata.z);
						socket.off('prbResult');
						
						if(tc_tool == tc_ref){					// Record offset of reference tool
							tc_offset = prbdata.z;
							tc_refWCSz = laststatus.machine.position.offset["z"]; // Record WCS offset in force at the time.
							tc_refset = "yes";
							
							console.log("Reference Tool Probe");
							console.log("Measured Tool Offset "+ tc_offset);
							console.log("Current WCS Offset " + tc_refWCSz);
							tc_newz = tc_refWCSz;								// For safety check on Z height
							tc_status = 8;
							//tc_waitingOK = "yes";
						}
						else if (tc_tool == tc_new){ 			// Offset reference for new tool
						
							var tc_result = prbdata.z;
							var tc_nowWCSz = laststatus.machine.position.offset["z"];
							var tc_deltaz = (tc_result - tc_offset);
							
							tc_newz = tc_nowWCSz + tc_deltaz;
							
							console.log("New Tool Probe");
							console.log("Measured Tool Offset" + tc_result);
							console.log("Current WCS Z offset "+ tc_nowWCSz);
							console.log("Previous Tool Offset "+ tc_offset);
							console.log("Previous WCS Offset " + tc_refWCSz);
							console.log("New WCS Offset "+(tc_newz).toFixed(3));
							tc_message = "Measured tool offset " + tc_result + "mm<br>Z Offset of current WCS (" + tc_coordsys + ") adjusted by " + (tc_deltaz).toFixed(3) + "mm<br><br>Remove probe / probe wire (if used)<br><br>Press Proceed to return to the original position or choose another action";
							printLog("Z Offset in " + tc_coordsys + " set to " + tc_newz + "("+ (tc_deltaz).toFixed(3) +")");
							tc_refWCSz = tc_nowWCSz;
							tc_offset= tc_result;
							console.log("Waiting to set new WCS offset");
							tc_status=5;
						}
						else
						{
							tc_message = "Undefined tool action " + tc_status;
							printLog("Undefined tool action " + tc_status);
							console.log("Undefined tool action " + tc_status);
							tc_status=0;
						}				
					}

					else {
						tc_message= "Tool length probe failed - Operation cancelled<br><br>Remove probe / probe wire (if used) before moving away";
						printLog("Probe Failed - Operation cancelled");
						socket.off('prbResult');
						tc_status=0;
						}
				});
			
			tc_needstorun = "yes";
			tc_waitingOK = "yes";

			break;
		}
		case 5:		//Set WCS to new offset
		{
			console.log("Ready to set new WCS offset");
			sendGcode("G10 L2 P0 Z"+tc_newz);
			//tc_needstorun = "yes";
			tc_status=8;
			tc_waitingOK = "yes";
			console.log("G10 command sent");
			break;
		}
		case 6:		//Move to tool setting location
		{	
			tc_message = "Moving to tool change location (G28)";
			
			var tc_tchng =  `
			G21 		;set mm mode
			G53 G0 Z-5	;Raise to safe height in machine coordinates
			G28 G91 X0 Y0	;Traverse to X & Y position for G28
			G28 G91 Z0	;Lower to Z position for G28
			`
			socket.emit('runJob', {
				data: tc_tchng,
				isJob: "no",
				completedMsg: "",
				fileName: ""
			});	

			tc_needstorun = "yes";
			tc_waitingOK = "no";
			tc_status=7;
			break;
		}
		case 7:		//At tool change location
		{
			tc_message = "At tool change location<br><br>If tool is changed, use Set New Tool before returning to original location or a crash may occur!";
			tc_status = 0;
			break;
		}
		
		case 8:		//Return to original position
		{
			if(tc_waitingOK == "yes") {break;}
			console.log("tc_zpos " + tc_zpos + " tc_newz " + tc_newz);
			var targetz = (tc_zpos*1 + tc_newz*1);
			console.log ("target Z " + targetz);
			if((targetz*1) > (0*1)) {						//Check that there is enough headroom for the new tool to return to previous Z
				tc_status = 0;								//Skip the move
				tc_message = "Insufficient Z clearance to return safely to previous position<br>Please use the jog controls to set the required position";				
				console.log("Target Z greater than or equal to zero");
				printLog("Insufficient Z clearance to return to previous position");
				alert ("Insufficient Z clearance to return safely to previous position");
				break;
			}
			tc_message = "Returning to the original position";
			
			var tc_goback =  `
			G21 										;set mm mode
			G90											;absolute coordinates
			G53 G0 Z-5									;Raise to safe height in machine coordinates
			G0 X` + tc_xpos + ` Y` + tc_ypos +`		 	;Traverse to old X & Y position
			G1 Z` + tc_zpos + `	F` +tc_finalzfeed +` 	;Lower to old Z position at slower feed
			`
			socket.emit('runJob', {
				data: tc_goback,
				isJob: "no",
				completedMsg: "",
				fileName: ""
			});	

			tc_needstorun = "yes";
			tc_status = 9;
			break;
		}
		case 9:		// Done
		{
			if (tc_refset=="no"){tc_message = "No reference stored - Please set Reference Tool";}
			else {tc_message="Reference offset (" + tc_offset + ")";}
			tc_waitingOK = "no";
			tc_status=0;
			break;
		}
		case 99:	//Exiting - clean up and go.
		{			
		if(tc_unitsmode != "") {sendGcode(tc_unitsmode);}	// Restore modal settings if they were read
		if(tc_distmode != "") {sendGcode (tc_distmode);}
		tc_message ="Closing";
		clearInterval(window.tc_refinterval);
		tc_status=0;
		break;
		}
		default:
		{
		}
      } 	  
    }
  }, 100)
}
}

window.tc_debug=function(){
console.log("Status" + laststatus.comms.runStatus);
console.log("waiting OK " + tc_waitingOK);
console.log("Stage " + tc_status);
console.log("X " + tc_xpos);
console.log("Y " + tc_ypos);
console.log("Z " + tc_zpos);
console.log("Units  " + tc_unitsmode);
console.log("Distance " + tc_distmode);
console.log("Offset " + tc_offset);
console.log("Reference Offset Stored? " + tc_refset);
console.log("Message " + tc_message);
}

window.tc_crackon = function() {			// Proceed button pressed - clear flag.
tc_waitingOK = "no";
}

window.tc_updateui = function() {			// Update UI elements
	if(tc_waitingOK == "yes") {$("#tc_ok").removeClass("disabled")}else{$("#tc_ok").addClass("disabled")}
	if(tc_refset == "yes") {$("#tc_changetool").removeClass("disabled")}else{$("#tc_changetool").addClass("disabled")}
	$("#tc_log").html(tc_message)
}

window.tc_safetycheck = function() {		// Check that machine is in a fit state to run the macro

	var tc_returnval = 1;										// Flag for machine state 1 = safe to proceed / 0 = not safe
	
	if(laststatus.comms.runStatus != "Idle") {					// Check that machine is idle
		alert ("This macro can't be used whilst a program is running or in alarm (Machine must be Idle)");
		tc_returnval = 0;
	}
	
	if(laststatus.machine.modals.spindlestate != "M5") {		// Check that spindle is stopped
		alert ("Spindle must be stopped to use this macro (Spindle state M5 - currently " + laststatus.machine.modals.spindlestate +")");
		tc_returnval = 0;
	}
	
	return (tc_returnval);
}

window.tc_homecheck = function(){								// Check whether machine thinks it has been homed & give the option to override
	var tc_oktogo = -1;											// Flag: -1 = not verified / 0 = not homed, don't continue / 1 = OK to continue

	if((laststatus.machine.modals.homedRecently == true)||(tc_ignorehomestatus == "yes")) {		// Machine has been homed, or we don't care
		tc_oktogo = 1;
		if (tc_ignorehomestatus != "yes") {
			console.log("Machine reports it has been homed");
		}
		else
		{
			console.log("Machine homed check disabled");
		}

	}
	else	
	{
		Metro.dialog.create({									// Machine not homed, so create a dialog to decide what to do next
			title: "Machine reports that it hasn't been homed!",
			content: "<div>This macro uses machine coordinates. It is strongly recommended that the machine is homed before continuing. Please click 'Go Back' and then home the machine.</div><p><div>Continuing without homing risks the machine crashing unless you know what you are doing.</div>",
			actions: [
			{
				caption: "Go Back",
				cls: "js-dialog-close alert",
				onclick: function(){
					printLog("Machine not homed warning heeded");
					tc_oktogo = 0;
					}
			},
			{
				caption: "Continue Anyway",
				cls: "js-dialog-close",
				onclick: function(){
					printLog("Machine not homed warning ignored");
					console.log("Machine not homed warning ignored");
					tc_oktogo = 1;
					}
			}
			]
		});
	}
					
	window.tc_refinterval = setInterval(function() {		// Set up loop to wait for dialog choices
		if(tc_oktogo !=-1){	
			clearInterval(window.tc_refinterval);
			if (tc_oktogo == 1) tc_initiate();			// Proceed to main program
		}
		
	}, 100)
}