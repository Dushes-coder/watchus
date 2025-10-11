/* client.js — клиентская логика для Watch Together
	Поддерживает: join-room, load-video, player-event (play/pause/seek) и chat-message.
	Пока реализована полноценная поддержка HTML5 <video>. YouTube — только загрузка iframe; для точного управления
	requires подключение YouTube IFrame API (YT.Player).
*/

// Helper function for getting elements by ID
function $(id) { return document.getElementById(id); }

// Generate random emoji for user identification
const userEmojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
const userEmoji = userEmojis[Math.floor(Math.random() * userEmojis.length)];

// Global variables
let timeUpdater = null;
let player = null;
let hlsInstance = null;
let ytPolling = null;
let youtubePlayer = null;
let localStream = null;
let pcs = {};

function initializeSocket() {
    // Определяем базовый URL для сокета
    let socketUrl;
    if (window.location.protocol === 'file:' ||
        window.location.protocol === 'chrome-extension:') {
        socketUrl = 'http://localhost:3000';
    } else {
        // Для HTTP/HTTPS используем текущий хост
        socketUrl = window.location.origin;
    }

    const socketOptions = {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling']
    };

    console.log('Connecting to socket server at:', socketUrl);
    window.socket = io(socketUrl, socketOptions);

    // Обработчики событий сокета
    window.socket.on('connect', () => {
        console.log('Connected to server with ID:', window.socket.id);
        updateConnectionStatus(true);
        // Удаляем сообщение об ошибке, если оно есть
    });

    window.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        updateConnectionStatus(false);
        // Очищаем список участников при отключении
        window.roomPlayers = [];
        if (typeof updateParticipantsList === 'function') {
            updateParticipantsList();
        }
        if (reason === 'io server disconnect') {
            // Сервер принудительно отключил сокет, переподключаемся
            window.socket.connect();
        }
    });

    window.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        showError('Ошибка подключения к серверу. Пытаемся переподключиться...');
    });
    window.socket.on('ping', (data) => {
        window.socket.emit('pong', { time: data.time });
    });

    // WebRTC event handlers
    window.socket.on('webrtc-offer', async ({ from, sdp }) => {
        // получено предложение — создаём PC, устанавливаем remote, создаём answer
        const rid = roomId;
        await startLocalCamera(); // ensure we have local media to send back
        const pc = createPeerConnection(from, rid);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            window.socket.emit('webrtc-answer', { roomId: rid, sdp: answer });
        } catch (e) { console.error('Failed to handle offer', e); }
    });

    window.socket.on('webrtc-answer', async ({ from, sdp }) => {
        // find local temp pc and set remote
        const pc = pcs['local-temp'];
        if (pc) { try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); } catch (e) { console.error('setRemoteDescription answer failed', e); } }
    });

    window.socket.on('webrtc-ice', async ({ from, candidate }) => {
        // add ICE candidate to all pcs
        const cand = candidate;
        for (const id of Object.keys(pcs)) {
            try { await pcs[id].addIceCandidate(new RTCIceCandidate(cand)); } catch (e) { }
        }
    });

    // Socket handlers
    window.socket.on('room-state', ({ state }) => {
        if (!state) return;
        if (state.url) {
            loadPlayer(state.url); setTimeout(() => {
                if (player && player.type === 'video') {
                    isSeekingProgrammatically = true;
                    if (typeof state.time === 'number') player.el.currentTime = state.time;
                    if (state.playing) player.el.play().catch(() => { });
                    isSeekingProgrammatically = false;
                }
            }, 300);
        }
    });

    window.socket.on('player-event', ({ type, data }) => { applyIncomingEvent(type, data); });

    // Рендер сообщений чата в соответствии с новой визуальной системой
    window.socket.on('chat-message', ({ author, message, time }) => {
        const box = $('chatBox');
        if (!box) return;
        const displayTime = new Date(time || Date.now());
        const hh = String(displayTime.getHours()).padStart(2, '0');
        const mm = String(displayTime.getMinutes()).padStart(2, '0');
        const isSelf = author === userEmoji;

        const wrapper = document.createElement('div');
        wrapper.className = `chat-message ${isSelf ? 'self' : 'peer'}`.trim();

        const avatar = document.createElement('div');
        avatar.className = 'chat-message-avatar';
        avatar.textContent = author;

        const content = document.createElement('div');
        content.className = 'chat-message-content';

        const meta = document.createElement('div');
        meta.className = 'chat-message-meta';

        const authorEl = document.createElement('span');
        authorEl.className = 'chat-message-author';
        authorEl.textContent = isSelf ? 'Вы' : author;

        const timeEl = document.createElement('span');
        timeEl.className = 'chat-message-time';
        timeEl.textContent = `${hh}:${mm}`;

        meta.appendChild(authorEl);
        meta.appendChild(document.createTextNode(' • '));
        meta.appendChild(timeEl);

        const textEl = document.createElement('div');
        textEl.className = 'chat-message-text';
        textEl.textContent = message;

        content.appendChild(meta);
        content.appendChild(textEl);

        wrapper.appendChild(avatar);
        wrapper.appendChild(content);

        box.appendChild(wrapper);
        box.scrollTop = box.scrollHeight;
    });

    // Синхронизация состояния игры для всех участников комнаты
    // Обработчик game-state перенесен в games.js

    // Обработчик списка участников комнаты
    window.socket.on('room-players', (players) => {
        console.log('Room players updated:', players);
        window.roomPlayers = players || [];
        updateParticipantsList();
    });

    // Уведомление о начале новой игры
    window.socket.on('game-started', ({ gameType, players, starter }) => {
        console.log('Game started:', gameType, 'by', starter);

        // Показываем уведомление
        showNotification(`${starter} начал игру: ${gameType === 'tictactoe' ? 'Крестики-нолики' : gameType === 'chess' ? 'Шахматы' : 'Карты'}`, 'info');

        // Если мы не инициатор, ожидаем состояния игры
        if (starter !== userEmoji) {
            // Ожидаем синхронизации состояния
        }
    });

    // Уведомление о завершении игры
    window.socket.on('game-ended', ({ winner, gameType }) => {
        const gameName = gameType === 'tictactoe' ? 'Крестики-нолики' : gameType === 'chess' ? 'Шахматы' : 'Карты';
        if (winner === 'draw') {
            showNotification(`Игра "${gameName}" завершилась ничьей!`, 'info');
        } else {
            showNotification(`Игра "${gameName}" завершена! Победитель: ${winner}`, 'success');
        }
    });

    // Обработчик приглашений в игры - удален, оставлен только в games.js

}
function showError(message) {
    // Удаляем старое сообщение, если оно есть
    let errorDiv = document.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        document.body.prepend(errorDiv);
    }
    errorDiv.textContent = message;
}

