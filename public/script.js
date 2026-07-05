// --- Inisialisasi Elemen ---
const userInput = document.getElementById('userInput');
const chatBox = document.getElementById('chatBox');
const themeToggle = document.getElementById('themeToggle');
const clearBtn = document.getElementById('clearBtn');
const sendBtn = document.getElementById('sendBtn');
const scrollBtn = document.getElementById('scrollToBottomBtn');
const menuItems = document.querySelectorAll('.menu-item');
const views = document.querySelectorAll('.view');
const headerTitle = document.getElementById('headerTitle');

// KONFIGURASI MODE (Harus sama dengan server.js)
const IS_SIMULATION = false; 

let aiTimer = null; 
let typewriterTimeout = null; 
let userIsScrollingUp = false; 
let isAiResponding = false; 
let abortController = null; 
let activeArea = 'sidebar'; 

sendBtn.disabled = false;

function showTyping() {
    const lastModelMessage = chatBox.querySelector('.message.model:last-child');
    if (lastModelMessage) {
        const dots = lastModelMessage.querySelector('.typing-dots');
        if (dots) dots.style.display = 'flex';
    }
}

function hideTyping() {
    const dots = document.querySelectorAll('.typing-dots');
    dots.forEach(dot => dot.style.display = 'none');
}

// --- Logika Utama ---
function switchView(targetId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    if (targetId === 'view-chat') clearBtn.style.display = 'flex'; else clearBtn.style.display = 'none';

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-target') === targetId) {
            item.classList.add('active');
            const customTitle = item.getAttribute('data-title');
            if (customTitle) headerTitle.innerText = customTitle;
        }
    });
    localStorage.setItem('activeMenu', targetId);
    if (targetId === 'view-chat') smoothScrollToBottom();
}

function updateWelcomeMessage() {
    observer.disconnect();
    let welcomeMsg = document.getElementById('welcomeMessage');
    const hasMessages = chatBox.querySelectorAll('.message').length > 0;
    if (!hasMessages) {
        if (!welcomeMsg) {
            welcomeMsg = document.createElement('div');
            welcomeMsg.id = 'welcomeMessage';
            welcomeMsg.innerHTML = `<span class="material-icons-outlined welcome-icon">restaurant_menu</span>
                <div class="welcome-text">Halo, SurkenBot siap membantu perjalanan Kuliner Anda di Suryakencana Bogor!</div>`;
            chatBox.appendChild(welcomeMsg);
        }
    } else {
        if (welcomeMsg) welcomeMsg.remove();
    }
    observer.observe(chatBox, { childList: true });
}

const observer = new MutationObserver(updateWelcomeMessage);

chatBox.addEventListener('scroll', () => {
    const isAtBottom = (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight) < 50;
    userIsScrollingUp = !isAtBottom; 
    scrollBtn.classList.toggle('visible', userIsScrollingUp);
});

function smoothScrollToBottom() {
    const start = chatBox.scrollTop;
    const end = Math.max(0, chatBox.scrollHeight - chatBox.clientHeight);
    const distance = end - start;
    const duration = 600; 
    let startTime = null;
    function animation(currentTime) {
        if (!startTime) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        chatBox.scrollTop = start + (distance * ease);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }
    requestAnimationFrame(animation);
}

function formatText(text) {
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<u>$1</u>');
}

function saveChatHistory() {
    const history = [];
    document.querySelectorAll('.message').forEach(msg => {
        const span = msg.querySelector('span:first-child');
        const text = span.innerText.replace(/content_copy|edit/g, "").trim(); 
        if (text) history.push({ text: text, sender: msg.classList.contains('user') ? 'user' : 'model' });
    });
    localStorage.setItem('surkenChatData', JSON.stringify(history));
}

function getChatHistoryForAPI() {
    const allMessages = Array.from(document.querySelectorAll('.message'));
    
    return allMessages.map(msg => {
        const span = msg.querySelector('span:first-child');
        const text = span.innerText.replace(/content_copy|edit/g, "").trim();
        return {
            role: msg.classList.contains('user') ? 'user' : 'model',
            parts: [{ text: text }]
        };
    });
}

function typeWriter(element, text, index = 0, onComplete) {
    if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        if (!userIsScrollingUp) requestAnimationFrame(smoothScrollToBottom);
        typewriterTimeout = setTimeout(() => typeWriter(element, text, index, onComplete), 30);
    } else {
        element.innerHTML = formatText(text).replace(/\n/g, '<br>');
        if (!userIsScrollingUp) smoothScrollToBottom();
        if (onComplete) onComplete();
    }
}

