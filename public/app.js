// Безопасная обёртка памяти
const storage = {
    mem: {},
    get(k) {
        try { return localStorage.getItem(k) || this.mem[k]; }
        catch(e) { return this.mem[k]; }
    },
    set(k, v) {
        this.mem[k] = v;
        try { localStorage.setItem(k, v); } catch(e) {}
    },
    clear() {
        this.mem = {};
        try { localStorage.clear(); } catch(e) {}
    }
};

// Абсолютно пустая база при старте
let chatsData = {};
try {
    const saved = storage.get('pulse_chats');
    if (saved) chatsData = JSON.parse(saved);
} catch(e) {}

let activeChat = null; // При входе ни один чат не открыт

const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const searchInput = document.getElementById('search-input');

// Авто-подстановка @ в поле логина
usernameInput.addEventListener('input', function() {
    if (this.value.length > 0 && !this.value.startsWith('@')) {
        this.value = '@' + this.value.replace(/@/g, '');
    }
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
}

function logout() {
    storage.clear();
    activeChat = null;
    document.getElementById('app-layout').classList.remove('active');
    document.getElementById('auth-screen').classList.remove('hidden');
}

// Отрисовка списка контактов
function renderChatList(filter = '') {
    const listEl = document.getElementById('chat-list');
    listEl.innerHTML = '';

    const keys = Object.keys(chatsData).filter(k => k.toLowerCase().includes(filter.toLowerCase()));

    // Если в поиске вбили новый @юзернейм, предлагаем сразу создать с ним чат
    if (filter.startsWith('@') && filter.length > 2 && !chatsData[filter]) {
        const addCard = document.createElement('div');
        addCard.className = 'chat-card';
        addCard.innerHTML = `
            <div class="avatar crimson-ring">+</div>
            <div class="chat-meta">
                <div class="chat-name">Написать ${filter}</div>
                <div class="chat-last-msg">Добавить в контакты и начать диалог</div>
            </div>
        `;
        addCard.onclick = () => {
            chatsData[filter] = {
                badge: filter.slice(1, 3).toUpperCase(),
                unread: 0,
                messages: []
            };
            saveChats();
            searchInput.value = '';
            openChat(filter);
        };
        listEl.appendChild(addCard);
    }

    keys.forEach(handle => {
        const chat = chatsData[handle];
        const lastMsg = chat.messages[chat.messages.length - 1];
        const card = document.createElement('div');
        card.className = 'chat-card' + (handle === activeChat ? ' selected' : '');
        card.innerHTML = `
            <div class="avatar-wrap">
                <div class="avatar ${handle === activeChat ? 'crimson-ring' : ''}">${chat.badge}</div>
                <div class="status-dot"></div>
            </div>
            <div class="chat-meta">
                <div class="chat-top">
                    <span class="chat-name">${handle}</span>
                    <span class="chat-time">${lastMsg ? lastMsg.time : 'новый'}</span>
                </div>
                <div class="chat-preview">
                    <span class="chat-last-msg">${lastMsg ? lastMsg.text : 'Нет сообщений'}</span>
                    ${chat.unread ? `<span class="unread-badge">${chat.unread}</span>` : ''}
                </div>
            </div>
        `;
        card.onclick = () => openChat(handle);
        listEl.appendChild(card);
    });
}

// Поиск и добавление новых юзеров на лету
searchInput.addEventListener('input', function() {
    if (this.value.length > 0 && !this.value.startsWith('@')) {
        this.value = '@' + this.value.replace(/@/g, '');
    }
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
    activeChat = null; // Сбрасываем активный чат при закрытии шторки
}

function renderMessages(handle) {
    if (!handle || !chatsData[handle]) return;
    
    const container = document.getElementById('messages-container');
    container.innerHTML = '<div class="date-divider">Сегодня • Сквозное шифрование</div>';
    const msgs = chatsData[handle].messages || [];

    msgs.forEach(m => {
        const b = document.createElement('div');
        b.className = `bubble ${m.side === 'out' ? 'bubble-out' : 'bubble-in'}`;
        b.innerHTML = `
            <span>${m.text}</span>
            <span class="bubble-meta">${m.time} ${m.side === 'out' ? '✓✓' : ''}</span>
        `;
        container.appendChild(b);
    });
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    if (!activeChat) return; // Защита: нельзя отправить, если не открыт чат

    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    chatsData[activeChat].messages.push({ side: 'out', text, time });
    saveChats();

    input.value = '';
    renderMessages(activeChat);
    renderChatList(searchInput.value.trim());
}

document.getElementById('msg-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

function saveChats() {
    storage.set('pulse_chats', JSON.stringify(chatsData));
}

// Авто-вход, если уже логинились
const savedUser = storage.get('pulse_user');
if (savedUser) enterApp(savedUser);
