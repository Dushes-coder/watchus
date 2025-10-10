#!/usr/bin/env node

// Простой скрипт для проверки работоспособности сервера
const http = require('http');

const serverUrl = process.argv[2] || 'http://localhost:3000';

console.log(`🔍 Проверка сервера: ${serverUrl}`);

// Проверяем основной endpoint
http.get(`${serverUrl}/`, (res) => {
    console.log(`✅ Основной сайт: ${res.statusCode}`);

    // Проверяем health endpoint
    http.get(`${serverUrl}/health`, (res) => {
        console.log(`✅ Health check: ${res.statusCode}`);
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const health = JSON.parse(data);
                console.log(`📊 Комнат: ${health.rooms}`);
                console.log(`🎮 Игр: ${health.games}`);
                console.log(`⏱️ Uptime: ${Math.round(health.uptime / 60)} мин`);
            } catch (e) {
                console.log('⚠️ Не удалось разобрать ответ health check');
            }
        });
    }).on('error', () => {
        console.log('❌ Health check недоступен');
    });

}).on('error', () => {
    console.log('❌ Основной сайт недоступен');
    console.log('💡 Убедитесь, что сервер запущен командой: npm start');
});
