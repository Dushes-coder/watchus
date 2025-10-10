// Toggle camera button - show only when connected to room
const toggleCamBtn = $('toggleCam');
let cameraBtnVisible = false;

function updateCameraButtonVisibility() {
    const isConnected = roomId && window.socket && window.socket.connected;
    if (isConnected && !cameraBtnVisible) {
        if (toggleCamBtn) {
            toggleCamBtn.style.display = 'flex';
            cameraBtnVisible = true;
            console.log('Camera button shown - connected to room');
        }
    } else if (!isConnected && cameraBtnVisible) {
        if (toggleCamBtn) {
            toggleCamBtn.style.display = 'none';
            cameraBtnVisible = false;
            console.log('Camera button hidden - disconnected from room');
        }
    }
}

if (toggleCamBtn) {
    // Initially hide the button
    toggleCamBtn.style.display = 'none';

    toggleCamBtn.addEventListener('click', async () => {
        if (!localStream) {
            // start camera
            await startLocalCamera();
            if (!localStream) return;

            // If user is in a room, create WebRTC offer for video calling
            if (roomId && window.socket) {
                // Создаём offer and ретранслируем его в комнату
                const tempPc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
                localStream.getTracks().forEach(t => tempPc.addTrack(t, localStream));

                tempPc.onicecandidate = (e) => { if (e.candidate) window.socket.emit('webrtc-ice', { roomId, candidate: e.candidate }); };
                tempPc.ontrack = (e) => { const remote = $('remoteVideo'); if (remote) remote.srcObject = e.streams[0]; };

                const offer = await tempPc.createOffer();
                await tempPc.setLocalDescription(offer);
                window.socket.emit('webrtc-offer', { roomId, sdp: offer });

                // сохраняем tempPc для последующей обработки answer от других
                pcs['local-temp'] = tempPc;
            }

            toggleCamBtn.textContent = '📷';
        } else {
            // stop camera and close connections
            stopLocalCamera();
            toggleCamBtn.textContent = '📷';
        }
    });
}

// Update camera button visibility when room connection changes
function checkRoomConnection() {
    updateCameraButtonVisibility();
}

// Call initially and set up periodic check
checkRoomConnection();
setInterval(checkRoomConnection, 1000); // Check every second