// Функция для отображения уведомлений
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Функция для рендеринга карточной игры
function renderCardsGame() {
    const container = document.getElementById('gameContainer');
    if (!container || !window.gameState) return;

    let html = '';

    // Информация о сопернике
    if (window.currentOpponent) {
        html += '<div class="game-opponent-info">';
        html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
        html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
        html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
        html += '</div>';
    }

    html += '<div class="game-status">Карточная игра - Дурак</div>';

    // Отображение карт игрока
    if (window.gameState.player1Hand && window.gameState.player1Hand.length > 0) {
        html += '<div class="cards-section">';
        html += '<h4>Ваши карты:</h4>';
        html += '<div class="player-cards">';
        window.gameState.player1Hand.forEach((card, index) => {
            html += `<div class="card" onclick="playCard('${card.suit}', '${card.value}', ${index})">${getCardSymbol(card)}</div>`;
        });
        html += '</div>';
        html += '</div>';
    }

    // Отображение карт на столе
    if (window.gameState.tableCards && window.gameState.tableCards.length > 0) {
        html += '<div class="cards-section">';
        html += '<h4>Карты на столе:</h4>';
        html += '<div class="table-cards">';
        window.gameState.tableCards.forEach(card => {
            html += `<div class="card">${getCardSymbol(card)}</div>`;
        });
        html += '</div>';
        html += '</div>';
    }

    // Козырь
    if (window.gameState.trumpSuit) {
        html += '<div class="trump-info">';
        html += '<h4>Козырь:</h4>';
        html += `<div class="card trump-card">${getSuitSymbol(window.gameState.trumpSuit)}</div>`;
        html += '</div>';
    }

    html += '<div class="game-controls">';
    html += '<button onclick="closeGame()">Закрыть игру</button>';
    html += '<button onclick="drawCards()">Взять карты</button>';
    html += '</div>';

    container.innerHTML = html;
}

function playCard(suit, value, index) {
    if (!window.socket || !window.roomId) return;

    window.socket.emit('game-move', {
        roomId: window.roomId,
        gameType: 'cards',
        move: {
            action: 'play',
            card: { suit, value },
            playerIndex: index
        }
    });
}

function drawCards() {
    if (!window.socket || !window.roomId) return;

    window.socket.emit('game-move', {
        roomId: window.roomId,
        gameType: 'cards',
        move: {
            action: 'draw'
        }
    });
}

// Функция для обновления статуса подключения
function updateConnectionStatus(connected) {
    // Для обратной совместимости оставляем старый код, но он не будет работать если элемент удален
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    statusEl.classList.remove('connected', 'disconnected');
    if (connected) {
        statusEl.classList.add('connected');
        statusEl.querySelector('.connection-text').textContent = 'Подключено';
    } else {
        statusEl.classList.add('disconnected');
        statusEl.querySelector('.connection-text').textContent = 'Нет соединения';
    }
}

// Initialize socket immediately when script loads
if (document.readyState === 'loading') {
    // DOM not ready yet, wait for it
    document.addEventListener('DOMContentLoaded', () => {
        initializeSocket();
    });
} else {
    // DOM already ready, initialize immediately
    initializeSocket();
}


function createVideoElement(url) {
	const vid = document.createElement('video');
	vid.controls = true;
	vid.src = url;
	vid.crossOrigin = 'anonymous';
	vid.preload = 'metadata';
	return vid;
}

function extractYouTubeId(url) {
	const m = url.match(/(?:v=|youtu.be\/)([A-Za-z0-9_-]{6,})/);
	return m ? m[1] : null;
}

function detectYouTube(url) {
	return url.includes('youtube.com') || url.includes('youtu.be');
}

function clearTimeUpdater() {
	if (timeUpdater) clearInterval(timeUpdater);
	timeUpdater = null;
}

function startTimeUpdater() {
	clearTimeUpdater();
	timeUpdater = setInterval(() => {
		if (player && player.type === 'video') {
			const el = player.el;
			const display = document.getElementById('time');
			if (display) display.textContent = Math.floor(el.currentTime);
		}
	}, 500);
}

function applyIncomingEvent(type, data) {
	if (!player) return;
	if (player.type === 'video') {
		const vid = player.el;
		if (type === 'play') {
			isSeekingProgrammatically = true;
			if (typeof data.time === 'number') vid.currentTime = data.time;
			vid.play().catch(() => { }).finally(() => { isSeekingProgrammatically = false; });
		} else if (type === 'pause') {
			isSeekingProgrammatically = true;
			if (typeof data.time === 'number') vid.currentTime = data.time;
			vid.pause();
			isSeekingProgrammatically = false;
		} else if (type === 'seek') {
			isSeekingProgrammatically = true;
			if (typeof data.time === 'number') vid.currentTime = data.time;
			setTimeout(() => isSeekingProgrammatically = false, 200);
		} else if (type === 'load') {
			loadPlayer(data.url || '');
			setTimeout(() => {
				if (player && player.type === 'video' && typeof data.time === 'number') {
					player.el.currentTime = data.time;
				}
			}, 250);
		}
	} else if (player.type === 'youtube') {
		if (!youtubePlayer) {
			// если плеер ещё не инициализирован, попробуем loadPlayer
			if (type === 'load') loadPlayer(data.url || '');
			return;
		}

		if (type === 'play') {
			isSeekingProgrammatically = true;
			if (typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
			youtubePlayer.playVideo();
			isSeekingProgrammatically = false;
		} else if (type === 'pause') {
			isSeekingProgrammatically = true;
			if (typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
			youtubePlayer.pauseVideo();
			isSeekingProgrammatically = false;
		} else if (type === 'seek') {
			isSeekingProgrammatically = true;
			if (typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
			setTimeout(() => isSeekingProgrammatically = false, 200);
		} else if (type === 'load') {
			loadPlayer(data.url || '');
			setTimeout(() => {
				if (youtubePlayer && typeof data.time === 'number') youtubePlayer.seekTo(data.time, true);
				if (youtubePlayer && data.playing) youtubePlayer.playVideo();
			}, 300);
		}
	}
}

function loadPlayer(url) {
	const container = document.getElementById('playerInner') || document.getElementById('playerContainer');
	if (!container) return;
	container.innerHTML = '';
	clearTimeUpdater();
	// Очищаем предыдущий hls instance
	if (hlsInstance) { try { hlsInstance.destroy(); } catch (e) { } hlsInstance = null; }
	// Очищаем предыдущий youtube polling и плеер
	if (ytPolling) { try { clearInterval(ytPolling); } catch (e) { } ytPolling = null; }
	if (youtubePlayer) { try { youtubePlayer.destroy(); } catch (e) { } youtubePlayer = null; }
	if (!url) { player = null; return; }

	// Инициализируем иконки play/pause
	const playIcon = $('playIcon');
	const pauseIcon = $('pauseIcon');
	if (playIcon) playIcon.style.display = 'block';
	if (pauseIcon) pauseIcon.style.display = 'none';
	if (detectYouTube(url)) {
		// Инициализация через YouTube IFrame API (YT.Player)
		const videoId = extractYouTubeId(url);
		const holder = document.createElement('div');
		holder.id = 'yt-player';
		holder.style.width = '100%';
		holder.style.height = '100%';
		container.appendChild(holder);
		player = { type: 'youtube', el: holder };

		// Удаляем предыдущий youtubePlayer, если есть
		if (youtubePlayer) { try { youtubePlayer.destroy(); } catch (e) { } youtubePlayer = null; }

		// Создаём плеер, когда API готов
		function createYT() {
			youtubePlayer = new YT.Player(holder.id, {
				videoId: videoId,
				playerVars: { 'rel': 0, 'enablejsapi': 1 },
				events: {
					'onStateChange': (e) => {
						// YT states: 1=playing, 2=paused, 0=ended
						if (e.data === YT.PlayerState.PLAYING) {
							if (!isSeekingProgrammatically && roomId) {
								socket.emit('player-event', { roomId, type: 'play', data: { time: youtubePlayer.getCurrentTime() } });
							}
							// Переключаем иконки
							const playIcon = $('playIcon');
							const pauseIcon = $('pauseIcon');
							if (playIcon) playIcon.style.display = 'none';
							if (pauseIcon) pauseIcon.style.display = 'block';
						} else if (e.data === YT.PlayerState.PAUSED) {
							if (!isSeekingProgrammatically && roomId) {
								socket.emit('player-event', { roomId, type: 'pause', data: { time: youtubePlayer.getCurrentTime() } });
							}
							// Переключаем иконки
							const playIcon = $('playIcon');
							const pauseIcon = $('pauseIcon');
							if (playIcon) playIcon.style.display = 'block';
							if (pauseIcon) pauseIcon.style.display = 'none';
						}
					}
				}
			});

			// Периодический опрос времени для отображения и обнаружения seek'ов
			if (ytPolling) clearInterval(ytPolling);
			ytPolling = setInterval(() => {
				if (youtubePlayer && youtubePlayer.getCurrentTime) {
					const t = Math.floor(youtubePlayer.getCurrentTime());
					const display = document.getElementById('time'); if (display) display.textContent = t;
				}
			}, 500);
		}

		if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
			// Если API ещё не загрузился, установим глобальную функцию onYouTubeIframeAPIReady
			const prev = window.onYouTubeIframeAPIReady;
			window.onYouTubeIframeAPIReady = function () { if (prev) try { prev(); } catch (e) { } createYT(); };
		} else {
			createYT();
		}
	} else {
		const vid = createVideoElement(url);
		container.appendChild(vid);
		player = { type: 'video', el: vid };

		// Поддержка HLS: если URL оканчивается на .m3u8 и hls.js доступен
		if (typeof Hls !== 'undefined' && url.match(/\.m3u8(\?|$)/i)) {
			if (Hls.isSupported()) {
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
			if (!isSeekingProgrammatically && roomId) socket.emit('player-event', { roomId, type: 'play', data: { time: vid.currentTime } });
			// Переключаем иконки
			const playIcon = $('playIcon');
			const pauseIcon = $('pauseIcon');
			if (playIcon) playIcon.style.display = 'none';
			if (pauseIcon) pauseIcon.style.display = 'block';
		});

		vid.addEventListener('pause', () => {
			if (!isSeekingProgrammatically && roomId) socket.emit('player-event', { roomId, type: 'pause', data: { time: vid.currentTime } });
			// Переключаем иконки
			const playIcon = $('playIcon');
			const pauseIcon = $('pauseIcon');
			if (playIcon) playIcon.style.display = 'block';
			if (pauseIcon) pauseIcon.style.display = 'none';
		});

		vid.addEventListener('seeking', () => {
			if (!isSeekingProgrammatically && roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: vid.currentTime } });
		});

		// Для синхронизации: если HLS воспроизводится через hls.js — подписываемся на seek events
		if (hlsInstance) {
			// hls.js не предоставляет прямого события seeking на уровне API; полагаемся на HTMLMediaElement
		}

		startTimeUpdater();
	}
}