function updateUIState(responding) {
    isAiResponding = responding;
    const btn = document.getElementById('sendBtn');
    const iconSend = document.getElementById('icon-send');
    const iconStop = document.getElementById('icon-stop');
    
    if (!btn || !iconSend || !iconStop) return;

    if (responding) {
        btn.classList.add('stop-mode');
        iconSend.style.display = "none";
        iconStop.style.display = "block";
        btn.style.backgroundColor = "#ff5252";
    } else {
        btn.classList.remove('stop-mode');
        iconSend.style.display = "block";
        iconStop.style.display = "none";
        btn.style.backgroundColor = "";
    }
    btn.disabled = false;
}

function stopAiResponse() {
    if (abortController) abortController.abort();
    clearTimeout(aiTimer);
    clearTimeout(typewriterTimeout);
    const dynamicMsg = chatBox.querySelector('.message.model:last-child span:first-child');
    if (dynamicMsg && dynamicMsg.querySelector('.typing-dots')) {
        dynamicMsg.innerHTML = "*Respons dihentikan oleh pengguna.*";
    }
    updateUIState(false);
    saveChatHistory();
    userInput.focus();
}

function addMessage(text, sender, isLoad = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    const textSpan = document.createElement('span');
    msgDiv.appendChild(textSpan);
    msgDiv.appendChild(createActionContainer(msgDiv));
    chatBox.appendChild(msgDiv);

    if (isLoad) {
        textSpan.innerHTML = formatText(text).replace(/\n/g, '<br>');
        msgDiv.classList.add('show'); 
        refreshEditButtons();
        return; 
    }

    if (sender === 'model') {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-dots';
        typingDiv.style.display = 'flex';
        typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        
        textSpan.appendChild(typingDiv); 
        msgDiv.classList.add('show');
        
        if (!userIsScrollingUp) smoothScrollToBottom();

        aiTimer = setTimeout(() => {
            typingDiv.remove(); 
            typeWriter(textSpan, text, 0, () => { 
                updateUIState(false); 
                saveChatHistory(); 
            });
        }, 1500); 
    } else {
        textSpan.innerHTML = formatText(text).replace(/\n/g, '<br>');
        msgDiv.classList.add('show');
        smoothScrollToBottom();
        saveChatHistory(); 
    }
    refreshEditButtons();
}

async function handleSendMessage() {
    if (isAiResponding) {
        stopAiResponse();
        return;
    }

    const text = userInput.value.trim();
    if (text === "") return;

    userIsScrollingUp = false; 
    addMessage(text, 'user');
    userInput.value = "";
    userInput.style.height = 'auto'; 
    
    updateUIState(true); 
    abortController = new AbortController();

    const currentHistory = getChatHistoryForAPI();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: currentHistory }), 
            signal: abortController.signal
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Gagal memproses jawaban");
        }

        if (data.reply) {
            addMessage(data.reply, 'model');
        } else {
            addMessage("Maaf, tidak ada respon dari server.", 'model');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            addMessage(error.message, 'model');
        }
    } finally {
        // updateUIState(false) dihandle oleh typeWriter
    }
}

function createActionContainer(msgDiv) {
    const actionContainer = document.createElement('div');
    actionContainer.classList.add('message-actions');
    const copyBtn = document.createElement('span');
    copyBtn.innerHTML = 'content_copy';
    copyBtn.classList.add('material-icons-outlined', 'copy-btn');
    copyBtn.onclick = () => {
        const currentText = msgDiv.querySelector('span:first-child').innerText;
        navigator.clipboard.writeText(currentText);
        copyBtn.textContent = 'check';
        setTimeout(() => copyBtn.textContent = 'content_copy', 2000);
    };
    actionContainer.appendChild(copyBtn);
    return actionContainer;
}

function refreshEditButtons() {
    document.querySelectorAll('.edit-btn').forEach(btn => btn.remove());
    const userMessages = document.querySelectorAll('.message.user');
    if (userMessages.length > 0) {
        const lastUserMsg = userMessages[userMessages.length - 1];
        const actionContainer = lastUserMsg.querySelector('.message-actions');
        const editBtn = document.createElement('span');
        editBtn.innerHTML = 'edit';
        editBtn.classList.add('material-icons-outlined', 'copy-btn', 'edit-btn');
        editBtn.style.marginRight = '10px';
        editBtn.onclick = () => { if (!isAiResponding) enableEditMode(lastUserMsg, lastUserMsg.querySelector('span:first-child').innerText); };
        actionContainer.insertBefore(editBtn, actionContainer.querySelector('.copy-btn'));
    }
}

