/* client.js — клиентская логика для Watch Together
	Поддерживает: join-room, load-video, player-event (play/pause/seek) и chat-message.
	Пока реализована полноценная поддержка HTML5 <video>. YouTube — только загрузка iframe; для точного управления
	requires подключение YouTube IFrame API (YT.Player).
*/

const socket = io();
let roomId = null;
let player = null; // { type: 'video'|'youtube', el: DOMElement }
let isSeekingProgrammatically = false;
let timeUpdater = null;
let hlsInstance = null; // hls.js instance when playing .m3u8
let youtubePlayer = null; // YT.Player instance
let ytPolling = null; // interval for polling currentTime from YT player
// WebRTC state
let localStream = null;
let pcs = {}; // peerId -> RTCPeerConnection

const $ = id => document.getElementById(id);

// user identity: emoji animal stored in localStorage
const ANIMALS = ['🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐵','🐸','🐔','🦄','🦁','🦝'];
let userEmoji = localStorage.getItem('wt_user_emoji');
if(!userEmoji){ userEmoji = ANIMALS[Math.floor(Math.random()*ANIMALS.length)]; localStorage.setItem('wt_user_emoji', userEmoji); }

function detectYouTube(url){
	return /youtube.com|youtu.be/.test(url);
}

function createVideoElement(url){
	const vid = document.createElement('video');
	vid.controls = true;
	vid.src = url;
	vid.crossOrigin = 'anonymous';
	vid.preload = 'metadata';
	return vid;
}

function extractYouTubeId(url){
	const m = url.match(/(?:v=|youtu.be\/)([A-Za-z0-9_-]{6,})/);
	return m ? m[1] : null;
}

function clearTimeUpdater(){
	if(timeUpdater) clearInterval(timeUpdater);
	timeUpdater = null;
}

function startTimeUpdater(){
	clearTimeUpdater();
	timeUpdater = setInterval(()=>{
		if(player && player.type === 'video'){
			const el = player.el;
			const display = document.getElementById('time');
			if(display) display.textContent = Math.floor(el.currentTime);
		}
	}, 500);
}