// Update global room ID
function updateGlobalRoomId(roomId) {
    window.roomId = roomId;
}

// UI handlers
document.addEventListener('DOMContentLoaded', () => {
	const createBtn = $('createBtn');
	if (createBtn) {
		createBtn.addEventListener('click', () => {
			const rid = $('roomId').value.trim();
			const url = $('videoUrl').value.trim();
			if (!rid) return alert('Введите roomId');
			roomId = rid; updateGlobalRoomId(roomId);
			socket.emit('join-room', { roomId, userEmoji });
			if (url) { socket.emit('load-video', { roomId, url }); loadPlayer(url); }
			// persist values
			try { localStorage.setItem('wt_room_id', rid); } catch (e) { }
			try { if (url) localStorage.setItem('wt_video_url', url); } catch (e) { }
			// Закрываем модальное окно после входа в комнату
			const roomModal = $('roomModal');
			if (roomModal) {
				roomModal.setAttribute('aria-hidden', 'true');
				roomModal.style.display = 'none';
			}
		});
	}

	const copyInvite = $('copyInvite');
	if (copyInvite) {
		copyInvite.addEventListener('click', () => {
			const rid = $('roomId').value.trim();
			if (!rid) return alert('Введите roomId');
			const currentUrl = $('videoUrl') ? $('videoUrl').value.trim() : '';
			const invite = `${location.origin}/?room=${encodeURIComponent(rid)}${currentUrl ? `&url=${encodeURIComponent(currentUrl)}` : ''}`;
			navigator.clipboard.writeText(invite).then(() => alert('Ссылка скопирована')).catch(() => alert('Не удалось скопировать'));
		});
	}

	// Persist inputs on change/blur
	const ridInput = $('roomId'); if (ridInput) { ridInput.addEventListener('blur', () => { try { if (ridInput.value.trim()) localStorage.setItem('wt_room_id', ridInput.value.trim()); } catch (e) { } }); }
	const urlInput = $('videoUrl'); if (urlInput) { urlInput.addEventListener('blur', () => { try { if (urlInput.value.trim()) localStorage.setItem('wt_video_url', urlInput.value.trim()); } catch (e) { } }); }

	// Локальный файл через input
	const fileInput = $('videoFile');
	if (fileInput) {
		fileInput.addEventListener('change', (ev) => {
			const f = ev.target.files && ev.target.files[0];
			if (!f) return;
			const url = URL.createObjectURL(f);
			// Локальный файл не отправляем в комнату — это локальная операция
			loadPlayer(url);
		});
	}

	// Restore saved room and url if present (unless URL params will handle it below)
	try {
		const savedRid = localStorage.getItem('wt_room_id') || '';
		const savedUrl = localStorage.getItem('wt_video_url') || '';
		if (savedRid) { const roomInput = $('roomId'); if (roomInput) roomInput.value = savedRid; }
		if (savedUrl) { const vInput = $('videoUrl'); if (vInput) vInput.value = savedUrl; }
	} catch (e) { }

	// Drag & drop на плеер
	const container = $('playerContainer');
	if (container) {
		container.addEventListener('dragover', (e) => { e.preventDefault(); container.style.outline = '2px dashed #2b6cb0'; });
		container.addEventListener('dragleave', (e) => { e.preventDefault(); container.style.outline = ''; });
		container.addEventListener('drop', (e) => {
			e.preventDefault(); container.style.outline = '';
			const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
			if (!f) return;
			loadPlayer(URL.createObjectURL(f));
		});
	}

	// unified play/pause button
	const playPauseBtn = $('playPause');
	if (playPauseBtn) {
		playPauseBtn.addEventListener('click', () => {
			if (!player) return;
			if (player.type === 'video') {
				const el = player.el;
				if (el.paused) { 
					el.play(); 
					if (roomId) socket.emit('player-event', { roomId, type: 'play', data: { time: el.currentTime } }); 
					// Переключаем иконки
					const playIcon = $('playIcon');
					const pauseIcon = $('pauseIcon');
					if (playIcon) playIcon.style.display = 'none';
					if (pauseIcon) pauseIcon.style.display = 'block';
				}
				else { 
					el.pause(); 
					if (roomId) socket.emit('player-event', { roomId, type: 'pause', data: { time: el.currentTime } }); 
					// Переключаем иконки
					const playIcon = $('playIcon');
					const pauseIcon = $('pauseIcon');
					if (playIcon) playIcon.style.display = 'block';
					if (pauseIcon) pauseIcon.style.display = 'none';
				}
			} else if (player.type === 'youtube' && youtubePlayer) {
				try {
					const state = youtubePlayer.getPlayerState();
					if (state === YT.PlayerState.PLAYING) { 
						youtubePlayer.pauseVideo(); 
						if (roomId) socket.emit('player-event', { roomId, type: 'pause', data: { time: youtubePlayer.getCurrentTime() } }); 
						// Переключаем иконки
						const playIcon = $('playIcon');
						const pauseIcon = $('pauseIcon');
						if (playIcon) playIcon.style.display = 'block';
						if (pauseIcon) pauseIcon.style.display = 'none';
					}
					else { 
						youtubePlayer.playVideo(); 
						if (roomId) socket.emit('player-event', { roomId, type: 'play', data: { time: youtubePlayer.getCurrentTime() } }); 
						// Переключаем иконки
						const playIcon = $('playIcon');
						const pauseIcon = $('pauseIcon');
						if (playIcon) playIcon.style.display = 'none';
						if (pauseIcon) pauseIcon.style.display = 'block';
					}
				} catch (e) { console.warn('YT control error', e); }
			}
		});
	}

	// Chat send
	const sendBtn = $('sendMsg');
	if (sendBtn) {
		sendBtn.addEventListener('click', () => {
			const msgInput = $('chatMsg');
			const msg = msgInput ? msgInput.value.trim() : '';
			if (!msg || !roomId) return;
			socket.emit('chat-message', { roomId, author: userEmoji, message: msg });
			msgInput.value = '';
		});
	}
	// Send on Enter, newline on Shift+Enter
	const chatInput = $('chatMsg');
	if (chatInput) {
		chatInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				if (e.shiftKey) {
					// allow newline
					return;
				}
				e.preventDefault();
				const text = chatInput.value.trim();
				if (!text || !roomId) return;
				socket.emit('chat-message', { roomId, author: userEmoji, message: text });
				chatInput.value = '';
			}
		});
	}

	// Room modal open/close
	const openRoom = $('openRoom');
	const closeRoom = $('closeRoom');
	const roomModal = $('roomModal');
	function showModal() {
		if (roomModal) {
			roomModal.setAttribute('aria-hidden', 'false');
			roomModal.style.display = 'flex';
			// Заполняем поля из localStorage при открытии модального окна
			try {
				const savedRid = localStorage.getItem('wt_room_id') || '';
				const savedUrl = localStorage.getItem('wt_video_url') || '';
				const roomInput = $('roomId'); if (roomInput && !roomInput.value) roomInput.value = savedRid;
				const urlInput = $('videoUrl'); if (urlInput && !urlInput.value) urlInput.value = savedUrl;
			} catch (e) { }
			// Фокус на первом поле ввода
			setTimeout(() => {
				const firstInput = roomModal.querySelector('input[type="text"]');
				if (firstInput) firstInput.focus();
			}, 100);
		}
	}
	function hideModal() { 
		if (roomModal) {
			const active = document.activeElement;
			if (active && roomModal.contains(active)) {
				active.blur();
			}
			roomModal.setAttribute('aria-hidden', 'true'); 
			roomModal.style.display = 'none';
		}
		const trigger = $('openRoom');
		if (trigger) {
			setTimeout(() => trigger.focus(), 0);
		}
	}
	if (openRoom) openRoom.addEventListener('click', showModal);
	if (closeRoom) closeRoom.addEventListener('click', hideModal);
	if (roomModal) {
		roomModal.addEventListener('click', (e) => { if (e.target === roomModal) hideModal(); });
		// Закрытие модального окна по Escape (глобальный обработчик)
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				const roomModal = $('roomModal');
				if (roomModal && roomModal.getAttribute('aria-hidden') === 'false') {
					roomModal.setAttribute('aria-hidden', 'true');
					roomModal.style.display = 'none';
				}
			}
		});
	}

	// Reset saved room/url button
	const resetSaved = $('resetSaved');
	if (resetSaved) {
		resetSaved.addEventListener('click', () => {
			try { localStorage.removeItem('wt_room_id'); } catch (e) { }
			try { localStorage.removeItem('wt_video_url'); } catch (e) { }
			const ridInput2 = $('roomId'); if (ridInput2) ridInput2.value = '';
			const urlInput2 = $('videoUrl'); if (urlInput2) urlInput2.value = '';
			alert('Сохранённые Room ID и ссылка на видео очищены');
		});
	}
	// Theme toggle button
	const themeToggle = $('themeToggle');
	if (themeToggle) {
		themeToggle.addEventListener('click', () => {
			document.body.classList.toggle('dark-theme');
			const isDark = document.body.classList.contains('dark-theme');
			themeToggle.querySelector('.theme-icon').textContent = isDark ? '☀️' : '🌙';
			try { localStorage.setItem('wt_theme', isDark ? 'dark' : 'light'); } catch (e) { }
		});
		// restore theme
		try {
			const savedTheme = localStorage.getItem('wt_theme');
			if (savedTheme === 'dark') {
				document.body.classList.add('dark-theme');
				themeToggle.querySelector('.theme-icon').textContent = '☀️';
			}
		} catch (e) { }
	}

	// About button
	const aboutBtn = $('aboutBtn');
	const aboutModal = $('aboutModal');
	const closeAbout = $('closeAbout');
	function showAboutModal() {
		if (aboutModal) {
			aboutModal.setAttribute('aria-hidden', 'false');
			aboutModal.style.display = 'flex';
			setTimeout(() => {
				const content = aboutModal.querySelector('.modal-content');
				if (content) content.style.transform = 'scale(1)';
			}, 10);
		}
	}
	function hideAboutModal() {
		if (aboutModal) {
			const content = aboutModal.querySelector('.modal-content');
			if (content) content.style.transform = 'scale(0.8)';
			setTimeout(() => {
				aboutModal.setAttribute('aria-hidden', 'true');
				aboutModal.style.display = 'none';
			}, 300);
		}
	}
	if (aboutBtn) aboutBtn.addEventListener('click', showAboutModal);
	if (closeAbout) closeAbout.addEventListener('click', hideAboutModal);
	if (aboutModal) {
		aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) hideAboutModal(); });
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && aboutModal.getAttribute('aria-hidden') === 'false') {
				hideAboutModal();
			}
		});
	}

	// Mute button
	const muteBtn = $('muteBtn');
	if (muteBtn) {
		muteBtn.addEventListener('click', () => {
			if (!player) return;
			if (player.type === 'video') {
				player.el.muted = !player.el.muted;
				muteBtn.textContent = player.el.muted ? '🔇' : '🔊';
				// Update volume slider to reflect mute state
				updateVolumeSlider();
			}
		});
	}

	// Speed control button
	const speedBtn = $('speedBtn');
	if (speedBtn) {
		const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
		let currentSpeedIndex = 2; // default 1x
		speedBtn.addEventListener('click', () => {
			if (!player) return;
			currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
			const speed = speeds[currentSpeedIndex];
			if (player.type === 'video') {
				player.el.playbackRate = speed;
			} else if (player.type === 'youtube' && youtubePlayer) {
				youtubePlayer.setPlaybackRate(speed);
			}
			speedBtn.textContent = speed + 'x';
		});
	}

	// Seek back and forward buttons
	const backBtn = $('seekBack'); if (backBtn) backBtn.addEventListener('click', () => {
		if (!player) return;
		if (player.type === 'video') { player.el.currentTime = Math.max(0, player.el.currentTime - 10); if (roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: player.el.currentTime } }); }
		else if (player.type === 'youtube' && youtubePlayer) { const t = Math.max(0, youtubePlayer.getCurrentTime() - 10); youtubePlayer.seekTo(t, true); if (roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: t } }); }
	});
	const fwdBtn = $('seekFwd'); if (fwdBtn) fwdBtn.addEventListener('click', () => {
		if (!player) return;
		if (player.type === 'video') { player.el.currentTime = player.el.currentTime + 10; if (roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: player.el.currentTime } }); }
		else if (player.type === 'youtube' && youtubePlayer) { const t = youtubePlayer.getCurrentTime() + 10; youtubePlayer.seekTo(t, true); if (roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: t } }); }
	});

	// Progress bar and handle
	const progressBar = $('progressBar');
	const progressHandle = $('progressHandle');
	let isDraggingProgress = false;

	function updateProgressBar() {
    if (!player || !progressBar) return;

		let duration = 0;
		let currentTime = 0;

		if (player.type === 'video') {
			duration = player.el.duration || 0;
			currentTime = player.el.currentTime || 0;
		} else if (player.type === 'youtube' && youtubePlayer) {
			duration = youtubePlayer.getDuration ? youtubePlayer.getDuration() : 0;
			currentTime = youtubePlayer.getCurrentTime ? youtubePlayer.getCurrentTime() : 0;
		}

		if (duration > 0) {
			const percentage = (currentTime / duration) * 100;
			progressBar.style.width = percentage + '%';
			if (progressHandle) {
				progressHandle.style.left = percentage + '%';
			}
		}
	}

	function seekToPosition(clientX) {
		if (!player || !progressBar) return;

		const rect = progressBar.parentElement.getBoundingClientRect();
		const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		
		let duration = 0;
		if (player.type === 'video') {
			duration = player.el.duration || 0;
			const newTime = duration * percentage;
			player.el.currentTime = newTime;
			if (roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: newTime } });
		} else if (player.type === 'youtube' && youtubePlayer) {
			duration = youtubePlayer.getDuration ? youtubePlayer.getDuration() : 0;
			const newTime = duration * percentage;
			youtubePlayer.seekTo(newTime, true);
			if (roomId) socket.emit('player-event', { roomId, type: 'seek', data: { time: newTime } });
		}

		updateProgressBar();
	}

	if (progressBar) {
		// Click on progress bar
		progressBar.parentElement.addEventListener('click', (e) => {
			if (!isDraggingProgress) {
				seekToPosition(e.clientX);
			}
		});

		// Mouse down on progress bar
		progressBar.parentElement.addEventListener('mousedown', (e) => {
			isDraggingProgress = true;
			seekToPosition(e.clientX);
		});

		// Mouse move while dragging
		document.addEventListener('mousemove', (e) => {
			if (isDraggingProgress) {
				seekToPosition(e.clientX);
			}
		});

		// Mouse up
		document.addEventListener('mouseup', () => {
			isDraggingProgress = false;
		});
	}

	if (progressHandle) {
		// Mouse down on handle
		progressHandle.addEventListener('mousedown', (e) => {
			isDraggingProgress = true;
			e.preventDefault();
		});
	}

	// Update progress bar periodically
	setInterval(updateProgressBar, 500);

	// Volume slider
	const volumeSlider = document.querySelector('.volume-slider');
	const volumeFill = $('volumeFill');
	let isDraggingVolume = false;

	function updateVolumeSlider() {
		if (!player || !volumeFill) return;

		let volume = 1;
		if (player.type === 'video') {
			volume = player.el.muted ? 0 : (player.el.volume || 0);
		}

		volumeFill.style.width = (volume * 100) + '%';
	}

	function setVolumeFromPosition(clientX) {
		if (!volumeSlider) return;

		const rect = volumeSlider.getBoundingClientRect();
		const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		
		if (player && player.type === 'video') {
			player.el.volume = percentage;
			player.el.muted = percentage === 0;
			
			// Update mute button
			const muteBtn = $('muteBtn');
			if (muteBtn) {
				muteBtn.textContent = percentage === 0 || player.el.muted ? '🔇' : '🔊';
			}
		}
	}

	if (volumeSlider) {
		// Click on volume slider
		volumeSlider.addEventListener('click', (e) => {
			if (!isDraggingVolume) {
				setVolumeFromPosition(e.clientX);
				updateVolumeSlider();
			}
		});

		// Mouse down on volume slider
		volumeSlider.addEventListener('mousedown', (e) => {
			isDraggingVolume = true;
			setVolumeFromPosition(e.clientX);
			updateVolumeSlider();
		});

		// Mouse move while dragging
		document.addEventListener('mousemove', (e) => {
			if (isDraggingVolume) {
				setVolumeFromPosition(e.clientX);
				updateVolumeSlider();
			}
		});

		// Mouse up
		document.addEventListener('mouseup', () => {
			isDraggingVolume = false;
		});
	}

	// Initialize volume display
	updateVolumeSlider();

	// Авто-вход по параметрам URL: ?room=...&url=...&autocam=1
	try {
		const params = new URLSearchParams(location.search);
		const rid = (params.get('room') || '').trim();
		const url = (params.get('url') || '').trim();
		const autoCam = ['1', 'true', 'yes'].includes((params.get('autocam') || '').toLowerCase());
		if (rid) {
			// выставим поля формы для наглядности
			const roomInput = $('roomId'); if (roomInput) roomInput.value = rid;
			if (url) { const urlInput = $('videoUrl'); if (urlInput) urlInput.value = url; }

			roomId = rid; updateGlobalRoomId(roomId);
			socket.emit('join-room', { roomId: rid, userEmoji });
			if (url) { socket.emit('load-video', { roomId: rid, url }); loadPlayer(url); }

			// опционально включаем камеру и шлём offer
			if (autoCam && !localStream) {
				const btn = $('toggleCam');
				if (btn) { btn.click(); }
			}
		} else {
			// если параметров нет, автоподключение по сохранённым данным
			try {
				const savedRid = localStorage.getItem('wt_room_id') || '';
				const savedUrl = localStorage.getItem('wt_video_url') || '';
				if (savedRid) {
					roomId = savedRid; updateGlobalRoomId(roomId); socket.emit('join-room', { roomId: savedRid, userEmoji });
					if (savedUrl) { socket.emit('load-video', { roomId: savedRid, url: savedUrl }); loadPlayer(savedUrl); }
				}
			} catch (e) { }
		}
	} catch (e) { /* ignore */ }
});

