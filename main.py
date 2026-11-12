from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
from typing import Dict, List

app = FastAPI()

# Разрешаем фронтенду с GitHub Pages стучаться к серверу
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        # Храним активные подключения: {"@Илюша": websocket_объект}
        self.active_connections: Dict[str, WebSocket] = {}
        # Буфер для оффлайн юзеров: {"@Илюша": [{"from": "@user", "text": "Привет", "time": "20:00"}]}
        self.offline_buffer: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket
        
        # Если юзер зашёл, а в буфере его ждут сообщения — вываливаем их ему
        if username in self.offline_buffer and self.offline_buffer[username]:
            for msg in self.offline_buffer[username]:
                await websocket.send_text(json.dumps(msg))
            # Очищаем память, так как сообщения доставлены
            self.offline_buffer[username] = []

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def send_personal_message(self, message: dict, receiver: str):
        if receiver in self.active_connections:
            # Собеседник в сети — кидаем напрямую в вебсокет
            await self.active_connections[receiver].send_text(json.dumps(message))
        else:
            # Собеседник оффлайн — сохраняем в оперативку
            if receiver not in self.offline_buffer:
                self.offline_buffer[receiver] = []
            self.offline_buffer[receiver].append(message)

manager = ConnectionManager()

# Эндпоинт для анти-сна (пингуем его с внешнего сервиса)
@app.get("/ping")
async def ping():
    return {"status": "alive"}

# Главный канал, куда подключается фронтенд
@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket, username)
    try:
        while True:
            # Ждём текст от клиента
            data = await websocket.receive_text()
            try:
                # Ожидаем, что фронтенд пришлёт JSON вида: {"to": "@Илюша", "text": "Текст", "time": "21:00"}
                message_data = json.loads(data)
                # Добавляем инфу, от кого это прилетело
                message_data["from"] = username 
                # Пересылаем адресату
                await manager.send_personal_message(message_data, message_data["to"])
            except json.JSONDecodeError:
                pass # Если прилетел какой-то мусор вместо JSON, игнорируем
    except WebSocketDisconnect:
        manager.disconnect(username)

