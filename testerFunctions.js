// function to grab the z offset 

socket.on(`status`, function(status){
    console.log(status);
    initialZOffset=status.machine.position.offset.z;
    console.log(`i think the work offset is ${initialZOffset}`)
  })

  var isDone = false;
  var whatIsDoing = 0;


 // function to call in a loop with a pause
  function runSomething(){
  // persitant loop to keep macro running until told to turn off will use for pauses etc
  var runningLoop = setInterval(function(){
    if (isDone == true ) {
        clearInterval(runningLoop)
    }
    else {
        console.log("I'm Still Running");
    }
}, 100) 
};

function mainLogic(state) {
    switch(state) {
        case 1:
            //call function 1 here
            break;

        case 2:
            //call function 2 here
            break;
        default:
            console.log(`oops something went wrong in the switch statement`);
            isDone = true
    }
};