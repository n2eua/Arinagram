from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import json
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.offline_buffer: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket
        
        if username in self.offline_buffer and self.offline_buffer[username]:
            for msg in self.offline_buffer[username]:
                await websocket.send_text(json.dumps(msg))
            self.offline_buffer[username] = []

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def send_personal_message(self, message: dict, receiver: str):
        if receiver in self.active_connections:
            await self.active_connections[receiver].send_text(json.dumps(message))
        else:
            if receiver not in self.offline_buffer:
                self.offline_buffer[receiver] = []
            self.offline_buffer[receiver].append(message)

manager = ConnectionManager()

@app.get("/ping")
async def ping():
    return {"status": "alive"}

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket, username)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_data["from"] = username 
                await manager.send_personal_message(message_data, message_data["to"])
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(username)

# ЖЕЛЕЗОБЕТОННАЯ РАЗДАЧА ФРОНТЕНДА
@app.get("/")
async def get_index():
    return FileResponse("public/index.html")

app.mount("/", StaticFiles(directory="public"), name="public")
