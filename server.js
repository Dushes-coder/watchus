const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = new Server(server);


app.use(express.static(path.join(__dirname, 'public')));


// Простая маршрутизация: / -> интерфейс создания комнаты
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));


// Храним простое состояние комнаты в памяти: { url, time, playing }
const roomStates = new Map();

io.on('connection', (socket) => {
	console.log('user connected', socket.id);

	socket.on('join-room', ({ roomId }) => {
		socket.join(roomId);
		console.log(socket.id, 'joined', roomId);
		// отправляем текущее состояние комнаты, если есть
		const state = roomStates.get(roomId) || null;
		socket.emit('room-state', { state });
	});

	// Синхронизирующие события: play, pause, seek, load
	socket.on('player-event', ({ roomId, type, data }) => {
		// обновляем состояние комнаты для новых участников
		let state = roomStates.get(roomId) || { url: null, time: 0, playing: false };
		if (type === 'load') {
			state.url = data.url || null;
			state.time = data.time || 0;
			state.playing = false;
			roomStates.set(roomId, state);
		} else if (type === 'play') {
			state.time = data.time || state.time;
			state.playing = true;
			roomStates.set(roomId, state);
		} else if (type === 'pause') {
			state.time = data.time || state.time;
			state.playing = false;
			roomStates.set(roomId, state);
		} else if (type === 'seek') {
			state.time = data.time || state.time;
			roomStates.set(roomId, state);
		}

		// ретранслируем всем кроме отправителя
		socket.to(roomId).emit('player-event', { type, data });
	});

	// Загрузка / смена видео (альтернатива через player-event type: 'load')
	socket.on('load-video', ({ roomId, url }) => {
		const state = { url, time: 0, playing: false };
		roomStates.set(roomId, state);
		io.in(roomId).emit('player-event', { type: 'load', data: { url, time: 0 } });
	});

	// Простой чат — ретранслируем всем в комнате
	socket.on('chat-message', ({ roomId, author, message }) => {
		io.in(roomId).emit('chat-message', { author, message, time: Date.now() });
	});

	// WebRTC signaling: offer/answer/ice
	socket.on('webrtc-offer', ({ roomId, sdp }) => {
		// ретранслируем всем кроме отправителя
		socket.to(roomId).emit('webrtc-offer', { from: socket.id, sdp });
	});

	socket.on('webrtc-answer', ({ roomId, sdp }) => {
		socket.to(roomId).emit('webrtc-answer', { from: socket.id, sdp });
	});

	socket.on('webrtc-ice', ({ roomId, candidate }) => {
		socket.to(roomId).emit('webrtc-ice', { from: socket.id, candidate });
	});

	socket.on('disconnect', () => {
		console.log('user disconnected', socket.id);
	});
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));