const storage = {
    mem: {},
    get(k) { try { return localStorage.getItem(k) || this.mem[k]; } catch(e) { return this.mem[k]; } },
    set(k, v) { this.mem[k] = v; try { localStorage.setItem(k, v); } catch(e) {} },
    clear() { this.mem = {}; try { localStorage.clear(); } catch(e) {} }
};

let chatsData = {};
try { const saved = storage.get('pulse_chats'); if (saved) chatsData = JSON.parse(saved); } catch(e) {}

let activeChat = null;
let ws = null; // Переменная для связи с сервером

const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const searchInput = document.getElementById('search-input');

usernameInput.addEventListener('input', function() {
    if (this.value.length > 0 && !this.value.startsWith('@')) this.value = '@' + this.value.replace(/@/g, '');
});

passwordInput.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });

function login() {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (user.length > 1 && pass.length > 0) {
        storage.set('pulse_user', user);
        enterApp(user);
    }
}

function enterApp(user) {
    document.getElementById('my-user-tag').innerText = user;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-layout').classList.add('active');
    renderChatList();
    if (activeChat) renderMessages(activeChat);
    
    // Подключаемся к серверу при входе
    connectWebSocket(user);
}

function connectWebSocket(username) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Берем текущий адрес сайта (на Render) и стучимся на канал вебсокетов
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${username}`);
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const sender = data.from;
        
        if (!chatsData[sender]) {
            chatsData[sender] = { badge: sender.slice(1, 3).toUpperCase(), unread: 0, messages: [] };
        }
        
        chatsData[sender].messages.push({ side: 'in', text: data.text, time: data.time });
        
        if (activeChat !== sender) chatsData[sender].unread += 1;
        else renderMessages(sender);
        
        saveChats();
        renderChatList(searchInput.value.trim());
    };
    
    ws.onclose = function() {
        console.log("Потеряно соединение. Переподключение...");
        setTimeout(() => connectWebSocket(username), 3000);
    };
}

function logout() {
    storage.clear();
    activeChat = null;
    if (ws) ws.close(); // Отключаемся от сервера
    document.getElementById('app-layout').classList.remove('active');
    document.getElementById('auth-screen').classList.remove('hidden');
}

function renderChatList(filter = '') {
    const listEl = document.getElementById('chat-list');
    listEl.innerHTML = '';
    const keys = Object.keys(chatsData).filter(k => k.toLowerCase().includes(filter.toLowerCase()));

    if (filter.startsWith('@') && filter.length > 2 && !chatsData[filter]) {
        const addCard = document.createElement('div');
        addCard.className = 'chat-card';
        addCard.innerHTML = `
            <div class="avatar crimson-ring">+</div>
            <div class="chat-meta"><div class="chat-name">Написать ${filter}</div></div>
        `;
        addCard.onclick = () => {
            chatsData[filter] = { badge: filter.slice(1, 3).toUpperCase(), unread: 0, messages: [] };
            saveChats(); searchInput.value = ''; openChat(filter);
        };
        listEl.appendChild(addCard);
    }

    keys.forEach(handle => {
        const chat = chatsData[handle];
        const lastMsg = chat.messages[chat.messages.length - 1];
        const card = document.createElement('div');
        card.className = 'chat-card' + (handle === activeChat ? ' selected' : '');
        card.innerHTML = `
            <div class="avatar-wrap"><div class="avatar ${handle === activeChat ? 'crimson-ring' : ''}">${chat.badge}</div></div>
            <div class="chat-meta">
                <div class="chat-top"><span class="chat-name">${handle}</span><span class="chat-time">${lastMsg ? lastMsg.time : 'новый'}</span></div>
                <div class="chat-preview"><span class="chat-last-msg">${lastMsg ? lastMsg.text : 'Нет сообщений'}</span>${chat.unread ? `<span class="unread-badge">${chat.unread}</span>` : ''}</div>
            </div>
        `;
        card.onclick = () => openChat(handle);
        listEl.appendChild(card);
    });
}

searchInput.addEventListener('input', function() {
    if (this.value.length > 0 && !this.value.startsWith('@')) this.value = '@' + this.value.replace(/@/g, '');
    renderChatList(this.value.trim());
});

function openChat(handle) {
    activeChat = handle;
    chatsData[handle].unread = 0;
    saveChats();
    document.getElementById('active-chat-name').innerText = handle;
    document.getElementById('active-avatar').innerText = chatsData[handle].badge;
    renderChatList(searchInput.value.trim());
    renderMessages(handle);
    document.getElementById('chat-window').classList.add('open');
}

function closeChat() {
    document.getElementById('chat-window').classList.remove('open');
    activeChat = null;
}

function renderMessages(handle) {
    if (!handle || !chatsData[handle]) return;
    const container = document.getElementById('messages-container');
    container.innerHTML = '<div class="date-divider">Сегодня • Сквозное шифрование</div>';
    
    (chatsData[handle].messages || []).forEach(m => {
        const b = document.createElement('div');
        b.className = `bubble ${m.side === 'out' ? 'bubble-out' : 'bubble-in'}`;
        b.innerHTML = `<span>${m.text}</span><span class="bubble-meta">${m.time}</span>`;
        container.appendChild(b);
    });
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    if (!activeChat) return;
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    // Шлём сообщение через вебсокет на сервер!
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ to: activeChat, text: text, time: time }));
    }

    chatsData[activeChat].messages.push({ side: 'out', text, time });
    saveChats();

    input.value = '';
    renderMessages(activeChat);
    renderChatList(searchInput.value.trim());
}

document.getElementById('msg-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
function saveChats() { storage.set('pulse_chats', JSON.stringify(chatsData)); }
const savedUser = storage.get('pulse_user');
if (savedUser) enterApp(savedUser);
