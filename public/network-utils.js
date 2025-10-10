// Network utilities for mobile device access
function detectLocalIP() {
    return new Promise((resolve, reject) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (ice) => {
            if (!ice.candidate) return;

            const ipMatch = ice.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (ipMatch) {
                const localIP = ipMatch[1];
                console.log('Detected local IP:', localIP);
                resolve(localIP);
                pc.close();
            }
        };

        pc.onicecandidateerror = (error) => {
            console.warn('ICE candidate error:', error);
        };

        pc.createDataChannel('');
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(error => {
                console.error('Error detecting local IP:', error);
                reject(error);
            });

        // Timeout after 5 seconds
        setTimeout(() => {
            pc.close();
            reject(new Error('Timeout detecting local IP'));
        }, 5000);
    });
}

// Update mobile warning with detected IP
async function updateMobileWarning() {
    const mobileWarning = document.getElementById('mobileWarning');
    if (!mobileWarning) return;

    try {
        const localIP = await detectLocalIP();
        const ipElement = document.createElement('p');
        ipElement.innerHTML = `<strong>Попробуйте:</strong> <code>http://${localIP}:3000</code>`;
        ipElement.style.margin = '10px 0';
        ipElement.style.padding = '8px';
        ipElement.style.background = 'var(--bg-tertiary)';
        ipElement.style.borderRadius = '4px';

        const existingIPElement = mobileWarning.querySelector('.detected-ip');
        if (existingIPElement) {
            existingIPElement.remove();
        }

        ipElement.className = 'detected-ip';
        mobileWarning.querySelector('.warning-content').insertBefore(
            ipElement,
            mobileWarning.querySelector('button')
        );
    } catch (error) {
        console.log('Could not detect local IP, showing general instructions');
    }
}

// Auto-detect IP when mobile warning is shown
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && window.location.hostname === 'localhost') {
            setTimeout(updateMobileWarning, 1000);
        }
    });
} else {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && window.location.hostname === 'localhost') {
        setTimeout(updateMobileWarning, 1000);
    }
}