// --- WebRTC helpers ---
function createPeerConnection(peerId, roomId) {
	if (pcs[peerId]) return pcs[peerId];
	const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
	pcs[peerId] = pc;

	// send ICE candidates to peer via server
	pc.onicecandidate = (e) => { if (e.candidate) { socket.emit('webrtc-ice', { roomId, candidate: e.candidate }); } };

	pc.ontrack = (e) => {
		// attach remote stream
		const remote = $('remoteVideo');
		if (remote) { remote.srcObject = e.streams[0]; }
	};

	// add local tracks
	if (localStream) { localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); }

	return pc;
}

// Global variable to track current camera facing mode
window.currentFacingMode = 'user'; // 'user' for front camera, 'environment' for back camera

async function startLocalCamera() {
	if (localStream) return;

	// Проверяем поддержку getUserMedia
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		alert('Ваш браузер не поддерживает доступ к камере. Попробуйте обновить браузер.');
		return;
	}

	try {
		console.log('Requesting camera access...');

		// Для мобильных устройств используем более простые настройки
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
		let constraints;

		if (isMobile) {
			constraints = {
				video: {
					width: { ideal: 640 },
					height: { ideal: 480 },
					facingMode: window.currentFacingMode // Use current facing mode
				},
				audio: true
			};
		} else {
			constraints = {
				video: true,
				audio: true
			};
		}

		localStream = await navigator.mediaDevices.getUserMedia(constraints);
		const local = $('localVideo');

		if (local) {
			local.srcObject = localStream;
			local.playsInline = true; // Важно для iOS
			local.muted = true; // Отключаем звук локального видео

			// На мобильных устройствах может потребоваться пользовательское взаимодействие
			if (isMobile) {
				try {
					await local.play();
					console.log('Camera started successfully on mobile');

					// Add camera switch button for mobile devices
					addCameraSwitchButton(local);
				} catch (playError) {
					console.warn('Auto-play failed on mobile, user interaction required:', playError);
					// Создаем кнопку для запуска видео
					showPlayButton(local);
				}
			}
		}

		console.log('Camera access granted successfully');
	} catch (e) {
		console.error('Camera access failed:', e);

		let errorMessage = 'Не удалось получить доступ к камере/микрофону.';
		if (e.name === 'NotAllowedError') {
			errorMessage += ' Разрешите доступ к камере в настройках браузера.';
		} else if (e.name === 'NotFoundError') {
			errorMessage += ' Камера или микрофон не найдены.';
		} else if (e.name === 'NotSupportedError') {
			errorMessage += ' Ваш браузер не поддерживает эту функцию.';
		} else if (e.name === 'NotReadableError') {
			errorMessage += ' Камера используется другим приложением.';
		} else if (e.name === 'OverconstrainedError') {
			errorMessage += ' Запрошенные настройки камеры недоступны.';
		} else {
			errorMessage += ' ' + (e.message || 'Неизвестная ошибка.');
		}

		alert(errorMessage);
		return;
	}
}

