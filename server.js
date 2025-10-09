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

// Храним состояние игр для каждой комнаты: { gameType, gameState, players }
const gameStates = new Map();

io.on('connection', (socket) => {
	console.log('user connected', socket.id);

	socket.on('join-room', ({ roomId }) => {
		socket.join(roomId);
		console.log(socket.id, 'joined', roomId);
		// отправляем текущее состояние комнаты, если есть
		const state = roomStates.get(roomId) || null;
		socket.emit('room-state', { state });
		
		// отправляем текущее состояние игры, если есть
		const gameState = gameStates.get(roomId);
		if (gameState) {
			socket.emit('game-state', gameState);
		}
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

	// === ИГРОВЫЕ СОБЫТИЯ ===
	
	// Начало новой игры
	socket.on('game-start', ({ roomId, gameType }) => {
		console.log(`Game started: ${gameType} in room ${roomId}`);
		let initialState = null;
		
		if (gameType === 'chess') {
			initialState = {
				gameType: 'chess',
				board: [
					['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
					['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
					['', '', '', '', '', '', '', ''],
					['', '', '', '', '', '', '', ''],
					['', '', '', '', '', '', '', ''],
					['', '', '', '', '', '', '', ''],
					['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
					['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
				],
				currentPlayer: 'white',
				selectedCell: null
			};
		} else if (gameType === 'tictactoe') {
			initialState = {
				gameType: 'tictactoe',
				board: [['', '', ''], ['', '', ''], ['', '', '']],
				currentPlayer: 'X',
				gameOver: false,
				winner: null
			};
		} else if (gameType === 'cards') {
			// Создаём колоду
			const suits = ['♠', '♥', '♦', '♣'];
			const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
			const deck = [];
			for (let suit of suits) {
				for (let value of values) {
					deck.push({ suit, value });
				}
			}
			// Перемешиваем
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}
			// Раздаём карты
			const player1Hand = [];
			const player2Hand = [];
			for (let i = 0; i < 6; i++) {
				player1Hand.push(deck.pop());
				player2Hand.push(deck.pop());
			}
			initialState = {
				gameType: 'cards',
				deck: deck,
				player1Hand: player1Hand,
				player2Hand: player2Hand,
				tableCards: [],
				currentPlayer: 'player1',
				trumpCard: deck.length > 0 ? deck[0] : null
			};
		}
		
		if (initialState) {
			gameStates.set(roomId, initialState);
			io.in(roomId).emit('game-state', initialState);
		}
	});
	
	// Ход в игре
	socket.on('game-move', ({ roomId, gameType, move }) => {
		const gameState = gameStates.get(roomId);
		if (!gameState || gameState.gameType !== gameType) return;
		
		if (gameType === 'chess') {
			// Применяем ход
			const { from, to } = move;
			const piece = gameState.board[from.row][from.col];
			gameState.board[from.row][from.col] = '';
			gameState.board[to.row][to.col] = piece;
			gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
			gameState.selectedCell = null;
		} else if (gameType === 'tictactoe') {
			// Применяем ход
			const { row, col, player } = move;
			if (gameState.board[row][col] === '' && !gameState.gameOver) {
				gameState.board[row][col] = player;
				gameState.currentPlayer = player === 'X' ? 'O' : 'X';
				// Проверка победителя
				const winner = checkTicTacToeWinner(gameState.board);
				if (winner) {
					gameState.gameOver = true;
					gameState.winner = winner;
				}
			}
		} else if (gameType === 'cards') {
			// Применяем ход
			const { action, card, player } = move;
			if (action === 'play' && player === gameState.currentPlayer) {
				const hand = player === 'player1' ? gameState.player1Hand : gameState.player2Hand;
				const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
				if (cardIndex !== -1) {
					hand.splice(cardIndex, 1);
					gameState.tableCards.push(card);
					gameState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
				}
			} else if (action === 'deal') {
				// Раздать новые карты
				if (gameState.deck.length >= 2) {
					if (gameState.player1Hand.length < 6 && gameState.deck.length > 0) {
						gameState.player1Hand.push(gameState.deck.pop());
					}
					if (gameState.player2Hand.length < 6 && gameState.deck.length > 0) {
						gameState.player2Hand.push(gameState.deck.pop());
					}
				}
			}
		}
		
		gameStates.set(roomId, gameState);
		io.in(roomId).emit('game-state', gameState);
	});
	
	// Закрытие игры
	socket.on('game-close', ({ roomId }) => {
		gameStates.delete(roomId);
		io.in(roomId).emit('game-closed');
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

// Вспомогательная функция для проверки победителя в крестиках-ноликах
function checkTicTacToeWinner(board) {
	// Проверяем строки
	for (let row = 0; row < 3; row++) {
		if (board[row][0] && board[row][0] === board[row][1] && board[row][0] === board[row][2]) {
			return board[row][0];
		}
	}
	// Проверяем столбцы
	for (let col = 0; col < 3; col++) {
		if (board[0][col] && board[0][col] === board[1][col] && board[0][col] === board[2][col]) {
			return board[0][col];
		}
	}
	// Проверяем диагонали
	if (board[0][0] && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
		return board[0][0];
	}
	if (board[0][2] && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
		return board[0][2];
	}
	// Проверяем ничью
	let isDraw = true;
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			if (board[row][col] === '') {
				isDraw = false;
				break;
			}
		}
		if (!isDraw) break;
	}
	return isDraw ? 'draw' : null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));