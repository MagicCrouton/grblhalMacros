; GRBLHAL-compatible macro for probing existing and new tools with two-step touch-off

; Set the probing feed rates (adjust as needed these don't need to be here in this macro these can be adjusted in firmware)
$110=1000  ; Fast probing speed
$111=100    ; Slow touch-off speed
$112=20     ; Example maximum travel limit in mm

; Move to tool change location (adjust coordinates)
G0 X100 Y100 Z10 ; Example coordinates 

; Move to the predefined tool setter location (adjust coordinates here and on line 56)
G0 X50 Y50 Z10 ; Example coordinates for the tool setter location

; First step of probing current tool - Fast initial probe
G38.2 Z-10 F$110 ; Probe towards negative Z direction at the fast speed

; Check for successful probing
IF [G38.2 RESULT]
  ; Calculate the travel distance
  $13=[G38.2 Z]
  
  ; Check if the travel distance exceeds the maximum limit
  IF $13<$112
    ; Probing successful, back off 5mm
    G91 ; Set to incremental mode
    G0 Z5 ; Move up 5mm
    G90 ; Set back to absolute mode
    
    ; Second step of probing - Slow touch-off
    G38.2 Z-5 F$111 ; Probe towards negative Z direction at the slow speed
    
    ; Check for successful touch-off
    IF [G38.2 RESULT]
      ; Touch-off successful, set the existing tool offset
      G10 L20 P1 Z[G38.2 Z]
      
      ; Move the tool away from the tool setter
      G0 Z10
    ELSE
      ; Touch-off unsuccessful, handle error or take appropriate action
      ; (e.g., retract, stop, or display an error message)
      M0 ; Pause for manual intervention or error handling
    ENDIF
  ELSE
    ; Maximum travel limit exceeded, handle error or take appropriate action
    ; (e.g., retract, stop, or display an error message)
    M0 ; Pause for manual intervention or error handling
  ENDIF
ELSE
  ; Probing unsuccessful for the existing tool, handle error or take appropriate action
  ; (e.g., retract, stop, or display an error message)
  M0 ; Pause for manual intervention or error handling
ENDIF

; Moves Back to Tool Changing Location
G0 X50 Y50 Z10 ; Example coordinates for the tool setter location

; Ask for manual tool change
M0 ; Pause for manual tool change

; First step of probing for the new tool - Fast initial probe
G38.2 Z-10 F$110 ; Probe towards negative Z direction at the fast speed

; Check for successful probing
IF [G38.2 RESULT]
  ; Calculate the travel distance
  $13=[G38.2 Z]
  
  ; Check if the travel distance exceeds the maximum limit
  IF $13<$112
    ; Probing successful, back off 5mm
    G91 ; Set to incremental mode
    G0 Z5 ; Move up 5mm
    G90 ; Set back to absolute mode
    
    ; Second step of probing - Slow touch-off
    G38.2 Z-5 F$111 ; Probe towards negative Z direction at the slow speed
    
    ; Check for successful touch-off
    IF [G38.2 RESULT]
      ; Touch-off successful, set the new tool offset
      G10 L20 P1 Z[G38.2 Z]
      
      ; Move the tool away from the tool setter
      G0 Z10
    ELSE
      ; Touch-off unsuccessful, handle error or take appropriate action
      ; (e.g., retract, stop, or display an error message)
      M0 ; Pause for manual intervention or error handling
    ENDIF
  ELSE
    ; Maximum travel limit exceeded, handle error or take appropriate action
    ; (e.g., retract, stop, or display an error message)
    M0 ; Pause for manual intervention or error handling
  ENDIF
ELSE
  ; Probing unsuccessful for the new tool, handle error or take appropriate action
  ; (e.g., retract, stop, or display an error message)
  M0 ; Pause for manual intervention or error handling
ENDIF