function addCameraSwitchButton(videoElement) {
	// Remove existing switch button if any
	const existingBtn = videoElement.parentElement.querySelector('.camera-switch-btn');
	if (existingBtn) existingBtn.remove();

	const switchBtn = document.createElement('button');
	switchBtn.textContent = '🔄';
	switchBtn.className = 'camera-switch-btn';
	switchBtn.title = 'Переключить камеру';
	switchBtn.style.position = 'absolute';
	switchBtn.style.top = '10px';
	switchBtn.style.right = '10px';
	switchBtn.style.zIndex = '1001';
	switchBtn.style.width = '40px';
	switchBtn.style.height = '40px';
	switchBtn.style.borderRadius = '50%';
	switchBtn.style.background = 'rgba(0,0,0,0.6)';
	switchBtn.style.color = 'white';
	switchBtn.style.border = 'none';
	switchBtn.style.cursor = 'pointer';
	switchBtn.style.display = 'flex';
	switchBtn.style.alignItems = 'center';
	switchBtn.style.justifyContent = 'center';
	switchBtn.style.fontSize = '16px';

	switchBtn.onclick = switchCamera;

	videoElement.parentElement.style.position = 'relative';
	videoElement.parentElement.appendChild(switchBtn);
}

async function switchCamera() {
	if (!localStream) return;

	try {
		// Stop current stream
		localStream.getTracks().forEach(track => track.stop());

		// Switch facing mode
		window.currentFacingMode = window.currentFacingMode === 'user' ? 'environment' : 'user';

		// Restart camera with new facing mode
		await startLocalCamera();
	} catch (e) {
		console.error('Failed to switch camera:', e);
		alert('Не удалось переключить камеру: ' + (e.message || 'Неизвестная ошибка'));
	}
}