function applyIncomingEvent(type, data){
	if(!player) return;
	if(player.type === 'video'){
		const vid = player.el;
		if(type === 'play'){
			isSeekingProgrammatically = true;
			if(typeof data.time === 'number') vid.currentTime = data.time;
			vid.play().catch(()=>{}).finally(()=>{ isSeekingProgrammatically = false; });
		} else if(type === 'pause'){
			isSeekingProgrammatically = true;
			if(typeof data.time === 'number') vid.currentTime = data.time;
			vid.pause();
			isSeekingProgrammatically = false;
		} else if(type === 'seek'){
			isSeekingProgrammatically = true;
			if(typeof data.time === 'number') vid.currentTime = data.time;
			setTimeout(()=> isSeekingProgrammatically = false, 200);
		} else if(type === 'load'){
			loadPlayer(data.url || '');
			setTimeout(()=>{
				if(player && player.type === 'video' && typeof data.time === 'number'){
					player.el.currentTime = data.time;
				}
			}, 250);
		}
	} else if(player.type === 'youtube'){
		if(!youtubePlayer){
			// если плеер ещё не инициализирован, попробуем loadPlayer
			if(type === 'load') loadPlayer(data.url || '');
			return;
		}

		if(type === 'play'){
			isSeekingProgrammatically = true;
			if(typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
			youtubePlayer.playVideo();
			isSeekingProgrammatically = false;
		} else if(type === 'pause'){
			isSeekingProgrammatically = true;
			if(typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
			youtubePlayer.pauseVideo();
			isSeekingProgrammatically = false;
		} else if(type === 'seek'){
			isSeekingProgrammatically = true;
			if(typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
			setTimeout(()=> isSeekingProgrammatically = false, 200);
		} else if(type === 'load'){
			loadPlayer(data.url || '');
			setTimeout(()=>{
				if(youtubePlayer && typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
				if(youtubePlayer && data.playing) youtubePlayer.playVideo();
			}, 300);
		}
	}
}

function loadPlayer(url){
	const container = document.getElementById('playerInner') || document.getElementById('playerContainer');
	if(!container) return;
	container.innerHTML = '';
	clearTimeUpdater();
	// Очищаем предыдущий hls instance
	if(hlsInstance){ try{ hlsInstance.destroy(); }catch(e){} hlsInstance = null; }
	// Очищаем предыдущий youtube polling и плеер
	if(ytPolling){ try{ clearInterval(ytPolling);}catch(e){} ytPolling = null; }
	if(youtubePlayer){ try{ youtubePlayer.destroy(); }catch(e){} youtubePlayer = null; }
	if(!url){ player = null; return; }
	if(detectYouTube(url)){
		// Инициализация через YouTube IFrame API (YT.Player)
		const videoId = extractYouTubeId(url);
	const holder = document.createElement('div');
	holder.id = 'yt-player';
	holder.style.width = '100%';
	holder.style.height = '100%';
	container.appendChild(holder);
		player = { type: 'youtube', el: holder };

		// Удаляем предыдущий youtubePlayer, если есть
		if(youtubePlayer){ try{ youtubePlayer.destroy(); }catch(e){} youtubePlayer = null; }

		// Создаём плеер, когда API готов
		function createYT(){
			youtubePlayer = new YT.Player(holder.id, {
				videoId: videoId,
				playerVars: { 'rel': 0, 'enablejsapi': 1 },
				events: {
					'onStateChange': (e)=>{
						// YT states: 1=playing, 2=paused, 0=ended
						if(e.data === YT.PlayerState.PLAYING){
							if(!isSeekingProgrammatically && roomId){
								socket.emit('player-event', { roomId, type:'play', data:{ time: youtubePlayer.getCurrentTime() } });
							}
						} else if(e.data === YT.PlayerState.PAUSED){
							if(!isSeekingProgrammatically && roomId){
								socket.emit('player-event', { roomId, type:'pause', data:{ time: youtubePlayer.getCurrentTime() } });
							}
						}
					}
				}
			});

			// Периодический опрос времени для отображения и обнаружения seek'ов
			if(ytPolling) clearInterval(ytPolling);
			ytPolling = setInterval(()=>{
				if(youtubePlayer && youtubePlayer.getCurrentTime){
					const t = Math.floor(youtubePlayer.getCurrentTime());
					const display = document.getElementById('time'); if(display) display.textContent = t;
				}
			}, 500);
		}

		if(typeof YT === 'undefined' || typeof YT.Player === 'undefined'){
			// Если API ещё не загрузился, установим глобальную функцию onYouTubeIframeAPIReady
			const prev = window.onYouTubeIframeAPIReady;
			window.onYouTubeIframeAPIReady = function(){ if(prev) try{ prev(); }catch(e){} createYT(); };
		} else {
			createYT();
		}
	} else {
		const vid = createVideoElement(url);
		container.appendChild(vid);
		player = { type: 'video', el: vid };

		// Поддержка HLS: если URL оканчивается на .m3u8 и hls.js доступен
		if(typeof Hls !== 'undefined' && url.match(/\.m3u8(\?|$)/i)){
			if(Hls.isSupported()){
				hlsInstance = new Hls();
				hlsInstance.loadSource(url);
				hlsInstance.attachMedia(vid);
				// hls.js будет ставить источники и управлять воспроизведением
			} else {
				// Нативная поддержка HLS (например Safari)
				vid.src = url;
			}
		} else {
			// Обычный файл/ссылка: оставляем src уже установленный в createVideoElement
		}

		vid.addEventListener('play', () => {
			if(!isSeekingProgrammatically && roomId) socket.emit('player-event', { roomId, type:'play', data:{time: vid.currentTime} });
			const btn = $('playPause'); if(btn) btn.textContent = '⏸️';
		});

		vid.addEventListener('pause', () => {
			if(!isSeekingProgrammatically && roomId) socket.emit('player-event', { roomId, type:'pause', data:{time: vid.currentTime} });
			const btn = $('playPause'); if(btn) btn.textContent = '▶️';
		});

		vid.addEventListener('seeking', () => {
			if(!isSeekingProgrammatically && roomId) socket.emit('player-event', { roomId, type:'seek', data:{time: vid.currentTime} });
		});

		// Для синхронизации: если HLS воспроизводится через hls.js — подписываемся на seek events
		if(hlsInstance){
			// hls.js не предоставляет прямого события seeking на уровне API; полагаемся на HTMLMediaElement
		}

		startTimeUpdater();
	}
}

// UI handlers
document.addEventListener('DOMContentLoaded', ()=>{
	const createBtn = $('createBtn');
	if(createBtn){
		createBtn.addEventListener('click', ()=>{
			const rid = $('roomId').value.trim();
			const url = $('videoUrl').value.trim();
			if(!rid) return alert('Введите roomId');
			roomId = rid;
			socket.emit('join-room', { roomId });
			if(url){ socket.emit('load-video', { roomId, url }); loadPlayer(url); }
			// persist values
			try{ localStorage.setItem('wt_room_id', rid); }catch(e){}
			try{ if(url) localStorage.setItem('wt_video_url', url); }catch(e){}
		});
	}

	const copyInvite = $('copyInvite');
	if(copyInvite){
		copyInvite.addEventListener('click', ()=>{
			const rid = $('roomId').value.trim();
			if(!rid) return alert('Введите roomId');
			const currentUrl = $('videoUrl') ? $('videoUrl').value.trim() : '';
			const invite = `${location.origin}/?room=${encodeURIComponent(rid)}${currentUrl ? `&url=${encodeURIComponent(currentUrl)}` : ''}`;
			navigator.clipboard.writeText(invite).then(()=> alert('Ссылка скопирована')).catch(()=> alert('Не удалось скопировать'));
		});
	}

	// Persist inputs on change/blur
	const ridInput = $('roomId'); if(ridInput){ ridInput.addEventListener('blur', ()=>{ try{ if(ridInput.value.trim()) localStorage.setItem('wt_room_id', ridInput.value.trim()); }catch(e){} }); }
	const urlInput = $('videoUrl'); if(urlInput){ urlInput.addEventListener('blur', ()=>{ try{ if(urlInput.value.trim()) localStorage.setItem('wt_video_url', urlInput.value.trim()); }catch(e){} }); }

	// Локальный файл через input
	const fileInput = $('videoFile');
	if(fileInput){
		fileInput.addEventListener('change', (ev)=>{
			const f = ev.target.files && ev.target.files[0];
			if(!f) return;
			const url = URL.createObjectURL(f);
			// Локальный файл не отправляем в комнату — это локальная операция
			loadPlayer(url);
		});
	}

	// Restore saved room and url if present (unless URL params will handle it below)
	try{
		const savedRid = localStorage.getItem('wt_room_id') || '';
		const savedUrl = localStorage.getItem('wt_video_url') || '';
		if(savedRid){ const roomInput = $('roomId'); if(roomInput) roomInput.value = savedRid; }
		if(savedUrl){ const vInput = $('videoUrl'); if(vInput) vInput.value = savedUrl; }
	}catch(e){}

	// Drag & drop на плеер
	const container = $('playerContainer');
	if(container){
		container.addEventListener('dragover', (e)=>{ e.preventDefault(); container.style.outline = '2px dashed #2b6cb0'; });
		container.addEventListener('dragleave', (e)=>{ e.preventDefault(); container.style.outline = ''; });
		container.addEventListener('drop', (e)=>{
			e.preventDefault(); container.style.outline = '';
			const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
			if(!f) return;
			const url = URL.createObjectURL(f);
			loadPlayer(url);
		});
	}

	// unified play/pause button
	const playPauseBtn = $('playPause');
	if(playPauseBtn){
		playPauseBtn.addEventListener('click', ()=>{
			if(!player) return;
			if(player.type === 'video'){
				const el = player.el;
				if(el.paused){ el.play(); if(roomId) socket.emit('player-event', { roomId, type:'play', data:{time: el.currentTime} }); playPauseBtn.textContent = '⏸️'; }
				else { el.pause(); if(roomId) socket.emit('player-event', { roomId, type:'pause', data:{time: el.currentTime} }); playPauseBtn.textContent = '▶️'; }
			} else if(player.type === 'youtube' && youtubePlayer){
				try{
					const state = youtubePlayer.getPlayerState();
					if(state === YT.PlayerState.PLAYING){ youtubePlayer.pauseVideo(); if(roomId) socket.emit('player-event', { roomId, type:'pause', data:{time: youtubePlayer.getCurrentTime()} }); playPauseBtn.textContent = '▶️'; }
					else { youtubePlayer.playVideo(); if(roomId) socket.emit('player-event', { roomId, type:'play', data:{time: youtubePlayer.getCurrentTime()} }); playPauseBtn.textContent = '⏸️'; }
				}catch(e){ console.warn('YT control error', e); }
			}
		});
	}

	const backBtn = $('seekBack'); if(backBtn) backBtn.addEventListener('click', ()=>{
		if(!player) return;
		if(player.type==='video'){ player.el.currentTime = Math.max(0, player.el.currentTime - 10); if(roomId) socket.emit('player-event', { roomId, type:'seek', data:{time: player.el.currentTime} }); }
		else if(player.type==='youtube' && youtubePlayer){ const t = Math.max(0, youtubePlayer.getCurrentTime() - 10); youtubePlayer.seekTo(t, true); if(roomId) socket.emit('player-event', { roomId, type:'seek', data:{time: t} }); }
	});
	const fwdBtn = $('seekFwd'); if(fwdBtn) fwdBtn.addEventListener('click', ()=>{
		if(!player) return;
		if(player.type==='video'){ player.el.currentTime = player.el.currentTime + 10; if(roomId) socket.emit('player-event', { roomId, type:'seek', data:{time: player.el.currentTime} }); }
		else if(player.type==='youtube' && youtubePlayer){ const t = youtubePlayer.getCurrentTime() + 10; youtubePlayer.seekTo(t, true); if(roomId) socket.emit('player-event', { roomId, type:'seek', data:{time: t} }); }
	});

    // Chat send
    const sendBtn = $('sendMsg');
    if(sendBtn){
        sendBtn.addEventListener('click', ()=>{
            const msgInput = $('chatMsg');
            const msg = msgInput ? msgInput.value.trim() : '';
            if(!msg || !roomId) return;
            socket.emit('chat-message', { roomId, author: userEmoji, message: msg });
            msgInput.value = '';
        });
    }
    // Send on Enter, newline on Shift+Enter
    const chatInput = $('chatMsg');
    if(chatInput){
        chatInput.addEventListener('keydown', (e)=>{
            if(e.key === 'Enter'){
                if(e.shiftKey){
                    // allow newline
                    return;
                }
                e.preventDefault();
                const text = chatInput.value.trim();
                if(!text || !roomId) return;
                socket.emit('chat-message', { roomId, author: userEmoji, message: text });
                chatInput.value = '';
            }
        });
    }

	// Room modal open/close
	const openRoom = $('openRoom');
	const closeRoom = $('closeRoom');
	const roomModal = $('roomModal');
	function showModal(){ if(roomModal){ roomModal.style.display = 'flex'; } }
	function hideModal(){ if(roomModal){ roomModal.style.display = 'none'; } }
	if(openRoom) openRoom.addEventListener('click', showModal);
	if(closeRoom) closeRoom.addEventListener('click', hideModal);
	if(roomModal){ roomModal.addEventListener('click', (e)=>{ if(e.target === roomModal) hideModal(); }); }

	// Reset saved room/url button
	const resetSaved = $('resetSaved');
	if(resetSaved){
		resetSaved.addEventListener('click', ()=>{
			try{ localStorage.removeItem('wt_room_id'); }catch(e){}
			try{ localStorage.removeItem('wt_video_url'); }catch(e){}
			const ridInput2 = $('roomId'); if(ridInput2) ridInput2.value = '';
			const urlInput2 = $('videoUrl'); if(urlInput2) urlInput2.value = '';
			alert('Сохранённые Room ID и ссылка на видео очищены');
		});
	}
	// auto-open modal when roomId is empty on first load
	setTimeout(()=>{ const rid = $('roomId') && $('roomId').value.trim(); if(!rid && openRoom && roomModal) showModal(); }, 100);

	// Авто-вход по параметрам URL: ?room=...&url=...&autocam=1
	try{
		const params = new URLSearchParams(location.search);
		const rid = (params.get('room') || '').trim();
		const url = (params.get('url') || '').trim();
		const autoCam = ['1','true','yes'].includes((params.get('autocam') || '').toLowerCase());
		if(rid){
			// выставим поля формы для наглядности
			const roomInput = $('roomId'); if(roomInput) roomInput.value = rid;
			if(url){ const urlInput = $('videoUrl'); if(urlInput) urlInput.value = url; }

			roomId = rid;
			socket.emit('join-room', { roomId: rid });
			if(url){ socket.emit('load-video', { roomId: rid, url }); loadPlayer(url); }

			// опционально включаем камеру и шлём offer
			if(autoCam && !localStream){
				const btn = $('toggleCam');
				if(btn){ btn.click(); }
			}
		} else {
			// если параметров нет, автоподключение по сохранённым данным
			try{
				const savedRid = localStorage.getItem('wt_room_id') || '';
				const savedUrl = localStorage.getItem('wt_video_url') || '';
				if(savedRid){
					roomId = savedRid; socket.emit('join-room', { roomId: savedRid });
					if(savedUrl){ socket.emit('load-video', { roomId: savedRid, url: savedUrl }); loadPlayer(savedUrl); }
				}
			}catch(e){}
		}
	}catch(e){ /* ignore */ }
});

// --- WebRTC helpers ---
function createPeerConnection(peerId, roomId){
	if(pcs[peerId]) return pcs[peerId];
	const pc = new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302']} ]});
	pcs[peerId] = pc;

	// send ICE candidates to peer via server
	pc.onicecandidate = (e)=>{ if(e.candidate){ socket.emit('webrtc-ice', { roomId, candidate: e.candidate }); } };

	pc.ontrack = (e)=>{
		// attach remote stream
		const remote = $('remoteVideo');
		if(remote){ remote.srcObject = e.streams[0]; }
	};

	// add local tracks
	if(localStream){ localStream.getTracks().forEach(t=> pc.addTrack(t, localStream)); }

	return pc;
}

async function startLocalCamera(){
	if(localStream) return;
	try{
		localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
		const local = $('localVideo'); if(local) local.srcObject = localStream;
	}catch(e){ console.error('getUserMedia failed', e); alert('Не удалось получить доступ к камере/микрофону'); return; }
}

function closeAllPeerConnections(){
	for(const id of Object.keys(pcs)){
		try{ pcs[id].close(); }catch(e){}
		try{ delete pcs[id]; }catch(e){}
	}
	pcs = {};
}

function stopLocalCamera(){
	// stop tracks
	if(localStream){
		try{ localStream.getTracks().forEach(t=>{ try{ t.stop(); }catch(e){} }); }catch(e){}
		localStream = null;
	}
	// clear local preview
	const local = $('localVideo'); if(local) local.srcObject = null;
	// clear remote preview
	const remote = $('remoteVideo'); if(remote) remote.srcObject = null;
	// close all peer connections
	closeAllPeerConnections();
	// remove saved temp pc
	try{ delete pcs['local-temp']; }catch(e){}
}

// Toggle camera button
const toggleCamBtn = $('toggleCam');
if(toggleCamBtn){
	toggleCamBtn.addEventListener('click', async ()=>{
		const rid = roomId;
		if(!localStream){
			// start camera
			await startLocalCamera();
			if(!localStream) return;

			// Создаём offer и ретранслируем его в комнату
			const tempPc = new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302']}]});
			localStream.getTracks().forEach(t=> tempPc.addTrack(t, localStream));

			tempPc.onicecandidate = (e)=>{ if(e.candidate) socket.emit('webrtc-ice', { roomId: rid, candidate: e.candidate }); };
			tempPc.ontrack = (e)=>{ const remote = $('remoteVideo'); if(remote) remote.srcObject = e.streams[0]; };

			const offer = await tempPc.createOffer();
			await tempPc.setLocalDescription(offer);
			socket.emit('webrtc-offer', { roomId: rid, sdp: offer });

			// сохраняем tempPc для последующей обработки answer от других
			pcs['local-temp'] = tempPc;
			toggleCamBtn.textContent = 'Выключить камеру';
		} else {
			// stop camera and close connections
			stopLocalCamera();
			toggleCamBtn.textContent = 'Включить камеру';
		}
	});
}

// Handle incoming signaling
socket.on('webrtc-offer', async ({ from, sdp })=>{
	// получено предложение — создаём PC, устанавливаем remote, создаём answer
	const rid = roomId;
	await startLocalCamera(); // ensure we have local media to send back
	const pc = createPeerConnection(from, rid);
	try{
		await pc.setRemoteDescription(new RTCSessionDescription(sdp));
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		socket.emit('webrtc-answer', { roomId: rid, sdp: answer });
	}catch(e){ console.error('Failed to handle offer', e); }
});

socket.on('webrtc-answer', async ({ from, sdp })=>{
	// find local temp pc and set remote
	const pc = pcs['local-temp'];
	if(pc){ try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }catch(e){ console.error('setRemoteDescription answer failed', e); } }
});

socket.on('webrtc-ice', async ({ from, candidate })=>{
	// add ICE candidate to all pcs
	const cand = candidate;
	for(const id of Object.keys(pcs)){
		try{ await pcs[id].addIceCandidate(new RTCIceCandidate(cand)); }catch(e){}
	}
});

// Floating camera widget interactions: drag, pin, close, remember position/size
function initFloatingCam(){
	const widget = $('floatingCam');
	if(!widget) return;

	// restore position/size
	try{
		const pos = JSON.parse(localStorage.getItem('wt_cam_pos')||'null');
		if(pos){ widget.style.left = pos.left; widget.style.top = pos.top; widget.style.width = pos.width; widget.style.height = pos.height; }
	}catch(e){}

	// ensure widget uses left/top anchoring (not right/bottom) and explicit size for proper CSS resize
	(function ensureAnchors(){
		widget.style.right = 'auto';
		widget.style.bottom = 'auto';
		if(!widget.style.width) widget.style.width = widget.offsetWidth + 'px';
		if(!widget.style.height) widget.style.height = widget.offsetHeight + 'px';
		if(!widget.style.left && !widget.style.top){
			const left = Math.max(8, window.innerWidth - widget.offsetWidth - 18);
			const top = Math.max(8, window.innerHeight - widget.offsetHeight - 18);
			widget.style.left = left + 'px';
			widget.style.top = top + 'px';
		}
	})();

	// add visible resize handles (south, east, south-east)
	function createHandle(className, onDrag){
		const h = document.createElement('div');
		h.className = 'resize-handle ' + className;
		let dragging=false, startX=0, startY=0, startW=0, startH=0;
		h.addEventListener('mousedown', (e)=>{ dragging=true; startX=e.clientX; startY=e.clientY; startW=widget.offsetWidth; startH=widget.offsetHeight; e.preventDefault(); e.stopPropagation(); });
		document.addEventListener('mousemove', (e)=>{ if(!dragging) return; onDrag(e, {startX,startY,startW,startH}); e.preventDefault(); });
		document.addEventListener('mouseup', ()=>{ if(!dragging) return; dragging=false; try{ localStorage.setItem('wt_cam_pos', JSON.stringify({ left: widget.style.left, top: widget.style.top, width: widget.style.width, height: widget.style.height })); }catch(e){} });
		widget.appendChild(h);
		return h;
	}

	createHandle('rh-se', (e, s)=>{
		const dw = e.clientX - s.startX; const dh = e.clientY - s.startY;
		widget.style.width = Math.min(window.innerWidth*0.9, Math.max(220, s.startW + dw)) + 'px';
		widget.style.height = Math.min(window.innerHeight*0.9, Math.max(120, s.startH + dh)) + 'px';
	});
	createHandle('rh-e', (e, s)=>{
		const dw = e.clientX - s.startX;
		widget.style.width = Math.min(window.innerWidth*0.9, Math.max(220, s.startW + dw)) + 'px';
	});
	createHandle('rh-s', (e, s)=>{
		const dh = e.clientY - s.startY;
		widget.style.height = Math.min(window.innerHeight*0.9, Math.max(120, s.startH + dh)) + 'px';
	});

	const header = $('camHeader');
	let dragging=false, startX=0, startY=0, startLeft=0, startTop=0;

	function ensureWithinViewport(){
		const margin = 8;
		const w = widget.offsetWidth; const h = widget.offsetHeight;
		const vw = window.innerWidth; const vh = window.innerHeight;
		let left = widget.offsetLeft; let top = widget.offsetTop;
		left = Math.max(margin, Math.min(left, vw - w - margin));
		top = Math.max(margin, Math.min(top, vh - h - margin));
		widget.style.left = left + 'px';
		widget.style.top = top + 'px';
		widget.style.right = 'auto'; widget.style.bottom = 'auto';
	}

	function onDown(e){
		dragging = true;
		const p = e.touches ? e.touches[0] : e;
		startX = p.clientX; startY = p.clientY;
		startLeft = widget.offsetLeft; startTop = widget.offsetTop;
		if(header) header.style.cursor = 'grabbing';
		e.preventDefault();
	}
	function onMove(e){
		if(!dragging) return;
		const p = e.touches ? e.touches[0] : e;
		const dx = p.clientX - startX; const dy = p.clientY - startY;
		const margin = 8;
		const w = widget.offsetWidth; const h = widget.offsetHeight;
		const vw = window.innerWidth; const vh = window.innerHeight;
		let newLeft = startLeft + dx; let newTop = startTop + dy;
		newLeft = Math.max(margin, Math.min(newLeft, vw - w - margin));
		newTop = Math.max(margin, Math.min(newTop, vh - h - margin));
		widget.style.left = newLeft + 'px'; widget.style.top = newTop + 'px';
		widget.style.right = 'auto'; widget.style.bottom = 'auto';
		e.preventDefault();
	}
	function onUp(e){
		if(!dragging) return;
		dragging=false; if(header) header.style.cursor='grab';
		try{ localStorage.setItem('wt_cam_pos', JSON.stringify({ left: widget.style.left, top: widget.style.top, width: widget.style.width, height: widget.style.height })); }catch(e){}
	}
	// Allow dragging from header and from the whole widget (in case header is off-screen)
	if(header){ header.addEventListener('mousedown', onDown); header.addEventListener('touchstart', onDown, {passive:false}); }
	widget.addEventListener('mousedown', onDown);
	widget.addEventListener('touchstart', onDown, {passive:false});
	document.addEventListener('mousemove', onMove);
	document.addEventListener('touchmove', onMove, {passive:false});
	document.addEventListener('mouseup', onUp);
	document.addEventListener('touchend', onUp);

	// Keep widget inside viewport on load and on resize
	ensureWithinViewport();
	window.addEventListener('resize', ensureWithinViewport);

	// Persist size changes when user resizes the widget
	try{
		const ro = new ResizeObserver(()=>{
			try{ localStorage.setItem('wt_cam_pos', JSON.stringify({ left: widget.style.left, top: widget.style.top, width: widget.style.width, height: widget.style.height })); }catch(e){}
			ensureWithinViewport();
		});
		ro.observe(widget);
	}catch(e){}

	// hide/show self-preview
	const toggleSelfBtn = $('toggleSelf');
	if(toggleSelfBtn){
		toggleSelfBtn.addEventListener('click', ()=>{
			const local = $('localVideo');
			if(!local) return;
			const hidden = local.classList.toggle('hide');
			if(hidden){ local.style.display = 'none'; } else { local.style.display = ''; }
			try{ localStorage.setItem('wt_cam_self_hidden', hidden ? '1':'0'); }catch(e){}
		});
		// restore
		try{ if(localStorage.getItem('wt_cam_self_hidden') === '1'){ const local = $('localVideo'); if(local){ local.style.display = 'none'; local.classList.add('hide'); } } }catch(e){}
	}

	// enlarge/restore behavior
	const enlarge = $('enlargeCam');
	if(enlarge){
		enlarge.addEventListener('click', ()=>{
			widget.classList.toggle('max');
			enlarge.textContent = widget.classList.contains('max') ? '⤡' : '⤢';
			// save state
			try{ localStorage.setItem('wt_cam_max', widget.classList.contains('max') ? '1':'0'); }catch(e){}
		});
		// restore previous enlarge state
		try{ if(localStorage.getItem('wt_cam_max') === '1'){ widget.classList.add('max'); enlarge.textContent = '⤡'; } }catch(e){}
	}

	// pin behavior
	const pin = $('pinCam'); if(pin){ pin.addEventListener('click', ()=>{ widget.classList.toggle('pin'); pin.textContent = widget.classList.contains('pin') ? '📌' : '📌'; }); }
	// close behavior
	const close = $('closeCam'); if(close){ close.addEventListener('click', ()=>{ stopLocalCamera(); widget.classList.add('hide'); }); }

	// ensure widget stays visible during fullscreen: when document enters fullscreen, append widget to fullscreenElement
	document.addEventListener('fullscreenchange', ()=>{
		const fs = document.fullscreenElement;
		if(fs){ try{ fs.appendChild(widget); }catch(e){} } else {
			// restore to body
			try{ document.body.appendChild(widget); }catch(e){}
		}
	});
}

// init floating cam behavior after DOM ready
document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(initFloatingCam, 100); });

// Picture-in-Picture button handling
document.addEventListener('DOMContentLoaded', ()=>{
	const pipBtn = $('pipBtn');
	const local = $('localVideo');
	function updatePipBtn(on){
		if(!pipBtn) return;
		pipBtn.textContent = on ? '🗖' : '🗔';
		pipBtn.title = on ? 'Выйти из PiP' : 'Вывести в PiP';
	}

	if(pipBtn){
		pipBtn.addEventListener('click', async ()=>{
			try{
				// ensure local video exists
				const video = $('localVideo');
				if(!video) return alert('Локальное видео недоступно');
				if(document.pictureInPictureElement){
					await document.exitPictureInPicture();
				} else {
					if(video.readyState === 0){ await video.play().catch(()=>{}); }
					if(video !== document.pictureInPictureElement){ await video.requestPictureInPicture(); }
				}
			}catch(e){ console.warn('PiP failed', e); alert('Picture-in-Picture недоступен в этом браузере'); }
		});
	}

	// update button based on PiP events
	if(local){
		local.addEventListener('enterpictureinpicture', ()=> updatePipBtn(true));
		local.addEventListener('leavepictureinpicture', ()=> updatePipBtn(false));
	}

	// initialize state
	setTimeout(()=> updatePipBtn(!!document.pictureInPictureElement), 200);

	// Auto PiP preference: read/save checkbox state
	const autoPipCheckbox = document.getElementById('autoPip');
	try{
		const saved = localStorage.getItem('wt_auto_pip');
		if(autoPipCheckbox && saved !== null){ autoPipCheckbox.checked = saved === '1'; }
	}catch(e){}
	if(autoPipCheckbox){ autoPipCheckbox.addEventListener('change', ()=>{ try{ localStorage.setItem('wt_auto_pip', autoPipCheckbox.checked ? '1' : '0'); }catch(e){} }); }

	// When entering fullscreen on the player, propose PiP via a small prompt
	let pipPrompt = null;
	function showPipPrompt(){
		if(pipPrompt) return;
		pipPrompt = document.createElement('div');
		pipPrompt.style.position = 'fixed';
		pipPrompt.style.left = '50%';
		pipPrompt.style.transform = 'translateX(-50%)';
		pipPrompt.style.bottom = '24px';
		pipPrompt.style.padding = '10px 14px';
		pipPrompt.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))';
		pipPrompt.style.color = 'white';
		pipPrompt.style.borderRadius = '10px';
		pipPrompt.style.zIndex = 2147483646;
		pipPrompt.style.display = 'flex';
		pipPrompt.style.flexDirection = 'column';
		pipPrompt.style.gap = '8px';
		pipPrompt.style.alignItems = 'center';

		const txt = document.createElement('div'); txt.textContent = 'Хотите вынести камеру в PiP?'; txt.style.marginBottom = '6px';

		const controlsRow = document.createElement('div'); controlsRow.style.display = 'flex'; controlsRow.style.gap = '8px';

		const enableBtn = document.createElement('button'); enableBtn.textContent = 'Включить сейчас'; enableBtn.className = 'primary';
		const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Отмена'; cancelBtn.className = 'secondary';

		const rememberLabel = document.createElement('label'); rememberLabel.style.display = 'flex'; rememberLabel.style.alignItems = 'center'; rememberLabel.style.gap = '6px'; rememberLabel.style.color = '#d7eefc';
		const rememberChk = document.createElement('input'); rememberChk.type = 'checkbox'; rememberChk.id = 'pipRemember';
		try{ const saved = localStorage.getItem('wt_auto_pip'); if(saved && saved === '1') rememberChk.checked = true; }catch(e){}
		rememberLabel.appendChild(rememberChk); rememberLabel.appendChild(document.createTextNode('Всегда включать PiP при fullscreen'));

		enableBtn.onclick = async ()=>{
			try{
				const video = $('localVideo');
				if(!video) return;
				if(video.readyState === 0) await video.play().catch(()=>{});
				if(!document.pictureInPictureElement) await video.requestPictureInPicture();
				// If user asked to remember, save preference
				if(rememberChk.checked){ try{ localStorage.setItem('wt_auto_pip','1'); if(autoPipCheckbox) autoPipCheckbox.checked = true; }catch(e){} }
			}catch(e){ console.warn('PiP failed', e); alert('Не удалось включить PiP автоматически: ' + (e && e.message ? e.message : 'ошибка')); }
			removePipPrompt();
		};

		cancelBtn.onclick = ()=>{ removePipPrompt(); };

		controlsRow.appendChild(enableBtn); controlsRow.appendChild(cancelBtn);
		pipPrompt.appendChild(txt);
		pipPrompt.appendChild(rememberLabel);
		pipPrompt.appendChild(controlsRow);
		document.body.appendChild(pipPrompt);
		// auto remove after 12s
		setTimeout(()=> removePipPrompt(), 12000);
	}
	function removePipPrompt(){ if(pipPrompt){ try{ pipPrompt.remove(); }catch(e){} pipPrompt = null; } }

	document.addEventListener('fullscreenchange', ()=>{
		const fs = document.fullscreenElement;
		if(!fs) return removePipPrompt();
		// if fullscreen element contains playerInner or is a video/iframe inside player
		const playerInner = document.getElementById('playerInner');
		if(playerInner && (fs === playerInner || fs.contains(playerInner) || playerInner.contains(fs))){
			// If user set Auto PiP, try to enter PiP automatically when possible
			let auto = false;
			try{ auto = !!localStorage.getItem('wt_auto_pip') && localStorage.getItem('wt_auto_pip') === '1'; }catch(e){}

			if(auto && document.pictureInPictureEnabled && !document.pictureInPictureElement){
				// try to enter PiP using local video if available
				const video = document.getElementById('localVideo');
				if(video){
					(async ()=>{
						try{
							if(video.readyState === 0) await video.play().catch(()=>{});
							if(!document.pictureInPictureElement) await video.requestPictureInPicture();
						}catch(e){
							// fallback to prompt if PiP failed
							console.warn('Auto PiP failed', e);
							if(document.pictureInPictureEnabled && !document.pictureInPictureElement) showPipPrompt();
						}
					})();
				} else {
					// no local video yet — show prompt so user can enable camera
					if(document.pictureInPictureEnabled && !document.pictureInPictureElement) showPipPrompt();
				}
			} else {
				// propose PiP (existing behavior)
				if(document.pictureInPictureEnabled && !document.pictureInPictureElement) showPipPrompt();
			}
		}
	});
	// clean up prompt on navigation/unload
	window.addEventListener('beforeunload', removePipPrompt);
});

// Socket handlers
socket.on('room-state', ({ state })=>{
	if(!state) return;
	if(state.url){ loadPlayer(state.url); setTimeout(()=>{
		if(player && player.type==='video'){
			isSeekingProgrammatically = true;
			if(typeof state.time === 'number') player.el.currentTime = state.time;
			if(state.playing) player.el.play().catch(()=>{});
			isSeekingProgrammatically = false;
		}
	}, 300); }
});

socket.on('player-event', ({ type, data })=>{ applyIncomingEvent(type, data); });

// Chat receive
socket.on('chat-message', ({ author, message, time })=>{
    const box = $('chatBox');
    if(!box) return;
    const el = document.createElement('div');
    el.className = 'message';
    const dt = new Date(time || Date.now());
    const hh = String(dt.getHours()).padStart(2,'0');
    const mm = String(dt.getMinutes()).padStart(2,'0');
    el.textContent = `[${hh}:${mm}] ${author}: ${message}`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
});