function enableEditMode(msgDiv, originalText) {
    if (isAiResponding) return;
    const textSpan = msgDiv.querySelector('span:first-child');
    const actionContainer = msgDiv.querySelector('.message-actions');
    textSpan.style.display = 'none';
    actionContainer.style.display = 'none';
    const editArea = document.createElement('textarea');
    editArea.value = originalText;
    editArea.classList.add('edit-textarea');
    const actionDiv = document.createElement('div');
    actionDiv.classList.add('edit-actions');
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Batal';
    cancelBtn.onclick = () => finishEdit(msgDiv, textSpan, actionContainer, editArea, actionDiv);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Perbarui';
    const doSave = () => {
        const newText = editArea.value.trim();
        if (newText) {
            textSpan.innerHTML = formatText(newText).replace(/\n/g, '<br>');
            finishEdit(msgDiv, textSpan, actionContainer, editArea, actionDiv);
            if (newText !== originalText) triggerAiResponse(newText, msgDiv);
        }
    };
    saveBtn.onclick = doSave;
    editArea.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSave(); } });
    actionDiv.appendChild(cancelBtn);
    actionDiv.appendChild(saveBtn);
    msgDiv.appendChild(editArea);
    msgDiv.appendChild(actionDiv);
    editArea.focus();
}

function finishEdit(msgDiv, textSpan, actionContainer, editArea, actionDiv) {
    textSpan.style.display = 'block';
    actionContainer.style.display = 'flex';
    editArea.remove();
    actionDiv.remove();
    refreshEditButtons();
    saveChatHistory();
}

async function triggerAiResponse(text, msgDiv) {
    if (abortController) abortController.abort();
    if (msgDiv.nextElementSibling) msgDiv.nextElementSibling.remove();
    sendBtn.disabled = true;
    updateUIState(true);
    abortController = new AbortController();
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: getChatHistoryForAPI() }),
            signal: abortController.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memproses pembaruan.");
        if (data.reply) addMessage(data.reply, 'model');
    } catch (error) {
        if (error.name !== 'AbortError') {
            addMessage(error.message, 'model');
            updateUIState(false);
        }
    } finally {
        // updateUIState(false) dihandle oleh typeWriter
    }
}

// --- Event Listeners ---
document.querySelector('#sidebar').addEventListener('click', () => activeArea = 'sidebar');
document.querySelector('#app').addEventListener('click', () => activeArea = 'content');
menuItems.forEach(item => { item.addEventListener('click', () => switchView(item.getAttribute('data-target'))); });
document.addEventListener('keydown', (e) => {
    if (document.activeElement === userInput || document.activeElement.classList.contains('edit-textarea')) return;
    if (activeArea === 'sidebar') {
        const menuItemsArr = Array.from(document.querySelectorAll('.menu-item'));
        const currentIndex = menuItemsArr.findIndex(item => item.classList.contains('active'));
        if (e.key === 'ArrowDown') { e.preventDefault(); menuItemsArr[(currentIndex + 1) % menuItemsArr.length].click(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); menuItemsArr[(currentIndex - 1 + menuItemsArr.length) % menuItemsArr.length].click(); }
    } else if (activeArea === 'content') {
        const activeView = document.querySelector('.view.active');
        if (e.key === 'ArrowDown') { e.preventDefault(); activeView.scrollTop += 50; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeView.scrollTop -= 50; }
    }
});

sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
userInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
scrollBtn.addEventListener('click', () => { smoothScrollToBottom(); userIsScrollingUp = false; });
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    themeToggle.querySelector('span').textContent = isDarkMode ? 'light_mode' : 'dark_mode';
});
clearBtn.addEventListener('click', () => { 
    if (isAiResponding) stopAiResponse();
    chatBox.innerHTML = ""; 
    localStorage.removeItem('surkenChatData'); 
    updateWelcomeMessage(); 
});
window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.querySelector('span').textContent = 'light_mode';
    }
    const savedData = localStorage.getItem('surkenChatData');
    if (savedData) {
        JSON.parse(savedData).forEach(item => addMessage(item.text, item.sender, true));
        setTimeout(smoothScrollToBottom, 100); 
    }
    updateWelcomeMessage();
    switchView(localStorage.getItem('activeMenu') || 'view-chat');
});