function showPlayButton(videoElement) {
	const playBtn = document.createElement('button');
	playBtn.textContent = '▶️ Запустить камеру';
	playBtn.style.position = 'absolute';
	playBtn.style.top = '50%';
	playBtn.style.left = '50%';
	playBtn.style.transform = 'translate(-50%, -50%)';
	playBtn.style.zIndex = '1000';
	playBtn.style.padding = '10px 20px';
	playBtn.style.background = 'rgba(0,0,0,0.8)';
	playBtn.style.color = 'white';
	playBtn.style.border = 'none';
	playBtn.style.borderRadius = '5px';
	playBtn.style.cursor = 'pointer';

	playBtn.onclick = async () => {
		try {
			await videoElement.play();
			playBtn.remove();
			console.log('Camera started after user interaction');
		} catch (e) {
			console.error('Failed to play video after user interaction:', e);
			alert('Не удалось запустить видео. Попробуйте обновить страницу.');
		}
	};

	videoElement.parentElement.style.position = 'relative';
	videoElement.parentElement.appendChild(playBtn);
}

function closeAllPeerConnections() {
	for (const id of Object.keys(pcs)) {
		try { pcs[id].close(); } catch (e) { }
		try { delete pcs[id]; } catch (e) { }
	}
	pcs = {};
}

function stopLocalCamera() {
	// stop tracks
	if (localStream) {
		try { localStream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } }); } catch (e) { }
		localStream = null;
	}
	// clear local preview
	const local = $('localVideo'); if (local) local.srcObject = null;
	// clear remote preview
	const remote = $('remoteVideo'); if (remote) remote.srcObject = null;
	// close all peer connections
	closeAllPeerConnections();
	// remove saved temp pc
	try { delete pcs['local-temp']; } catch (e) { }
}

// Toggle camera button
const toggleCamBtn = $('toggleCam');
if (toggleCamBtn) {
	toggleCamBtn.addEventListener('click', async () => {
		if (!localStream) {
			// start camera
			await startLocalCamera();
			if (!localStream) return;

			// If user is in a room, create WebRTC offer for video calling
			if (roomId && window.socket) {
				// Создаём offer и ретранслируем его в комнату
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

// Toggle microphone button
const toggleMicBtn = $('toggleMic');
let micEnabled = true; // Track mic state
if (toggleMicBtn) {
	toggleMicBtn.addEventListener('click', () => {
		if (!localStream) return;

		// Find audio tracks
		const audioTracks = localStream.getAudioTracks();
		if (audioTracks.length === 0) return;

		micEnabled = !micEnabled;

		// Enable/disable all audio tracks
		audioTracks.forEach(track => {
			track.enabled = micEnabled;
		});

		// Update button appearance
		toggleMicBtn.textContent = micEnabled ? '🎤' : '🎤❌';
		toggleMicBtn.title = micEnabled ? 'Выключить микрофон' : 'Включить микрофон';
		toggleMicBtn.style.opacity = micEnabled ? '1' : '0.5';

		console.log('Microphone', micEnabled ? 'enabled' : 'disabled');
	});
}

// Remote video volume control
const remoteVolumeSlider = $('remoteVolume');
if (remoteVolumeSlider) {
	const remoteVideo = $('remoteVideo');
	if (remoteVideo) {
		// Set initial volume
		remoteVideo.volume = remoteVolumeSlider.value;

		// Handle volume changes
		remoteVolumeSlider.addEventListener('input', (e) => {
			const volume = parseFloat(e.target.value);
			remoteVideo.volume = volume;
			console.log('Remote video volume set to:', volume);

			// Save volume preference
			try {
				localStorage.setItem('wt_remote_volume', volume.toString());
			} catch (e) { }
		});

		// Restore saved volume
		try {
			const savedVolume = localStorage.getItem('wt_remote_volume');
			if (savedVolume !== null) {
				const volume = parseFloat(savedVolume);
				remoteVolumeSlider.value = volume;
				remoteVideo.volume = volume;
			}
		} catch (e) { }
	}
}

// Function to update camera toggle button appearance
function updateCameraToggleButton(isHidden) {
    const cameraToggle = $('cameraToggle');
    if (cameraToggle) {
        const icon = cameraToggle.querySelector('.camera-icon');
        if (icon) {
            icon.textContent = isHidden ? '📷' : '📹';
            cameraToggle.title = isHidden ? 'Показать видеосвязь' : 'Скрыть видеосвязь';
        }
    }
}

// Handle incoming signaling
// These handlers are now registered inside initializeSocket() function
function initFloatingCam() {
	const widget = $('floatingCam');
	if (!widget) return;

	// restore position/size
	try {
		const pos = JSON.parse(localStorage.getItem('wt_cam_pos') || 'null');
		if (pos) { widget.style.left = pos.left; widget.style.top = pos.top; widget.style.width = pos.width; widget.style.height = pos.height; }
	} catch (e) { }

	// ensure widget uses left/top anchoring (not right/bottom) and explicit size for proper CSS resize
	(function ensureAnchors() {
		widget.style.right = 'auto';
		widget.style.bottom = 'auto';
		if (!widget.style.width) widget.style.width = widget.offsetWidth + 'px';
		if (!widget.style.height) widget.style.height = widget.offsetHeight + 'px';
		if (!widget.style.left && !widget.style.top) {
			const left = Math.max(8, window.innerWidth - widget.offsetWidth - 18);
			const top = Math.max(8, window.innerHeight - widget.offsetHeight - 18);
			widget.style.left = left + 'px';
			widget.style.top = top + 'px';
		}
	})();

	// add visible resize handles (south, east, south-east)
	function createHandle(className, onDrag) {
		const h = document.createElement('div');
		h.className = 'resize-handle ' + className;
		h.style.zIndex = '200'; // Make sure it's above everything
		h.title = `Resize ${className}`; // Add tooltip

		// Simple click test
		h.addEventListener('click', () => {
			console.log('Resize handle clicked:', className);
		});

		// Use capture phase to intercept events before they bubble
		h.addEventListener('mousedown', (e) => {
			console.log('Resize handle mousedown (capture):', className, 'target:', e.target);
			e.preventDefault();
			e.stopImmediatePropagation(); // Stop ALL event propagation

			// Start resize immediately
			let dragging = true, startX = e.clientX, startY = e.clientY;
			let startW = widget.offsetWidth, startH = widget.offsetHeight;

			const moveHandler = (e) => {
				if (!dragging) return;
				const dw = e.clientX - startX, dh = e.clientY - startY;
				console.log('Resizing:', className, dw, dh);
				onDrag({ clientX: startX + dw, clientY: startY + dh }, { startX, startY, startW, startH });
				e.preventDefault();
			};

			const upHandler = () => {
				console.log('Resize finished:', className);
				dragging = false;
				document.removeEventListener('mousemove', moveHandler);
				document.removeEventListener('mouseup', upHandler);
				try { localStorage.setItem('wt_cam_pos', JSON.stringify({ left: widget.style.left, top: widget.style.top, width: widget.style.width, height: widget.style.height })); } catch (e) { }
			};

			document.addEventListener('mousemove', moveHandler);
			document.addEventListener('mouseup', upHandler);
		}, true); // Use capture phase

		widget.appendChild(h);
		return h;
	}

	createHandle('rh-se', (e, s) => {
		const dw = e.clientX - s.startX; const dh = e.clientY - s.startY;
		widget.style.width = Math.min(window.innerWidth * 0.9, Math.max(220, s.startW + dw)) + 'px';
		widget.style.height = Math.min(window.innerHeight * 0.9, Math.max(120, s.startH + dh)) + 'px';
	});
	createHandle('rh-e', (e, s) => {
		const dw = e.clientX - s.startX;
		widget.style.width = Math.min(window.innerWidth * 0.9, Math.max(220, s.startW + dw)) + 'px';
	});
	createHandle('rh-s', (e, s) => {
		const dh = e.clientY - s.startY;
		widget.style.height = Math.min(window.innerHeight * 0.9, Math.max(120, s.startH + dh)) + 'px';
	});

	const header = $('camHeader');

	function ensureWithinViewport() {
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
	function addDragHandlers() {
		console.log('Adding drag handlers...');
		console.log('Header element:', header);
		console.log('Header found:', !!header);

		if (!header) {
			console.error('Header not found, cannot add drag handlers');
			return;
		}

		// Debug header CSS properties
		console.log('Header CSS properties:');
		console.log('- position:', getComputedStyle(header).position);
		console.log('- z-index:', getComputedStyle(header).zIndex);
		console.log('- pointer-events:', getComputedStyle(header).pointerEvents);
		console.log('- cursor:', getComputedStyle(header).cursor);
		console.log('- display:', getComputedStyle(header).display);
		console.log('- visibility:', getComputedStyle(header).visibility);

		let isDragging = false;
		let startX, startY, startLeft, startTop;

		const handleMouseDown = (e) => {
			console.log('=== MOUSE DOWN EVENT ===');
			console.log('Event target:', e.target);
			console.log('Event target tag:', e.target.tagName);
			console.log('Event target class:', e.target.className);
			console.log('Current target:', e.currentTarget);
			console.log('Widget hidden?', widget.classList.contains('hidden'));

			// Check if clicked on interactive elements
			const interactiveElement = e.target.closest('button, input, select, textarea');
			console.log('Clicked on interactive element:', !!interactiveElement);

			if (interactiveElement) {
				console.log('Ignoring drag - clicked on interactive element');
				return;
			}

			// Don't drag if widget is hidden
			if (widget.classList.contains('hidden')) {
				console.log('Ignoring drag - widget is hidden');
				return;
			}

			console.log('STARTING DRAG');
			isDragging = true;
			const rect = widget.getBoundingClientRect();
			startX = e.clientX;
			startY = e.clientY;
			startLeft = rect.left;
			startTop = rect.top;

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);

			e.preventDefault();
			console.log('Drag started successfully');
		};

		const handleMouseMove = (e) => {
			if (!isDragging) return;

			console.log('Mouse move - dragging');
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			let newLeft = startLeft + dx;
			let newTop = startTop + dy;

			// Keep within viewport bounds
			const margin = 8;
			const maxLeft = window.innerWidth - widget.offsetWidth - margin;
			const maxTop = window.innerHeight - widget.offsetHeight - margin;

			newLeft = Math.max(margin, Math.min(newLeft, maxLeft));
			newTop = Math.max(margin, Math.min(newTop, maxTop));

			widget.style.left = newLeft + 'px';
			widget.style.top = newTop + 'px';
			widget.style.right = 'auto';
			widget.style.bottom = 'auto';

			e.preventDefault();
		};

		const handleMouseUp = () => {
			if (isDragging) {
				console.log('STOPPING DRAG');
				isDragging = false;
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				console.log('Drag stopped');
			}
		};

		console.log('Attaching mousedown listener to header');
		header.addEventListener('mousedown', handleMouseDown);
		console.log('Drag handlers attached successfully');

		// Test click handler to verify events reach header
		header.addEventListener('click', (e) => {
			console.log('=== HEADER CLICK TEST ===');
			console.log('Click event reached header!');
			console.log('Click target:', e.target);
			console.log('Click target tag:', e.target.tagName);
		});
	}

	// Add drag handlers after resize handles are fully set up
	setTimeout(addDragHandlers, 100);

	// Add debug logging
	console.log('Resize handles created:', document.querySelectorAll('.resize-handle').length);

	// Keep widget inside viewport on load and on resize
	ensureWithinViewport();
	window.addEventListener('resize', ensureWithinViewport);

	// Persist size changes when user resizes the widget
	try {
		const ro = new ResizeObserver(() => {
			try { localStorage.setItem('wt_cam_pos', JSON.stringify({ left: widget.style.left, top: widget.style.top, width: widget.style.width, height: widget.style.height })); } catch (e) { }
			ensureWithinViewport();
		});
		ro.observe(widget);
	} catch (e) { }

	// ensure widget stays visible during fullscreen: when document enters fullscreen, append widget to fullscreenElement
	document.addEventListener('fullscreenchange', () => {
		const fs = document.fullscreenElement;
		if (fs) { try { fs.appendChild(widget); } catch (e) { } } else {
			// restore to body
			try { document.body.appendChild(widget); } catch (e) { }
		}
	});
}

// init floating cam behavior after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initFloatingCam, 100);

    // Chat visibility check
    setTimeout(() => {
        const chatPanel = document.querySelector('.left-panel .panel:nth-child(2)') ||
                       document.querySelector('.left-panel .panel:has(.chat-container)') ||
                       Array.from(document.querySelectorAll('.left-panel .panel')).find(p => p.querySelector('.chat-container'));

        const chatContainer = document.getElementById('chatBox');
        const chatMessages = document.querySelector('.chat-messages');
        const chatInput = document.querySelector('.chat-input-group');

        console.log('Chat visibility check:');
        console.log('- Chat panel found:', !!chatPanel);
        console.log('- Chat container found:', !!chatContainer);
        console.log('- Chat messages found:', !!chatMessages);
        console.log('- Chat input found:', !!chatInput);

        if (chatPanel) {
            console.log('- Chat panel display:', getComputedStyle(chatPanel).display);
            console.log('- Chat panel visibility:', getComputedStyle(chatPanel).visibility);
            console.log('- Chat panel opacity:', getComputedStyle(chatPanel).opacity);
            console.log('- Chat panel position:', getComputedStyle(chatPanel).position);
        }

        if (chatMessages) {
            console.log('- Chat messages display:', getComputedStyle(chatMessages).display);
            console.log('- Chat messages height:', getComputedStyle(chatMessages).height);
            console.log('- Chat messages max-height:', getComputedStyle(chatMessages).maxHeight);
            console.log('- Chat messages flex:', getComputedStyle(chatMessages).flex);
            console.log('- Chat messages flex-grow:', getComputedStyle(chatMessages).flexGrow);
        }

        // Check parent containers
        if (chatPanel) {
            console.log('- Chat panel height:', getComputedStyle(chatPanel).height);
            console.log('- Chat panel max-height:', getComputedStyle(chatPanel).maxHeight);
        }

        if (chatContainer) {
            console.log('- Chat container height:', getComputedStyle(chatContainer).height);
            console.log('- Chat container display:', getComputedStyle(chatContainer).display);
            console.log('- Chat container flex-direction:', getComputedStyle(chatContainer).flexDirection);
        }

        // Force show chat if hidden
        if (chatPanel && getComputedStyle(chatPanel).display === 'none') {
            console.log('Chat panel is hidden - forcing visibility');
            chatPanel.style.display = 'block';
        }
    }, 1000);
});

// Camera toggle button in header
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== CAMERA TOGGLE INIT ===');
    const cameraToggle = $('cameraToggle');
    console.log('Camera toggle element found:', !!cameraToggle);

    if (cameraToggle) {
        console.log('Attaching click handler to camera toggle');
        cameraToggle.addEventListener('click', () => {
            console.log('=== CAMERA TOGGLE CLICKED ===');
            const widget = $('floatingCam');
            console.log('Floating cam widget found:', !!widget);

            if (!widget) {
                console.log('ERROR: Floating cam widget not found');
                return;
            }

            const isHidden = widget.classList.contains('hidden');
            console.log('Widget currently hidden:', isHidden);

            if (isHidden) {
                // Show the camera window
                console.log('Showing camera window');
                widget.classList.remove('hidden');
                updateCameraToggleButton(false);
                try { localStorage.setItem('wt_cam_visible', '1'); } catch (e) { }

                // Initialize floating cam functionality
                console.log('Initializing floating cam after showing...');
                setTimeout(() => initFloatingCam(), 100);
            } else {
                // Hide the camera window
                console.log('Hiding camera window');
                widget.classList.add('hidden');
                updateCameraToggleButton(true);
                try { localStorage.setItem('wt_cam_visible', '0'); } catch (e) { }
            }
        });
    } else {
        console.log('ERROR: Camera toggle button not found');
    }

    // Initialize camera toggle button state - window is hidden by default
    console.log('Initializing camera toggle state');
    const widget = $('floatingCam');
    if (widget) {
        // Check if user previously showed the camera
        let shouldShow = false;
        try {
            const saved = localStorage.getItem('wt_cam_visible');
            console.log('Saved camera visibility:', saved);
            shouldShow = saved === '1';
        } catch (e) { }

        console.log('Should show camera on init:', shouldShow);

        if (shouldShow) {
            console.log('Showing camera on init');
            widget.classList.remove('hidden');
            updateCameraToggleButton(false);
            // Initialize floating cam immediately since we're showing it
            setTimeout(() => initFloatingCam(), 100);
        } else {
            widget.classList.add('hidden');
            updateCameraToggleButton(true);
        }
    } else {
        console.log('ERROR: Floating cam widget not found during init');
    }
});

// Toggle games panel
function toggleGamesPanel() {
    const panel = document.getElementById('gamesPanel');
    const container = document.getElementById('gameContainer');
    const button = panel.querySelector('.toggle-panel');

    if (panel.classList.contains('collapsed')) {
        // Expand panel
        panel.classList.remove('collapsed');
        container.style.display = '';
        button.textContent = '−';
        button.title = 'Свернуть';
        try { localStorage.setItem('wt_games_collapsed', 'false'); } catch (e) {}
    } else {
        // Collapse panel
        panel.classList.add('collapsed');
        container.style.display = 'none';
        button.textContent = '+';
        button.title = 'Развернуть';
        try { localStorage.setItem('wt_games_collapsed', 'true'); } catch (e) {}
    }
}

// Initialize games panel state
document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('gamesPanel');
    if (panel) {
        try {
            const isMobile = window.innerWidth <= 767;
            const saved = localStorage.getItem('wt_games_collapsed');

            // На мобильных по умолчанию свернуто, на десктопе - развернуто
            const shouldCollapse = isMobile ? (saved !== 'false') : (saved === 'true');

            if (shouldCollapse) {
                panel.classList.add('collapsed');
                const container = document.getElementById('gameContainer');
                if (container) container.style.display = 'none';
                const button = panel.querySelector('.toggle-panel');
                if (button) {
                    button.textContent = '+';
                    button.title = 'Развернуть';
                }
            }
        } catch (e) {}
    }
});
