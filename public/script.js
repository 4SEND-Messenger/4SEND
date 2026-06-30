if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(()=>{});
    });
}
const globalLocale = window.currentLang === 'en' ? 'en-US' : 'ru-RU';
const _origFetch = window.fetch;
window.fetch = function(url, opts) {
    opts = opts || {};
    if (opts.headers instanceof Headers) {
        opts.headers.set('X-Language', window.currentLang || 'en');
    } else {
        opts.headers = Object.assign({}, opts.headers, { 'X-Language': window.currentLang || 'en' });
    }
    return _origFetch.call(this, url, opts);
};
let socket,isSending=false,isChatLoading=false,msgContainer,contactsContainer,sInput;
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !appLocked) {
        const minutes = parseInt(localStorage.getItem('4send_lock_time'));
        const savedPin = localStorage.getItem('4send_pin');
        if (minutes > 0 && savedPin) {
            if (Date.now() - lastActivityTime >= minutes * 60 * 1000) {
                lockApp();
            } else {
                resetIdleTimer();
            }
        }
    }
});
if (localStorage.getItem('4send_lock_time')) resetIdleTimer();
document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('4send_user');
    const token = localStorage.getItem('4send_token');
    const avatar = localStorage.getItem('4send_avatar');
    const isVer = localStorage.getItem('4send_isVerified') === '1';
    const dName = localStorage.getItem('4send_displayName') || user;
    
    const dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('4send_db',1);req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains('cache'))db.createObjectStore('cache');};req.onsuccess=e=>resolve(e.target.result);req.onerror=e=>reject(e.target.error);});
    async function idbSet(key,val){try{const db=await dbPromise;const tx=db.transaction('cache','readwrite');tx.objectStore('cache').put(val,key);return new Promise(r=>tx.oncomplete=r);}catch{}}
    async function idbGet(key){try{const db=await dbPromise;const tx=db.transaction('cache','readonly');const req=tx.objectStore('cache').get(key);return new Promise(r=>req.onsuccess=()=>r(req.result));}catch{return null;}}
    
    const style=document.createElement('style');
    style.innerHTML=`.msg-wrapper-cv{contain-intrinsic-size:auto 80px;}`;
    document.head.appendChild(style);
        
    if (!user || !token) {
        localStorage.removeItem('4send_user');
        localStorage.removeItem('4send_session');
        typeof scatterPattern === 'function' && scatterPattern();
    } else {
        const mainApp = document.getElementById('main-app');
        if (mainApp) {
            mainApp.style.filter = 'blur(15px)';
            mainApp.style.transition = 'filter 0.8s ease';
            setTimeout(() => {
                mainApp.style.filter = 'blur(0px)';
                mainApp.classList.add('main-clear');
            }, 100);
        }
        
        const safeUser = String(user).replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));
        const safeDName = String(dName).replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));
        const myName = document.getElementById('my-name');
        const nameHtml = safeDName + (isVer ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '') : '');
        
        if (myName) myName.innerHTML = nameHtml;
        
        if (typeof updateDrawerNameUI === 'function') {
            updateDrawerNameUI(dName, user, isVer);
        }
        
        if (typeof updateAvatarUI === 'function') {
            updateAvatarUI('my-avatar', avatar, user);
            updateAvatarUI('drawer-av-box', avatar, user);
        }
        
        if (typeof saveCurrentAccount === 'function') saveCurrentAccount();
        
        typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
        if (window.socket && window.socket.connected) {
            window.socket.emit('join', user);
        }
    }
});

if(window.isSocketInitialized){
    socket=window.socketInstance;
}else{
    window.isSocketInitialized=true;
    const token = localStorage.getItem('4send_token');
    socket=io({ auth: { token }, query: { lang: window.currentLang || 'en' } });
    window.socketInstance=socket;
    msgContainer=document.getElementById('msg-container');
    contactsContainer=document.getElementById('contacts');
    sInput=document.getElementById('searchInput')??document.getElementById('search');
    
    let searchTimeout;
    
    const doSearch = q => {
        q && socket?.connected ? socket.emit('search_user', q) : typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
    };

    if(sInput){
        sInput.oninput = e => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                doSearch(e.target.value.trim());
            }, 500);
        };
        sInput.onkeydown = e => {
            if(e.key !== 'Enter') return;
            e.preventDefault();
            clearTimeout(searchTimeout);
            const q = sInput.value.trim();
            doSearch(q);
            q && sInput.blur();
            return false;
        };
    }
    
    socket.on('search_results', data => {
        if (!contactsContainer) return;
        
        let users = [];
        let rooms =[];
        
        if (Array.isArray(data)) {
            users = data;
        } else if (data) {
            users = data.users || [];
            rooms = data.rooms ||[];
        }

        if (!users.length && !rooms.length) {
            contactsContainer.innerHTML = `
                <div data-search="true" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:40px 20px; color:#888; text-align:center;">
                    <svg viewBox="0 0 24 24" style="width:64px; height:64px; fill:none; stroke:#a74fff; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; margin-bottom:15px; animation: searchWobble 2s infinite ease-in-out;">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <div style="font-size:14px; font-weight:500; color:#aaa;">${t('Ничего не найдено')}</div>
                    <div style="font-size:12px; color:#777; margin-top:5px;">${t('Попробуйте другой запрос')}</div>
                    <style>
                        @keyframes searchWobble {
                            0%, 100% { transform: rotate(0deg) translateX(0); }
                            25% { transform: rotate(-10deg) translateX(-3px); }
                            75% { transform: rotate(10deg) translateX(3px); }
                        }
                    </style>
                </div>
            `;
            return;
        }

        let html = '';
        users.forEach(u => {
            const dName = u.displayName || u.username;
            const avatar = typeof getAvatarHtml === 'function' ? getAvatarHtml(dName, u.avatar, 42) : `<div class="avatar-stub" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:#252530;border-radius:50%;color:#a74fff;font-weight:bold;">${dName[0].toUpperCase()}</div>`;
            html += `<div class="contact-item" data-search="true" data-username="${escapeAttr(u.username)}" onclick="selectChat('${escapeAttr(u.username)}')" style="cursor:pointer;display:flex;align-items:center;padding:10px 15px;transition:.2s"><div class="avatar" style="width:42px;height:42px;flex-shrink:0;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center">${avatar}</div><div style="margin-left:12px;overflow:hidden;flex:1;"><div style="font-weight:600;color:#eee;font-size:14px;display:flex;align-items:center;overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(dName)}</span>${u.isVerified?getVerifyBadgeHtml('user'):''}</div><div style="font-size:12px;color:#a74fff;opacity:.8">@${escapeHTML(u.username)}</div></div></div>`;
        });

        rooms.forEach(r => {
            const avatar = typeof getAvatarHtml === 'function' ? getAvatarHtml(r.name, r.avatar, 42) : '';
            html += `<div class="contact-item" data-search="true" onclick="previewRoom('${escapeAttr(r.roomId)}')" style="cursor:pointer;display:flex;align-items:center;padding:10px 15px;transition:.2s"><div style="width:42px;height:42px;flex-shrink:0;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center">${avatar}</div><div style="margin-left:12px;overflow:hidden;flex:1;"><div style="font-weight:600;color:#eee;font-size:14px;display:flex;align-items:center;overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(r.name)}</span>${r.isVerified?getVerifyBadgeHtml(r.type):''}</div><div style="font-size:12px;color:#a74fff;opacity:.8">${r.type === 'channel' ? t('Публичный канал') : t('Публичная группа')}</div></div></div>`;
        });

        contactsContainer.innerHTML = html;
    });
    
    socket.on('auth_success', u => {
        window.me = u.username || u;
        const avatar = u.avatar || localStorage.getItem('4send_avatar');
        const isVer = u.isVerified || localStorage.getItem('4send_isVerified') === '1';
        const displayName = u.displayName || u.username || window.me;
        
        localStorage.setItem('4send_user', window.me);
        if (u.isVerified !== undefined) localStorage.setItem('4send_isVerified', u.isVerified ? '1' : '0');
        if (avatar) localStorage.setItem('4send_avatar', avatar);
        if (u.displayName) localStorage.setItem('4send_displayName', u.displayName);
        if (u.notificationRepeat !== undefined) localStorage.setItem('4send_notif_repeat', u.notificationRepeat);
        
        if (typeof saveCurrentAccount === 'function') saveCurrentAccount();
        
        const screen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');
        
        if (screen) {
            screen.style.transition = 'opacity 0.5s ease';
            screen.style.opacity = '0';
            setTimeout(() => { screen.style.display = 'none'; screen.classList.remove('auth-exit'); }, 500);
        }
        
        if (mainApp) {
            Object.assign(mainApp.style, { display: 'flex', opacity: '0', filter: 'blur(15px)', transition: 'opacity 0.8s ease, filter 0.8s ease', visibility: 'visible' });
            void mainApp.offsetWidth;
            setTimeout(() => {
                mainApp.style.opacity = '1';
                mainApp.style.filter = 'blur(0px)';
                mainApp.classList.add('main-clear');
            }, 50);
        }
        
        const mn = document.getElementById('my-name');
        
        if (mn) {
            mn.style.display = 'flex';
            mn.style.alignItems = 'center';
            mn.style.overflow = 'hidden';
            mn.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(displayName)}</span>${isVer ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '') : ''}`;
        }
        
        if (typeof updateDrawerNameUI === 'function') {
            updateDrawerNameUI(displayName, window.me, isVer);
        }
        
        if (typeof updateAvatarUI === 'function') {
            updateAvatarUI('my-avatar', avatar, window.me);
            updateAvatarUI('drawer-av-box', avatar, window.me);
        }
        
        setTimeout(() => window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now(), 100);
    });

    socket.on('new_message', async data => {
        const {id, sender, receiver, text, reply_to} = data;
        if(id && document.getElementById(`msg-${id}`)) return;
        
        if (data.tempId && pendingMessages.has(data.tempId)) {
            clearTimeout(pendingMessages.get(data.tempId).timeout);
            pendingMessages.delete(data.tempId);
        }
        
        const myId = String(me||'').toLowerCase().trim();
        const s = String(sender||'').toLowerCase().trim();
        const r = String(receiver||'').toLowerCase().trim();
        const currentTarget = String(target||'').toLowerCase().trim();
        
        if(text && typeof clarify==='function') data.text = clarify(text, id);
        if(reply_to && typeof clarify==='function') data.reply_to = clarify(reply_to, id);
        
        typeof loadChatsWithPreview==='function' && await loadChatsWithPreview();
        
        const isCurrent = currentTarget && (
            (s === currentTarget && r === myId) || 
            (s === myId && r === currentTarget) || 
            (r.startsWith('room_') && r === currentTarget) 
        );
        
        if(isCurrent){
            if(typeof renderMessage==='function') renderMessage(data);
            
            const t = (data.text||'').toLowerCase();['🎉','🥳','ура','поздравляю','🎊','🎈','congrats'].some(x=>t.includes(x)) && typeof launchConfetti==='function' && launchConfetti();
            
            if(msgContainer){
                const nearBottom = msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 500;
                if(s===myId || nearBottom){
                    msgContainer.scrollTop = msgContainer.scrollHeight;
                    setTimeout(() => msgContainer.scrollTop = msgContainer.scrollHeight, 150);
                }
            }
            if(s!==myId) socket.emit('mark_read', {sender, receiver: me});
        }
        
        if(s!==myId){
            const el = document.querySelector(`.contact-item[data-username="${sender}"]`);
            if(el?.getAttribute('data-muted')!=='1'){
                const vol = parseFloat(localStorage.getItem('4send_volume') ?? 1);
                if (vol > 0) {
                    if(typeof chatNotify!=='undefined') {
                        chatNotify.volume = vol;
                        chatNotify.currentTime = 0;
                        chatNotify.play().catch(()=>{});
                    }
                } else {
                    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
                }
                if(document.hidden){
                    const tTitle = document.title;
                    document.title = t('🔔 Новое сообщение!');
                    setTimeout(() => document.title = tTitle, 3000);
                }
            }
        }
    });
}

const pendingMessages = new Map();

const sendFailedSvg = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#ff4d4d;vertical-align:middle;cursor:pointer;" title="${t('Не отправлено. Нажмите для повтора.')}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

function showSendFailed(tempId) {
    const el = document.querySelector(`[data-tempid="${tempId}"]`);
    if (!el || el.querySelector('.msg-failed-icon')) return;
    const wrapper = el.parentElement;
    if (!wrapper) return;
    const errIcon = document.createElement('div');
    errIcon.className = 'msg-failed-icon';
    errIcon.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-shrink:0;width:24px;margin-right:8px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
    errIcon.innerHTML = sendFailedSvg;
    errIcon.title = t('Не отправлено. Нажмите для повтора.');
    errIcon.onclick = function(e) { e.preventDefault(); e.stopPropagation(); retryMessage(tempId); };
    errIcon.ontouchend = function(e) { e.preventDefault(); e.stopPropagation(); retryMessage(tempId); };
    wrapper.insertBefore(errIcon, el);
}

function retryMessage(tempId) {
    const info = pendingMessages.get(tempId);
    if (!info) return;
    const el = document.querySelector(`[data-tempid="${tempId}"]`);
    if (el) {
        const wrapper = el.parentElement;
        if (wrapper) {
            const icon = wrapper.querySelector('.msg-failed-icon');
            if (icon) icon.remove();
        }
    }
    clearTimeout(info.timeout);
    pendingMessages.delete(tempId);
    if (socket && socket.connected) {
        socket.emit('chat_message', info.data);
        const newTimeout = setTimeout(() => showSendFailed(tempId), 15000);
        pendingMessages.set(tempId, { timeout: newTimeout, data: info.data });
    } else {
        showSendFailed(tempId);
        if (typeof showToast === 'function') showToast(t('Нет соединения с сервером'), true);
    }
}

socket.on('error_message', (data) => {
    if (data && data.tempId) {
        const el = document.querySelector(`[data-tempid="${data.tempId}"]`);
        if (el) {
            const wrapper = el.parentElement;
            if (wrapper && !wrapper.querySelector('.msg-failed-icon')) {
                const errIcon = document.createElement('div');
                errIcon.className = 'msg-failed-icon';
                errIcon.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-shrink:0;width:24px;margin-right:8px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
                errIcon.innerHTML = sendFailedSvg;
                errIcon.title = data.text || t('Не отправлено');
                errIcon.onclick = function(e) { e.preventDefault(); e.stopPropagation(); retryMessage(data.tempId); };
                errIcon.ontouchend = function(e) { e.preventDefault(); e.stopPropagation(); retryMessage(data.tempId); };
                wrapper.insertBefore(errIcon, el);
            }
        }
        if (data.tempId && pendingMessages.has(data.tempId)) {
            clearTimeout(pendingMessages.get(data.tempId).timeout);
            pendingMessages.delete(data.tempId);
        }
    }
    if (data && data.text && typeof showToast === 'function') showToast(data.text, true);
});

window.onload=()=>{
    if(me){
        document.getElementById('auth-screen').style.display='none';
        document.getElementById('main-app').style.display='flex';
        const isVer=localStorage.getItem('4send_isVerified')==='1';
        const dName = localStorage.getItem('4send_displayName') || me;
        
        if (typeof updateDrawerNameUI === 'function') {
            updateDrawerNameUI(dName, me, isVer);
        }
        
        const myAvatar=localStorage.getItem('4send_avatar');
        document.getElementById('drawer-av-box').innerHTML=getAvatarHtml(dName,myAvatar,90,true);
        socket.emit('join',me);
        loadChatsWithPreview();
    }
};
let me=localStorage.getItem('4send_user')||'',target='',editingMsgId=null,replyText=null;
let viewingArchive=false;

let isHandlingPopstate = false;
window.isProgrammaticBack = false;

window.pushNavigationState = function(stateId) {
    window.history.pushState({ popup: stateId || true }, "");
};

window.backIfNav = function() {
    if (!isHandlingPopstate && window.history.state && (window.history.state.popup || window.history.state.chatOpen || window.history.state.nav)) {
        window.isProgrammaticBack = true;
        window.history.back();
    }
};
window.addEventListener('popstate', (e) => {
    if (window.isProgrammaticBack) {
        window.isProgrammaticBack = false;
        return;
    }
    isHandlingPopstate = true;
    
    let handled = false;
    const modernMenu = document.getElementById('modern-menu');
    if (modernMenu && modernMenu.style.display !== 'none') {
        Object.assign(modernMenu.style, {opacity: '0', transform: 'scale(0.8) translateY(10px)'});
        setTimeout(() => { modernMenu.style.display = 'none'; }, 300);
        handled = true;
    } else if (document.getElementById('sidebar-context-menu')) {
        forceCloseMenu(true);
        handled = true;
    } else if (editingMsgId || replyText) {
        if (editingMsgId) {
            editingMsgId = null;
            const inp = document.getElementById('messageText');
            if (inp) {
                inp.value = '';
                inp.style.height = 'auto';
                inp.style.overflowY = 'hidden';
                const wrapper = inp.closest('div[style*="border-radius:22px"]') || inp.parentElement;
                if(wrapper) wrapper.style.borderColor = "#252530";
            }
        }
        if (replyText) {
            replyText = null;
            const bar = document.getElementById('reply-preview-bar');
            if (bar) bar.style.display = 'none';
        }
        handled = true;
    } else if (closeTopmostModal()) {
        handled = true;
    } else if (document.getElementById('menu-drawer')?.classList.contains('open')) {
        toggleMenu(false);
        handled = true;
    } else if (document.body.classList.contains('is-chat-active')) {
        document.body.classList.remove('is-chat-active');
        document.querySelectorAll('.contact-item').forEach(el => {
            el.style.background = 'transparent';
        });
        resetToHome();
        handled = true;
    }

    setTimeout(() => { isHandlingPopstate = false; }, 100);
});

window.addEventListener('popstate', () => {
    setTimeout(() => {
        const state = window.history.state;
        const isRootState = !state || Object.keys(state).length === 0;
        
        if (isRootState && document.body.classList.contains('is-chat-active')) {
            const chat = document.querySelector('.main-content');
            if (chat) {
                chat.style.transition = 'none';
                document.body.classList.remove('is-chat-active');
                void chat.offsetWidth;
                chat.style.transition = '';
            } else {
                document.body.classList.remove('is-chat-active');
            }
            
            document.querySelectorAll('.contact-item').forEach(el => {
                el.style.background = 'transparent';
            });
            
            if (typeof resetToHome === 'function') resetToHome();
        }
    }, 50);
});

const mutedSvg = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#888;margin-left:4px;flex-shrink:0;display:block;"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
window.isRequestingMedia = false;

window.downloadMedia = async function(url, filename) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    } catch (e) {}
};
window.closeTopmostModal = function() {
    const modals =[
        { id: 'sound-settings-modal', close: closeSoundSettingsModal },
        { id: 'autolock-modal', close: closeAutoLockModal },
        { id: 'security-modal', close: closeSecurityModal },
        { id: 'active-sessions-modal', close: closeActiveSessionsModal },
        { id: 'pin-setup-modal', close: closePinSetup },
        { id: 'pin-modal', close: closePinModal },
        { id: 'user-profile-modal', close: closeProfile },
        { id: 'settings-modal', close: closeSettings },
        { id: 'delete-chat-confirm-modal', close: closeDeleteChatModal },
        { id: 'delete-modal', close: closeDeleteMenu },
        { id: 'forward-modal', close: closeForward },
        { id: 'lightbox', close: closeLightbox },
        { id: 'file-preview-modal', close: () => { if(window.activeFilePreviewCleanup) window.activeFilePreviewCleanup(); } },
        { id: 'privacy-exceptions-modal', close: closePrivacyExceptionsModal },
        { id: 'privacy-option-modal', close: closePrivacyOptionModal },
        { id: 'privacy-settings-modal', close: closePrivacySettingsModal },
        { id: 'chat-settings-modal', close: closeChatSettingsModal },
        { id: 'archive-settings-modal', close: closeArchiveSettingsModal },
        { id: 'archive-password-setup-modal', close: closeArchivePasswordSetupModal },
        { id: 'archive-password-remove-modal', close: closeArchivePasswordRemoveModal },
        { id: 'archive-unlock-modal', close: closeArchiveUnlockModal },
        { id: 'text-size-modal', close: closeTextSizeModal },
        { id: 'language-modal', close: closeLanguageModal },
        { id: 'password-modal', close: closePasswordModal },
        { id: 'quick-reaction-modal', close: closeQuickReactionModal },
        { id: 'auto-delete-modal', close: closeAutoDeleteModal },
        { id: 'auto-logout-modal', close: closeAutoLogoutModal },
        { id: 'room-settings-modal', close: closeRoomSettings },
        { id: 'room-preview-modal', close: closeRoomPreview },
        { id: 'create-room-modal', close: closeCreateRoomModal },
        { id: 'qr-modal', close: closeQRModal },
        { id: 'admin-modal', close: closeAdminPanel },
        { id: 'two-factor-modal', close: closeTwoFactorModal },
        { id: 'panic-password-modal', close: closePanicPasswordModal },
        { id: 'media-editor-modal', close: closeMediaEditor }
    ];
    for (let m of modals) {
        const el = document.getElementById(m.id);
        if (el && (el.style.display === 'flex' || el.style.display === 'block' || el.classList.contains('active'))) {
            if (!el.classList.contains('closing') && el.style.opacity !== '0') {
                m.close();
                return true;
            }
        }
    }
    return false;
};
let isMenuActionExecuting = false;

window.executeMenuAction = function(actionFn) {
    if (typeof isMenuActionExecuting !== 'undefined' && isMenuActionExecuting) return;
    window.isMenuActionExecuting = true;
    setTimeout(() => { window.isMenuActionExecuting = false; }, 300);

    const modernMenu = document.getElementById('modern-menu');
    if (modernMenu && modernMenu.style.display !== 'none') {
        Object.assign(modernMenu.style, {opacity: '0', transform: 'scale(0.8) translateY(10px)'});
        setTimeout(() => { if (modernMenu.parentNode) modernMenu.remove(); }, 300);
    }
    
    document.querySelectorAll('.msg-highlighted').forEach(el => el.classList.remove('msg-highlighted'));
    
    window.blockNextClick = false;
    window.isProgrammaticBack = true;
    typeof backIfNav === 'function' && backIfNav();
    
    setTimeout(actionFn, 150);
};
function clarify(encoded){
    return encoded;
}
document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{
        if(typeof me!=='undefined'&&me){
            loadChatsWithPreview();
            if(typeof target!=='undefined'&&target)selectChat(target);
        }
    },100);
});
(function(){
    const isMobile=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const noop=()=>{};
    Object.keys(console).forEach(m=>console[m]=noop);
    if(!isMobile){
        const kill=()=>{window.location.replace("about:blank");document.documentElement.innerHTML="";};
        if(navigator.webdriver)kill();
        const check=()=>{
            const start=performance.now();
            debugger;
            if(performance.now()-start>100)kill();
            if(window.outerWidth-window.innerWidth>160||window.outerHeight-window.innerHeight>160)kill();
        };
        setInterval(check,500);
        window.addEventListener('resize',check);
        window.addEventListener('keydown',e=>{
            if(e.keyCode===123||(e.ctrlKey&&e.shiftKey&&(e.keyCode===73||e.keyCode===74))||(e.ctrlKey&&e.keyCode===85)){
                e.preventDefault();kill();
            }
        });
        window.addEventListener('contextmenu',e=>e.preventDefault());
    }
})();
window.forceCloseMenu = (skipBack = false) => {
    document.querySelectorAll('.msg-highlighted').forEach(el => el.classList.remove('msg-highlighted'));
    document.querySelectorAll('.context-menu-active').forEach(el => {
        el.classList.remove('context-menu-active');
        if (typeof target !== 'undefined' && el.getAttribute('data-username') !== target) {
            el.style.background = 'transparent';
        }
    });
    
    let closedSomething = false;
    
    ['sidebar-context-menu', 'modern-menu', 'chat-header-menu', 'profile-more-menu'].forEach(id => {
        const m = document.getElementById(id);
        if (m && m.style.display !== 'none' && m.style.opacity !== '0') {
            m.style.opacity = '0';
            m.style.transform = 'scale(0.8)';
            setTimeout(() => { 
                if (m.parentNode) m.remove(); 
            }, 200);
            closedSomething = true;
        }
    });
    
    window.blockNextClick = false;
    if (closedSomething && !skipBack) {
        typeof backIfNav === 'function' && backIfNav();
    }
};
const escapeHTML = str => {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
};
const escapeJS = str => {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
};
const escapeAttr = str => escapeHTML(escapeJS(str));
const formatLastSeen = (lastSeenDate) => {
    const lastDate = new Date(lastSeenDate);
    if (isNaN(lastDate.getTime())) return t('был(а) недавно');
    const now = new Date();
    const isToday = lastDate.toDateString() === now.toDateString();
    const timeStr = lastDate.toLocaleTimeString(globalLocale, { hour: '2-digit', minute: '2-digit' });
    const dateStr = lastDate.toLocaleDateString(globalLocale, { day: 'numeric', month: 'short' });
    return isToday ? t('online_at_time', {time: timeStr}) : t('online_date_at_time', {date: dateStr, time: timeStr});
};
let isLoginMode = false;

document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen && !document.getElementById('auth-toggle-btn')) {
        const container = authScreen.querySelector('div') || authScreen;
        
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'auth-toggle-btn';
        toggleBtn.innerHTML = `<span id="mode-login" style="color:#a74fff; cursor:pointer; font-weight:bold; margin-right:15px;">${t('Вход')}</span> <span id="mode-register" style="color:#888; cursor:pointer; font-weight:bold;">${t('Регистрация')}</span>`;
        toggleBtn.style.marginBottom = '20px';
        
        const termsDiv = document.createElement('div');
        termsDiv.id = 'terms-container';
        termsDiv.style.display = 'none';
        termsDiv.style.marginBottom = '20px';
        termsDiv.style.fontSize = '12px';
        termsDiv.style.color = '#aaa';
        termsDiv.innerHTML = `<input type="checkbox" id="terms-checkbox" style="margin-right:5px;"> ${t('Я согласен с')} <a href="/terms.html" target="_blank" style="color:#a74fff;">${t('условиями')}</a> ${t('и')} <a href="/privacy.html" target="_blank" style="color:#a74fff;">${t('политикой')}</a>`;
        
        const inputs = container.querySelectorAll('input');
        if (inputs.length > 0) {
            container.insertBefore(toggleBtn, inputs[0]);
            container.insertBefore(termsDiv, container.querySelector('button'));
        }

        document.getElementById('mode-login').onclick = () => {
            isLoginMode = true;
            document.getElementById('mode-login').style.color = '#a74fff';
            document.getElementById('mode-register').style.color = '#888';
            document.getElementById('terms-container').style.display = 'none';
            document.querySelector('#auth-screen button').innerText = t('ВОЙТИ');
        };
        
        document.getElementById('mode-register').onclick = () => {
            isLoginMode = false;
            document.getElementById('mode-login').style.color = '#888';
            document.getElementById('mode-register').style.color = '#a74fff';
            document.getElementById('terms-container').style.display = 'block';
            document.querySelector('#auth-screen button').innerText = t('ЗАРЕГИСТРИРОВАТЬСЯ');
        };
    }
});
window.isLoginMode = false;

window.toggleAuthLang = function() {
    const newLang = window.currentLang === 'en' ? 'ru' : 'en';
    localStorage.setItem('4send_language', newLang);
    window.currentLang = newLang;
    document.documentElement.lang = newLang;
    if (typeof applyTranslations === 'function') applyTranslations();
    const langText = document.getElementById('auth-lang-text');
    if (langText) langText.innerText = newLang === 'en' ? 'EN' : 'RU';
};

document.addEventListener('DOMContentLoaded', () => {
    const langText = document.getElementById('auth-lang-text');
    if (langText) langText.innerText = (window.currentLang || 'en').toUpperCase();
});

window.switchAuthMode = function(isLogin) {
    const loginTab = document.getElementById('mode-login');
    const registerTab = document.getElementById('mode-register');
    const termsContainer = document.getElementById('terms-container');
    const submitBtn = document.getElementById('auth-submit-btn');
    const lErr = document.getElementById('lErr');

    if (!loginTab || !registerTab) return;

    window.isLoginMode = isLogin;
    if (isLogin) {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        if (termsContainer) termsContainer.style.display = 'none';
        if (submitBtn) submitBtn.innerText = t('ВОЙТИ');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        if (termsContainer) termsContainer.style.display = 'block';
        if (submitBtn) submitBtn.innerText = t('ЗАРЕГИСТРИРОВАТЬСЯ');
    }
    if (lErr) lErr.innerText = '';
};

function initAuthUI() {
    const loginTab = document.getElementById('mode-login');
    const registerTab = document.getElementById('mode-register');

    if (!loginTab || !registerTab) return;

    const handleLogin = (e) => { e.preventDefault(); window.switchAuthMode(true); };
    const handleRegister = (e) => { e.preventDefault(); window.switchAuthMode(false); };

    loginTab.addEventListener('pointerdown', handleLogin);
    registerTab.addEventListener('pointerdown', handleRegister);
    loginTab.addEventListener('click', handleLogin);
    registerTab.addEventListener('click', handleRegister);
}

document.addEventListener('DOMContentLoaded', initAuthUI);
setTimeout(initAuthUI, 500);

window.auth = async function() {
    const u = document.getElementById('u')?.value.trim();
    const p = document.getElementById('p')?.value.trim();
    const code2fa = document.getElementById('2fa-input')?.value.trim();
    
    if (!u || !p) return;
    
    const screen = document.getElementById('auth-screen');
    const lErr = document.getElementById('lErr');
    
    const showError = (msg) => {
        if(lErr) lErr.innerText = msg;
        if(screen){
            screen.classList.remove('shake-anim');
            void screen.offsetWidth;
            screen.classList.add('shake-anim');
        }
        if(typeof showToast === 'function') showToast(msg, true);
    };

    if(!window.isLoginMode) {
        const terms1El = document.getElementById('terms-checkbox-1');
        const terms2El = document.getElementById('terms-checkbox-2');
        const termsOldEl = document.getElementById('terms-checkbox');
        
        let termsAccepted = false;
        if (terms1El && terms2El) {
            termsAccepted = terms1El.checked && terms2El.checked;
        } else if (termsOldEl) {
            termsAccepted = termsOldEl.checked;
        }

        if (!termsAccepted) {
            showError(t('Примите условия и политику конфиденциальности'));
            return;
        }
    }

    if(!/^[a-z]+$/.test(u) || u.length < 4 || u.length > 20){
        showError(t('Логин: только строчные буквы, от 4 до 20 символов'));
        return;
    }
    if(p.length < 8 || p.length > 30){
        showError(t('Пароль должен быть от 8 до 30 символов'));
        return;
    }
    
    try {
        const bodyData = { username: u, password: p, termsAccepted: !window.isLoginMode };
        if (code2fa) bodyData.twoFactorPassword = code2fa;

        const endpoint = window.isLoginMode ? (code2fa ? '/auth/login/2fa' : '/auth/login') : '/auth/register';
        
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        
        if (res.ok) {
            const d = await res.json();
            
            if (d.requires2FA) {
                let container2fa = document.getElementById('2fa-container');
                if (!container2fa) {
                    container2fa = document.createElement('div');
                    container2fa.id = '2fa-container';
                    container2fa.style.width = '100%';
                    container2fa.style.opacity = '0';
                    container2fa.style.transform = 'translateY(10px)';
                    container2fa.style.transition = 'all 0.3s ease';
                    container2fa.innerHTML = `
                        <div class="input-group">
                            <svg class="input-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                            <input type="password" id="2fa-input" maxlength="30" placeholder="${t('Пароль 2FA')}" autocomplete="off" style="padding-left: 45px;">
                        </div>
                        <div style="color:#a74fff;font-size:13px;cursor:pointer;text-align:center;font-weight:bold;margin-bottom:15px;" onclick="resetAuthUI()">${t('Назад')}</div>
                    `;
                    const btn = screen.querySelector('#auth-submit-btn');
                    btn.parentNode.insertBefore(container2fa, btn);
                }
                
                const uParent = document.getElementById('u').parentElement;
                const pParent = document.getElementById('p').parentElement;
                const toggleBtn = document.getElementById('auth-toggle-btn');
                
                uParent.style.transition = 'all 0.3s ease';
                pParent.style.transition = 'all 0.3s ease';
                if(toggleBtn) toggleBtn.style.transition = 'all 0.3s ease';
                
                uParent.style.opacity = '0';
                pParent.style.opacity = '0';
                if(toggleBtn) toggleBtn.style.opacity = '0';
                
                setTimeout(() => {
                    uParent.style.display = 'none';
                    pParent.style.display = 'none';
                    if(toggleBtn) toggleBtn.style.display = 'none';
                    
                    container2fa.style.display = 'block';
                    requestAnimationFrame(() => {
                        container2fa.style.opacity = '1';
                        container2fa.style.transform = 'translateY(0)';
                        document.getElementById('2fa-input').focus();
                    });
                }, 300);
                
                window.resetAuthUI = () => {
                    container2fa.style.opacity = '0';
                    container2fa.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        container2fa.style.display = 'none';
                        uParent.style.display = 'block';
                        pParent.style.display = 'block';
                        if(toggleBtn) toggleBtn.style.display = 'flex';
                        requestAnimationFrame(() => {
                            uParent.style.opacity = '1';
                            pParent.style.opacity = '1';
                            if(toggleBtn) toggleBtn.style.opacity = '1';
                        });
                        document.getElementById('2fa-input').value = '';
                        if(lErr) lErr.innerText = '';
                    }, 300);
                };
                
                if(lErr) lErr.innerText = t("Введите пароль двухфакторной аутентификации");
                return;
            }

            localStorage.setItem('4send_user', d.username);
            localStorage.setItem('4send_avatar', d.avatar || '');
            localStorage.setItem('4send_role', d.role || 'user');
            localStorage.setItem('4send_isVerified', d.isVerified ? '1' : '0');
            if(d.token) localStorage.setItem('4send_token', d.token);
            if(d.displayName) localStorage.setItem('4send_displayName', d.displayName);
            
            if (typeof saveCurrentAccount === 'function') saveCurrentAccount();
            
            screen?.classList.add('auth-exit');
            setTimeout(() => window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now(), 600);
        } else {
            const errData = await res.json();
            showError(errData.error || t('Ошибка авторизации'));
        }
    } catch {
        document.getElementById('sessions-list').innerHTML = `<div style="color:#ff4d4d;text-align:center;">${t('Ошибка загрузки')}</div>`;
    }
};

let appLocked = false, idleTimer, lastActivityTime = Date.now();
function resetIdleTimer() {
    if (appLocked) return;
    lastActivityTime = Date.now();
    clearTimeout(idleTimer);
    const minutes = parseInt(localStorage.getItem('4send_lock_time'));
    const savedPin = localStorage.getItem('4send_pin');
    if (minutes > 0 && savedPin) {
        idleTimer = setTimeout(lockApp, minutes * 60 * 1000);
    }
}
window.onmousemove = window.onkeydown = window.onmousedown = window.onclick = window.ontouchstart = resetIdleTimer;
if(localStorage.getItem('4send_lock_time'))resetIdleTimer();
let privacyState = {
    avatar: "all", bio: "all", status: "all", messages: "all", calls: "all", voice_video: "all", forwards: "all", search: "all",
    exceptions: { avatar: [], bio: [], status: [], messages: [], calls: [], voice_video: [], forwards: [], search:[] }
};
async function savePrivacyState() {
    localStorage.setItem('4send_privacy', JSON.stringify(privacyState));
    const token = localStorage.getItem('4send_token');
    if(token) {
        try {
            await fetch('/api/privacy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(privacyState)
            });
        } catch(e) {}
    }
}
window.setPrivacyOption = function(key, val) {
    privacyState[key] = val;
    savePrivacyState();
    const title = key === 'avatar' ? t('Фотография профиля') : key === 'status' ? t('Время последнего захода') : key === 'messages' ? t('Личные сообщения') : key === 'voice_video' ? t('Голосовые/видеосообщения') : key === 'forwards' ? t('Пересылка сообщения') : t('Кто может меня найти');
    const modal = document.getElementById('privacy-option-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            if(modal) modal.remove();
            openPrivacyOptionModal(key, title);
        }, 150);
    }
};
function getPrivacyLabel(val, key) {
    const count = (privacyState.exceptions && privacyState.exceptions[key]) ? privacyState.exceptions[key].length : 0;
    if (val === 'all') return t('Все');
    if (val === 'none') return t('Никто');
    if (val === 'selected') return t('Избранные', {count: count});
    return t('Все');
}
window.openAutoDeleteModal = function() {
    let modal = document.getElementById('auto-delete-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auto-delete-modal';
        document.body.appendChild(modal);
    }
    const currentLimit = parseInt(localStorage.getItem('4send_auto_delete')) || 6;
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('auto-delete-modal-style')){
        styleTag.id = 'auto-delete-modal-style';
        document.head.appendChild(styleTag);
    }
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 12px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Удаление аккаунта')}</h3>
        <div style="color:#8e8e93;font-size:14px;margin-bottom:24px;line-height:1.5;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Если вы не будете заходить в сеть в течение этого времени, ваш аккаунт и все сообщения будут удалены.')}</div>
        
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
            <div onclick="setAutoDelete(3)" style="padding:16px;border-radius:14px;background:${currentLimit === 3 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentLimit === 3 ? '#ff9500' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='${currentLimit === 3 ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentLimit === 3 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'}'">
                <span>${t('3 месяца')}</span>
                ${currentLimit === 3 ? '<div style="width:20px;height:20px;background:#ff9500;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
            <div onclick="setAutoDelete(6)" style="padding:16px;border-radius:14px;background:${currentLimit === 6 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentLimit === 6 ? '#ff9500' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='${currentLimit === 6 ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentLimit === 6 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'}'">
                <span>${t('6 месяцев')}</span>
                ${currentLimit === 6 ? '<div style="width:20px;height:20px;background:#ff9500;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
            <div onclick="setAutoDelete(12)" style="padding:16px;border-radius:14px;background:${currentLimit === 12 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentLimit === 12 ? '#ff9500' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='${currentLimit === 12 ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentLimit === 12 ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'}'">
                <span>${t('1 год')}</span>
                ${currentLimit === 12 ? '<div style="width:20px;height:20px;background:#ff9500;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
        </div>
        
        <button onclick="closeAutoDeleteModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeAutoDeleteModal = function(callback) {
    const modal = document.getElementById('auto-delete-modal');
    if (!modal) { 
        if (typeof callback === 'function') callback(); 
        return; 
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setAutoDelete = async function(months) {
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/auto-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ months })
        });
        if (res.ok) {
            localStorage.setItem('4send_auto_delete', months);
            showToast(t('auto_delete_months', {months: months}), false);
            closeAutoDeleteModal();
        } else {
            showToast(t("Ошибка сохранения"), true);
        }
    } catch {
        showToast(t("Нет связи с сервером"), true);
    }
};
window.openPasswordModal = function() {
    let modal = document.getElementById('password-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'password-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('password-modal-style')){
        styleTag.id = 'password-modal-style';
        document.head.appendChild(styleTag);
    }
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Изменить пароль')}</h3>
        
        <div style="margin-bottom:16px">
            <label style="display:block;color:#8e8e93;font-size:12px;font-weight:600;margin-bottom:8px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('Старый пароль')}</label>
            <input type="password" id="sec-old-pass" maxlength="30" placeholder="${t('Введите старый пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;transition:all 0.2s ease" onfocus="this.style.borderColor='#34c759';this.style.background='rgba(52,199,89,0.1)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)'">
        </div>
        
        <div style="margin-bottom:24px">
            <label style="display:block;color:#8e8e93;font-size:12px;font-weight:600;margin-bottom:8px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('Новый пароль')}</label>
            <input type="password" id="sec-new-pass" maxlength="30" placeholder="${t('Введите новый пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;transition:all 0.2s ease" onfocus="this.style.borderColor='#34c759';this.style.background='rgba(52,199,89,0.1)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)'">
        </div>
        
        <button onclick="savePassword()" style="width:100%;padding:16px;background:linear-gradient(135deg,#34c759,#28a745);color:#fff;border:none;border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:12px;box-shadow:0 4px 12px rgba(52,199,89,0.3)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(52,199,89,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(52,199,89,0.3)'">${t('Сохранить')}</button>
        
        <button onclick="closePasswordModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closePasswordModal = function(callback) {
    const modal = document.getElementById('password-modal');
    if (!modal) { 
        if (typeof callback === 'function') callback(); 
        return; 
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.savePassword = async function() {
    const oldPass = document.getElementById('sec-old-pass')?.value.trim();
    const newPass = document.getElementById('sec-new-pass')?.value.trim();
    if (!oldPass || !newPass) return showToast(t("Заполните оба поля"), true);
    if (newPass.length < 8 || newPass.length > 30) return showToast(t("Новый пароль от 8 до 30 символов"), true);
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/auth/profile-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ newUsername: me, oldPassword: oldPass, newPassword: newPass })
        });
        if (res.ok) {
            showToast(t("Пароль успешно изменен"), false);
            closePasswordModal();
        } else {
            const err = await res.json();
            showToast(err.error || t("Ошибка изменения пароля"), true);
        }
    } catch {
        showToast(t("Нет связи с сервером"), true);
    }
};

window.openQuickReactionModal = function() {
    let modal = document.getElementById('quick-reaction-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quick-reaction-modal';
        document.body.appendChild(modal);
    }
    const currentReaction = localStorage.getItem('4send_quick_reaction') || '❤️';
    const emojis = ['👍', '❤️', '😂', '😮', '😡', '🔥', '👏', '🎉', '💘', '😝', '🤭', '😔'];
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 12px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Быстрая реакция')}</h3>
        <div style="color:#8e8e93;font-size:14px;margin-bottom:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Выберите реакцию для двойного клика')}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
            ${emojis.map(e => `<div onclick="setQuickReaction('${escapeAttr(e)}')" style="font-size:32px;cursor:pointer;padding:14px;border-radius:14px;background:${currentReaction === e ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentReaction === e ? '#ff9500' : 'transparent'};transition:all 0.2s ease;display:flex;align-items:center;justify-content:center;position:relative" onmouseover="this.style.background='${currentReaction === e ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.08)'}';this.style.transform='scale(1.1)'" onmouseout="this.style.background='${currentReaction === e ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'}';this.style.transform='scale(1)'">${e}${currentReaction === e ? '<div style="position:absolute;top:4px;right:4px;width:16px;height:16px;background:#ff9500;border-radius:50%;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}</div>`).join('')}
        </div>
        <button onclick="closeQuickReactionModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeQuickReactionModal = function(callback) {
    const modal = document.getElementById('quick-reaction-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style, { opacity: '0', backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', pointerEvents: 'none' });
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.8) translateY(20px)', transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 400);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setQuickReaction = function(emoji) {
    localStorage.setItem('4send_quick_reaction', emoji);
    showToast(t('Быстрая реакция:') + ' ' + emoji, false);
    closeQuickReactionModal();
};
function openSecurityModal(){
    let modal=document.getElementById('security-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='security-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(30,27,36,0.95)',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease'});
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        #security-modal-content::-webkit-scrollbar { display: none; }
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('security-modal-scrollbar-style')){
        styleTag.id = 'security-modal-scrollbar-style';
        document.head.appendChild(styleTag);
    }
    
    modal.innerHTML=`<div id="security-modal-content" class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:600px;max-height:85vh;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);margin:0 auto">
        <div style="display:flex;align-items:center;margin-bottom:24px;">
            <button onclick="closeSecurityModal()" style="background:rgba(255,255,255,0.1);border:none;color:#9d4edd;font-size:24px;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:0.2s;flex-shrink:0;">‹</button>
            <h2 style="flex:1;text-align:center;margin:0;color:#fff;font-size:18px;font-weight:700;">${t('Приватность')}</h2>
            <div style="width:40px;height:40px;flex-shrink:0;"></div>
        </div>
        <div style="max-width:600px;margin:0 auto">
            
            <div style="padding:0 8px 12px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('ПРИВАТНОСТЬ')}</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
                <div onclick="closeSecurityModal(openPrivacySettingsModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#007aff,#0051d5);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(0,122,255,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Настройки приватности')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Управление настройками приватности')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
            </div>

            <div style="padding:0 8px 12px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('БЕЗОПАСНОСТЬ')}</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
                <div onclick="closeSecurityModal(openPasswordModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#34c759,#28a745);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(52,199,89,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Изменить пароль')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Обновление пароля аккаунта')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeSecurityModal(openTwoFactorModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#e91e63,#c2185b);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(233,30,99,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Двухфакторная аутентификация')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Дополнительный пароль при входе')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeSecurityModal(openPanicPasswordModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(255,59,48,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#ff3b30,#d32f2f);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(255,59,48,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#ff3b30;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Тревожный пароль')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Удаление аккаунта при входе')}</div>
                    </div>
                    <div style="color:#ff3b30;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeSecurityModal(openAutoLockModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#af52de,#8e24aa);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(175,82,222,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Автоблокировка')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Блокировка мессенджера при неактивности')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeSecurityModal(openActiveSessionsModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#00c6ff,#0072ff);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(0,198,255,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Активные сеансы')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Управление устройствами')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
            </div>

            <div style="padding:0 8px 12px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('АККАУНТ')}</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
                <div onclick="closeSecurityModal(openAutoDeleteModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#ff9500,#ff6b00);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(255,149,0,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Автоудаление')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Автоматическое удаление аккаунта')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeSecurityModal(openAutoLogoutModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#007aff,#0051d5);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(0,122,255,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Автовыход')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Завершение сеансов при неактивности')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeSecurityModal(openDeleteMenu)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(255,77,77,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#ff3b30,#d32f2f);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(255,59,48,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#ff3b30;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Удалить аккаунт')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Безвозвратное удаление данных')}</div>
                    </div>
                    <div style="color:#ff3b30;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
            </div>
        </div>
    </div>`;
    
    const content=modal.querySelector('.modal-content');
    
    content.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    requestAnimationFrame(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'translateY(0)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
}

window.openAutoLogoutModal = function() {
    let modal = document.getElementById('auto-logout-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auto-logout-modal';
        document.body.appendChild(modal);
    }
    const currentLimit = parseInt(localStorage.getItem('4send_auto_logout')) || 7;
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('auto-logout-modal-style')){
        styleTag.id = 'auto-logout-modal-style';
        document.head.appendChild(styleTag);
    }
    
    const buildOpt = (val, label) => `
        <div onclick="setAutoLogout(${val})" style="padding:16px;border-radius:14px;background:${currentLimit === val ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentLimit === val ? '#007aff' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='${currentLimit === val ? 'rgba(0,122,255,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentLimit === val ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)'}'">
            <span>${label}</span>
            ${currentLimit === val ? '<div style="width:20px;height:20px;background:#007aff;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
        </div>
    `;

    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 12px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Автовыход')}</h3>
        <div style="color:#8e8e93;font-size:14px;margin-bottom:24px;line-height:1.5;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Если вы не будете заходить в сеть в течение этого времени, сеанс будет завершен.')}</div>
        
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
            ${buildOpt(1, t('1 день'))}
            ${buildOpt(7, t('1 неделя'))}
            ${buildOpt(30, t('1 месяц'))}
            ${buildOpt(180, t('6 месяцев'))}
        </div>
        
        <button onclick="closeAutoLogoutModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeAutoLogoutModal = function(callback) {
    const modal = document.getElementById('auto-logout-modal');
    if (!modal) { 
        if (typeof callback === 'function') callback(); 
        return; 
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setAutoLogout = async function(days) {
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/auto-logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ days })
        });
        if (res.ok) {
            localStorage.setItem('4send_auto_logout', days);
            showToast(t('Автовыход через {days} дн.', {days: days}), false);
            closeAutoLogoutModal();
        } else {
            showToast(t("Ошибка сохранения"), true);
        }
    } catch {
        showToast(t("Нет связи с сервером"), true);
    }
};

window.openPanicPasswordModal = function() {
    let modal = document.getElementById('panic-password-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'panic-password-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(255,59,48,0.3);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 12px 0;color:#ff3b30;font-size:22px;font-weight:700;text-align:center">${t('Тревожный пароль')}</h3>
        <div style="color:#8e8e93;font-size:13px;margin-bottom:20px;text-align:center;line-height:1.4;">${t('Ввод этого пароля при входе')} <b>${t('навсегда удалит')}</b> ${t('ваш аккаунт, сообщения и файлы.')}</div>
        <input type="password" id="panic-main-pass" maxlength="30" placeholder="${t('Основной пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:12px;">
        <input type="password" id="panic-new-pass" maxlength="30" placeholder="${t('Тревожный пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,59,48,0.3);background:rgba(255,59,48,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:20px;">
        <button onclick="setupPanicPassword()" style="width:100%;padding:16px;background:linear-gradient(135deg,#ff3b30,#d32f2f);color:#fff;border:none;border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;margin-bottom:12px;">${t('Установить')}</button>
        <button onclick="closePanicPasswordModal()" style="width:100%;padding:16px;background:rgba(255,255,255,0.05);color:#eee;border:1px solid rgba(255,255,255,0.1);border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Отмена')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closePanicPasswordModal = function(callback) {
    const modal = document.getElementById('panic-password-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setupPanicPassword = async function() {
    const password = document.getElementById('panic-main-pass').value;
    const panicPassword = document.getElementById('panic-new-pass').value;
    if (!password || !panicPassword) return showToast(t("Заполните все поля"), true);
    if (panicPassword.length < 8 || panicPassword.length > 30) return showToast(t("Тревожный пароль от 8 до 30 символов"), true);
    
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/panic-password/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password, panicPassword })
        });
        if (res.ok) {
            showToast(t("Тревожный пароль установлен"), false);
            closePanicPasswordModal();
        } else {
            const err = await res.json();
            showToast(err.error || t("Ошибка"), true);
        }
    } catch { showToast(t("Ошибка соединения"), true); }
};

async function openTwoFactorModal() {
    let modal = document.getElementById('two-factor-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'two-factor-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;text-align:center">${t('Двухфакторная аутентификация')}</h3>
        <div id="2fa-loading" style="color:#888;text-align:center;margin-bottom:20px;">${t('Загрузка...')}</div>
        <div id="2fa-content" style="display:none;"></div>
        <button onclick="closeTwoFactorModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;margin-top:12px;">${t('Закрыть')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/2fa/status', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        document.getElementById('2fa-loading').style.display = 'none';
        const contentDiv = document.getElementById('2fa-content');
        contentDiv.style.display = 'block';
        
        if (data.enabled) {
            contentDiv.innerHTML = `
                <div style="color:#4caf50;font-size:14px;margin-bottom:20px;text-align:center;font-weight:bold;">${t('2FA включена')}</div>
                <input type="password" id="2fa-main-pass" maxlength="30" placeholder="${t('Основной пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:12px;">
                <input type="password" id="2fa-current-pass" maxlength="30" placeholder="${t('Текущий 2FA пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:20px;">
                <button onclick="disableTwoFactor()" style="width:100%;padding:16px;background:rgba(255,77,77,0.15);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3);border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Отключить 2FA')}</button>
            `;
        } else {
            contentDiv.innerHTML = `
                <div style="color:#888;font-size:14px;margin-bottom:20px;text-align:center;">${t('Установите дополнительный пароль для защиты аккаунта.')}</div>
                <input type="password" id="2fa-main-pass" maxlength="30" placeholder="${t('Основной пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:12px;">
                <input type="password" id="2fa-new-pass" maxlength="30" placeholder="${t('Новый 2FA пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:20px;">
                <button onclick="setupTwoFactor()" style="width:100%;padding:16px;background:linear-gradient(135deg,#34c759,#28a745);color:#fff;border:none;border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Включить 2FA')}</button>
            `;
        }
    } catch {
        document.getElementById('2fa-loading').innerText = t('Ошибка загрузки');
    }
}

function closeTwoFactorModal(callback) {
    const modal = document.getElementById('two-factor-modal');
    if (!modal) {
        if (typeof callback === 'function') callback();
        return;
    }
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

async function setupTwoFactor() {
    const password = document.getElementById('2fa-main-pass').value;
    const twoFactorPassword = document.getElementById('2fa-new-pass').value;
    if (!password || !twoFactorPassword) return showToast(t("Заполните все поля"), true);
    if (twoFactorPassword.length < 4 || twoFactorPassword.length > 30) return showToast(t("2FA пароль от 4 до 30 символов"), true);
    
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/2fa/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password, twoFactorPassword })
        });
        if (res.ok) {
            showToast(t('2FA успешно включена'), false);
            closeTwoFactorModal();
        } else {
            const err = await res.json();
            showToast(err.error || t("Ошибка"), true);
        }
    } catch { showToast(t("Ошибка соединения"), true); }
}

async function disableTwoFactor() {
    const password = document.getElementById('2fa-main-pass').value;
    const twoFactorPassword = document.getElementById('2fa-current-pass').value;
    if (!password || !twoFactorPassword) return showToast(t("Заполните все поля"), true);
    
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/2fa/disable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password, twoFactorPassword })
        });
        if (res.ok) {
            showToast(t("2FA отключена"), false);
            closeTwoFactorModal();
        } else {
            const err = await res.json();
            showToast(err.error || t("Ошибка"), true);
        }
    } catch { showToast(t("Ошибка соединения"), true); }
}

window.openActiveSessionsModal = async function() {
    let modal = document.getElementById('active-sessions-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'active-sessions-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `#active-sessions-content::-webkit-scrollbar { display: none; }`;
    if (!document.getElementById('active-sessions-style')) {
        styleTag.id = 'active-sessions-style';
        document.head.appendChild(styleTag);
    }

    modal.innerHTML = `<div id="active-sessions-content" class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:600px;max-height:85vh;overflow-y:auto;scrollbar-width:none;padding:24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);margin:0 auto">
        <div style="display:flex;align-items:center;margin-bottom:24px;">
            <button onclick="closeActiveSessionsModal()" style="background:rgba(255,255,255,0.1);border:none;color:#9d4edd;font-size:24px;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:0.2s;flex-shrink:0;">‹</button>
            <h2 style="flex:1;text-align:center;margin:0;color:#fff;font-size:20px;font-weight:700;margin-right:40px">${t('Активные сеансы')}</h2>
        </div>
        <button onclick="revokeAllSessions()" style="width:100%;padding:14px;background:rgba(255,77,77,0.15);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3);border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;margin-bottom:20px;">${t('Завершить все другие сеансы')}</button>
        <div id="sessions-list" style="display:flex;flex-direction:column;gap:10px;">
            <div style="color:#888;text-align:center;padding:20px;">${t('Загрузка...')}</div>
        </div>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    content.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });

    const parseDevice = (ua) => {
        if (!ua) return t('Неизвестное устройство');
        if (/iPhone|iPad|iPod/i.test(ua)) return 'Apple (iOS)';
        if (/Mac/i.test(ua)) return 'Apple (Mac)';
        if (/Android/i.test(ua)) return 'Android';
        if (/Windows/i.test(ua)) return 'Windows';
        if (/Linux/i.test(ua)) return 'Linux';
        return t('Неизвестное устройство');
    };

    const getDeviceIcon = (deviceName) => {
        if (deviceName.includes('Windows')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#00a4ef"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.85z"/></svg>`;
        if (deviceName.includes('Apple') || deviceName.includes('iOS') || deviceName.includes('Mac')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.59-.76 1.56.04 2.87.74 3.62 1.9-3.22 1.96-2.64 6.58.51 7.86-.68 1.64-1.53 3.22-2.8 4.17zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.3 2.4-2.02 4.36-3.74 4.25z"/></svg>`;
        if (deviceName.includes('Android')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#3DDC84"><path d="M17.523 15.341c-.725 0-1.311-.586-1.311-1.311s.586-1.311 1.311-1.311 1.311.586 1.311 1.311-.586 1.311-1.311 1.311zm-11.046 0c-.725 0-1.311-.586-1.311-1.311s.586-1.311 1.311-1.311 1.311.586 1.311 1.311-.586 1.311-1.311 1.311zm11.436-7.25l1.938-3.357a.43.43 0 00-.156-.586.432.432 0 00-.586.156l-1.973 3.418c-1.484-.684-3.164-1.055-4.951-1.055s-3.467.371-4.951 1.055l-1.973-3.418a.432.432 0 00-.586-.156.43.43 0 00-.156.586l1.938 3.357C2.891 9.668.508 13.535.117 18.164h23.766c-.391-4.629-2.773-8.496-5.969-10.073z"/></svg>`;
        if (deviceName.includes('Linux')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#FCC624"><path d="M11.97 0C5.36 0 0 5.36 0 11.97s5.36 11.97 11.97 11.97 11.97-5.36 11.97-11.97S18.58 0 11.97 0zm0 21.82c-5.44 0-9.85-4.41-9.85-9.85s4.41-9.85 9.85-9.85 9.85 4.41 9.85 9.85-4.41 9.85-9.85 9.85z"/></svg>`;
        return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#888"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>`;
    };

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/sessions', { headers: { 'Authorization': `Bearer ${token}` } });
        const sessions = await res.json();
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';
        
        sessions.sort((a, b) => (a.token === token ? -1 : (b.token === token ? 1 : 0))).forEach(s => {
            const isCurrent = s.token === token;
            const date = new Date(s.lastActive).toLocaleString(globalLocale);
            const deviceName = parseDevice(s.device);
            const deviceIcon = getDeviceIcon(deviceName);
            list.innerHTML += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:#2a2633;border-radius:16px;border:1px solid ${isCurrent ? '#a74fff' : 'transparent'}">
                    <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:rgba(255,255,255,0.05);border-radius:12px;margin-right:14px;flex-shrink:0;">
                        ${deviceIcon}
                    </div>
                    <div style="flex:1;overflow:hidden;">
                        <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${deviceName}</div>
                        <div style="color:#8e8e93;font-size:13px;">IP: ${escapeHTML(s.ip)}</div>
                        <div style="color:#8e8e93;font-size:13px;">${t('Активность')}: ${date}</div>
                        ${isCurrent ? `<div style="color:#a74fff;font-size:12px;font-weight:bold;margin-top:4px;">${t('Текущий сеанс')}</div>` : ''}
                    </div>
                    ${!isCurrent ? `<button onclick="revokeSession('${escapeAttr(s.token)}')" style="background:rgba(255,77,77,0.15);color:#ff4d4d;border:none;padding:8px 12px;border-radius:10px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Завершить')}</button>` : ''}
                </div>
            `;
        });
    } catch {
        document.getElementById('sessions-list').innerHTML = `<div style="color:#ff4d4d;text-align:center;">${t('Ошибка загрузки')}</div>`;
    }
};

async function revokeAllSessions() {
    try {
        const token = localStorage.getItem('4send_token');
        await fetch('/api/sessions/revoke-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        openActiveSessionsModal();
    } catch {}
}

function closeActiveSessionsModal(callback) {
    const modal = document.getElementById('active-sessions-modal');
    if (!modal) {
        if (typeof callback === 'function') callback();
        return;
    }
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    if (content) Object.assign(content.style, { opacity: '0', transform: 'translateY(20px)' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

async function revokeSession(tokenToRevoke) {
    try {
        const token = localStorage.getItem('4send_token');
        await fetch('/api/sessions/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ token: tokenToRevoke })
        });
        openActiveSessionsModal();
    } catch {}
}

function openChatSettingsModal(){
    let modal=document.getElementById('chat-settings-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='chat-settings-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(30,27,36,0.95)',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease'});
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        #chat-settings-content::-webkit-scrollbar { display: none; }
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('modal-scrollbar-style')){
        styleTag.id = 'modal-scrollbar-style';
        document.head.appendChild(styleTag);
    }
    
    modal.innerHTML=`<div id="chat-settings-content" class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:600px;max-height:85vh;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);margin:0 auto">
        <div style="display:flex;align-items:center;margin-bottom:24px;">
            <button onclick="closeChatSettingsModal()" style="background:rgba(255,255,255,0.1);border:none;color:#9d4edd;font-size:24px;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:0.2s;flex-shrink:0;">‹</button>
            <h2 style="flex:1;text-align:center;margin:0;color:#fff;font-size:18px;font-weight:700;">${t('Чаты')}</h2>
            <div style="width:40px;height:40px;flex-shrink:0;"></div>
        </div>
        <div style="max-width:600px;margin:0 auto">
            <div style="padding:0 8px 12px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('НАСТРОЙКИ ЧАТОВ')}</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
                <div onclick="closeChatSettingsModal(openTextSizeModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#007aff,#0051d5);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(0,122,255,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Размер текста')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Настройка размера шрифта сообщений')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeChatSettingsModal(openSoundSettingsModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#34c759,#28a745);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(52,199,89,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Настройки звука')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Громкость уведомлений и звуковых эффектов')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeChatSettingsModal(openNotificationRepeatModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#e91e63,#c2185b);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(233,30,99,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Повтор уведомлений')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Напоминания о непрочитанных')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeChatSettingsModal(openQuickReactionModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#ff9500,#ff6b00);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(255,149,0,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Быстрая реакция')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Выбор эмодзи для реакции по двойному нажатию')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeChatSettingsModal(openArchiveSettingsModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#00c6ff,#0072ff);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(0,198,255,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12.14l.82 1H5.12z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Настройки архива')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Установка пароля на архив чатов')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
                <div onclick="closeChatSettingsModal(openLanguageModal)" style="display:flex;align-items:center;gap:14px;padding:16px;background:#2a2633;border-radius:16px;cursor:pointer;transition:all 0.2s ease" onmouseover="this.style.background='rgba(157,78,221,0.15)'" onmouseout="this.style.background='#2a2633'">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#af52de,#8e24aa);border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(175,82,222,0.3)">
                        <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="color:#fff;font-size:17px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Язык')}</div>
                        <div style="color:#8e8e93;font-size:14px;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Выбор языка интерфейса')}</div>
                    </div>
                    <div style="color:#9d4edd;font-size:20px;margin-left:auto;font-weight:600">›</div>
                </div>
            </div>
        </div>
    </div>`;
    
    const content=modal.querySelector('.modal-content');
    
    content.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    requestAnimationFrame(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'translateY(0)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
}

window.openNotificationRepeatModal = function() {
    let modal = document.getElementById('notif-repeat-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'notif-repeat-modal';
        document.body.appendChild(modal);
    }
    const stored = localStorage.getItem('4send_notif_repeat');
    const currentVal = stored !== null ? parseInt(stored) : 5;
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    const buildOpt = (val, label) => `
        <div onclick="setNotificationRepeat(${val})" style="padding:16px;border-radius:14px;background:${currentVal === val ? 'rgba(233,30,99,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentVal === val ? '#e91e63' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px" onmouseover="this.style.background='${currentVal === val ? 'rgba(233,30,99,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentVal === val ? 'rgba(233,30,99,0.15)' : 'rgba(255,255,255,0.05)'}'">
            <span>${label}</span>
            ${currentVal === val ? '<div style="width:20px;height:20px;background:#e91e63;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
        </div>
    `;

    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Повтор уведомлений')}</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
            ${buildOpt(0, t('Выкл'))}
            ${buildOpt(5, t('Каждые 5 минут'))}
            ${buildOpt(10, t('Каждые 10 минут'))}
            ${buildOpt(30, t('Каждые 30 минут'))}
            ${buildOpt(60, t('Каждый час'))}
        </div>
        <button onclick="closeNotificationRepeatModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeNotificationRepeatModal = function(callback) {
    const modal = document.getElementById('notif-repeat-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style, { opacity: '0', backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', pointerEvents: 'none' });
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.8) translateY(20px)', transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 400);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setNotificationRepeat = async function(minutes) {
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/notification-repeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ minutes })
        });
        if (res.ok) {
            localStorage.setItem('4send_notif_repeat', minutes);
            showToast(minutes === 0 ? t('Повтор уведомлений выключен') : t('repeat_every_minutes', {minutes: minutes}), false);
            closeNotificationRepeatModal();
        } else {
            showToast(t("Ошибка сохранения"), true);
        }
    } catch {
        showToast(t("Нет связи с сервером"), true);
    }
};

window.openTextSizeModal = function() {
    let modal = document.getElementById('text-size-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'text-size-modal';
        document.body.appendChild(modal);
    }
    const currentSize = localStorage.getItem('4send_text_size') || 'medium';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Размер текста')}</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
            <div onclick="setTextSize('small')" style="padding:16px;border-radius:14px;background:${currentSize === 'small' ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentSize === 'small' ? '#007aff' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:14px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px" onmouseover="this.style.background='${currentSize === 'small' ? 'rgba(0,122,255,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentSize === 'small' ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)'}'">
                <span>${t('Мелкий')}</span>
                ${currentSize === 'small' ? '<div style="width:20px;height:20px;background:#007aff;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
            <div onclick="setTextSize('medium')" style="padding:16px;border-radius:14px;background:${currentSize === 'medium' ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentSize === 'medium' ? '#34c759' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px" onmouseover="this.style.background='${currentSize === 'medium' ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentSize === 'medium' ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.05)'}'">
                <span>${t('Средний')}</span>
                ${currentSize === 'medium' ? '<div style="width:20px;height:20px;background:#34c759;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
            <div onclick="setTextSize('large')" style="padding:16px;border-radius:14px;background:${currentSize === 'large' ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentSize === 'large' ? '#ff9500' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:18px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px" onmouseover="this.style.background='${currentSize === 'large' ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentSize === 'large' ? 'rgba(255,149,0,0.15)' : 'rgba(255,255,255,0.05)'}'">
                <span>${t('Большой')}</span>
                ${currentSize === 'large' ? '<div style="width:20px;height:20px;background:#ff9500;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
        </div>
        <button onclick="closeTextSizeModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeTextSizeModal = function(callback) {
    const modal = document.getElementById('text-size-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style, { opacity: '0', backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', pointerEvents: 'none' });
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.8) translateY(20px)', transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 400);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setTextSize = function(size) {
    localStorage.setItem('4send_text_size', size);
    applyTextSize(size);
    showToast(t('Размер текста изменен'), false);
    closeTextSizeModal();
};

window.applyTextSize = function(size) {
    let px = '15px';
    if (size === 'small') px = '13px';
    if (size === 'large') px = '17px';
    document.documentElement.style.setProperty('--msg-text-size', px);
    document.querySelectorAll('.msg-text').forEach(el => {
        el.style.fontSize = px;
    });
    const msgInput = document.getElementById('messageText');
    if (msgInput) msgInput.style.fontSize = px;
};

window.openLanguageModal = function() {
    let modal = document.getElementById('language-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'language-modal';
        document.body.appendChild(modal);
    }
    const currentLang = window.currentLang || localStorage.getItem('4send_language') || 'en';
    
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Язык')}</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px;">
            <div onclick="setLanguage('ru')" style="padding:16px;border-radius:14px;background:${currentLang === 'ru' ? 'rgba(175,82,222,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentLang === 'ru' ? '#af52de' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;display:flex;justify-content:center;align-items:center;position:relative;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
                <span>${t('Русский')}</span>
                ${currentLang === 'ru' ? '<div style="width:20px;height:20px;background:#af52de;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
            <div onclick="setLanguage('en')" style="padding:16px;border-radius:14px;background:${currentLang === 'en' ? 'rgba(175,82,222,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentLang === 'en' ? '#af52de' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;display:flex;justify-content:center;align-items:center;position:relative;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
                <span>${t('English')}</span>
                ${currentLang === 'en' ? '<div style="width:20px;height:20px;background:#af52de;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
            </div>
        </div>
        <button onclick="closeLanguageModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeLanguageModal = function(callback) {
    const modal = document.getElementById('language-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style, { opacity: '0', backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', pointerEvents: 'none' });
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.8) translateY(20px)', transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 400);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.setLanguage = function(lang) {
    localStorage.setItem('4send_language', lang);
    window.currentLang = lang;
    document.documentElement.lang = lang === 'en' ? 'en' : 'ru';
    if (typeof applyTranslations === 'function') applyTranslations();
    showToast(t('Язык изменен'), false);
    closeLanguageModal();
};

function closeChatSettingsModal(callback){
    const modal=document.getElementById('chat-settings-modal');
    if(!modal){
        if(typeof callback==='function') callback();
        return;
    }
    const content=modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style,{opacity:'0',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)',pointerEvents:'none'});
    if(content)Object.assign(content.style,{opacity:'0',transform:'scale(0.8) translateY(20px)',transition:'all 0.4s cubic-bezier(0.4,0,0.2,1)'});
    setTimeout(()=>{
        if(modal.classList.contains('closing'))modal.remove();
        if(typeof callback==='function') callback();
    }, 400);
    if(typeof callback!=='function' && typeof backIfNav==='function') backIfNav();
}

function openPrivacySettingsModal() {
    let modal=document.getElementById('privacy-settings-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='privacy-settings-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(30,27,36,0.95)',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease'});
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        #privacy-settings-content::-webkit-scrollbar { display: none; }
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('privacy-settings-modal-style')){
        styleTag.id = 'privacy-settings-modal-style';
        document.head.appendChild(styleTag);
    }
    
    const buildRow = (key, title) => `
        <div onclick="closePrivacySettingsModal(() => openPrivacyOptionModal('${escapeAttr(key)}', '${escapeAttr(title)}'))" style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:rgba(255,255,255,0.05);border-radius:14px;cursor:pointer;transition:all 0.2s ease;margin-bottom:10px" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            <span style="color:#fff;font-size:15px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${title}</span>
            <div style="display:flex;align-items:center;gap:8px">
                <span style="color:#9d4edd;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${getPrivacyLabel(privacyState[key], key)}</span>
                <div style="color:#9d4edd;font-size:18px;font-weight:600;margin-top:-2px">›</div>
            </div>
        </div>
    `;

    modal.innerHTML=`<div id="privacy-settings-content" class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;max-height:85vh;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Настройки приватности')}</h3>
        <div style="display:flex;flex-direction:column;margin-bottom:14px;">
            <div style="padding:0 8px 8px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Профиль')}</div>
            ${buildRow('avatar', t('Фотография профиля'))}
            ${buildRow('bio', t('О себе'))}
            ${buildRow('status', t('Время последнего захода'))}
            
            <div style="padding:16px 8px 8px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Связь')}</div>
            ${buildRow('messages', t('Личные сообщения'))}
            ${buildRow('calls', t('Звонки'))}
            ${buildRow('voice_video', t('Голосовые/видеосообщения'))}
            ${buildRow('forwards', t('Пересылка сообщения'))}
            
            <div style="padding:16px 8px 8px 8px;color:#8e8e93;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Поиск')}</div>
            ${buildRow('search', t('Кто может меня найти'))}
        </div>
        <button onclick="closePrivacySettingsModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content=modal.querySelector('.modal-content');
    
    content.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    
    requestAnimationFrame(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
}

function closePrivacySettingsModal(callback) {
    const modal = document.getElementById('privacy-settings-modal');
    if (!modal) { 
        if (typeof callback === 'function') callback(); 
        return; 
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

function openPrivacyOptionModal(key, title) {
    let modal=document.getElementById('privacy-option-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='privacy-option-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(30,27,36,0.95)',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease'});
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('privacy-option-modal-style')){
        styleTag.id = 'privacy-option-modal-style';
        document.head.appendChild(styleTag);
    }
    
    if (!privacyState.exceptions) privacyState.exceptions = {};
    if (!privacyState.exceptions[key]) privacyState.exceptions[key] =[];
    
    const buildOption = (val, label) => `
        <div onclick="setPrivacyOption('${escapeAttr(key)}', '${escapeAttr(val)}')" style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:${privacyState[key]===val?'rgba(0,122,255,0.15)':'rgba(255,255,255,0.05)'};border:2px solid ${privacyState[key]===val?'#007aff':'transparent'};border-radius:14px;cursor:pointer;transition:all 0.2s ease;margin-bottom:10px" onmouseover="this.style.background='${privacyState[key]===val?'rgba(0,122,255,0.2)':'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${privacyState[key]===val?'rgba(0,122,255,0.15)':'rgba(255,255,255,0.05)'}'">
            <span style="color:#fff;font-size:16px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${label}</span>
            ${privacyState[key]===val?'<div style="width:20px;height:20px;background:#007aff;border-radius:50%;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>':''}
        </div>
    `;

    modal.innerHTML=`<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${title}</h3>
        <div style="display:flex;flex-direction:column;margin-bottom:${privacyState[key] === 'selected' ? '16px' : '24px'};">
            ${buildOption('all', t('Все'))}
            ${buildOption('selected', t('Избранные', {count: privacyState.exceptions[key].length}))}
            ${buildOption('none', t('Никто'))}
        </div>
        ${privacyState[key] === 'selected' ? `<button onclick="closePrivacyOptionModal(() => openPrivacyExceptionsModal('${escapeAttr(key)}'))" style="width:100%;padding:16px;background:rgba(0,122,255,0.15);color:#007aff;border:2px solid rgba(0,122,255,0.3);border-radius:14px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:12px;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(0,122,255,0.25)';this.style.borderColor='rgba(0,122,255,0.5)'" onmouseout="this.style.background='rgba(0,122,255,0.15)';this.style.borderColor='rgba(0,122,255,0.3)'">${t('Выбрать пользователей')}</button>` : ''}
        <button onclick="closePrivacyOptionModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content=modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    
    requestAnimationFrame(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
}

window.setPrivacyOption = function(key, val) {
    privacyState[key] = val;
    savePrivacyState();
    const title = key === 'avatar' ? t('Фотография профиля') : key === 'bio' ? t('О себе') : key === 'status' ? t('Время последнего захода') : key === 'messages' ? t('Личные сообщения') : key === 'calls' ? t('Звонки') : key === 'voice_video' ? t('Голосовые/видеосообщения') : key === 'forwards' ? t('Пересылка сообщения') : t('Кто может меня найти');
    const modal = document.getElementById('privacy-option-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            if(modal) modal.remove();
            openPrivacyOptionModal(key, title);
        }, 150);
    }
};

function closePrivacyOptionModal(callback) {
    const modal = document.getElementById('privacy-option-modal');
    if (!modal) {
        if (typeof callback === 'function') callback();
        return;
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
}

async function openPrivacyExceptionsModal(key) {
    if (!privacyState.exceptions) privacyState.exceptions = {};
    if (!privacyState.exceptions[key]) privacyState.exceptions[key] =[];

    let modal=document.getElementById('privacy-exceptions-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='privacy-exceptions-modal';
        document.body.appendChild(modal);
    }
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)',transition:'all 0.5s cubic-bezier(0.4,0,0.2,1)'});
    
    modal.innerHTML=`<div class="modal-content" style="background:#1c1c23;width:340px;height:70vh;display:flex;flex-direction:column;padding:25px;border-radius:32px;border:1px solid rgba(255,255,255,0.1);text-align:center;box-shadow:0 25px 70px rgba(0,0,0,0.6);transform:scale(0.8) translateY(20px);opacity:0;transition:all 0.5s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin-bottom:15px;color:#fff;font-size:16px;font-weight:800;font-family:sans-serif">${t('Выбор пользователей')}</h3>
        <div id="privacy-users-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:20px;scrollbar-width:none;">
            <div style="color:#888;font-size:13px;margin-top:20px;">${t('Загрузка контактов...')}</div>
        </div>
        <button onclick="closePrivacyExceptionsModal()" style="width:100%;padding:16px;background:#a74fff;color:#fff;border:none;border-radius:18px;cursor:pointer;font-size:14px;font-weight:700;transition:.2s;font-family:sans-serif">${t('ЗАКРЫТЬ')}</button>
    </div>`;
    
    const content=modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    setTimeout(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1',backdropFilter:'blur(12px)',webkitBackdropFilter:'blur(12px)'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1) translateY(0)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
        
        fetch(`/chats-extended/${me}?t=${Date.now()}`).then(r=>r.json()).then(chats => {
            const list = document.getElementById('privacy-users-list');
            if(!list) return;
            list.innerHTML = '';
            const users = chats.filter(c => !c.isRoom && c.username !== me);
            if(users.length === 0) {
                list.innerHTML = `<div style="color:#888;font-size:13px;margin-top:20px;">${t('У вас нет контактов')}</div>`;
                return;
            }
            users.forEach(u => {
                const isSelected = privacyState.exceptions[key].includes(u.username.toLowerCase());
                const div = document.createElement('div');
                div.onclick = () => {
                    const idx = privacyState.exceptions[key].indexOf(u.username.toLowerCase());
                    if (idx > -1) privacyState.exceptions[key].splice(idx, 1);
                    else privacyState.exceptions[key].push(u.username.toLowerCase());
                    savePrivacyState();
                    const check = div.querySelector('.check-circle');
                    if (privacyState.exceptions[key].includes(u.username.toLowerCase())) {
                        check.style.background = '#a74fff';
                        check.style.borderColor = '#a74fff';
                        check.innerHTML = '<svg viewBox="0 0 24 24" style="width:12px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
                    } else {
                        check.style.background = 'transparent';
                        check.style.borderColor = 'rgba(255,255,255,0.2)';
                        check.innerHTML = '';
                    }
                };
                Object.assign(div.style, {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px',background:'rgba(255,255,255,0.03)',borderRadius:'12px',cursor:'pointer'});
                div.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:36px;height:36px;border-radius:50%;overflow:hidden">${getAvatarHtml(u.displayName || u.username, u.avatar, 36)}</div>
                        <div style="color:#eee;font-size:14px;font-weight:600">${escapeHTML(u.displayName || u.username)}</div>
                    </div>
                    <div class="check-circle" style="width:20px;height:20px;border-radius:50%;border:2px solid ${isSelected?'#a74fff':'rgba(255,255,255,0.2)'};background:${isSelected?'#a74fff':'transparent'};display:flex;alignItems:center;justifyContent:center;transition:0.2s">
                        ${isSelected?'<svg viewBox="0 0 24 24" style="width:12px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>':''}
                    </div>
                `;
                list.appendChild(div);
            });
        }).catch(()=>{});
    },15);
}
function toggleActionBtn(textarea) {
    const btn = document.getElementById('main-action-btn');
    if (!btn) return;
    if (textarea.value.trim().length > 0) {
        btn.classList.remove('mic-mode');
        btn.classList.add('send-mode');
    } else {
        btn.classList.remove('send-mode');
        btn.classList.add('mic-mode');
    }
    const aiBtn = document.getElementById('ai-rewrite-btn');
    if (aiBtn) {
        const textLen = textarea.value.trim().length;
        if (textLen >= 30) {
            aiBtn.style.display = 'flex';
            requestAnimationFrame(() => { aiBtn.style.opacity = '1'; aiBtn.style.transform = 'scale(1)'; });
        } else {
            aiBtn.style.opacity = '0';
            aiBtn.style.transform = 'scale(0.5)';
            setTimeout(() => { if (aiBtn.style.opacity === '0') aiBtn.style.display = 'none'; }, 300);
        }
    }
}

window.openAiRewriteModal = function() {
    const textarea = document.getElementById('messageText');
    const currentText = textarea ? textarea.value.trim() : '';
    if (currentText.length < 10) return;

    let modal = document.getElementById('ai-rewrite-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ai-rewrite-modal';
        document.body.appendChild(modal);
    }

    document.body.style.overflow = 'hidden';

    modal.innerHTML = `<div class="modal-content" style="
        background:rgba(30,27,36,0.95);
        backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);
        width:90%;max-width:400px;padding:32px 24px;border-radius:24px;
        border:1px solid rgba(255,255,255,0.05);
        box-shadow:0 20px 60px rgba(0,0,0,0.5);
        transform:scale(0.9);opacity:0;
        transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('AI Стилизатор')}</h3>
        <div style="position:relative;margin-bottom:20px;">
            <label style="display:block;color:#8e8e93;font-size:13px;margin-bottom:8px;font-weight:600;text-align:left;">${t('Ваш текст')}</label>
            <textarea id="ai-rewrite-text" style="width:100%;min-height:100px;max-height:150px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:16px;color:#fff;padding:16px;font-size:14px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;line-height:1.5;transition:border-color .2s" onfocus="this.style.borderColor='rgba(167,79,255,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.05)'">${escapeHTML(currentText)}</textarea>
        </div>
        <div style="position:relative;margin-bottom:24px;">
            <label style="display:block;color:#8e8e93;font-size:13px;margin-bottom:8px;font-weight:600;text-align:left;">${t('Опишите стиль')}</label>
            <input id="ai-rewrite-style" type="text" placeholder="${t('например: официально, по-дружески, как рэпер...')}" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:16px;color:#fff;padding:16px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .2s" onfocus="this.style.borderColor='rgba(167,79,255,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.05)'" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('ai-rewrite-send').click();}">
        </div>
        <div id="ai-rewrite-result-wrap" style="display:none;margin-bottom:24px;">
            <label style="display:block;color:#8e8e93;font-size:13px;margin-bottom:8px;font-weight:600;text-align:left;">${t('Результат')}</label>
            <div id="ai-rewrite-result" style="width:100%;min-height:60px;background:rgba(167,79,255,0.08);border:1px solid rgba(167,79,255,0.2);border-radius:16px;color:#e0d4f7;padding:16px;font-size:14px;line-height:1.5;word-break:break-word;text-align:left;"></div>
        </div>
        <div style="display:flex;gap:12px;">
            <button onclick="closeAiRewriteModal()" style="flex:1;background:rgba(255,255,255,0.05);color:#8e8e93;border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:16px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#8e8e93'">${t('Отмена')}</button>
            <button id="ai-rewrite-send" onclick="sendAiRewrite()" style="flex:1;background:linear-gradient(135deg,#a74fff,#6a11cb);color:#fff;border:none;border-radius:16px;padding:16px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(167,79,255,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">${t('Переписать')}</button>
            <button id="ai-rewrite-apply" onclick="applyAiRewrite()" style="display:none;flex:1;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;border-radius:16px;padding:16px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(34,197,94,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">${t('Применить')}</button>
        </div>
    </div>`;

    if (!document.getElementById('ai-rewrite-style-tag')) {
        const s = document.createElement('style');
        s.id = 'ai-rewrite-style-tag';
        s.textContent = '#ai-rewrite-text{scrollbar-width:none;-ms-overflow-style:none}#ai-rewrite-text::-webkit-scrollbar{display:none}';
        document.head.appendChild(s);
    }

    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)',
        opacity: '0', transition: 'opacity 0.3s ease', pointerEvents: 'auto'
    });

    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });

    setTimeout(() => { const styleInput = document.getElementById('ai-rewrite-style'); if (styleInput) styleInput.focus(); }, 350);
};

window.closeAiRewriteModal = function(callback) {
    const modal = document.getElementById('ai-rewrite-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    document.body.style.overflow = '';
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
};

window.sendAiRewrite = async function() {
    const textEl = document.getElementById('ai-rewrite-text');
    const styleEl = document.getElementById('ai-rewrite-style');
    const sendBtn = document.getElementById('ai-rewrite-send');
    const applyBtn = document.getElementById('ai-rewrite-apply');
    const resultWrap = document.getElementById('ai-rewrite-result-wrap');
    const resultEl = document.getElementById('ai-rewrite-result');
    if (!textEl || !styleEl) return;

    const text = textEl.value.trim();
    const style = styleEl.value.trim();
    if (text.length < 10 || style.length < 2) return;

    const originalBtnHtml = sendBtn.innerHTML;
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;animation:spin 1.5s linear infinite;"><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/></svg>`;
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.8';
    applyBtn.style.display = 'none';
    resultWrap.style.display = 'none';

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/ai-rewrite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text, style })
        });
        const data = await res.json();
        if (data.result) {
            resultEl.textContent = data.result;
            resultWrap.style.display = 'block';
            applyBtn.style.display = 'flex';
            sendBtn.innerHTML = t('Ещё раз');
        } else {
            resultEl.textContent = data.error || t('Ошибка');
            resultWrap.style.display = 'block';
            sendBtn.innerHTML = t('Переписать');
        }
    } catch {
        resultEl.textContent = t('Нет связи с сервером');
        resultWrap.style.display = 'block';
        sendBtn.innerHTML = t('Переписать');
    } finally {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    }
};

window.applyAiRewrite = function() {
    const resultEl = document.getElementById('ai-rewrite-result');
    const textarea = document.getElementById('messageText');
    if (!resultEl || !textarea) return;
    textarea.value = resultEl.textContent;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    if (typeof toggleActionBtn === 'function') toggleActionBtn(textarea);
    closeAiRewriteModal();
};
function closePrivacyExceptionsModal(callback) {
    const modal=document.getElementById('privacy-exceptions-modal');
    if(!modal){
        if(typeof callback==='function') callback();
        return;
    }
    const content=modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style,{opacity:'0',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)',pointerEvents:'none'});
    if(content)Object.assign(content.style,{opacity:'0',transform:'scale(0.8) translateY(20px)',transition:'all 0.4s cubic-bezier(0.4,0,0.2,1)'});
    setTimeout(()=>{
        if(modal.classList.contains('closing'))modal.remove();
        if(typeof callback==='function') callback();
    }, 400);
    if(typeof callback!=='function' && typeof backIfNav==='function') backIfNav();
}

if (socket && socket.connected) {
    socket.emit('update_privacy', privacyState);
}
window.updateVolume = function(val) {
    const v = parseFloat(val);
    localStorage.setItem('4send_volume', v);
    const status = document.getElementById('vol-status');
    if(status) {
        status.innerText = v === 0 ? t('Только вибрация') : t('Звук включен');
        status.style.color = v === 0 ? '#888' : '#a74fff';
    }
};

window.testVolume = function() {
    const v = parseFloat(localStorage.getItem('4send_volume') || 1);
    if (v > 0) {
        if(typeof chatNotify!=='undefined') {
            chatNotify.volume = v;
            chatNotify.currentTime = 0;
            chatNotify.play().catch(()=>{});
        }
    } else {
        if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
};
function closeSecurityModal(callback) {
    const modal = document.getElementById('security-modal');
    if (!modal) {
        if (typeof callback === 'function') callback();
        return;
    }
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style, { opacity: '0', backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', pointerEvents: 'none' });
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.8) translateY(20px)', transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 400);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}
function openAutoLockModal(){
    let modal=document.getElementById('autolock-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='autolock-modal';
        document.body.appendChild(modal);
    }
    const currentTimer=localStorage.getItem('4send_lock_time')||'0';
    const hasPin=!!localStorage.getItem('4send_pin');
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(30,27,36,0.95)',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease'});
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        body.modal-open { overflow: hidden !important; }
    `;
    if(!document.getElementById('autolock-modal-style')){
        styleTag.id = 'autolock-modal-style';
        document.head.appendChild(styleTag);
    }
    
    modal.innerHTML=`<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Автоблокировка')}</h3>
        
        <div style="margin-bottom:20px">
            <div style="color:#8e8e93;font-size:12px;margin-bottom:12px;font-weight:600;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('Таймер блокировки')}</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
                ${['1','3','5','0'].map(m=>`<button class="timer-option-btn" onclick="saveSecuritySettings('${m}')" style="padding:14px 8px;border-radius:14px;border:2px solid ${currentTimer==m?'#af52de':'transparent'};background:${currentTimer==m?'rgba(175,82,222,0.15)':'rgba(255,255,255,0.05)'};color:#fff;cursor:pointer;font-size:15px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;position:relative" onmouseover="this.style.background='${currentTimer==m?'rgba(175,82,222,0.2)':'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentTimer==m?'rgba(175,82,222,0.15)':'rgba(255,255,255,0.05)'}'">${m=='0'?t('Выкл'):m+'м'}${currentTimer==m?'<div style="position:absolute;top:4px;right:4px;width:16px;height:16px;background:#af52de;border-radius:50%;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>':''}</button>`).join('')}
            </div>
        </div>
        
        <div style="margin-bottom:24px">
            <div style="color:#8e8e93;font-size:12px;margin-bottom:12px;font-weight:600;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('Защита доступа')}</div>
            <button onclick="setupNewPin()" style="width:100%;padding:16px;border-radius:14px;background:rgba(175,82,222,0.1);border:2px dashed rgba(175,82,222,0.4);color:#af52de;font-weight:600;cursor:pointer;font-size:15px;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px" onmouseover="this.style.background='rgba(175,82,222,0.15)';this.style.borderColor='rgba(175,82,222,0.6)'" onmouseout="this.style.background='rgba(175,82,222,0.1)';this.style.borderColor='rgba(175,82,222,0.4)'">
                <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#af52de"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                ${hasPin?t('Сменить PIN-код'):t('Установить PIN-код')}
            </button>
        </div>
        
        <button onclick="closeAutoLockModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content=modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    
    requestAnimationFrame(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
}

function closeAutoLockModal(callback){
    const modal=document.getElementById('autolock-modal');
    if(!modal){
        if(typeof callback==='function') callback();
        return;
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content=modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    
    if(content)Object.assign(content.style,{opacity:'0',transform:'scale(0.9)'});
    Object.assign(modal.style,{opacity:'0',pointerEvents:'none'});
    
    setTimeout(()=>{
        if(modal.classList.contains('closing'))modal.remove();
        if(typeof callback==='function') callback();
    },300);
    
    if(typeof callback!=='function' && typeof backIfNav==='function') backIfNav();
}

function openSoundSettingsModal(){
    let modal=document.getElementById('sound-settings-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if(!modal){
        modal=document.createElement('div');
        modal.id='sound-settings-modal';
        document.body.appendChild(modal);
    }
    const currentVol=localStorage.getItem('4send_volume')!==null?parseFloat(localStorage.getItem('4send_volume')):1;
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',zIndex:'11000',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(30,27,36,0.95)',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease'});
    modal.innerHTML=`<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Настройки звука')}</h3>
        <div style="color:#8e8e93;font-size:12px;margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Громкость уведомлений')}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:16px;background:rgba(255,255,255,0.05);border-radius:14px">
            <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#8e8e93;flex-shrink:0"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            <input type="range" id="vol-slider" min="0" max="1" step="0.1" value="${currentVol}" style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,0.1);outline:none;-webkit-appearance:none;appearance:none" oninput="updateVolume(this.value)" onchange="testVolume()">
            <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#34c759;flex-shrink:0"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </div>
        <div id="vol-status" style="font-size:14px;color:${currentVol===0?'#8e8e93':'#34c759'};margin-bottom:24px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${currentVol===0?t('Только вибрация'):t('Звук включен')}</div>
        <button onclick="closeSoundSettingsModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>
    <style>
    #vol-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#34c759;cursor:pointer;box-shadow:0 2px 8px rgba(52,199,89,0.4)}
    #vol-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#34c759;cursor:pointer;border:none;box-shadow:0 2px 8px rgba(52,199,89,0.4)}
    </style>`;
    const content=modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    Object.assign(modal.style,{display:'flex',pointerEvents:'auto'});
    requestAnimationFrame(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{opacity:'1'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1)'});
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
}

function closeSoundSettingsModal(callback){
    const modal=document.getElementById('sound-settings-modal');
    if(!modal){
        if(typeof callback==='function') callback();
        return;
    }
    const content=modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style,{opacity:'0',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)',pointerEvents:'none'});
    if(content)Object.assign(content.style,{opacity:'0',transform:'scale(0.8) translateY(20px)',transition:'all 0.4s cubic-bezier(0.4,0,0.2,1)'});
    setTimeout(()=>{
        if(modal.classList.contains('closing'))modal.remove();
        if(typeof callback==='function') callback();
    },400);
    if(typeof callback!=='function' && typeof backIfNav==='function') backIfNav();
}
function saveSecuritySettings(minutes){
    if(minutes==='0'){
        localStorage.removeItem('4send_lock_time');
        typeof idleTimer!=='undefined'&&clearTimeout(idleTimer);
        showToast(t("Автоблокировка выключена"),false);
    }else{
        const pin=localStorage.getItem('4send_pin');
        if(!pin){
            showToast(t("Сначала установите PIN!"),true);
            return setupNewPin();
        }
        localStorage.setItem('4send_lock_time',minutes);
        showToast(t('lock_in_minutes', {minutes: minutes}),false);
        typeof resetIdleTimer==='function'&&resetIdleTimer();
    }
    closeAutoLockModal();
    typeof updateLockStatusUI==='function'&&updateLockStatusUI();
}
function updateLockStatusUI(){
    const statusEl=document.getElementById('lock-time-status');
    if(!statusEl)return;
    const time=localStorage.getItem('4send_lock_time');
    if(time&&time!=='0'){
        statusEl.innerText=time+' '+t('мин');
        statusEl.style.color='#4caf50';
    }else{
        statusEl.innerText=t('Выкл');
        statusEl.style.color='#ff4d4d';
    }
}
updateLockStatusUI();
function setupNewPin(){
    let modal = document.getElementById('pin-setup-modal');
    let wasHidden = !modal;
    if (modal) modal.remove();
    modal=document.createElement('div');
    modal.id='pin-setup-modal';
    
    document.body.style.overflow = 'hidden';
    
    Object.assign(modal.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',background:'rgba(30,27,36,0.95)',zIndex:'12000',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(20px)',webkitBackdropFilter:'blur(20px)',opacity:'0',transition:'opacity 0.3s ease',pointerEvents:'none'});
    
    const content=document.createElement('div');
    Object.assign(content.style,{background:'rgba(42,38,51,0.95)',backdropFilter:'blur(40px)',webkitBackdropFilter:'blur(40px)',width:'90%',maxWidth:'340px',padding:'32px 24px',borderRadius:'24px',border:'1px solid rgba(157,78,221,0.2)',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',transform:'scale(0.9)',opacity:'0',transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'});
    
    content.innerHTML=`
        <h3 style="color:#fff;margin:0 0 12px 0;font-weight:700;font-size:22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Новый PIN-код')}</h3>
        <p style="color:#8e8e93;font-size:14px;margin:0 0 24px 0;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Введите 4 цифры для защиты')}</p>
        <input type="password" id="new-pin-field" maxlength="4" placeholder="••••" style="width:160px;padding:16px;background:rgba(255,255,255,0.05);border:2px solid rgba(175,82,222,0.3);border-radius:14px;color:#fff;font-size:32px;text-align:center;outline:none;margin-bottom:24px;box-shadow:inset 0 2px 10px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:8px" onfocus="this.style.borderColor='#af52de';this.style.background='rgba(175,82,222,0.1)'" onblur="this.style.borderColor='rgba(175,82,222,0.3)';this.style.background='rgba(255,255,255,0.05)'">
        <div style="display:flex;gap:12px;width:100%">
            <button onclick="confirmNewPin()" style="flex:1;padding:16px;background:linear-gradient(135deg,#af52de,#8e24aa);border:none;border-radius:14px;color:#fff;cursor:pointer;font-weight:600;font-size:16px;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 12px rgba(175,82,222,0.3)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(175,82,222,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(175,82,222,0.3)'">${t('Сохранить')}</button>
            <button onclick="closePinSetup()" style="flex:1;padding:16px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.1);border-radius:14px;color:#8e8e93;cursor:pointer;font-weight:600;font-size:16px;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#8e8e93'">${t('Отмена')}</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    
    requestAnimationFrame(()=>{
        Object.assign(modal.style,{opacity:'1',pointerEvents:'auto'});
        Object.assign(content.style,{opacity:'1',transform:'scale(1)'});
        document.getElementById('new-pin-field')?.focus();
        if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
    });
    
    document.getElementById('new-pin-field').onkeydown=e=>{if(e.key==='Enter')confirmNewPin();};
}

function closePinSetup(){
    const modal=document.getElementById('pin-setup-modal');
    if(!modal)return;
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content=modal.querySelector('div');
    Object.assign(modal.style,{pointerEvents:'none',opacity:'0'});
    if(content)Object.assign(content.style,{transform:'scale(0.9)',opacity:'0'});
    
    setTimeout(()=>modal.remove(),300);
    typeof backIfNav==='function'&&backIfNav();
}
function confirmNewPin(){
    const val=document.getElementById('new-pin-field')?.value;
    if(val&&/^\d{4}$/.test(val)){
        localStorage.setItem('4send_pin',val);
        showToast(t("PIN-код успешно изменен!"),false);
        closePinSetup();
        if(document.getElementById('autolock-modal'))openAutoLockModal();
    }else showToast(t("Нужно ровно 4 цифры!"),true);
}
function lockApp(){
    const savedPin=localStorage.getItem('4send_pin');
    if(!savedPin||appLocked)return;
    appLocked=true;
    sessionStorage.setItem('4send_is_locked','1');
    const overlay=document.createElement('div');
    overlay.id="lock-screen";
    Object.assign(overlay.style,{position:'fixed',top:'0',left:'0',width:'100%',height:'100%',background:'rgba(10,10,15,0.95)',zIndex:'20000',display:'flex',alignItems:'center',justifyContent:'center',opacity:'0',transition:'opacity 0.6s ease',backdropFilter:'blur(15px)',webkitBackdropFilter:'blur(15px)'});
    const content=document.createElement('div');
    Object.assign(content.style,{textAlign:'center',fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transform:'scale(0.9)',transition:'all 0.6s cubic-bezier(0.34,1.56,0.64,1)'});
    
    content.innerHTML=`
        <style>
            @keyframes lockFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
            @keyframes lockPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
            @keyframes bgGlow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } }
            @keyframes shakeError { 
                0%, 100% { transform: translateX(0); } 
                25% { transform: translateX(-4px); } 
                50% { transform: translateX(4px); } 
                75% { transform: translateX(-4px); } 
            }
            .lock-input-modern {
                box-sizing: border-box; padding: 16px; border-radius: 18px; border: 2px solid rgba(167,79,255,0.3);
                background: rgba(255,255,255,0.03); color: #fff; text-align: center; font-size: 32px;
                width: 180px; outline: none; letter-spacing: 12px; text-indent: 12px; font-family: monospace;
                transition: all 0.3s ease; box-shadow: inset 0 4px 15px rgba(0,0,0,0.3);
            }
            .lock-input-modern:focus {
                border-color: #a74fff; box-shadow: 0 0 25px rgba(167,79,255,0.2), inset 0 4px 15px rgba(0,0,0,0.3);
                background: rgba(167,79,255,0.05);
            }
            .lock-input-modern::placeholder { color: rgba(255,255,255,0.2); letter-spacing: 8px; text-indent: 8px; transform: translateY(-4px); display: inline-block; }
            .lock-btn-modern {
                margin-top: 35px; padding: 18px 50px; background: linear-gradient(135deg, #a74fff, #6a11cb);
                border: none; border-radius: 16px; color: #fff; font-weight: 800; font-size: 15px; letter-spacing: 1.5px;
                cursor: pointer; transition: all 0.3s ease; box-shadow: 0 8px 25px rgba(167,79,255,0.4);
            }
            .lock-btn-modern:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(167,79,255,0.6); }
            .lock-btn-modern:active { transform: translateY(1px); box-shadow: 0 5px 15px rgba(167,79,255,0.4); }
        </style>
        <div style="position:relative; display:inline-block; margin-bottom:30px;">
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:140px; height:140px; background:radial-gradient(circle, rgba(167,79,255,0.4) 0%, transparent 70%); animation: bgGlow 3s infinite ease-in-out; z-index:0; border-radius:50%;"></div>
            <svg viewBox="0 0 24 24" style="position:relative; z-index:1; width: 85px; height: 85px; fill: none; stroke: #a74fff; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 8px 16px rgba(167,79,255,0.5)); animation: lockFloat 3s ease-in-out infinite;">
                <rect x="3" y="11" width="18" height="11" rx="3" ry="3" fill="rgba(167,79,255,0.1)"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                <circle cx="12" cy="16" r="1.5" fill="#a74fff" stroke="none" style="animation: lockPulse 2s infinite; transform-origin: center;"></circle>
            </svg>
        </div>
        <h2 style="color:#fff; margin:0 0 12px 0; letter-spacing:3px; font-weight:800; font-size:22px; text-shadow: 0 4px 15px rgba(0,0,0,0.5);">${t('4SEND ЗАБЛОКИРОВАН')}</h2>
        <p style="color:#8e8e93; font-size:14px; margin-bottom:35px; font-weight:500;">${t('Введите PIN-код для доступа')}</p>
        <input type="password" id="pin-input" class="lock-input-modern" placeholder="••••" maxlength="4" autocomplete="off"><br>
        <button onclick="unlockApp()" class="lock-btn-modern">${t('РАЗБЛОКИРОВАТЬ')}</button>
    `;
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    setTimeout(()=>{
        Object.assign(overlay.style,{opacity:'1'});
        content.style.transform='scale(1)';
        const input=document.getElementById('pin-input');
        if(input){
            input.focus();
            input.onkeydown=e=>{if(e.key==='Enter')unlockApp();};
        }
    },10);
}

function unlockApp(){
    const val=document.getElementById('pin-input')?.value;
    const savedPin=localStorage.getItem('4send_pin');
    if(val===savedPin){
        const screen=document.getElementById('lock-screen');
        if(screen){
            screen.style.opacity='0';
            screen.querySelector('div').style.transform='scale(0.9)';
            setTimeout(()=>screen.remove(),600);
        }
        appLocked=false;
        sessionStorage.removeItem('4send_is_locked');
        resetIdleTimer();
    }else{
        typeof showToast === 'function' && showToast(t("Неверный PIN!"),true);
        const inp=document.getElementById('pin-input');
        if(inp){
            inp.value='';
            inp.focus();
            inp.style.borderColor='#ff4d4d';
            inp.style.background='rgba(255,77,77,0.05)';
            inp.style.animation = 'shakeError 0.4s ease-in-out both';
            setTimeout(()=>{
                inp.style.animation = '';
                inp.style.borderColor = 'rgba(167,79,255,0.3)';
                inp.style.background = 'rgba(255,255,255,0.03)';
            }, 400);
        }
    }
}

async function selectChat(u, displayName = null, isRoom = false, roomType = null, roomOwner = null) {
    if(typeof blockNextClick!=='undefined'&&blockNextClick){blockNextClick=false;return;}
    if(document.getElementById('sidebar-context-menu')||!u)return;
    const newTarget=u.toLowerCase().trim();
    if((typeof target!=='undefined'&&target===newTarget)||isChatLoading)return;
    
    isChatLoading=true;
    window.isChatLoading = true;
    
    target=newTarget;
    window.currentRoomType=null;
    window.currentRoomMembers = [];
    window.allLoaded=false;
    window.historyPage=1;
    window.isLoadingHistory=false;
    window.currentChatHasHistory = true;
    clearProfileModal();
    clearNotifications();
    typeof openChatMobile==='function'&&openChatMobile();
    const meLower=String(me||'').toLowerCase();
    editingMsgId=null;
    replyText=null;
    if(typeof replyMsgId!=='undefined')replyMsgId=null;
    
    const chatHeader = document.getElementById('chat-header');
    if (chatHeader) chatHeader.style.display = 'flex';
    
    document.querySelectorAll('.contact-item').forEach(el => {
        if (el.getAttribute('data-username') === target) {
            el.style.background = 'rgba(167,79,255,0.15)';
            const badge = el.querySelector('.unread-badge');
            if (badge) badge.remove();
        } else {
            el.style.background = 'transparent';
        }
    });
    
    const inp=document.getElementById('messageText');
    if(inp){
        inp.value='';
        inp.style.height='auto';
        const wrapper = inp.closest('div[style*="border-radius:22px"]') || inp.parentElement;
        if(wrapper) wrapper.style.borderColor = "#252530";
        toggleActionBtn(inp);
    }
    
    const repBar=document.getElementById('reply-preview-bar');
    if(repBar)repBar.style.display='none';
    document.body.classList.add('chat-selected');
    const avBox=document.getElementById('header-avatar-box');
    const statusEl=document.getElementById('chat-status');
    const msgInput=document.getElementById('messageText');
    const sendBtn=document.getElementById('main-action-btn');
    if(avBox)avBox.style.display='block';
    const chatNameEl=document.getElementById('chat-name');
    const contactItem=document.querySelector(`.contact-item[data-username="${CSS.escape(target)}"]`);
    const isMuted=contactItem?contactItem.getAttribute('data-muted')==='1':false;
    let immediateName=displayName||u;
    if(target===meLower)immediateName=t('Избранное');
    
    if(chatNameEl) {
        chatNameEl.style.display = 'flex';
        chatNameEl.style.alignItems = 'center';
        chatNameEl.style.overflow = 'hidden';
        chatNameEl.innerHTML=`<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(immediateName)}</span>${isMuted?typeof mutedSvg!=='undefined'?mutedSvg:'' : ''}`;
    }
    
    if(statusEl){statusEl.innerText=t('загрузка...');statusEl.style.color='#777';}
    
    if(avBox){
        if(target===meLower){avBox.innerHTML=typeof savedIconSvg!=='undefined'?savedIconSvg:'';}
        else if(contactItem){
            const avatarDiv=contactItem.querySelector('div[style*="width:48px"]')||contactItem.querySelector('.avatar-box');
            if(avatarDiv)avBox.innerHTML=avatarDiv.innerHTML;
            else avBox.innerHTML=getAvatarHtml(immediateName,null,42);
        }else{avBox.innerHTML=getAvatarHtml(immediateName,null,42);}
    }
    
    let sInput=document.getElementById('searchInput')??document.getElementById('search');
    if(sInput && sInput.value.trim() !== ''){
        sInput.value='';
        const tempLock = window.isChatLoading;
        window.isChatLoading = false;
        typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
        window.isChatLoading = tempLock;
    }
    
    window.lastDateLabel=null;
    window.currentChatDate=null;

    const renderMsgArray=(msgsArray)=>{
        if(!msgContainer)return;
        msgContainer.style.visibility='hidden';
        msgContainer.innerHTML='';
        window.lastDateLabel=null;
        const frag=document.createDocumentFragment();
        const origAppend=msgContainer.appendChild.bind(msgContainer);
        msgContainer.appendChild=(node)=>frag.appendChild(node);
        msgsArray.forEach(m=>typeof renderMessage==='function'&&renderMessage(m, true));
        origAppend(frag);
        msgContainer.appendChild=origAppend;
        
        window.cleanupDateSeparators();
        msgContainer.style.visibility='visible';
        scrollToBottom(false, true);
    };
    
    const cacheKey='history_'+target.toLowerCase();
    let cachedHistory = null;
    try { cachedHistory = await idbGet(cacheKey); } catch {}
    
    if (cachedHistory && cachedHistory.length > 0) {
        renderMsgArray(cachedHistory);
    } else {
        if(msgContainer){
            msgContainer.innerHTML='';
            msgContainer.style.visibility='visible';
        }
    }

    const fetchStatus=async()=>{
        if(target !== newTarget || !target) return;
        if(isRoom||target.startsWith('room_')){
            try{
                const res=await fetch(`/api/room/${encodeURIComponent(target)}`);
                if(target !== newTarget || !target) return;
                if(res.ok){
                    const roomData=await res.json();
                    window.currentRoomType=roomData.type;
                    window.currentRoomMembers = roomData.memberDetails || []; // Сохраняем участников для автокомплита
                    const mCount=roomData.members?roomData.members.length:1;
                    if(roomData.type==='channel'){statusEl.innerText=typeof pluralize==='function'?pluralize(mCount,[t('подписчик'),t('подписчика'),t('подписчиков')]):mCount+' '+t('участн.');}
                    else{statusEl.innerText=typeof pluralize==='function'?pluralize(mCount,[t('участник'),t('участника'),t('участников')]):mCount+' '+t('участн.');}
                    preloadProfileModal(target,roomData,{isRoom:true});
                    if(chatNameEl) {
                        chatNameEl.style.display = 'flex';
                        chatNameEl.style.alignItems = 'center';
                        chatNameEl.style.overflow = 'hidden';
                        chatNameEl.innerHTML=`<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(roomData.name||target)}</span>${roomData.isVerified?getVerifyBadgeHtml(roomData.type):''}${isMuted?typeof mutedSvg!=='undefined'?mutedSvg:'' : ''}`;
                    }
                    if(avBox)avBox.innerHTML=getAvatarHtml(roomData.name||target,roomData.avatar,42);
                    statusEl.style.color='#777';
                    
                    const msgContainerEl = document.getElementById('msg-container');
                    if (msgContainerEl) {
                        if (roomData.copyRestriction) {
                            msgContainerEl.classList.add('copy-restricted');
                        } else {
                            msgContainerEl.classList.remove('copy-restricted');
                        }
                    }

                    const bottomBar=document.getElementById('bottom-bar-container');
                    let channelOverlay=document.getElementById('channel-overlay');
                    if(roomData.type==='channel'&&String(roomData.owner).toLowerCase()!==meLower){
                        if(bottomBar)bottomBar.style.display='none';
                        if(!channelOverlay){
                            channelOverlay=document.createElement('div');
                            channelOverlay.id='channel-overlay';
                            channelOverlay.style='padding: 18px; text-align: center; background: #121218; border-top: 1px solid #252530; cursor: pointer; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; transition: background 0.2s ease; text-transform: uppercase; user-select: none;';
                            channelOverlay.onmouseover=()=>channelOverlay.style.background='rgba(167, 79, 255, 0.1)';
                            channelOverlay.onmouseout=()=>channelOverlay.style.background='#121218';
                            const chatWindow=document.getElementById('chat-window');
                            if(chatWindow)chatWindow.appendChild(channelOverlay);
                        }
                        channelOverlay.style.display='block';
                        const updateMuteBtn=()=>{
                            const contactItem=document.querySelector(`.contact-item[data-username="${CSS.escape(target)}"]`);
                            const isMuted=contactItem?contactItem.getAttribute('data-muted')==='1':false;
                            channelOverlay.innerText=isMuted?t('ВКЛЮЧИТЬ УВЕДОМЛЕНИЯ'):t('УБРАТЬ ЗВУК');
                            channelOverlay.style.color=isMuted?'#888':'#a74fff';
                        };
                        updateMuteBtn();
                        channelOverlay.onclick=()=>{
                            const contactItem=document.querySelector(`.contact-item[data-username="${CSS.escape(target)}"]`);
                            if(contactItem){
                                const isMuted=contactItem.getAttribute('data-muted')==='1';
                                contactItem.setAttribute('data-muted',isMuted?'0':'1');
                            }
                            socket.emit('toggle_mute',{contact:target,me:window.me});
                            updateMuteBtn();
                        };
                    }else{
                        if(bottomBar)bottomBar.style.display='flex';
                        if(channelOverlay)channelOverlay.style.display='none';
                        if(msgInput){
                            msgInput.disabled=false;
                            msgInput.placeholder=t("Написать...");
                            msgInput.style.opacity="1";
                        }
                        if(sendBtn)Object.assign(sendBtn.style,{pointerEvents:"auto",opacity:"1"});
                    }
                }
            }catch(e){}
        }else{
            const channelOverlay=document.getElementById('channel-overlay');
            if(channelOverlay)channelOverlay.style.display='none';
            const bottomBar=document.getElementById('bottom-bar-container');
            if(bottomBar)bottomBar.style.display='flex';
            try{
                const res=await fetch(`/api/status/${encodeURIComponent(target)}?me=${encodeURIComponent(me)}`,{headers:{'Authorization':`Bearer ${localStorage.getItem('4send_token')}`}});
                if(target !== newTarget || !target) return;
                const data=await res.json();
                
                const msgContainerEl = document.getElementById('msg-container');
                if (msgContainerEl) {
                    if (data.copyRestriction) {
                        msgContainerEl.classList.add('copy-restricted');
                    } else {
                        msgContainerEl.classList.remove('copy-restricted');
                    }
                }

                if(chatNameEl) {
                    chatNameEl.style.display = 'flex';
                    chatNameEl.style.alignItems = 'center';
                    chatNameEl.style.overflow = 'hidden';
                    chatNameEl.innerHTML=`<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${target===meLower?t('Избранное'):escapeHTML(data.displayName || immediateName)}</span>${target!==meLower&&data.isVerified?getVerifyBadgeHtml('user'):''}${isMuted?typeof mutedSvg!=='undefined'?mutedSvg:'' : ''}`;
                }
                const blockCheckRes=await fetch(`/api/is-blocked/${encodeURIComponent(me)}/${encodeURIComponent(target)}`);
                const blockCheckData=await blockCheckRes.json();
                const iBlockedHim=blockCheckData.blocked;
                const avatarToDisplay=data.is_blocked?null:data.avatar;
                
                if(avBox){
                    if(target===meLower) {
                        avBox.innerHTML=typeof savedIconSvg!=='undefined'?savedIconSvg:'';
                    } else {
                        avBox.innerHTML=getAvatarHtml(data.displayName || target,avatarToDisplay,42);
                    }
                }
                
                const isOn=typeof onlineUsers!=='undefined'&&Array.from(onlineUsers).some(u=>String(u).toLowerCase()===target);
                if(target===meLower){
                    statusEl.innerText=t('сохраненные сообщения');
                    statusEl.style.color='#777';
                }else if(target === '4send_system' || target === '4send_help'){
                    statusEl.innerText=t('системный бот');
                    statusEl.style.color='#777';
                }else if(data.is_blocked){
                    statusEl.innerText=t('был(а) давно');
                    statusEl.style.color='#777';
                }else if(window.currentChatHasHistory === false){
                    statusEl.innerText=t('был(а) недавно');
                    statusEl.style.color='#777';
                }else if(isOn){
                    statusEl.innerText=t('в сети');
                    statusEl.style.color='#4caf50';
                }else if(data.last_seen){
                    statusEl.innerText=typeof formatLastSeen==='function'?formatLastSeen(data.last_seen):t('был(а) недавно');
                    statusEl.style.color='#777';
                }
                preloadProfileModal(target,data,{isRoom:false,iBlockedHim});
                if(target === '4send_system') {
                    if(msgInput){
                        msgInput.disabled=true;
                        msgInput.placeholder=t("Системный бот");
                        msgInput.style.opacity="0.5";
                        msgInput.value="";
                    }
                    if(sendBtn)Object.assign(sendBtn.style,{pointerEvents:"none",opacity:"0.5"});
                } else if(data.is_blocked||iBlockedHim){
                    if(msgInput){
                        msgInput.disabled=true;
                        msgInput.placeholder=t("Отправка сообщений ограничена");
                        msgInput.style.opacity="0.5";
                        msgInput.value="";
                    }
                    if(sendBtn)Object.assign(sendBtn.style,{pointerEvents:"none",opacity:"0.5"});
                }else{
                    if(msgInput){
                        msgInput.disabled=false;
                        msgInput.placeholder=t("Написать...");
                        msgInput.style.opacity="1";
                        const savedDraft=localStorage.getItem('4send_draft_'+target)||'';
                        msgInput.value=savedDraft;
                        msgInput.style.height='auto';
                        const newHeight=Math.min(msgInput.scrollHeight>0?msgInput.scrollHeight:0,150);
                        if(newHeight>0)msgInput.style.height=newHeight+'px';
                        msgInput.style.overflowY=msgInput.scrollHeight>150?'auto':'hidden';
                        toggleActionBtn(msgInput);
                    }
                    if(sendBtn)Object.assign(sendBtn.style,{pointerEvents:"auto",opacity:"1"});
                }
            }catch(e){}
        }
    };
    const fetchHistory = async () => {
        if(target !== newTarget || !target) return;
        try {
            const u1 = String(me).toLowerCase();
            const u2 = String(target).toLowerCase();

            let cached = await idbGet(cacheKey) ||[];

            const hRes = await fetch(`/history/${encodeURIComponent(u1)}/${encodeURIComponent(u2)}?t=${Date.now()}`, {
                headers: {'Authorization': `Bearer ${localStorage.getItem('4send_token')}`}
            });
            if(target !== newTarget || !target) return;
            const serverMsgs = await hRes.json();

            if(Array.isArray(serverMsgs)) {
                let mergedMsgs =[];

                if (serverMsgs.length > 0) {
                    const oldestServerMsg = serverMsgs[0];
                    const olderCached = cached.filter(m => new Date(m.timestamp) < new Date(oldestServerMsg.timestamp) && m.id !== oldestServerMsg.id);
                    mergedMsgs =[...olderCached, ...serverMsgs];
                } else {
                    mergedMsgs =[];
                }

                window.currentChatHasHistory = mergedMsgs.length > 0;
                await idbSet(cacheKey, mergedMsgs);

                renderMsgArray(mergedMsgs);

                if (!window.currentChatHasHistory && !isRoom && !target.startsWith('room_') && target !== String(me).toLowerCase()) {
                    const statusEl = document.getElementById('chat-status');
                    if (statusEl && !window.isTypingActive) {
                        statusEl.innerText = t('был(а) недавно');
                        statusEl.style.color = '#777';
                    }
                }
            }
        } catch {}
    };
    const fetchPins=async()=>{
        if(target !== newTarget || !target) return;
        try{
            const res=await fetch(`/api/get-pins/${encodeURIComponent(me)}/${encodeURIComponent(target)}`);
            if(target !== newTarget || !target) return;
            const pinsFromDb=await res.json();
            if(Array.isArray(pinsFromDb)){
                if(typeof allPinned!=='undefined'){
                    allPinned[cacheKey]=pinsFromDb.map(p=>({id:p.id||p.message_id,text:p.text||t("Сообщение")}));
                    typeof savePins==='function'&&savePins();
                }
            }
        }catch{}
        typeof updatePinnedUI==='function'&&updatePinnedUI();
    };
    
    await Promise.all([fetchStatus(),fetchHistory(),fetchPins()]);
    
    if(target!==meLower){
        if(target.startsWith('room_')){
            socket.emit('mark_read',{sender:target,receiver:me,isRoom:true});
        }else{
            socket.emit('mark_read',{sender:target,receiver:me});
        }
    }
    currentPinnedIndex=0;
    if(msgInput&&!msgInput.disabled){
        setTimeout(()=>msgInput.focus(),100);
        msgInput.onkeydown=e=>{
            if(e.key==='Enter'&&!e.shiftKey){
                e.preventDefault();
                e.stopImmediatePropagation();
                typeof send==='function'&&send();
                return false;
            }
            if(e.key==='ArrowUp'&&msgInput.value===''&&!editingMsgId){
                e.preventDefault();
                const sentMsgs=document.querySelectorAll('.msg.sent');
                for (let i = sentMsgs.length - 1; i >= 0; i--) {
                    const lastMsg = sentMsgs[i];
                    const isVideoNote = !!lastMsg.querySelector('.video-note-wrapper') || !!lastMsg.querySelector('.custom-video-wrapper');
                    const isVoice = !!lastMsg.querySelector('.voice-player');
                    if (!isVideoNote && !isVoice) {
                        const id = lastMsg.getAttribute('data-id');
                        const textEl = lastMsg.querySelector('.msg-text');
                        const txt = textEl ? textEl.innerText : "";
                        if (id) { prepareEdit(id, txt); break; }
                    }
                }
            }
            if(e.key==='ArrowLeft'&&msgInput.value===''){
                e.preventDefault();
                const rcvMsgs=document.querySelectorAll('.msg.rcv');
                if(rcvMsgs.length>0){
                    const lastMsg=rcvMsgs[rcvMsgs.length-1];
                    const id=lastMsg.getAttribute('data-id');
                    const textEl=lastMsg.querySelector('.msg-text');
                    const txt=textEl?textEl.innerText:t("Медиа");
                    if(id){prepareReply(txt,id);}
                }
            }
        };
    }
    
    isChatLoading=false;
    
    setTimeout(() => {
        window.isChatLoading = false;
    }, 500);
    
    if (typeof applyChatPrivacyUI === 'function') {
        applyChatPrivacyUI(u);
    }
}

async function loadMoreHistory(targetUser) {
    if(window.allLoaded || !targetUser || window.isLoadingHistory) return;
    window.isLoadingHistory = true;
    
    const c = document.getElementById('msg-container');
    const firstMsgEl = c.querySelector('.msg');
    const lastId = firstMsgEl ? firstMsgEl.getAttribute('data-id') : null;
    
    try {
        const u1 = String(me).toLowerCase();
        const u2 = String(targetUser).toLowerCase();
        const token = localStorage.getItem('4send_token');
        
        const res = await fetch(`/history/${u1}/${u2}?lastId=${lastId}&t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const msgs = await res.json();
        
        if(!msgs || msgs.length === 0 || msgs.error) {
            window.allLoaded = true;
            window.isLoadingHistory = false;
            return;
        }
        
        const tempContainer = document.createElement('div');
        const originalGetElementById = document.getElementById;
        document.getElementById = function(id) {
            if (id === 'msg-container') return tempContainer;
            return originalGetElementById.call(document, id);
        };
        
        window.lastDateLabel = null; 
        msgs.forEach(m => renderMessage(m, true));
        document.getElementById = originalGetElementById; 
        
        const fragment = document.createDocumentFragment();
        while(tempContainer.firstChild) {
            fragment.appendChild(tempContainer.firstChild);
        }
        
        const oldScrollHeight = c.scrollHeight;
        const oldScrollTop = c.scrollTop;
        
        c.insertBefore(fragment, c.firstChild);
        
        c.scrollTop = oldScrollTop + (c.scrollHeight - oldScrollHeight);
        window.cleanupDateSeparators();
        
    } catch (e) {
    } finally {
        setTimeout(() => {
            window.isLoadingHistory = false;
        }, 150);
    }
}
async function send(){
    const inp=document.getElementById('messageText');
    const text=inp.value.trim();
    
    if(typeof isSending==='undefined')window.isSending=false;
    if(isSending)return;
    if(text.length>1000){
        typeof showToast==='function'&&showToast(t("Сообщение слишком длинное! Лимит — 1000 символов."));
        return;
    }
    if(!text&&!editingMsgId&&!replyText)return;
    const currentTarget=typeof target!=='undefined'?target:activeChat;
    if(!currentTarget){
        typeof showToast==='function'&&showToast(t("Выберите чат!"));
        return;
    }
    isSending=true;
    
    const currentEditingId = editingMsgId;
    const currentReplyText = replyText;
    const currentReplyMsgId = typeof replyMsgId !== 'undefined' ? replyMsgId : null;
    
    const tempId='4S_'+Date.now()+Math.random().toString(36).substr(2,9);
    let expiresAt=null;
    if(typeof activeTimerMinutes!=='undefined'&&activeTimerMinutes>0){
        expiresAt = activeTimerMinutes * 60;
    }

    const delayMinutes = window.scheduledMessageTime || 0;

    const executeSend = async () => {
        try {
            localStorage.removeItem('4send_draft_' + currentTarget);
            const sendUrl = extractFirstUrl(text);
            if (sendUrl && typeof fetchLinkPreview === 'function') fetchLinkPreview(sendUrl);
            if (currentEditingId) {
                socket.emit('edit_msg', { id: currentEditingId, newText: text, sender: me });
                editingMsgId = null;
                if (inp) {
                    const wrapper = inp.parentElement.parentElement;
                    if (wrapper) wrapper.style.borderColor = "#252530";
                }
                typeof backIfNav === 'function' && backIfNav();
            } else {
                if (typeof renderMessage === 'function') {
                    renderMessage({ sender: me, receiver: currentTarget, text, timestamp: new Date().toISOString(), id: tempId, tempId, reply_to: currentReplyText, reply_to_id: currentReplyMsgId, expires_at: expiresAt });
                    scrollToBottom(false, true);
                }
                socket.emit('chat_message', { sender: me, receiver: currentTarget, text, expires_at: expiresAt, reply_to: currentReplyText, reply_to_id: currentReplyMsgId, tempId });
                const msgData = { sender: me, receiver: currentTarget, text, expires_at: expiresAt, reply_to: currentReplyText, reply_to_id: currentReplyMsgId, tempId };
                const msgTimeout = setTimeout(() => {
                    showSendFailed(tempId);
                }, 15000);
                pendingMessages.set(tempId, { timeout: msgTimeout, data: msgData });
            }
        } catch {}
    };

    if (delayMinutes > 0) {
        addScheduledTask(delayMinutes, executeSend, text);
        window.scheduledMessageTime = 0; 
    } else {
        await executeSend();
    }

    inp.value='';
    inp.style.height='auto';
    inp.style.overflowY='hidden';
    const wrapper = inp.parentElement.parentElement;
    if(wrapper) wrapper.style.borderColor = "#252530";
    toggleActionBtn(inp);
    typeof cancelReply==='function'&&cancelReply();
    const counter=document.getElementById('char-counter');
    if(counter){
        counter.innerText="0/1000";
        counter.style.opacity="0";
    }
    typeof setTimer==='function'&&setTimer(0,t('Выкл'),true);
    inp.focus();
    setTimeout(()=>isSending=false,500);
}
window.openEchoSound = function() {
    typeof forceCloseMenu === 'function' && forceCloseMenu(true);
    const drawer = document.getElementById('menu-drawer');
    if(drawer) drawer.classList.remove('open');
    const ov = document.getElementById('overlay');
    if(ov) {
        ov.classList.remove('active');
        setTimeout(() => ov.style.display = 'none', 300);
    }

    typeof backIfNav === 'function' && backIfNav();

    setTimeout(() => {
        let modal = document.getElementById('echosound-modal');
        let iframe = document.getElementById('echosound-iframe');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'echosound-modal';
            Object.assign(modal.style, {
                display: 'none', position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: '#07070f', opacity: '0', transition: 'opacity 0.3s ease', zIndex: '2147483647'
            });
            modal.innerHTML = `
                <div style="width:100%;height:100%;position:relative;display:flex;flex-direction:column;">
                    <div style="position:fixed;top:calc(15px + env(safe-area-inset-top));right:20px;z-index:999999;">
                        <button onclick="closeEchoSound()" style="background:rgba(0,0,0,0.5);border:1px solid rgba(168,85,247,0.5);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(5px);transition:0.2s;-webkit-tap-highlight-color:transparent;" onmouseover="this.style.background='rgba(168,85,247,0.5)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">✕</button>
                    </div>
                    <iframe id="echosound-iframe" src="/echosound.html" style="flex:1;width:100%;height:100%;border:none;background:#07070f;"></iframe>
                </div>
            `;
            document.body.appendChild(modal);
            iframe = modal.querySelector('iframe');
        }
        
        if (modal && iframe) {
            modal.style.setProperty('z-index', '2147483647', 'important');
            iframe.src = '/echosound.html';
            modal.style.display = 'flex';
            setTimeout(() => modal.style.opacity = '1', 10);
            typeof pushNavigationState === 'function' && pushNavigationState();
        }
    }, 150);
};

window.closeEchoSound = function() {
    const modal = document.getElementById('echosound-modal');
    const iframe = document.getElementById('echosound-iframe');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            if (iframe) iframe.src = '';
        }, 300);
        typeof backIfNav === 'function' && backIfNav();
    }
};
function updateAvatarUI(id,file,name){
    const el=document.getElementById(id);
    if(file)el.innerHTML=`<img src="/uploads/${escapeAttr(file)}">`;
    else el.innerHTML=name.toUpperCase();
}
function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    const content = document.getElementById('settings-modal-content');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    
    setTimeout(() => {
        modal.remove();
        typeof backIfNav === 'function' && backIfNav();
    }, 300);
}
let onlineUsers=new Set(),mediaRecorder,audioChunks=[],recordInterval,seconds=0,tempAvatarUrl=null,msgToForward=null,replyMsgId=null,previewResetTimeouts={};
socket.on('user_status_update',data=>{if(data.username===target)updateHeaderStatusOnly(data.username);});
window.ondragstart=()=>false;
const savedIconSvg=`<div class="saved-icon" style="background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><svg viewBox="0 0 24 24" style="width:60%;height:60%;fill:white"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>`;
function getAvatarHtml(name, url, size=40, isPersonal=false){
    if (!isPersonal && name && window.me) {
        if (!checkPrivacySetting(name, window.me, 'avatar')) {
            url = null;
        }
    }
    
    if(String(name).toLowerCase()===String(me).toLowerCase()&&!isPersonal)return savedIconSvg;
    if(url && url !== 'null' && url !== '') {
        let optimizedUrl = url;
        if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
            optimizedUrl = url.replace('/upload/', `/upload/w_${size*2},h_${size*2},c_fill,q_auto,f_auto/`);
        }
        return `<img src="${escapeHTML(optimizedUrl)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover">`;
    }
    const colors=['#f44336','#9c27b0','#673ab7','#3f51b5','#2196f3','#009688','#4caf50','#ff9800'];
    const color=colors[Math.abs(name.length)%colors.length];
    return `<div class="av-letter" style="background:${color};font-size:${size/2.2}px">${escapeHTML(name).charAt(0).toUpperCase()}</div>`;
}
window.onload=()=>{
    if(me){
        document.getElementById('auth-screen').style.display='none';
        document.getElementById('main-app').style.display='flex';
        const isVer=localStorage.getItem('4send_isVerified')==='1';
        const dName = localStorage.getItem('4send_displayName') || me;
        
        if (typeof updateDrawerNameUI === 'function') {
            updateDrawerNameUI(dName, me, isVer);
        }
        
        const myAvatar=localStorage.getItem('4send_avatar');
        document.getElementById('drawer-av-box').innerHTML=getAvatarHtml(dName,myAvatar,90,true);
        socket.emit('join',me);
        loadChatsWithPreview();
    }
};

function toggleInternalSearch() {
    const bar = document.getElementById('chat-search-bar');
    const inp = document.getElementById('internalSearchInput');
    if (!bar || !inp) return;
    
    if (bar.style.display === 'none' || bar.style.display === '') {
        bar.style.display = 'block';
        bar.classList.remove('search-bar-exit');
        bar.classList.add('search-bar-enter');
        inp.value = '';
        setTimeout(() => inp.focus(), 50);
    } else {
        bar.classList.remove('search-bar-enter');
        bar.classList.add('search-bar-exit');
        setTimeout(() => {
            bar.style.display = 'none';
            inp.value = '';
            resetSearch();
        }, 200);
    }
}
function resetSearch() {
    document.querySelectorAll('.msg').forEach(m => {
        const wrapper = m.parentElement;
        if (wrapper) wrapper.classList.remove('msg-hidden-by-search');
        
        const span = m.querySelector('.msg-text');
        if (span && span.hasAttribute('data-original')) {
            span.innerHTML = span.getAttribute('data-original');
        }
    });
    
    document.querySelectorAll('.date-separator').forEach(ds => {
        ds.style.display = 'flex';
    });
}
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const searchInputEl = document.getElementById('internalSearchInput');
let internalSearchTimeout;

if (searchInputEl) {
    searchInputEl.oninput = e => {
        clearTimeout(internalSearchTimeout);
        internalSearchTimeout = setTimeout(() => {
            const q = e.target.value.toLowerCase().trim();
            
            if (q.length === 0) {
                resetSearch();
                return;
            }

            document.querySelectorAll('.date-separator').forEach(ds => {
                ds.style.display = 'none';
            });

            document.querySelectorAll('.msg').forEach(m => {
                const wrapper = m.parentElement;
                const span = m.querySelector('.msg-text');
                
                if (!span) {
                    if (wrapper) wrapper.classList.add('msg-hidden-by-search');
                    return;
                }

                if (!span.hasAttribute('data-original')) {
                    span.setAttribute('data-original', span.innerHTML);
                }
                
                const originalHTML = span.getAttribute('data-original');
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = originalHTML;
                
                const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
                const nodes = [];
                let node;
                while (node = walker.nextNode()) {
                    nodes.push(node);
                }
                
                let matched = false;
                nodes.forEach(n => {
                    const text = n.nodeValue;
                    if (text.toLowerCase().includes(q)) {
                        matched = true;
                        const escapedText = escapeHTML(text);
                        const regex = new RegExp(`(${escapeRegExp(escapeHTML(q))})`, 'gi');
                        const spanWrapper = document.createElement('span');
                        spanWrapper.innerHTML = escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
                        n.parentNode.replaceChild(spanWrapper, n);
                    }
                });
                
                if (matched) {
                    span.innerHTML = tempDiv.innerHTML;
                    if (wrapper) wrapper.classList.remove('msg-hidden-by-search');
                } else {
                    span.innerHTML = originalHTML; 
                    if (wrapper) wrapper.classList.add('msg-hidden-by-search');
                }
            });
        }, 300);
    };
    
    searchInputEl.onkeydown = e => {
        if (e.key === 'Escape') {
            toggleInternalSearch();
        }
    };
}
document.addEventListener('DOMContentLoaded', () => {
    const customStyles = document.createElement('style');
    customStyles.innerHTML = `
        .chat-content, .message-row, .msg { -webkit-user-select: none !important; -ms-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
        .msg-text { -webkit-user-select: text !important; -ms-user-select: text !important; user-select: text !important; -webkit-touch-callout: default !important; }
        .msg-highlighted { z-index: 1000001; position: relative; filter: brightness(1.2); transform: scale(1.02); transition: all 0.2s ease; box-shadow: 0 0 20px rgba(167,79,255,0.4); }
        .msg-selected-wrapper { background: rgba(167,79,255,0.15); border-radius: 14px; transition: 0.2s; }
        .select-checkbox { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); margin: auto 10px; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; }
        .select-checkbox.checked { background: #a74fff; border-color: #a74fff; }
        .select-checkbox.checked::after { content: ''; width: 5px; height: 10px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); margin-bottom: 2px; }
        .menu-group { background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
        .menu-group .menu-item { border-radius: 0; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .menu-group .menu-item:last-child { border-bottom: none; }
    `;
    document.head.appendChild(customStyles);
    const style = document.createElement('style');
    style.innerHTML = `
        #chat-search-bar {
            background: transparent;
            padding: 10px 15px;
            display: none;
            position: relative;
            z-index: 100;
        }
        .search-bar-enter {
            animation: slideDownSearch 0.2s ease-out forwards;
        }
        .search-bar-exit {
            animation: slideUpSearch 0.2s ease-in forwards;
        }
        #internalSearchInput {
            width: 100%;
            background: transparent;
            border: 1px solid rgba(167,79,255,0.3);
            color: #fff;
            padding: 10px 15px 10px 40px;
            border-radius: 12px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23a74fff" width="18px" height="18px"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>');
            background-repeat: no-repeat;
            background-position: 12px center;
        }
        #internalSearchInput:focus {
            border-color: #a74fff;
            background-color: rgba(167,79,255,0.05);
            box-shadow: 0 0 0 3px rgba(167,79,255,0.1);
        }
        #internalSearchInput::placeholder {
            color: #777;
        }
        mark.search-highlight {
            background-color: #a74fff;
            color: #fff;
            border-radius: 4px;
            padding: 1px 4px;
            font-weight: 600;
            box-shadow: 0 0 8px rgba(167, 79, 255, 0.6);
        }
        .msg-hidden-by-search {
            display: none !important;
        }
        @keyframes slideDownSearch {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUpSearch {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
});
window.privacyRegistry = {};
setInterval(() => {
    if (typeof target !== 'undefined' && target) applyChatPrivacyUI(target);
}, 500);
socket.on('privacy_sync', (registry) => {
    window.privacyRegistry = registry;
    if (window.me && registry[window.me.toLowerCase()]) {
        const serverState = registry[window.me.toLowerCase()];
        privacyState = { ...privacyState, ...serverState };
        privacyState.exceptions = { ...privacyState.exceptions, ...(serverState.exceptions || {}) };
        localStorage.setItem('4send_privacy', JSON.stringify(privacyState));
    }
    
    typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
    typeof updateHeaderStatus === 'function' && updateHeaderStatus();
    if (typeof target !== 'undefined' && target) applyChatPrivacyUI(target);
});

socket.on('connect', () => {
    socket.emit('request_privacy_sync');
});

if (socket && socket.connected) {
    socket.emit('request_privacy_sync');
    socket.emit('update_privacy', privacyState);
}
function checkPrivacySetting(owner, requester, type) {
    if (!owner || !requester || owner.toLowerCase() === requester.toLowerCase()) return true;
    if (!window.privacyRegistry) return true;
    const p = window.privacyRegistry[owner.toLowerCase()];
    if (!p) return true;
    if (p[type] === 'none') return false;
    if (p[type] === 'selected') return p.exceptions && p.exceptions[type] && p.exceptions[type].includes(requester.toLowerCase());
    return true;
}
const _baseGetAvatarHtml = window.getAvatarHtml;
window.getAvatarHtml = function(name, url, size=40, isPersonal=false) {
    if (!isPersonal && name && window.me) {
        if (!checkPrivacySetting(name, window.me, 'avatar')) url = null;
    }
    return _baseGetAvatarHtml(name, url, size, isPersonal);
};
const _baseUpdateHeaderStatus = window.updateHeaderStatus;
window.updateHeaderStatus = async function() {
    if (typeof target !== 'undefined' && target && !target.startsWith('room_') && target.toLowerCase() !== window.me.toLowerCase()) {
        if (!checkPrivacySetting(target, window.me, 'status')) {
            const statusEl = document.getElementById('chat-status');
            if (statusEl) {
                statusEl.innerText = t('был(а) недавно');
                statusEl.style.color = '#777';
            }
            return;
        }
    }
    return _baseUpdateHeaderStatus.apply(this, arguments);
};

async function checkAndSelectChat(username) {
    try {
        const res = await fetch(`/api/status/${username}?me=${me}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('4send_token')}` } });
        if (res.ok) {
            selectChat(username);
        } else {
            typeof showToast === 'function' && showToast(t("Пользователь не найден"), true);
        }
    } catch {
        typeof showToast === 'function' && showToast(t("Ошибка соединения"), true);
    }
}

window.unpinMessageById = function(msgId) {
    if (!target) return;
    socket.emit('unpin_request', { messageId: msgId, chatId: target.toLowerCase(), pinnerId: me.toLowerCase() });
};
function applyChatPrivacyUI(userTarget) {
    const callBtn = document.getElementById('chat-header-call-btn');
    if (!userTarget || userTarget.startsWith('room_') || userTarget.toLowerCase() === window.me.toLowerCase()) {
        if (callBtn) callBtn.style.display = 'none';
    } else if (callBtn) {
        callBtn.style.display = (userTarget === '4send_system' || userTarget === '4send_help') ? 'none' : 'flex';
    }
    
    const msgInput = document.getElementById('messageText');
    const actionBtn = document.getElementById('main-action-btn');
    const fInputBtn = document.querySelector('button[onclick=\'document.getElementById("f-input").click()\']');
    
    const canMsg = checkPrivacySetting(userTarget, window.me, 'messages');
    const canMedia = checkPrivacySetting(userTarget, window.me, 'voice_video');

    if (!canMsg && msgInput) {
        if (!msgInput.disabled || msgInput.placeholder !== t("Пользователь ограничил доступ")) {
            msgInput.disabled = true;
            msgInput.placeholder = t("Пользователь ограничил доступ");
            msgInput.style.opacity = "0.5";
            msgInput.value = "";
            if(actionBtn) Object.assign(actionBtn.style, {pointerEvents: "none", opacity: "0.5"});
            if(fInputBtn) Object.assign(fInputBtn.style, {pointerEvents: "none", opacity: "0.5"});
        }
    } else if (canMsg && msgInput && msgInput.placeholder === t("Пользователь ограничил доступ")) {
        msgInput.disabled = false;
        msgInput.placeholder = t("Написать...");
        msgInput.style.opacity = "1";
        if(actionBtn) Object.assign(actionBtn.style, {pointerEvents: "auto", opacity: "1"});
        if(fInputBtn) Object.assign(fInputBtn.style, {pointerEvents: "auto", opacity: "1"});
    }

    if (canMsg && actionBtn) {
        if (!canMedia) {
            actionBtn.classList.add('media-restricted');
        } else {
            actionBtn.classList.remove('media-restricted');
        }
    }
}
document.getElementById('msg-container')?.addEventListener('contextmenu', e => {
    const msgWrapper = e.target.closest('div[style*="width: 100%"]') || e.target.closest('.msg-swipe-wrap') || e.target.closest('.msg-wrapper-cv');
    const el = msgWrapper ? msgWrapper.querySelector('.msg') : e.target.closest('.msg');
    if (!el) return;
    e.preventDefault();
    
    if (window.isMultiSelectMode) {
        closeMultiSelect();
    }
    
    document.querySelectorAll('.msg-highlighted').forEach(elem => elem.classList.remove('msg-highlighted'));
    
    menuOpenTime = Date.now();
    const id = el.getAttribute('data-id');
    const isMe = el.classList.contains('sent');
    
    el.classList.add('msg-highlighted');
    
    const isVideoNote = !!el.querySelector('.video-note-wrapper') || !!el.querySelector('.custom-video-wrapper');
    const isVoice = !!el.querySelector('.voice-player');
    const canEdit = isMe && !isVideoNote && !isVoice;
    
    let txt = t("Сообщение");
    let editTxt = "";
    const textEl = el.querySelector('.msg-text');
    
    if (textEl) {
        txt = textEl.innerText;
        editTxt = txt;
    } else if (isVideoNote) {
        txt = t('📹 Видеосообщение');
    } else if (isVoice) {
        txt = t('🎤 Голосовое сообщение');
    } else if (el.querySelector('.music-player')) {
        txt = t('🎵 Аудиозапись');
    } else if (el.querySelector('.file-message')) {
        txt = t('📁 Файл');
    } else if (el.querySelector('img')) {
        const imgEl = el.querySelector('img');
        if (imgEl.getAttribute('data-is-sticker') === 'true') txt = t('Стикер');
        else if (imgEl.getAttribute('data-is-gif') === 'true') txt = "GIF";
        else txt = t('📷 Фотография');
    }
    
    let downloadUrl = null;
    let downloadName = 'media';
    const img = el.querySelector('img');
    const vid = el.querySelector('video');
    const fileMsg = el.querySelector('.file-message');
    
    const isGif = img && (img.getAttribute('data-is-gif') === 'true' || img.src.toLowerCase().includes('.gif'));
    const isSticker = img && img.getAttribute('data-is-sticker') === 'true';
    
    if (img && !img.src.includes('youtube.com')) {
        downloadUrl = img.src;
        downloadName = isGif ? 'animation.gif' : 'photo.jpg';
    } else if (vid) {
        downloadUrl = vid.src;
        downloadName = 'video.mp4';
    } else if (fileMsg) {
        const onclickAttr = fileMsg.getAttribute('onclick');
        if (onclickAttr) {
            const match = onclickAttr.match(/window\.open\('([^']+)'/);
            if (match) {
                downloadUrl = match[1];
                downloadName = fileMsg.querySelector('div[style*="color:#eee"]')?.innerText || 'file';
            }
        }
    }

    let m = document.getElementById('modern-menu');
    let wasOpen = !!m;
    if (!m) {
        m = document.createElement('div');
        m.id = 'modern-menu';
        document.body.appendChild(m);
    }
    if (!wasOpen) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    
    Object.assign(m.style, { position: 'fixed', display: 'block', zIndex: '1000000', minWidth: '210px', background: 'rgba(23,23,30,0.98)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '6px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)', pointerEvents: 'auto', touchAction: 'manipulation' });
    
    m.ontouchstart = ev => ev.stopPropagation();
    m.ontouchend = ev => ev.stopPropagation();
    
    const emojis = ['👍', '❤️', '😂', '😮', '😡'];
    const emojiPanel = `<style>@keyframes emojiPop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}.emoji-item-menu{display:inline-block;cursor:pointer;font-size:24px;transition:transform .2s;animation:emojiPop .3s cubic-bezier(0.34,1.56,0.64,1) backwards;padding:2px 4px}.emoji-item-menu:active{transform:scale(1.3)!important}</style><div style="display:flex;gap:2px;padding:6px;border-bottom:1px solid rgba(255,255,255,0.1);justify-content:center;overflow:hidden;margin-bottom:6px;">${emojis.map((emoji, i) => `<span class="emoji-item-menu" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>sendReaction('${escapeAttr(id)}','${escapeAttr(emoji)}','${escapeAttr(target)}'))" onclick="event.stopPropagation();executeMenuAction(()=>sendReaction('${escapeAttr(id)}','${escapeAttr(emoji)}','${escapeAttr(target)}'))" style="animation-delay:${i * 0.05}s">${emoji}</span>`).join('')}</div>`;
    
    const safeTxt = txt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/[\n\r]/g, ' ').replace(/"/g, '&quot;').replace(/'/g, '\\\'');
    const safeEditTxt = editTxt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/[\n\r]/g, ' ').replace(/"/g, '&quot;').replace(/'/g, '\\\'');
    
    const isPinned = allPinned[target] && allPinned[target].some(p => p.id === id);
    const pinAction = isPinned ? `unpinMessageById('${escapeAttr(id)}')` : `pinMessage('${escapeAttr(id)}')`;
    const pinText = isPinned ? t('Открепить') : t('Закрепить');
    const pinIcon = isPinned ? `<svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 11H7v-2h10v2z"/></svg>` : `<svg viewBox="0 0 24 24"><path d="M16 9V4l1 0V2H7v2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-6h5v-2l-2-2V5z"/></svg>`;

    const contactItem = document.querySelector(`.contact-item[data-username="${target}"]`);
    const isRestricted = contactItem ? contactItem.getAttribute('data-restricted') === '1' : false;

    m.innerHTML = emojiPanel + `
<div class="menu-group">
    <div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>prepareReply(\`${safeTxt}\`,'${escapeAttr(id)}'))" onclick="event.stopPropagation();executeMenuAction(()=>prepareReply(\`${safeTxt}\`,'${escapeAttr(id)}'))"><svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg> ${t('Ответить')}</div>
    ${!isRestricted ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>copyMsgContent('${escapeAttr(id)}'))" onclick="event.stopPropagation();executeMenuAction(()=>copyMsgContent('${escapeAttr(id)}'))"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> ${t('Копировать')}</div>` : ''}
    ${!isRestricted ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>prepareForward('${escapeAttr(id)}'))" onclick="event.stopPropagation();executeMenuAction(()=>prepareForward('${escapeAttr(id)}'))"><svg viewBox="0 0 24 24"><path d="M12 8V4l8 8-8 8v-4H4V8h8z"/></svg> ${t('Переслать')}</div>` : ''}
    ${!isRestricted ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>{msgToForward='${escapeAttr(id)}';confirmForward('${escapeAttr(me)}');})" onclick="event.stopPropagation();executeMenuAction(()=>{msgToForward='${escapeAttr(id)}';confirmForward('${escapeAttr(me)}');})"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg> ${t('В избранное')}</div>` : ''}
</div>
<div class="menu-group">
    <div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>${pinAction})" onclick="event.stopPropagation();executeMenuAction(()=>${pinAction})">${pinIcon} ${pinText}</div>
    <div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>toggleMultiSelect('${escapeAttr(id)}'))" onclick="event.stopPropagation();executeMenuAction(()=>toggleMultiSelect('${escapeAttr(id)}'))"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> ${t('Выбрать')}</div>
    ${isSticker && !isRestricted ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>saveSticker('${escapeAttr(downloadUrl)}'))" onclick="event.stopPropagation();executeMenuAction(()=>saveSticker('${escapeAttr(downloadUrl)}'))"><svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg> ${t('Сохранить в Стикеры')}</div>` : ''}
    ${isGif && !isRestricted ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>saveGif('${escapeAttr(downloadUrl)}'))" onclick="event.stopPropagation();executeMenuAction(()=>saveGif('${escapeAttr(downloadUrl)}'))"><svg viewBox="0 0 24 24"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg> ${t('Сохранить в GIF')}</div>` : ''}
    ${downloadUrl && !isRestricted ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>downloadMedia('${escapeAttr(downloadUrl)}', '${escapeAttr(downloadName)}'))" onclick="event.stopPropagation();executeMenuAction(()=>downloadMedia('${escapeAttr(downloadUrl)}', '${escapeAttr(downloadName)}'))"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> ${t('Скачать')}</div>` : ''}
</div>
${canEdit || isMe ? `
<div class="menu-group">
    ${canEdit ? `<div class="menu-item" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>prepareEdit('${escapeAttr(id)}',\`${safeEditTxt}\`))" onclick="event.stopPropagation();executeMenuAction(()=>prepareEdit('${escapeAttr(id)}',\`${safeEditTxt}\`))"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg> ${t('Изменить')}</div>` : ''}
    ${isMe ? `<div class="menu-item" style="color:#ff4d4d" ontouchend="event.preventDefault();event.stopPropagation();executeMenuAction(()=>deleteMessageClient('${escapeAttr(id)}'))" onclick="event.stopPropagation();executeMenuAction(()=>deleteMessageClient('${escapeAttr(id)}'))"><svg viewBox="0 0 24 24" style="fill:#ff4d4d"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> ${t('Удалить')}</div>` : ''}
</div>` : ''}`;

    const menuWidth = 210;
    const menuHeight = m.offsetHeight || 350;
    let posX = e.clientX;
    let posY = e.clientY;
    
    let originX = 'left';
    let originY = 'top';

    if (posX + menuWidth > window.innerWidth) {
        posX = window.innerWidth - menuWidth - 10;
        originX = 'right';
    }
    
    const distFromBottom = window.innerHeight - posY;
    if (distFromBottom < menuHeight + 20) {
        m.style.bottom = distFromBottom + 'px';
        m.style.top = 'auto';
        originY = 'bottom';
    } else {
        if (posY < 10) posY = 10;
        m.style.top = posY + 'px';
        m.style.bottom = 'auto';
    }
    
    m.style.left = posX + 'px';
    m.style.transformOrigin = `${originY} ${originX}`;

    m.style.opacity = '0.01';
    m.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        m.style.opacity = '1';
        m.style.transform = 'scale(1)';
    }, 10);
});
function toggleMenu(o){
    const d=document.getElementById('menu-drawer');
    const ov=document.getElementById('overlay');
    if(!d||!ov)return;
    if(o){
        ov.style.display='block';
        setTimeout(()=>{
            ov.classList.add('active');
            d.classList.add('open');
            d.querySelectorAll('.menu-item').forEach((item,i)=>item.style.transitionDelay=`${(i+1)*0.04}s`);
            if (!d.dataset.navPushed) {
                typeof pushNavigationState==='function'&&pushNavigationState();
                d.dataset.navPushed = "true";
            }
        },10);
    }else{
        d.classList.remove('open');
        ov.classList.remove('active');
        d.dataset.navPushed = "";
        d.querySelectorAll('.menu-item').forEach(item=>item.style.transitionDelay='0s');
        setTimeout(()=>{if(!d.classList.contains('open'))ov.style.display='none';},400);
        typeof backIfNav==='function'&&backIfNav();
    }
}
function closeProfile(){
    const modal=document.getElementById('user-profile-modal');
    if(!modal)return;
    const content=modal.querySelector('div');
    modal.classList.add('closing');
    modal.classList.remove('active');
    Object.assign(modal.style,{pointerEvents:'none',transition:'opacity 0.3s ease',opacity:'0'});
    if(content)Object.assign(content.style,{transition:'transform 0.3s ease',transform:'scale(0.9)'});
    
    setTimeout(()=>{
        if(!modal.classList.contains('active')){
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }
    },300);
}
const dropZone=document.getElementById('drop-zone');
['dragenter','dragover','dragleave','drop'].forEach(eName=>window.addEventListener(eName,e=>{e.preventDefault();e.stopPropagation();},false));
window.addEventListener('dragenter',()=>target&&(dropZone.style.display='flex'));
window.addEventListener('dragleave',e=>(e.relatedTarget===null||e.clientY<=0||e.clientX<=0)&&(dropZone.style.display='none'));
window.addEventListener('drop',e=>{
    dropZone.style.display='none';
    if(!target)return;
    const files=e.dataTransfer.files;
    if(files.length>0)handleDroppedFiles(files);
});
function handleDroppedFiles(files){
    if(files.length > 0) typeof upFile === 'function' && upFile(Array.from(files));
}
function updateCounter(input){
    const counter=document.getElementById('char-counter');
    const len=input.value.length;
    counter.innerText=`${len}/1000`;
    counter.style.opacity=len>500?"1":"0";
    counter.style.color=len>=1000?"#ff4444":len>800?"#a74fff":"rgba(255,255,255,0.3)";
}
function resetToHome(){
    if (window.isMultiSelectMode && typeof closeMultiSelect === 'function') {
        closeMultiSelect();
    }
    
    target=null;
    isChatLoading = false; 
    window.currentRoomType = null;
    document.body.classList.remove('chat-selected');
    
    const chatHeader = document.getElementById('chat-header');
    if (chatHeader) chatHeader.style.display = 'none';
    
    msgContainer=document.getElementById('msg-container');
    if(msgContainer) {
        msgContainer.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;user-select:none;">
                <svg viewBox="0 0 24 24" style="width:80px;height:80px;fill:none;stroke:#a74fff;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;margin-bottom:20px;animation:floatEmpty 3s ease-in-out infinite;">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                <div style="font-size:18px;font-weight:600;color:#eee;letter-spacing:0.5px;">${t('Выберите чат')}</div>
                <div style="font-size:13px;margin-top:8px;opacity:0.6;">${t('для начала общения')}</div>
                <style>
                    @keyframes floatEmpty {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-10px); }
                    }
                </style>
            </div>
        `;
    }
    
    document.querySelectorAll('.contact-item').forEach(el => {
        el.classList.remove('active');
        el.style.background = 'transparent';
    });
    
    const footer = document.querySelector('.bottom-bar') || document.querySelector('.chat-footer') || document.getElementById('bottom-bar-container');
    if(footer) footer.style.display = 'none';
    
    const channelOverlay = document.getElementById('channel-overlay');
    if (channelOverlay) channelOverlay.style.display = 'none';

    const searchBtn = document.querySelector('[onclick="toggleInternalSearch()"]') || document.getElementById('chat-search-btn');
    if(searchBtn) searchBtn.style.display = 'none';

    const searchBar = document.getElementById('chat-search-bar');
    if (searchBar) {
        searchBar.style.display = 'none';
        const inp = document.getElementById('internalSearchInput');
        if (inp) inp.value = '';
        typeof resetSearch === 'function' && resetSearch();
    }
    
    const pinBar=document.getElementById('pinned-message-bar');
    if(pinBar)pinBar.style.display='none';

    const scrollWrapper = document.getElementById('scroll-down-wrapper');
    if(scrollWrapper) {
        scrollWrapper.style.setProperty('opacity', '0', 'important');
        scrollWrapper.style.setProperty('pointer-events', 'none', 'important');
    }

    const inp = document.getElementById('messageText');
    if (inp) {
        inp.value = '';
        inp.style.height = 'auto';
        const wrapper = inp.parentElement.parentElement;
        if (wrapper) wrapper.style.borderColor = "#252530";
    }
    editingMsgId = null;
    replyText = null;
    const repBar = document.getElementById('reply-preview-bar');
    if (repBar) repBar.style.display = 'none';
}

function openSavedMessages(){
    const myUsername=(typeof me!=='undefined'&&me)?me:localStorage.getItem('4send_user');
    if(myUsername&&typeof selectChat==='function'){
        selectChat(myUsername);
        typeof toggleMenu==='function'?toggleMenu():typeof closeMenu==='function'?closeMenu():(document.getElementById('menu-drawer')&&(document.getElementById('menu-drawer').style.display='none'));
    }
}
document.getElementById('msg-container').onscroll=function(){if(this.scrollTop===0&&!allLoaded)loadMoreHistory(target);};
function openChatMobile(){
    if(window.innerWidth<=768){
        const chat=document.querySelector('.main-content');
        if(chat)chat.style.willChange='transform';
        if (!document.body.classList.contains('is-chat-active')) {
            document.body.classList.add('is-chat-active');
            typeof pushNavigationState==='function'?pushNavigationState('chat'):window.history.pushState({chatOpen:true},"");
        }
    }
}
let touchTimer,isLongTap=false,blockNextClick=false,menuOpenTime=0;
const handleContextMenu = e => {
    const el = e.target.closest('.contact-item');
    if (!el) return;
    if (e.cancelable) e.preventDefault();
    
    el.classList.add('context-menu-active');
    el.style.background = 'rgba(167,79,255,0.15)';
    
    const contactName = el.getAttribute('data-username') || "";
    const isPinned = el.getAttribute('data-pinned') === '1';
    const isMuted = el.getAttribute('data-muted') === '1';
    const isArchived = el.getAttribute('data-archived') === '1';
    const iBlockedHim = el.getAttribute('data-i-blocked') === '1';
    const isRoom = el.getAttribute('data-is-room') === '1';
    const roomType = el.getAttribute('data-room-type');
    const roomOwner = el.getAttribute('data-room-owner');
    const myId = typeof me !== 'undefined' ? me : localStorage.getItem('4send_user');
    
    let deleteText = t('Удалить чат');
    let deleteAction = `prepareDeleteChat('${escapeAttr(contactName)}', '0', '')`;

    if (isRoom) {
        if (roomOwner === myId) {
            deleteText = roomType === 'channel' ? t('Удалить канал') : t('Удалить группу');
            deleteAction = `prepareDeleteChat('${escapeAttr(contactName)}', '1', '${escapeAttr(roomType)}')`;
        } else {
            deleteText = roomType === 'channel' ? t('Покинуть канал') : t('Покинуть группу');
            deleteAction = `leaveRoom('${escapeAttr(contactName)}')`;
        }
    }

    let m = document.getElementById('sidebar-context-menu');
    let wasOpen = !!m;
    if (m) m.remove();
    m = document.createElement('div');
    m.id = 'sidebar-context-menu';
    Object.assign(m.style, { position: 'fixed', zIndex: '100000', minWidth: '210px', background: 'rgba(23,23,30,0.98)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '6px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)', opacity: '0', transform: 'scale(0.8) translateY(10px)', transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents: 'auto', touchAction: 'manipulation' });
    
    const closeM = (force = false) => {
        if (!force && (Date.now() - menuOpenTime < 300)) return;
        Object.assign(m.style, { opacity: '0', transform: 'scale(0.8) translateY(10px)' });
        setTimeout(() => {
            if (m) m.remove();
            el.classList.remove('context-menu-active');
            if (target !== contactName) {
                el.style.background = 'transparent';
            }
        }, 300);
        document.removeEventListener('mousedown', checkOut);
        document.removeEventListener('touchstart', checkOut);
    };
    
    m.ontouchstart = ev => ev.stopPropagation();
    m.ontouchend = ev => ev.stopPropagation();
    m.innerHTML = `<div class="menu-item" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;border-radius:10px;font-size:14px;color:#eee" ontouchend="event.preventDefault();socket.emit('toggle_pin',{user:'${escapeAttr(myId)}',contact:'${escapeAttr(contactName)}'});forceCloseMenu()" onclick="socket.emit('toggle_pin',{user:'${escapeAttr(myId)}',contact:'${escapeAttr(contactName)}'});forceCloseMenu()"><svg viewBox="0 0 24 24" style="width:18px;fill:#a74fff"><path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z"/></svg><span>${isPinned ? t('Открепить') : t('Закрепить')}</span></div>${contactName !== myId ? `<div class="menu-item" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;border-radius:10px;font-size:14px;color:#eee" ontouchend="event.preventDefault();socket.emit('toggle_archive',{contact:'${escapeAttr(contactName)}',me:'${escapeAttr(myId)}'});forceCloseMenu()" onclick="socket.emit('toggle_archive',{contact:'${escapeAttr(contactName)}',me:'${escapeAttr(myId)}'});forceCloseMenu()"><svg viewBox="0 0 24 24" style="width:18px;fill:#a74fff"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12.14l.82 1H5.12z"/></svg><span>${isArchived ? t('Из архива') : t('Архивировать')}</span></div><div class="menu-item" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;border-radius:10px;font-size:14px;color:#eee" ontouchend="event.preventDefault();socket.emit('toggle_mute',{contact:'${escapeAttr(contactName)}',me:'${escapeAttr(myId)}'});forceCloseMenu()" onclick="socket.emit('toggle_mute',{contact:'${escapeAttr(contactName)}',me:'${escapeAttr(myId)}'});forceCloseMenu()"><svg viewBox="0 0 24 24" style="width:18px;fill:#a74fff">${isMuted ? '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>' : '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zM4.41 2.86L3 4.27l16.73 16.73 1.41-1.41L4.41 2.86z"/>'}</svg><span>${isMuted ? t('Включить уведомления') : t('Выключить уведомления')}</span></div><div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 6px"></div>${!isRoom && contactName !== '4send_system' && contactName !== '4send_help' ? `<div class="menu-item" style="padding:10px 14px;color:#ff4d4d" ontouchend="event.preventDefault();toggleBlockUser('${contactName}');forceCloseMenu()" onclick="toggleBlockUser('${contactName}');forceCloseMenu()"><svg viewBox="0 0 24 24" style="width:18px;fill:#ff4d4d"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg><span>${iBlockedHim ? t('Разблокировать') : t('Заблокировать')}</span></div>` : ''}<div class="menu-item" style="padding:10px 14px;color:#ff4d4d" ontouchend="event.preventDefault();${deleteAction};forceCloseMenu()" onclick="${deleteAction};forceCloseMenu()"><svg viewBox="0 0 24 24" style="width:18px;fill:#ff4d4d"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg><span>${deleteText}</span></div>` : ''}`;
    document.body.appendChild(m);
    if (!wasOpen) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    menuOpenTime = Date.now();
    const touch = e.touches && e.touches[0] ? e.touches[0] : e;
    m.style.left = Math.min(touch.clientX, window.innerWidth - 225) + 'px';
    m.style.top = Math.min(touch.clientY, window.innerHeight - 300) + 'px';
    setTimeout(() => { Object.assign(m.style, { opacity: '1', transform: 'scale(1) translateY(0)' }); }, 10);
    window.checkOut = ev => { if (m && !m.contains(ev.target)) closeM(); };
    setTimeout(() => {
        document.addEventListener('mousedown', checkOut);
        document.addEventListener('touchstart', checkOut);
    }, 50);
};
document.addEventListener('touchstart',e=>{
    const menuEl=e.target.closest('#modern-menu')||e.target.closest('#sidebar-context-menu');
    if(!menuEl&&(document.getElementById('modern-menu')||document.getElementById('sidebar-context-menu'))) {
        if (Date.now() - menuOpenTime > 300) {
            typeof forceCloseMenu==='function'&&forceCloseMenu();
        }
    }
    const contactEl=e.target.closest('.contact-item');
    const msgEl=e.target.closest('.msg');
    if(!contactEl&&!msgEl)return;
    isLongTap=false;
    blockNextClick=false;
    typeof touchTimer!=='undefined'&&clearTimeout(touchTimer);
    touchTimer=setTimeout(()=>{
        isLongTap=true;
        blockNextClick=true;
        navigator.vibrate&&navigator.vibrate(45);
        menuOpenTime=Date.now();
        const touch=e.touches[0];
        const ev=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,clientX:touch.clientX,clientY:touch.clientY});
        contactEl?contactEl.dispatchEvent(ev):msgEl&&msgEl.dispatchEvent(ev);
    },450);
},{passive:false});
document.addEventListener('mousedown',e=>{
    if (e.button === 2) return; 
    if (Date.now() - menuOpenTime < 300) return;
    const m1=document.getElementById('modern-menu');
    const m2=document.getElementById('sidebar-context-menu');
    if(m1&&!m1.contains(e.target)&&typeof forceCloseMenu==='function')forceCloseMenu();
    if(m2&&!m2.contains(e.target)&&typeof forceCloseMenu==='function')forceCloseMenu();
},{capture:true});
document.addEventListener('touchend',e=>{
    clearTimeout(touchTimer);
    if(isLongTap){
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => isLongTap = false, 100);
    }
},{passive:false});
document.addEventListener('touchmove',()=>clearTimeout(touchTimer));
document.addEventListener('contextmenu',handleContextMenu);
function closeChatMobile(){
    if (document.body.classList.contains('is-chat-active')) {
        if (window.isMultiSelectMode && typeof closeMultiSelect === 'function') {
            closeMultiSelect();
        }
        document.body.classList.remove('is-chat-active');
        document.querySelectorAll('.contact-item').forEach(el => {
            el.style.background = 'transparent';
        });
        
        resetToHome();
        
        const scrollWrapper = document.getElementById('scroll-down-wrapper');
        if(scrollWrapper) {
            scrollWrapper.style.setProperty('opacity', '0', 'important');
            scrollWrapper.style.setProperty('pointer-events', 'none', 'important');
        }
        typeof backIfNav==='function'&&backIfNav();
    }
}
let epTouchTimer;
let epLongTap = false;
document.addEventListener('touchstart', e => {
    const item = e.target.closest('.ep-gif-item') || e.target.closest('.ep-sticker-item');
    if (!item) return;
    epLongTap = false;
    clearTimeout(epTouchTimer);
    epTouchTimer = setTimeout(() => {
        epLongTap = true;
        navigator.vibrate && navigator.vibrate(45);
        const type = item.classList.contains('ep-gif-item') ? 'gif' : 'sticker';
        const url = item.getAttribute('src');
        const touch = e.touches[0];
        handleMediaContextMenu({ preventDefault: ()=>{}, stopPropagation: ()=>{}, clientX: touch.clientX, clientY: touch.clientY }, url, type);
    }, 450);
}, { passive: true });

document.addEventListener('touchmove', () => clearTimeout(epTouchTimer), { passive: true });
document.addEventListener('touchend', e => {
    clearTimeout(epTouchTimer);
    if (epLongTap) {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => epLongTap = false, 100);
    }
}, { passive: false });
window.openLightbox = function(src) {
    let lb = document.getElementById('lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'lightbox';
        Object.assign(lb.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.9)', zIndex: '2147483649', display: 'none',
            alignItems: 'center', justifyContent: 'center', opacity: '0', transition: 'opacity 0.3s ease', cursor: 'pointer',
            overflow: 'hidden'
        });
        lb.style.setProperty('z-index', '2147483649', 'important');
        lb.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');
        
        lb.innerHTML = `
            <div id="lightbox-close" style="position:absolute;top:max(20px, env(safe-area-inset-top));right:20px;width:40px;height:40px;background:rgba(0,0,0,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;cursor:pointer;z-index:2;backdrop-filter:blur(5px);transition:0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">✕</div>
            <img id="lightbox-img" style="max-width:95%; max-height:95%; object-fit:contain; transform: translate(0px, 0px) scale(0.9); transition:transform 0.3s ease; border-radius:8px; cursor: grab; z-index:1; position:relative;">
        `;
        
        document.body.appendChild(lb);

        document.getElementById('lightbox-close').addEventListener('click', (e) => {
            e.stopPropagation();
            closeLightbox();
        });

        const img = document.getElementById('lightbox-img');
        
        lb.zoomState = { scale: 1, tx: 0, ty: 0 };
        let isDragging = false, startX, startY, initTx, initTy, initDist, initScale;

        const updateTransform = (smooth = false) => {
            img.style.transition = smooth ? 'transform 0.3s ease' : 'none';
            img.style.transform = `translate(${lb.zoomState.tx}px, ${lb.zoomState.ty}px) scale(${lb.zoomState.scale})`;
        };

        lb.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            lb.zoomState.scale = Math.max(0.5, Math.min(lb.zoomState.scale + delta * 0.15, 5));
            if (lb.zoomState.scale === 1) { lb.zoomState.tx = 0; lb.zoomState.ty = 0; }
            updateTransform(false);
        });

        const startDrag = (e) => {
            if (e.touches && e.touches.length === 2) {
                initDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                initScale = lb.zoomState.scale;
                return;
            }
            if (lb.zoomState.scale <= 1) return;
            isDragging = true;
            img.style.cursor = 'grabbing';
            startX = e.clientX || (e.touches && e.touches[0].clientX);
            startY = e.clientY || (e.touches && e.touches[0].clientY);
            initTx = lb.zoomState.tx;
            initTy = lb.zoomState.ty;
        };

        const doDrag = (e) => {
            if (e.touches && e.touches.length === 2 && initDist) {
                e.preventDefault();
                const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                lb.zoomState.scale = Math.max(0.5, Math.min(initScale * (currentDist / initDist), 5));
                updateTransform(false);
                return;
            }
            if (!isDragging) return;
            e.preventDefault();
            const currentX = e.clientX || (e.touches && e.touches[0].clientX);
            const currentY = e.clientY || (e.touches && e.touches[0].clientY);
            lb.zoomState.tx = initTx + (currentX - startX);
            lb.zoomState.ty = initTy + (currentY - startY);
            updateTransform(false);
        };

        const endDrag = () => {
            isDragging = false;
            img.style.cursor = 'grab';
            initDist = null;
            if (lb.zoomState.scale < 1) {
                lb.zoomState.scale = 1;
                lb.zoomState.tx = 0;
                lb.zoomState.ty = 0;
                updateTransform(true);
            }
        };

        img.addEventListener('mousedown', startDrag);
        img.addEventListener('touchstart', startDrag, {passive: false});
        window.addEventListener('mousemove', doDrag, {passive: false});
        window.addEventListener('touchmove', doDrag, {passive: false});
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchend', endDrag);

        img.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (lb.zoomState.scale > 1) { lb.zoomState.scale = 1; lb.zoomState.tx = 0; lb.zoomState.ty = 0; }
            else { lb.zoomState.scale = 2; }
            updateTransform(true);
        });

        lb.addEventListener('click', (e) => {
            if (e.target === lb) closeLightbox();
        });
    }
    
    const img = document.getElementById('lightbox-img');
    img.src = src;
    lb.zoomState = { scale: 1, tx: 0, ty: 0 };
    img.style.transition = 'transform 0.3s ease';
    img.style.transform = 'translate(0px, 0px) scale(0.9)';
    
    lb.style.display = 'flex';
    typeof pushNavigationState === 'function' && pushNavigationState();
    setTimeout(() => {
        lb.style.opacity = '1';
        img.style.transform = 'translate(0px, 0px) scale(1)';
    }, 10);
};
document.addEventListener('DOMContentLoaded', () => {
    const uInput = document.getElementById('u');
    const pInput = document.getElementById('p');
    if (uInput) uInput.setAttribute('maxlength', '20');
    if (pInput) pInput.setAttribute('maxlength', '30');
    
    const style = document.createElement('style');
    style.innerHTML = `
        #auth-screen input {
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
            transition: border-color 0.2s ease, background-color 0.2s ease !important;
        }
    `;
    document.head.appendChild(style);
});
function toggleTimerMenu(e, btnElement) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('timer-menu');
    const btn = btnElement || document.getElementById('main-action-btn');
    if (!menu || !btn) return;

    const closeMenu = () => {
        menu.classList.add('timer-closing');
        setTimeout(() => {
            menu.style.display = 'none';
            menu.classList.remove('timer-closing');
        }, 200);
    };

    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.classList.remove('timer-closing');
        menu.style.display = 'flex';
        
        const btnRect = btn.getBoundingClientRect();
        const bottomPos = window.innerHeight - btnRect.top + 12;
        const leftPos = btnRect.left + (btnRect.width / 2) - 100;
        
        menu.style.bottom = `${bottomPos}px`;
        menu.style.top = 'auto';
        menu.style.left = `${leftPos}px`;
        
        const outsideClickListener = (event) => {
            if (!menu.contains(event.target) && !btn.contains(event.target)) {
                closeMenu();
                document.removeEventListener('click', outsideClickListener);
                document.removeEventListener('pointerdown', outsideClickListener);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', outsideClickListener);
            document.addEventListener('pointerdown', outsideClickListener);
        }, 10);
    } else {
        closeMenu();
    }
}
function setCustomTimer() {
    const val = parseInt(document.getElementById('custom-timer-val').value);
    if (val > 0) {
        setTimer(val, val + ' ' + t('мин'));
        document.getElementById('custom-timer-val').value = '';
    }
}
document.addEventListener('click', e => {
    const menus = ['timer-menu', 'send-options-menu', 'schedule-menu'];
    const btn = document.getElementById('main-action-btn');
    
    menus.forEach(id => {
        const menu = document.getElementById(id);
        if (menu && menu.style.display === 'flex' && !menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.classList.add('timer-closing');
            setTimeout(() => {
                menu.style.display = 'none';
                menu.classList.remove('timer-closing');
            }, 200);
        }
    });
});
document.addEventListener('paste', async (e) => {
    if (!target || (document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'messageText') || document.activeElement.tagName === 'TEXTAREA' && document.activeElement.id !== 'messageText') return;
    
    const text = (e.clipboardData || e.originalEvent?.clipboardData || window.clipboardData)?.getData('text');
    if (text && text.includes('tiktok.com')) {
        e.preventDefault();
        const msgInput = document.getElementById('messageText');
        const originalPlaceholder = msgInput.placeholder;
        msgInput.placeholder = t("Загрузка TikTok...");
        msgInput.disabled = true;
        
        try {
            const token = localStorage.getItem('4send_token');
            const res = await fetch('/api/upload-tiktok', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ url: text })
            });
            const data = await res.json();
            if (data.url) {
                socket.emit('chat_message', {
                    sender: me, receiver: target, fileUrl: data.url, text: "📹 TikTok ${t('Видео')}", 
                    isVideoNote: false, is_encrypted: false
                });
                if(typeof showToast === 'function') showToast(t('TikTok успешно загружен'), false);
            } else {
                msgInput.value += text;
            }
        } catch (err) {
            msgInput.value += text;
        } finally {
            msgInput.placeholder = originalPlaceholder;
            msgInput.disabled = false;
            msgInput.focus();
        }
        return;
    }

    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (items) {
        const pastedFiles =[];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const blob = item.getAsFile();
                if (blob) pastedFiles.push(blob);
            }
        }
        if (pastedFiles.length > 0) {
            e.preventDefault();
            upFile(pastedFiles);
        }
    }
});
function closeLightbox(){
    const lb=document.getElementById('lightbox');
    if (lb.style.display === 'none') return;
    const img=document.getElementById('lightbox-img');
    img.style.transform='scale(0.9)';
    lb.style.opacity='0';
    setTimeout(()=>{lb.style.display='none';lb.style.opacity='1';},300);
    typeof backIfNav==='function'&&backIfNav();
}
function launchConfetti(){
    const colors=['#a74fff','#ff4d4d','#4caf50','#ffeb3b','#2196f3'];
    for(let i=0;i<50;i++){
        const piece=document.createElement('div');
        piece.className='confetti-piece';
        const size=Math.random()*8+5+'px';
        Object.assign(piece.style,{left:Math.random()*100+'vw',width:size,height:size,backgroundColor:colors[Math.floor(Math.random()*colors.length)],animationDuration:Math.random()*3+2+'s',animationDelay:Math.random()*2+'s',borderRadius:Math.random()>0.5?'50%':'2px',transform:`rotate(${Math.random()*360}deg)`});
        document.body.appendChild(piece);
        setTimeout(()=>piece.remove(),5000);
    }
}
document.addEventListener('keydown', e => {
    if (e.key === "Escape") {
        const lb = document.getElementById('lightbox');
        if (lb && lb.style.display !== 'none' && lb.style.opacity !== '0') {
            closeLightbox();
            return;
        }
        
        if (typeof window.activeFilePreviewCleanup === 'function') window.activeFilePreviewCleanup();
        if (document.fullscreenElement) document.exitFullscreen();
        if (editingMsgId || replyText) {
            editingMsgId = null;
            replyText = null;
            const inp = document.getElementById('messageText');
            if (inp) {
                inp.value = '';
                inp.style.height = 'auto';
                inp.style.overflowY = 'hidden';
                const wrapper = inp.parentElement.parentElement;
                if(wrapper) wrapper.style.borderColor = "#252530";
            }
            const repBar = document.getElementById('reply-preview-bar');
            if (repBar) repBar.style.display = 'none';
            typeof backIfNav === 'function' && backIfNav();
        } else if (target) {
            if (window.innerWidth <= 768) {
                closeChatMobile();
            } else {
                resetToHome();
            }
        }
    }
});
function clearNotifications() {
    updateAppBadge();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.getNotifications().then(n => {
                n.forEach(x => x.close());
            });
        });
    }
}
function updateAppBadge() {
    if (!('setAppBadge' in navigator)) return;
    let total = 0;
    document.querySelectorAll('.contact-item .unread-badge').forEach(badge => {
        const text = badge.textContent.trim();
        const n = parseInt(text, 10);
        if (n > 0) total += n;
    });
    if (total > 0) {
        navigator.setAppBadge(total).catch(()=>{});
    } else {
        navigator.clearAppBadge().catch(()=>{});
    }
}
let pinnedMessages=[],currentPinnedIndex=0,allPinned=JSON.parse(localStorage.getItem('chat_all_pins')||'{}'),pendingPinData=null;
function pinMessage(id) {
    if (!target) return;
    const msgNode = document.querySelector(`[data-id="${id}"]`);
    if (!msgNode) return;
    let pinText = "";
    
    if (msgNode.querySelector('.video-note-wrapper') || msgNode.querySelector('.custom-video-wrapper')) pinText = t('📹 Видеосообщение');
    else if (msgNode.querySelector('.voice-player')) pinText = t('🎤 Голосовое сообщение');
    else if (msgNode.querySelector('.music-player')) pinText = t('🎵 Аудиозапись');
    else if (msgNode.querySelector('.file-message')) pinText = t('📁 Файл');
    else if (msgNode.querySelector('img')) pinText = t('📷 Фотография');
    else {
        const pureTextNode = msgNode.querySelector('.msg-text');
        if (pureTextNode) pinText = pureTextNode.innerText;
        else pinText = t("Сообщение");
    }
    
    pinText = pinText.trim().replace(/\s+/g, ' ');
    if (pinText.length > 45) pinText = pinText.substring(0, 45) + "...";
    showPinOptions(id, pinText);
}

function showPinOptions(id,text){
    pendingPinData={id,text};
    const modal=document.getElementById('pin-modal');
    let wasHidden = modal.style.display === 'none' || modal.style.display === '';
    const preview=document.getElementById('pin-preview-text');
    if(preview)preview.innerText=`«${text}»`;
    modal.style.display='flex';
    if (wasHidden) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    setTimeout(()=>modal.classList.add('active'),10);
}
function closePinModal(){
    const modal=document.getElementById('pin-modal');
    if (!modal.classList.contains('active')) return;
    modal.classList.remove('active');
    setTimeout(()=>{modal.style.display='none';pendingPinData=null;},300);
    typeof backIfNav==='function'&&backIfNav();
}
function confirmPin(type){
    if(!pendingPinData||!target)return;
    socket.emit('pin_request',{messageId:pendingPinData.id,chatId:target.toLowerCase(),pinnerId:me.toLowerCase(),type,textPreview:pendingPinData.text});
    closePinModal();
}
function updatePinnedUI(){
    const bar=document.getElementById('pinned-message-bar');
    const content=document.getElementById('pinned-text-content');
    const counter=document.getElementById('pinned-counter');
    if(!target){if(bar)bar.style.display='none';return;}
    const chatKey=target.toLowerCase();
    const currentChatPins=allPinned[chatKey]||[];
    if(currentChatPins.length>0){
        if(bar)bar.style.display='flex';
        if(currentPinnedIndex<0||currentPinnedIndex>=currentChatPins.length)currentPinnedIndex=0;
        const current=currentChatPins[currentPinnedIndex];
        if(content)content.innerText=current.text||current.text_preview||t("Сообщение без текста");
        if(counter)counter.innerText=currentChatPins.length>1?`${t('ЗАКРЕПЛЁННЫЕ СООБЩЕНИЯ')} (${currentChatPins.length})`:t('ЗАКРЕПЛЁННОЕ СООБЩЕНИЕ');
    }else if(bar)bar.style.display='none';
}
function savePins(){localStorage.setItem('chat_all_pins',JSON.stringify(allPinned));}
function handlePinnedClick(){
    const currentChatPins=allPinned[target]||[];
    if(currentChatPins.length===0)return;
    if(currentChatPins.length>1){
        currentPinnedIndex=(currentPinnedIndex+1)%currentChatPins.length;
        updatePinnedUI();
    }
    scrollToPinned();
}
function unpinMessage(){
    const current=allPinned[target]?.[currentPinnedIndex];
    if(current)socket.emit('unpin_request',{messageId:current.id,chatId:target,pinnerId:me});
}
function scrollToPinned(){
    const current=allPinned[target]?.[currentPinnedIndex];
    if(!current)return;
    const targetMsg=document.querySelector(`[data-id="${current.id}"]`);
    if(targetMsg){
        targetMsg.scrollIntoView({behavior:'smooth',block:'center'});
        const originalBg=targetMsg.style.background;
        Object.assign(targetMsg.style,{transition:'background 0.3s ease',background:'rgba(167, 79, 255, 0.3)'});
        setTimeout(()=>targetMsg.style.background=originalBg,1000);
    }
}
window.renderMessage = function(d, isHistoryLoad = false) {
    if (!target || !d) return;
    
    const isRoom = d.receiver?.startsWith('room_');
    const belongsToCurrentChat = isRoom ? (target === d.receiver) : (target === d.sender || target === d.receiver || (d.sender === me && d.receiver === target));
    if (!belongsToCurrentChat) return;

    const c = document.getElementById('msg-container');
    if (!c) return;
    
    const msgId = d.id || d.tempId;
    if (!msgId) return;
    
    let existingMsg = document.getElementById(`msg-${msgId}`);
    if (!existingMsg && d.tempId) {
        existingMsg = document.querySelector(`[data-tempid="${d.tempId}"]`);
    }
    
    if (existingMsg) {
        if (d.id && existingMsg.getAttribute('data-id') !== d.id) {
            existingMsg.id = `msg-${d.id}`;
            existingMsg.setAttribute('data-id', d.id);
            const loader = existingMsg.parentElement.querySelector('.upload-loader');
            if (loader) loader.remove();
        }
        return;
    }
    
    const dateObj = d.timestamp ? new Date(d.timestamp) : new Date();
    const dateLabel = dateObj.toLocaleDateString(globalLocale, { day: 'numeric', month: 'long' });
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (dateLabel !== window.lastDateLabel) {
        typeof insertDateSeparator === 'function' && insertDateSeparator(d.timestamp || new Date().toISOString());
        window.lastDateLabel = dateLabel;
    }
    
    let textToDisplay = typeof clarify === 'function' ? clarify(d.text || '', d.id) : (d.text || '');

    if (d.callType) {
        const isMeMsg = String(d.sender || '').toLowerCase() === String(me || '').toLowerCase();
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper-cv';
        Object.assign(wrapper.style, { display: 'flex', width: '100%', marginBottom: '14px', justifyContent: isMeMsg ? 'flex-end' : 'flex-start' });

        const div = document.createElement('div');
        div.id = `msg-${msgId}`;
        div.setAttribute('data-id', msgId);
        if (d.tempId) div.setAttribute('data-tempid', d.tempId);
        div.className = `msg ${isMeMsg ? 'sent' : 'rcv'}`;
        Object.assign(div.style, { width: 'fit-content', maxWidth: '60%', padding: '10px 14px 22px 14px', position: 'relative', borderRadius: '12px', overflow: 'visible' });

        const isMissed = d.callType === 'missed';
        const isRejected = d.callType === 'rejected';
        const callColor = (isMissed || isRejected) ? '#ff4d4d' : '#a74fff';

        const phoneSvg = `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:${callColor};flex-shrink:0;margin-left:4px;margin-top:4px;"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;

        const arrowSvg = (isMissed || isRejected)
            ? `<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:${callColor};transform:rotate(135deg);flex-shrink:0;"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`
            : isMeMsg
                ? `<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:rgba(255,255,255,0.45);flex-shrink:0;"><path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z"/></svg>`
                : `<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:rgba(255,255,255,0.45);flex-shrink:0;transform:scaleX(-1);"><path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z"/></svg>`;

        const duration = d.callDuration || 0;
        const durStr = duration > 0 ? ` ${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}` : '';
        const videoIcon = d.callWithVideo ? `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:${callColor};flex-shrink:0;margin-left:4px;"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>` : '';
        const callLabel = isMissed ? t('Пропущенный звонок') : isRejected ? t('Отклонённый звонок') : (d.callType === 'outgoing' ? t('Исходящий звонок') : t('Входящий звонок'));

        const dateObj = d.timestamp ? new Date(d.timestamp) : new Date();
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;width:100%;"><span style="font-size:15px;color:#eee;font-weight:600;display:flex;align-items:center;">${callLabel}${videoIcon}</span>${phoneSvg}</div><div style="position:absolute;left:14px;bottom:5px;display:flex;align-items:center;gap:3px;pointer-events:none;z-index:10;">${arrowSvg}<span style="font-size:11px;color:rgba(255,255,255,0.4);font-family:'Inter',sans-serif;">${timeStr}</span></div>`;

        wrapper.appendChild(div);
        c.appendChild(wrapper);

        if ((d.tempId || d.sender === me) && !isHistoryLoad) {
            const targetChatId = d.receiver?.startsWith('room_') ? d.receiver : (d.sender === me ? d.receiver : d.sender);
            if (targetChatId) updateSidebarPreview(targetChatId, d, !isHistoryLoad);
        }
        return;
    }

    if (d.isService) {
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper-cv service-msg-wrapper';
        Object.assign(wrapper.style, { display: 'flex', width: '100%', marginBottom: '14px', justifyContent: 'center' });
        
        const div = document.createElement('div');
        div.id = `msg-${msgId}`;
        div.setAttribute('data-id', msgId);
        div.className = 'service-message';
        Object.assign(div.style, {
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '6px 16px',
            borderRadius: '16px',
            color: '#eee',
            fontSize: '13px',
            fontWeight: '500',
            textAlign: 'center',
            maxWidth: '85%',
            wordBreak: 'break-word',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            userSelect: 'none'
        });
        
        div.innerHTML = typeof formatMessageText === 'function' ? formatMessageText(textToDisplay) : escapeHTML(textToDisplay);
        
        wrapper.appendChild(div);
        c.appendChild(wrapper);
        
        if ((d.tempId || d.sender === me) && !isHistoryLoad) {
            const targetChatId = d.receiver?.startsWith('room_') ? d.receiver : (d.sender === me ? d.receiver : d.sender);
            if (targetChatId) {
                updateSidebarPreview(targetChatId, d, !isHistoryLoad);
            }
        }
        return;
    }

    let forwardedFrom = null;
    const fwdMatch = textToDisplay.match(new RegExp(`^📂 (?:Переслано от|Forwarded from) (.*?):\\n?([\\s\\S]*)$`));
    if (fwdMatch) {
        forwardedFrom = escapeHTML(fwdMatch[1]);
        textToDisplay = fwdMatch[2].trim();
    }
    
    let decodedReply = d.reply_to ? (typeof clarify === 'function' ? clarify(d.reply_to) : d.reply_to) : null;
    if (decodedReply) {
        const rawReply = decodedReply;
        decodedReply = escapeHTML(decodedReply);
        const replyMap = {
            [t('📹 Видеосообщение')]: `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('Видео')}`,
            [t('🎤 Голосовое сообщение')]: `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>${t('Голосовое сообщение')}`,
            [t('🎵 Аудиозапись')]: `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>${t('Аудиозапись')}`,
            [t('📁 Файл')]: `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${t('Файл')}`,
            [t('📷 Фотография')]: `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>${t('Фотография')}`,
            [t('Стикер')]: `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg>${t('Стикер')}`,
            "GIF": `<svg style="width:12px;height:12px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>GIF`
        };
        if (replyMap[rawReply]) {
            decodedReply = replyMap[rawReply];
        }
    }
    
    const isChannel = window.currentRoomType === 'channel';
    const isGroup = window.currentRoomType === 'group';
    const meLower = String(me || '').toLowerCase();
    const senderLower = String(d.sender || '').toLowerCase();
    const isMeMsg = senderLower === meLower;
    const safeSender = escapeHTML(d.displayName || d.sender || '');
    
    let shouldShowText = textToDisplay.trim() !== '';
    const safeFileName = escapeHTML(d.fileName || d.fileUrl?.split('/').pop().split('?')[0] || t('📁 Файл'));
    
    let isImage = false;
    let isVideo = false;
    let ext = '';
    
    if (d.fileUrl && d.fileUrl !== 'dummy') {
        const extMatch = d.fileName ? d.fileName.match(/\.([^.?#]+)(?:[?#]|$)/i) : d.fileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
        ext = extMatch ? extMatch[1].toLowerCase() : '';
        isImage =['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        isVideo =['mp4', 'webm', 'mov'].includes(ext);
        
        if (d.isAudio && (textToDisplay === t('🎤 Голосовое сообщение') || textToDisplay === t('Голосовое сообщение'))) shouldShowText = false;
        if (d.isVideoNote && (textToDisplay === t('📹 Видеосообщение') || textToDisplay === t('Видосообщение'))) shouldShowText = false;
        if (d.fileName && textToDisplay === d.fileName) shouldShowText = false;
        
        const urlFileName = d.fileUrl.split('/').pop().split('?')[0];
        if (textToDisplay === urlFileName || textToDisplay === decodeURIComponent(urlFileName)) shouldShowText = false;
        if (textToDisplay === "GIF" || textToDisplay === t('Стикер')) shouldShowText = false;
        if ((isImage || isVideo) && textToDisplay.match(/\.(jpeg|jpg|png|gif|webp|mp4|mov|webm)$/i)) shouldShowText = false;
    } else if (d.fileUrl === 'dummy') {
        if (d.isAudio && (textToDisplay === t('🎤 Голосовое сообщение') || textToDisplay === t('Голосовое сообщение'))) shouldShowText = false;
        if (d.isVideoNote && (textToDisplay === t('📹 Видеосообщение') || textToDisplay === t('Видосообщение'))) shouldShowText = false;
        if (d.fileName && textToDisplay === d.fileName) shouldShowText = false;
        if (textToDisplay === "GIF" || textToDisplay === t('Стикер')) shouldShowText = false;
    }
    
    const isMediaOnly = (isImage || isVideo || (d.fileUrls && d.fileUrls.length > 1)) && !shouldShowText;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-wrapper-cv';
    Object.assign(wrapper.style, { display: 'flex', width: '100%', marginBottom: '14px', justifyContent: isMeMsg ? 'flex-end' : 'flex-start' });
    
    const div = document.createElement('div');
    div.id = `msg-${msgId}`;
    div.setAttribute('data-id', msgId);
    div.setAttribute('data-time', timeStr);
    if (d.tempId) div.setAttribute('data-tempid', d.tempId);
    div.className = `msg ${isMeMsg ? 'sent' : 'rcv'}`;
    Object.assign(div.style, { width: 'fit-content', maxWidth: isChannel ? '85%' : '75%', padding: '8px 14px 2px 14px', position: 'relative', minWidth: isChannel ? '50%' : '100px', display: 'flex', flexDirection: 'column', overflow: 'visible' });
    
    if (d.isVideoNote || d.isAudio) {
        div.style.background = 'transparent';
        div.style.border = 'none';
        div.style.padding = '0';
        div.style.boxShadow = 'none';
    }
    
    let textContentHtml = '';
    if (shouldShowText) {
        const formattedText = typeof formatMessageText === 'function' ? formatMessageText(textToDisplay) : escapeHTML(textToDisplay);
        textContentHtml = `<div class="msg-text" style="font-size:var(--msg-text-size, 15px);line-height:1.4;color:#eee;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap;max-width:100%;overflow:hidden;margin-top:${d.fileUrl || (d.fileUrls && d.fileUrls.length > 0) ? '8px' : '0'}">${formattedText}</div>`;
    }
    
    let mainContent = '';
    if (d.fileUrls && d.fileUrls.length > 1) {
        const urls = d.fileUrls;
        let gridStyle = 'display:grid; gap:2px; border-radius:10px; overflow:hidden; margin-bottom:8px;';
        
        if (urls.length === 2) gridStyle += 'grid-template-columns: 1fr 1fr;';
        else if (urls.length === 3) gridStyle += 'grid-template-columns: 1fr 1fr;';
        else if (urls.length === 4) gridStyle += 'grid-template-columns: 1fr 1fr;';
        else gridStyle += 'grid-template-columns: repeat(3, 1fr);';

        let imagesHtml = '';
        urls.forEach((url, idx) => {
            let displayUrl = url;
            let lightboxUrl = url;
            if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
                displayUrl = url.replace('/upload/', '/upload/q_auto,f_auto,w_600,c_limit/');
                lightboxUrl = url.replace('/upload/', '/upload/q_auto,f_auto,w_1920,c_limit/');
            }
            
            let imgStyle = 'width:100%; height:100%; object-fit:cover; cursor:pointer; min-height:100px;';
            if (urls.length === 3 && idx === 0) imgStyle += 'grid-column: span 2; max-height: 250px;';
            else if (urls.length === 2) imgStyle += 'max-height: 250px;';
            else if (urls.length === 4) imgStyle += 'max-height: 150px;';
            else imgStyle += 'max-height: 120px;';

            imagesHtml += `<img src="${escapeHTML(displayUrl)}" loading="lazy" decoding="async" style="${imgStyle}" onclick="openLightbox('${escapeHTML(lightboxUrl)}')">`;
        });

        mainContent = `<div style="${gridStyle}">${imagesHtml}</div>` + textContentHtml;
    } else if (d.fileUrl) {
        if (d.isVideoNote) {
            mainContent = `<div class="video-note-wrapper" style="position:relative; width:250px; height:250px; margin: 5px 0; display:flex; align-items:center; justify-content:center;"><div class="video-note-container" style="position:relative; width:240px; height:240px; border-radius:50%; overflow:hidden; cursor:pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" onclick="toggleVideoNotePlayback(this.parentElement)"><video src="${escapeHTML(d.fileUrl)}" loop muted playsinline ontimeupdate="updateVideoNoteProgress(this)" style="width:100%; height:100%; object-fit:cover; display:block; background:#000;"></video></div><svg class="vn-progress" width="250" height="250" style="position:absolute; top:0; left:0; cursor:pointer; transform: rotate(-90deg);" onclick="seekVideoNote(event, this.parentElement)"><circle cx="125" cy="125" r="121" fill="none" stroke="rgba(167,79,255,0.2)" stroke-width="4"></circle><circle class="vn-progress-circle" cx="125" cy="125" r="121" fill="none" stroke="#a74fff" stroke-width="4" stroke-dasharray="760" stroke-dashoffset="760" style="transition: stroke-dashoffset 0.1s linear;"></circle></svg><div class="vn-sound-icon" onclick="toggleVideoNotePlayback(this.parentElement)" style="position:absolute; bottom:0px; left:0px; background:rgba(28,28,35,0.9); border:1px solid rgba(167,79,255,0.4); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10; transition: 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.4);"><svg viewBox="0 0 24 24" style="width:18px; fill:#fff;"><path d="M8 5v14l11-7z"/></svg></div></div>`;
        } else if (d.isAudio) {
            const isPlayed = localStorage.getItem(`played_voice_${msgId}`) || isMeMsg;
            const unreadDot = !isPlayed ? `<div class="v-unread-dot" style="width:8px;height:8px;background:#a74fff;border-radius:50%;box-shadow:0 0 5px #a74fff;flex-shrink:0;margin-left:8px;"></div>` : '';
            let barsHtml = Array.from({ length: 30 }, () => `<div class="v-bar" style="height:${Math.floor(Math.random() * 20) + 5}px;width:2px;background:rgba(167,79,255,0.2);border-radius:1px;transition:background 0.1s"></div>`).join('');
            mainContent = `<div style="display:flex;align-items:center;"><div class="voice-player" data-src="${escapeHTML(d.fileUrl)}" style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.05);padding:10px 16px;border-radius:26px;min-width:240px;max-width:100%;user-select:none;position:relative;box-sizing:border-box"><button class="v-play-btn" onclick="toggleVoice(this)" style="width:40px;height:40px;background:#a74fff;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;flex-shrink:0;transition:transform .2s"><svg class="play-icon" viewBox="0 0 24 24" style="width:16px;height:16px;fill:white"><path d="M8 5v14l11-7z"/></svg><svg class="pause-icon" viewBox="0 0 24 24" style="width:16px;height:16px;fill:white;display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button><div class="v-waves" onclick="seekVoice(event,this)" style="display:flex;align-items:center;gap:3px;height:30px;flex:1;cursor:pointer;position:relative;margin-right:50px;overflow:hidden">${barsHtml}</div><span class="v-time" style="position:absolute;right:48px;top:50%;transform:translateY(-50%);font-size:12px;color:#888;white-space:nowrap">0:00</span><button class="v-speed-btn" onclick="changeVoiceSpeed(this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(167,79,255,0.15);border:1px solid rgba(167,79,255,0.3);border-radius:8px;color:#a74fff;font-size:11px;font-weight:bold;padding:4px 6px;cursor:pointer;min-width:32px;z-index:10;transition:.2s">1x</button><audio src="${escapeHTML(d.fileUrl)}" crossorigin="anonymous" onloadedmetadata="initVoiceDuration(this)" ontimeupdate="updateVoiceUI(this)" onended="resetVoiceUI(this)"></audio></div>${unreadDot}</div><div class="voice-summary-container" style="margin-top: 8px;"><button id="btn-summary-${msgId}" onclick="summarizeVoice('${msgId}', '${escapeHTML(d.fileUrl)}')" style="background:rgba(167,79,255,0.1); border:1px solid rgba(167,79,255,0.3); color:#a74fff; border-radius:12px; padding:4px 10px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:0.2s;"><svg viewBox="0 0 24 24" style="width:12px; fill:currentColor;"><path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/></svg>${t('Пересказать')}</button><div id="summary-text-${msgId}" style="display:none; margin-top:6px; font-size:13px; color:#eee; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:12px; border-left:2px solid #a74fff; line-height:1.4;"></div></div>`;
        } else if (d.isMusic || ext === 'mp3') {
            mainContent = `<div class="music-player" style="background:rgba(167,79,255,0.08);border:1px solid rgba(167,79,255,0.2);padding:12px;border-radius:18px;min-width:240px;display:flex;flex-direction:column;gap:8px;backdrop-filter:blur(10px);position:relative;padding-bottom:30px;"><div style="display:flex;align-items:center;gap:10px"><button class="v-play-btn" onclick="toggleVoice(this)" style="width:38px;height:38px;background:#a74fff;border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:.2s"><svg class="play-icon" viewBox="0 0 24 24" style="width:16px;fill:white"><path d="M8 5v14l11-7z"/></svg><svg class="pause-icon" viewBox="0 0 24 24" style="width:16px;fill:white;display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button><div style="overflow:hidden;flex:1"><div style="font-size:13px;font-weight:600;color:#eee;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${safeFileName}</div><div class="v-time" style="font-size:11px;color:#a74fff;margin-top:2px">0:00 / 0:00</div></div></div><div onclick="seekMusic(event,this)" style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;position:relative;cursor:pointer"><div class="v-progress" style="width:0%;height:100%;background:#a74fff;border-radius:3px;transition:width 0.1s;pointer-events:none"></div></div><audio src="${escapeHTML(d.fileUrl)}" crossorigin="anonymous" onloadedmetadata="initMusicDuration(this)" ontimeupdate="updateMusicUI(this)" onended="resetVoiceUI(this)"></audio></div>`;
        } else if (isVideo) {
            mainContent = `<video src="${escapeHTML(d.fileUrl)}" controls onloadeddata="typeof scrollToBottom === 'function' && scrollToBottom()" style="max-width:100%;border-radius:10px;display:block;outline:none;background:#000;max-height:400px;"></video>`;
        } else if (isImage) {
            const isStickerFlag = textToDisplay === t('Стикер');
            const isGifFlag = textToDisplay === "GIF" || ext === 'gif';
            
            let displayUrl = d.fileUrl;
            let lightboxUrl = d.fileUrl;
            
            if (d.fileUrl && d.fileUrl.includes('res.cloudinary.com') && d.fileUrl.includes('/upload/')) {
                displayUrl = d.fileUrl.replace('/upload/', '/upload/q_auto,f_auto,w_800,c_limit/');
                lightboxUrl = d.fileUrl.replace('/upload/', '/upload/q_auto,f_auto,w_1920,c_limit/');
            }
            
            mainContent = `<img src="${escapeHTML(displayUrl)}" data-is-sticker="${isStickerFlag}" data-is-gif="${isGifFlag}" loading="lazy" decoding="async" onload="typeof scrollToBottom === 'function' && scrollToBottom()" style="max-width:100%;border-radius:10px;display:block;cursor:pointer" onclick="openLightbox('${escapeHTML(lightboxUrl)}')">`;
        } else {
            mainContent = `<div class="file-message" style="display:flex;align-items:center;gap:12px;background:rgba(167,79,255,0.08);padding:12px;border-radius:14px;cursor:pointer;border:1px solid rgba(167,79,255,0.2);min-width:200px;" onclick="window.open('${escapeHTML(d.fileUrl)}', '_blank')"><div style="width:44px;height:44px;background:#a74fff;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 10px rgba(167,79,255,0.3);"><svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div><div style="overflow:hidden;display:flex;flex-direction:column;justify-content:center;"><div style="color:#eee;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeFileName}</div>                        <div style="color:#a74fff;font-size:12px;margin-top:2px;font-weight:500;">${t('Скачать файл')}</div></div></div>`;
        }
        mainContent += textContentHtml;
    } else {
        mainContent = textContentHtml;
    }
    
    let finalHtml = '';
    if (forwardedFrom) {
        finalHtml += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;opacity:0.9;background:rgba(167,79,255,0.1);padding:4px 8px;border-radius:6px;width:fit-content;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#a74fff"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg><div style="font-size:12px;color:#a74fff;font-weight:600;">${t('Переслано от')} ${forwardedFrom}</div></div>`;
    }
    
    if (decodedReply) {
        const safeReplyId = escapeHTML(String(d.reply_to_id || ''));
        finalHtml += `<div onclick="scrollToReply('${safeReplyId}')" style="background:rgba(255,255,255,0.05);border-left:2px solid #a74fff;padding:4px 8px;margin-bottom:6px;border-radius:4px;font-size:12px;cursor:pointer;opacity:0.8"><div style="color:#a74fff;font-weight:bold;font-size:10px;margin-bottom:2px">${t('Ответ на:')}</div><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${decodedReply}</div></div>`;
    }
    
    if (!isChannel && !isMeMsg && !forwardedFrom) {
        const nameColors =['#ff4d4d', '#4caf50', '#ffeb3b', '#2196f3', '#a74fff', '#ff9800', '#00bcd4', '#e91e63'];
        const senderColor = nameColors[Math.abs(safeSender.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % nameColors.length];
        finalHtml += `<div onclick="event.stopPropagation(); showUserProfile('${escapeAttr(d.sender)}')" style="font-size:13px;color:${senderColor};font-weight:600;margin-bottom:4px;display:flex;align-items:center;cursor:pointer;width:fit-content;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeSender}</span>${d.isVerified ? verifyBadge : ''}</div>`;
    }
    
    finalHtml += mainContent;

    if (shouldShowText && !d.fileUrl && !d.isService && textToDisplay) {
        const firstUrl = extractFirstUrl(textToDisplay);
        if (firstUrl) {
            const previewId = 'lp-' + msgId;
            finalHtml += `<div id="${previewId}"></div>`;
            setTimeout(() => {
                const container = document.getElementById(previewId);
                if (!container) return;
                const cached = linkPreviewCache.get(firstUrl);
                if (cached) {
                    container.innerHTML = renderLinkPreviewCard(cached);
                } else {
                    fetchLinkPreview(firstUrl).then(preview => {
                        const el = document.getElementById(previewId);
                        if (el && preview) el.innerHTML = renderLinkPreviewCard(preview);
                    });
                }
            }, 0);
        }
    }
    
    const isRead = d.is_read == 1 || (isMeMsg && c?.querySelectorAll(`.sent[data-id="${d.id}"].msg-read`).length > 0);
    const isDarkPill = d.isVideoNote || d.isAudio || isMediaOnly;
    const timeColor = isDarkPill ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
    const tickColor = isRead ? (isDarkPill ? '#d4aaff' : '#a74fff') : timeColor;
    const tickSvg = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;transform:translateY(0.5px)"><path d="M4 12l4 4L18 6"></path></svg>`;
    const timerIcon = d.expires_at ? `<div class="timer-icon-svg" style="display:flex;align-items:center;color:${timeColor};margin-right:3px" title="${t('Сообщение с таймером')}"><svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 15 15"></polyline></svg></div>` : '';
    const statusBg = isDarkPill ? 'background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:10px;' : '';
    const statusBottom = isMediaOnly ? '10px' : '-5px';
    const statusRight = isMediaOnly ? '6px' : '-2px';
    const contentPaddingBottom = isMediaOnly ? '0px' : (d.fileUrl || (d.fileUrls && d.fileUrls.length > 0) ? '20px' : '14px');
    
    const viewsCount = d.read_by ? d.read_by.length : 1;
    const viewsIcon = isChannel ? `<div style="display:flex;align-items:center;gap:3px;margin-right:4px;color:${timeColor};" title="${t('Просмотры')}"><svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transform:translateY(0.5px)"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span style="font-size:11px;font-family:'Inter',sans-serif;line-height:14px">${viewsCount}</span></div>` : '';

    const statusContent = `<div class="msg-status-block" style="position:absolute;right:${statusRight};bottom:${statusBottom};display:flex;align-items:center;gap:4px;pointer-events:none;z-index:10;white-space:nowrap;user-select:none;height:14px;${statusBg}">${viewsIcon}${timerIcon}${d.is_edited ? `<span class="edit-mark" style="font-size:11px;color:${timeColor};font-family:'Inter',sans-serif;line-height:14px">${t('ред.')}</span>` : ''}<span style="font-size:11px;color:${timeColor};font-family:'Inter',sans-serif;line-height:14px">${timeStr}</span>${isMeMsg && String(target).toLowerCase() !== meLower && !isChannel ? `<div style="position:relative;width:18px;height:14px;color:${tickColor};display:flex;align-items:center"><div style="position:absolute;left:0;display:flex;align-items:center">${tickSvg}</div>${isRead ? `<div style="position:absolute;left:6px;display:flex;align-items:center">${tickSvg}</div>` : ''}</div>` : ''}</div>`;
    const loadingOverlay = d.isLoading ? `<div class="upload-loader" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;border-radius:inherit;z-index:20"><div style="width:24px;height:24px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;"></div></div>` : '';
    
    div.innerHTML = `<div class="msg-content-wrapper" style="position:relative; padding-bottom:${contentPaddingBottom}; word-break:break-word; font-size:15px; line-height:1.4; z-index:1;">${finalHtml}${statusContent}${loadingOverlay}</div>`;
    
    wrapper.innerHTML = '';
    wrapper.appendChild(div);
    c.appendChild(wrapper);
    
    if (d.reactions && d.reactions.length > 0) {
        setTimeout(() => renderReactionsUI(msgId, d.reactions), 50);
    }
    
    if ((d.tempId || isMeMsg) && !isHistoryLoad) {
        const targetChatId = d.receiver?.startsWith('room_') ? d.receiver : (isMeMsg ? d.receiver : d.sender);
        if (targetChatId) {
            updateSidebarPreview(targetChatId, d, !isHistoryLoad);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const savedSize = localStorage.getItem('4send_text_size') || 'medium';
    applyTextSize(savedSize);
});
window.updateVideoNoteProgress = function(v) {
    const wrapper = v.closest('.video-note-wrapper');
    if (!wrapper) return;
    const circle = wrapper.querySelector('.vn-progress-circle');
    if (!circle || !v.duration) return;
    const progress = v.currentTime / v.duration;
    const offset = 760 - (progress * 760);
    circle.style.strokeDashoffset = offset;
};
window.seekVideoNote = function(e, wrapper) {
    const v = wrapper.querySelector('video');
    if (!v || !v.duration) return;
    
    const svg = wrapper.querySelector('.vn-progress');
    const rect = svg.getBoundingClientRect();
    
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let angle = Math.atan2(y - cy, x - cx);
    let deg = angle * (180 / Math.PI);
    
    deg += 90; 
    if (deg < 0) deg += 360;
    
    const progress = deg / 360;
    v.currentTime = progress * v.duration;
};
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #emoji-panel {
            display: none; position: absolute; bottom: 65px; right: 12px; width: 320px; height: 380px; 
            background: rgba(28,28,35,0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); z-index: 10000; flex-direction: column; 
            overflow: hidden; transform-origin: bottom right; animation: menuPopUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @media (max-width: 768px) {
            #emoji-panel { width: calc(100vw - 24px); right: 12px; left: 12px; }
        }
        .ep-tabs { display: flex; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .ep-tab { flex: 1; text-align: center; padding: 12px 0; color: #888; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; border-bottom: 2px solid transparent; }
        .ep-tab.active { color: #a74fff; border-bottom: 2px solid #a74fff; background: rgba(167,79,255,0.05); }
        .ep-content { flex: 1; overflow-y: auto; padding: 10px; scrollbar-width: none; }
        .ep-content::-webkit-scrollbar { display: none; }
        .ep-emoji-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 4px; }
        .ep-emoji-item { font-size: 24px; text-align: center; cursor: pointer; padding: 4px; border-radius: 8px; transition: 0.1s; user-select: none; }
        .ep-emoji-item:hover { background: rgba(255,255,255,0.1); transform: scale(1.1); }
        .ep-emoji-item:active { transform: scale(0.9); }
        .ep-sticker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .ep-sticker-item { width: 100%; aspect-ratio: 1; cursor: pointer; border-radius: 12px; transition: 0.2s; padding: 4px; object-fit: contain; }
        .ep-sticker-item:hover { background: rgba(167,79,255,0.15); transform: scale(1.05); }
        .ep-gif-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
        .ep-gif-item { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; transition: 0.2s; }
        .ep-gif-item:hover { transform: scale(1.02); box-shadow: 0 4px 12px rgba(167,79,255,0.3); }
        .ep-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 200px; color: #777; font-size: 13px; text-align: center; padding: 20px; box-sizing: border-box; margin: 0 auto; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'emoji-panel';
    panel.innerHTML = `
        <div class="ep-tabs">
            <div class="ep-tab active" onclick="switchEpTab('emoji')">${t('Эмодзи')}</div>
            <div class="ep-tab" onclick="switchEpTab('sticker')">${t('Стикеры')}</div>
            <div class="ep-tab" onclick="switchEpTab('gif')">GIF</div>
        </div>
        <div id="ep-content-emoji" class="ep-content ep-emoji-grid" style="display:grid;"></div>
        <div id="ep-content-sticker" class="ep-content ep-sticker-grid" style="display:none;"></div>
        <div id="ep-content-gif" class="ep-content ep-gif-grid" style="display:none;"></div>
    `;
    
    const bottomBar = document.getElementById('bottom-bar-container');
    if (bottomBar) bottomBar.appendChild(panel);

    populateEmojis();
    populateStickers();
    populateGifs();

    document.querySelectorAll('.ep-content').forEach(el => {
        el.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    });

    document.addEventListener('click', (e) => {
        const p = document.getElementById('emoji-panel');
        const btn = document.getElementById('emoji-toggle-btn');
        if (p && p.style.display === 'flex' && !p.contains(e.target) && (!btn || !btn.contains(e.target))) {
            p.style.display = 'none';
            if(btn) btn.style.color = '#888';
        }
    });
});
window.toggleEmojiPanel = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const p = document.getElementById('emoji-panel');
    const btn = document.getElementById('emoji-toggle-btn');
    if (!p) return;
    if (p.style.display === 'none' || p.style.display === '') {
        p.style.display = 'flex';
        if(btn) btn.style.color = '#a74fff';
        populateStickers();
        populateGifs(); 
    } else {
        p.style.display = 'none';
        if(btn) btn.style.color = '#888';
    }
};

window.switchEpTab = function(tab) {
    document.querySelectorAll('.ep-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.ep-tab[onclick="switchEpTab('${tab}')"]`).classList.add('active');
    document.querySelectorAll('.ep-content').forEach(c => c.style.display = 'none');
    
    const container = document.getElementById(`ep-content-${tab}`);
    if (tab === 'emoji') {
        container.style.display = 'grid';
    } else if (tab === 'sticker') {
        let savedStickers = [];
        try { savedStickers = JSON.parse(localStorage.getItem('4send_saved_stickers') || '[]'); } catch(e){}
        container.style.display = savedStickers.length === 0 ? 'flex' : 'grid';
    } else if (tab === 'gif') {
        let savedGifs = [];
        try { savedGifs = JSON.parse(localStorage.getItem('4send_saved_gifs') || '[]'); } catch(e){}
        container.style.display = savedGifs.length === 0 ? 'flex' : 'grid';
    }
};

function populateEmojis() {
    const emojis = "😀,😃,😄,😁,😆,😅,😂,🤣,🥲,☺️,😊,😇,🙂,🙃,😉,😌,😍,🥰,😘,😗,😙,😚,😋,😛,😝,😜,🤪,🤨,🧐,🤓,😎,🥸,🤩,🥳,😏,😒,😞,😔,😟,😕,🙁,☹️,😣,😖,😫,😩,🥺,😢,😭,😤,😠,😡,🤬,🤯,😳,🥵,🥶,😱,😨,😰,😥,😓,🤗,🤔,🤭,🤫,🤥,😶,😐,😑,😬,🙄,😯,😦,😧,😮,😲,🥱,😴,🤤,😪,😵,🤐,🥴,🤢,🤮,🤧,😷,🤒,🤕,🤑,🤠,😈,👿,👹,👺,🤡,💩,👻,💀,☠️,👽,👾,🤖,🎃,😺,😸,😹,😻,😼,😽,🙀,😿,😾,👋,🤚,🖐,✋,🖖,👌,🤌,🤏,✌️,🤞,🤟,🤘,🤙,👈,👉,👆,🖕,👇,☝️,👍,👎,✊,👊,🤛,🤜,👏,🙌,👐,🤲,🤝,🙏,❤️,🔥,✨,🎉,💯".split(',');
    const container = document.getElementById('ep-content-emoji');
    if (!container) return;
    container.innerHTML = emojis.map(e => `<div class="ep-emoji-item" onclick="insertEmoji('${escapeAttr(e)}')">${e}</div>`).join('');
}

window.insertEmoji = function(char) {
    const input = document.getElementById('messageText');
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    input.value = text.substring(0, start) + char + text.substring(end);
    input.selectionStart = input.selectionEnd = start + char.length;
    updateCounter(input);
    toggleActionBtn(input);
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
};

function populateStickers() {
    const container = document.getElementById('ep-content-sticker');
    if (!container) return;
    let savedStickers = [];
    try { savedStickers = JSON.parse(localStorage.getItem('4send_saved_stickers') || '[]'); } catch(e){}
    
    if (savedStickers.length === 0) {
        container.innerHTML = `<div class="ep-empty-state"><svg viewBox="0 0 24 24" style="width:40px;fill:#555;margin-bottom:10px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-9c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm7 0c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>${t('У вас пока нет сохраненных стикеров.')}<br>${t('Сохраняйте их из чата!')}</div>`;
    } else {
        container.innerHTML = savedStickers.map(url => `<img src="${escapeAttr(url)}" class="ep-sticker-item" onclick="sendMediaDirectly('${escapeAttr(url)}', '${t('Стикер')}')" oncontextmenu="handleMediaContextMenu(event, '${escapeAttr(url)}', 'sticker')">`).join('');
    }
}

function populateGifs() {
    const container = document.getElementById('ep-content-gif');
    if (!container) return;
    let savedGifs = [];
    try { savedGifs = JSON.parse(localStorage.getItem('4send_saved_gifs') || '[]'); } catch(e){}
    
    if (savedGifs.length === 0) {
        container.innerHTML = `<div class="ep-empty-state"><svg viewBox="0 0 24 24" style="width:40px;fill:#555;margin-bottom:10px;"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>${t('У вас пока нет сохраненных GIF.')}<br>${t('Сохраняйте их из чата!')}</div>`;
    } else {
        container.innerHTML = savedGifs.map(url => `<img src="${escapeAttr(url)}" class="ep-gif-item" onclick="sendMediaDirectly('${escapeAttr(url)}', 'GIF')" oncontextmenu="handleMediaContextMenu(event, '${escapeAttr(url)}', 'gif')">`).join('');
    }
}

window.sendMediaDirectly = async function(url, typeName) {
    if (!target || document.getElementById('messageText')?.disabled) return;
    document.getElementById('emoji-panel').style.display = 'none';
    
    const tempId = '4S_media_' + Date.now();
    const tempMsg = {
        id: tempId, tempId: tempId, sender: me, receiver: target,
        text: typeName, fileUrl: url, isAudio: false, isVideoNote: false,
        timestamp: new Date().toISOString(), isLoading: true
    };
    
    const delayMinutes = window.scheduledMessageTime || 0;

    try {
        const emitData = {
            sender: me, receiver: target, fileUrl: url, text: typeName, 
            isAudio: false, isVideoNote: false, is_encrypted: false, 
            reply_to: typeof replyText !== 'undefined' ? replyText : null, 
            reply_to_id: typeof replyMsgId !== 'undefined' ? replyMsgId : null,
            tempId: tempId 
        };
        
        if (delayMinutes > 0) {
            addScheduledTask(delayMinutes, () => {
                if (typeof renderMessage === 'function') {
                    tempMsg.isLoading = false;
                    renderMessage(tempMsg);
                    scrollToBottom();
                }
                if (socket?.connected) socket.emit('chat_message', emitData);
            }, typeName);
            window.scheduledMessageTime = 0;
        } else {
            if (typeof renderMessage === 'function') {
                renderMessage(tempMsg);
                scrollToBottom();
            }
            if (socket?.connected) socket.emit('chat_message', emitData);
            setTimeout(() => {
                const tempEl = document.getElementById(`msg-${tempId}`);
                if (tempEl) tempEl.parentElement.remove();
            }, 500);
        }
        
        if (typeof replyMsgId !== 'undefined') replyMsgId = null;
        if (typeof replyText !== 'undefined') replyText = null;
        typeof cancelReply === 'function' && cancelReply();
    } catch (e) {
        typeof showToast === 'function' && showToast(t("Ошибка отправки"));
    }
};

window.pendingSchedules = [];

window.addScheduledTask = function(delayMinutes, taskFn, previewText) {
    const executeAt = Date.now() + delayMinutes * 60000;
    const taskObj = {
        id: 'sched_' + Date.now() + Math.random().toString(36).substr(2,5),
        executeAt,
        previewText,
        taskFn,
        timerId: null
    };

    taskObj.timerId = setTimeout(() => {
        taskObj.taskFn();
        window.pendingSchedules = window.pendingSchedules.filter(t => t.id !== taskObj.id);
        updateScheduledUI();
    }, delayMinutes * 60000);

    window.pendingSchedules.push(taskObj);
    updateScheduledUI();
};

window.updateScheduledUI = function() {
    const btn = document.getElementById('scheduled-messages-btn');
    const count = document.getElementById('scheduled-count');
    if (!btn || !count) return;

    if (window.pendingSchedules.length > 0) {
        btn.style.display = 'flex';
        count.innerText = window.pendingSchedules.length;
    } else {
        btn.style.display = 'none';
    }
};

window.showScheduledMessages = function() {
    let modal = document.getElementById('scheduled-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'scheduled-modal';
        Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
        document.body.appendChild(modal);
    }

    let listHtml = window.pendingSchedules.map(t => {
        const dateStr = new Date(t.executeAt).toLocaleString(globalLocale, {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
        return `
            <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; text-align:left;">
                <div style="overflow:hidden; flex:1; margin-right:10px;">
                    <div style="color:#a74fff; font-size:11px; font-weight:bold; margin-bottom:4px;">${t('Отправится')}: ${dateStr}</div>
                    <div style="color:#eee; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(t.previewText)}</div>
                </div>
                <button onclick="cancelScheduledTask('${escapeAttr(t.id)}')" style="background:rgba(255,77,77,0.2); color:#ff4d4d; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='rgba(255,77,77,0.3)'" onmouseout="this.style.background='rgba(255,77,77,0.2)'">${t('Отменить')}</button>
            </div>
        `;
    }).join('');

    if (window.pendingSchedules.length === 0) {
        listHtml = `<div style="color:#888; font-size:14px; padding:20px;">${t('Нет запланированных сообщений')}</div>`;
    }

    modal.innerHTML = `
        <div style="background: #1c1c23; width: 320px; max-height:80vh; display:flex; flex-direction:column; padding: 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color: #fff; margin-bottom: 15px; font-family: 'Inter', sans-serif; font-size: 18px;">${t('Отложенные сообщения')}</h3>
            <div id="scheduled-list-container" style="flex:1; overflow-y:auto; margin-bottom:15px; scrollbar-width:none;">
                ${listHtml}
            </div>
            <button onclick="closeScheduledModal()" style="width: 100%; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#2a2a3a'">${t('ЗАКРЫТЬ')}</button>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);
};

window.cancelScheduledTask = function(id) {
    const taskIndex = window.pendingSchedules.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        clearTimeout(window.pendingSchedules[taskIndex].timerId);
        window.pendingSchedules.splice(taskIndex, 1);
        updateScheduledUI();
        showScheduledMessages(); 
    }
};

window.closeScheduledModal = function() {
    const modal = document.getElementById('scheduled-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('div').style.transform = 'scale(0.9)';
    setTimeout(() => modal.style.display = 'none', 300);
};

window.setCustomSchedule = function() {
    const input = document.getElementById('custom-schedule-time');
    if (!input.value) return;
    const targetTime = new Date(input.value).getTime();
    const now = Date.now();
    if (targetTime <= now) {
        typeof showToast === 'function' && showToast(t("Выберите время в будущем"), true);
        return;
    }
    const diffMinutes = (targetTime - now) / 60000;
    setSchedule(diffMinutes, new Date(targetTime).toLocaleString(globalLocale, {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}));
};


window.saveGif = function(url) {
    if (!url.toLowerCase().includes('.gif')) {
        typeof showToast === 'function' && showToast(t("Можно сохранять только форматы .gif"), true);
        return;
    }
    let savedGifs = [];
    try { savedGifs = JSON.parse(localStorage.getItem('4send_saved_gifs') || '[]'); } catch(e){}
    if (!savedGifs.includes(url)) {
        savedGifs.unshift(url);
        localStorage.setItem('4send_saved_gifs', JSON.stringify(savedGifs));
        typeof showToast === 'function' && showToast(t('GIF сохранена'), false);
        populateGifs();
    } else {
        typeof showToast === 'function' && showToast(t('GIF уже сохранена'), false);
    }
};

window.saveSticker = function(url) {
    if (!url.toLowerCase().includes('.webp')) {
        typeof showToast === 'function' && showToast(t("Можно сохранять только форматы .webp"), true);
        return;
    }
    let savedStickers = [];
    try { savedStickers = JSON.parse(localStorage.getItem('4send_saved_stickers') || '[]'); } catch(e){}
    if (!savedStickers.includes(url)) {
        savedStickers.unshift(url);
        localStorage.setItem('4send_saved_stickers', JSON.stringify(savedStickers));
        typeof showToast === 'function' && showToast(t('Стикер сохранен'), false);
        populateStickers();
    } else {
        typeof showToast === 'function' && showToast(t('Стикер уже сохранен'), false);
    }
};
window.handleMediaContextMenu = function(e, url, type) {
    e.preventDefault();
    e.stopPropagation();
    
    let m = document.getElementById('modern-menu');
    let wasOpen = !!m;
    if (!m) {
        m = document.createElement('div');
        m.id = 'modern-menu';
        document.body.appendChild(m);
    }
    if (!wasOpen) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    
    Object.assign(m.style, { position: 'fixed', display: 'block', zIndex: '1000000', minWidth: '180px', background: 'rgba(23,23,30,0.98)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '6px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)', pointerEvents: 'auto' });
    
    m.innerHTML = `
        <div class="menu-item" style="color:#ff4d4d" onclick="deleteSavedMedia('${escapeAttr(url)}', '${escapeAttr(type)}'); forceCloseMenu();">
            <svg viewBox="0 0 24 24" style="fill:#ff4d4d"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> ${t('Удалить')}
        </div>
    `;
    
    let posX = e.clientX;
    let posY = e.clientY;
    if (posX + 180 > window.innerWidth) posX = window.innerWidth - 180 - 10;
    if (posY + 60 > window.innerHeight) posY = window.innerHeight - 60 - 10;
    
    m.style.left = posX + 'px';
    m.style.top = posY + 'px';
    m.style.bottom = 'auto';
    
    m.style.opacity = '0.01';
    m.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        m.style.transition = 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)';
        Object.assign(m.style, { opacity: '1', transform: 'scale(1) translateY(0)' });
    }, 10);
};
window.deleteSavedMedia = function(url, type) {
    const key = type === 'gif' ? '4send_saved_gifs' : '4send_saved_stickers';
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){}
    saved = saved.filter(u => u !== url);
    localStorage.setItem(key, JSON.stringify(saved));
    
    if (type === 'gif') populateGifs();
    else populateStickers();
    
    switchEpTab(type);
    typeof showToast === 'function' && showToast(t("Удалено"), false);
};
function formatChatDate(dateStr){
    const date=new Date(dateStr.replace(' ','T'));
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const yesterday=new Date(today);
    yesterday.setDate(yesterday.getDate()-1);
    const checkDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    if(checkDate.getTime()===today.getTime())return t("Сегодня");
    if(checkDate.getTime()===yesterday.getTime())return t("Вчера");
    return date.toLocaleDateString(globalLocale,{day:'numeric',month:'long'});
}
function insertDateSeparator(timestamp){
    const c=document.getElementById('msg-container');
    if(!c)return;
    const dateLabel=typeof formatChatDate==='function'?formatChatDate(timestamp):timestamp;
    if(!dateLabel)return;
    if(Array.from(c.querySelectorAll('.date-bubble')).some(b=>b.innerText.trim()===dateLabel.trim())){
        window.lastDateLabel=dateLabel;
        return;
    }
    const sep=document.createElement('div');
    sep.className='date-separator';
    Object.assign(sep.style,{width:'100%',display:'flex',justifyContent:'center',margin:'30px 0 15px 0',position:'relative',zIndex:'10'});
    sep.innerHTML=`<div class="date-bubble" style="background:rgba(167,79,255,0.18);backdrop-filter:blur(10px);padding:8px 24px;border-radius:22px;border:1px solid rgba(167,79,255,0.4);color:#fff;font-size:13px;font-weight:600;letter-spacing:0.5px;box-shadow:0 4px 15px rgba(0,0,0,0.4)">${dateLabel}</div>`;
    const anchor=document.getElementById('chat-anchor');
    anchor?c.insertBefore(sep,anchor):c.appendChild(sep);
    window.lastDateLabel=dateLabel;
}
function changeVoiceSpeed(btn){
    const audio=btn.closest('.voice-player')?.querySelector('audio');
    if(!audio)return;
    const newSpeed=audio.playbackRate===1?1.5:audio.playbackRate===1.5?2:1;
    audio.playbackRate=newSpeed;
    btn.innerText=newSpeed+'x';
    Object.assign(btn.style,newSpeed>1?{background:'rgba(167,79,255,0.2)',borderColor:'#a74fff'}:{background:'rgba(167,79,255,0.1)',borderColor:'rgba(167,79,255,0.3)'});
}
function seekMusic(e,bar){
    const audio=bar.closest('.music-player')?.querySelector('audio');
    if(audio?.duration)audio.currentTime=(e.clientX-bar.getBoundingClientRect().left)/bar.getBoundingClientRect().width*audio.duration;
}
function seekVoice(e,wavesContainer){
    const audio=wavesContainer.closest('.voice-player')?.querySelector('audio');
    if(audio?.duration)audio.currentTime=(e.clientX-wavesContainer.getBoundingClientRect().left)/wavesContainer.getBoundingClientRect().width*audio.duration;
}
function initVoiceDuration(audio){
    const timeEl=audio.closest('.voice-player')?.querySelector('.v-time');
    if(!timeEl)return;
    if(audio.duration === Infinity || isNaN(audio.duration)){
        audio.currentTime = 1e6;
        audio.onseeked = function() {
            audio.onseeked = null;
            audio.currentTime = 0;
            const dur=Math.floor(audio.duration);
            timeEl.innerText=`${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}`;
        };
    } else {
        const dur=Math.floor(audio.duration);
        timeEl.innerText=`${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}`;
    }
}
window.pauseAllMedia = function(exceptElement) {
    document.querySelectorAll('audio, .video-note-wrapper video').forEach(media => {
        if (media !== exceptElement) {
            media.pause();
            if (media.tagName.toLowerCase() === 'audio') {
                const p = media.closest('.voice-player') ?? media.closest('.music-player');
                if (p) {
                    const playIcon = p.querySelector('.play-icon');
                    const pauseIcon = p.querySelector('.pause-icon');
                    if (playIcon) playIcon.style.display = 'block';
                    if (pauseIcon) pauseIcon.style.display = 'none';
                }
            } else {
                const w = media.closest('.video-note-wrapper');
                if (w) {
                    const icon = w.querySelector('.vn-sound-icon');
                    if (icon) {
                        icon.style.display = 'flex';
                        icon.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px; fill:#fff;"><path d="M8 5v14l11-7z"/></svg>`;
                    }
                }
            }
        }
    });
};

window.attachCustomPlayer = function(video, wrapperClass = 'custom-video-wrapper') {
    const wrapper = document.createElement('div');
    wrapper.className = wrapperClass + ' paused';
    
    video.parentNode.insertBefore(wrapper, video);
    wrapper.appendChild(video);
    video.removeAttribute('controls');
    
    const centerPlay = document.createElement('div');
    centerPlay.className = 'cv-center-play';
    centerPlay.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    wrapper.appendChild(centerPlay);
    
    const controls = document.createElement('div');
    controls.className = 'cv-controls';
    controls.innerHTML = `
        <button class="cv-btn cv-play-pause">
            <svg class="cv-icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <svg class="cv-icon-pause" viewBox="0 0 24 24" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button class="cv-btn cv-rewind" title="-10s">
            <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
        </button>
        <button class="cv-btn cv-forward" title="+10s">
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
        </button>
        <div class="cv-volume-container">
            <button class="cv-btn cv-mute">
                <svg class="cv-icon-vol" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                <svg class="cv-icon-muted" viewBox="0 0 24 24" style="display:none;"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            </button>
            <div class="cv-volume-slider">
                <input type="range" min="0" max="1" step="0.05" value="1">
            </div>
        </div>
        <div class="cv-progress"><div class="cv-progress-fill"></div></div>
        <div class="cv-time">0:00 / 0:00</div>
        <button class="cv-btn cv-fullscreen">
            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        </button>
    `;
    wrapper.appendChild(controls);

    const playPauseBtn = controls.querySelector('.cv-play-pause');
    const iconPlay = controls.querySelector('.cv-icon-play');
    const iconPause = controls.querySelector('.cv-icon-pause');
    const rewindBtn = controls.querySelector('.cv-rewind');
    const forwardBtn = controls.querySelector('.cv-forward');
    const muteBtn = controls.querySelector('.cv-mute');
    const iconVol = controls.querySelector('.cv-icon-vol');
    const iconMuted = controls.querySelector('.cv-icon-muted');
    const volSlider = controls.querySelector('.cv-volume-slider input');
    const progress = controls.querySelector('.cv-progress');
    const progressFill = controls.querySelector('.cv-progress-fill');
    const timeDisplay = controls.querySelector('.cv-time');
    const fullscreenBtn = controls.querySelector('.cv-fullscreen');

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const togglePlay = (e) => {
        e.stopPropagation();
        if (video.paused) {
            document.querySelectorAll('.custom-video-wrapper video, .custom-video-wrapper-fullscreen video').forEach(v => {
                if (v !== video) {
                    v.pause();
                    const w = v.closest('.custom-video-wrapper') || v.closest('.custom-video-wrapper-fullscreen');
                    if (w) {
                        w.classList.add('paused');
                        const pIcon = w.querySelector('.cv-icon-play');
                        const paIcon = w.querySelector('.cv-icon-pause');
                        if(pIcon) pIcon.style.display = 'block';
                        if(paIcon) paIcon.style.display = 'none';
                    }
                }
            });
            video.play();
            wrapper.classList.remove('paused');
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        } else {
            video.pause();
            wrapper.classList.add('paused');
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        }
    };

    video.addEventListener('click', togglePlay);
    playPauseBtn.addEventListener('click', togglePlay);
    centerPlay.addEventListener('click', togglePlay);

    rewindBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = Math.max(0, video.currentTime - 10); });
    forwardBtn.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime = Math.min(video.duration, video.currentTime + 10); });

    const updateVolumeUI = () => {
        if (video.muted || video.volume === 0) {
            iconVol.style.display = 'none';
            iconMuted.style.display = 'block';
            volSlider.value = 0;
        } else {
            iconVol.style.display = 'block';
            iconMuted.style.display = 'none';
            volSlider.value = video.volume;
        }
    };

    muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) video.volume = 1;
        updateVolumeUI();
    });

    volSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        video.volume = e.target.value;
        video.muted = video.volume === 0;
        updateVolumeUI();
    });
    
    volSlider.addEventListener('click', e => e.stopPropagation());

    video.addEventListener('timeupdate', () => {
        const percent = (video.currentTime / video.duration) * 100;
        progressFill.style.width = `${percent}%`;
        timeDisplay.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    });

    video.addEventListener('loadedmetadata', () => {
        timeDisplay.innerText = `0:00 / ${formatTime(video.duration)}`;
    });

    video.addEventListener('ended', () => {
        wrapper.classList.add('paused');
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
        video.currentTime = 0;
    });

    progress.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = progress.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    });

    fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (wrapper.requestFullscreen) wrapper.requestFullscreen();
            else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    });
};

window.openFullscreenVideo = function(url) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        background: '#000', zIndex: '2147483649', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    Object.assign(closeBtn.style, {
        position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', right: '20px', background: 'rgba(0,0,0,0.5)',
        color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px',
        fontSize: '20px', cursor: 'pointer', zIndex: '2147483650', display: 'flex',
        alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
    });
    
    const v = document.createElement('video');
    v.src = url;
    v.autoplay = true;
    Object.assign(v.style, {
        maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'
    });
    
    overlay.appendChild(v);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    
    attachCustomPlayer(v, 'custom-video-wrapper-fullscreen');
    
    const closeV = () => { overlay.remove(); };
    closeBtn.onclick = closeV;
    v.onended = closeV;
};

if (!window._originalRenderMessageVideo) {
    window._originalRenderMessageVideo = window.renderMessage;
}

window.renderMessage = function(...args) {
    window._originalRenderMessageVideo.apply(this, args);
    const d = args[0];
    const msgId = d.id || d.tempId;
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;
    
    const video = msgEl.querySelector('video');
    if (video && !msgEl.querySelector('.video-note-wrapper') && !msgEl.querySelector('.custom-video-wrapper')) {
        if (typeof attachCustomPlayer === 'function') {
            attachCustomPlayer(video);
        }
    }
};
window.playNextMedia = function(currentMediaElement) {
    const currentMsg = currentMediaElement.closest('.msg-wrapper-cv');
    if (!currentMsg || !document.body.contains(currentMsg)) return;
    
    let nextMsg = currentMsg.nextElementSibling;
    while (nextMsg) {
        const nextAudio = nextMsg.querySelector('.voice-player audio');
        const nextVideo = nextMsg.querySelector('.video-note-wrapper video');
        
        if (nextAudio) {
            const playBtn = nextMsg.querySelector('.v-play-btn');
            if (playBtn) {
                nextMsg.scrollIntoView({behavior: 'smooth', block: 'center'});
                setTimeout(() => {
                    if (document.body.contains(nextMsg)) toggleVoice(playBtn);
                }, 300);
            }
            break;
        } else if (nextVideo) {
            const wrapper = nextMsg.querySelector('.video-note-wrapper');
            if (wrapper) {
                nextMsg.scrollIntoView({behavior: 'smooth', block: 'center'});
                setTimeout(() => {
                    if (document.body.contains(nextMsg)) toggleVideoNotePlayback(wrapper);
                }, 300);
            }
            break;
        }
        nextMsg = nextMsg.nextElementSibling;
    }
};
let globalAudioCtx = null;
function boostAudio(audio) {
    try {
        if(!globalAudioCtx) {
            globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if(globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
        
        if(!audio._boosted) {
            const source = globalAudioCtx.createMediaElementSource(audio);
            const gainNode = globalAudioCtx.createGain();
            gainNode.gain.value = 1.5;
            source.connect(gainNode);
            gainNode.connect(globalAudioCtx.destination);
            audio._boosted = true;
        }
    } catch(e) {
    }
}

function toggleVoice(btn) {
    const player = btn.closest('.voice-player') ?? btn.closest('.music-player');
    if (!player) return;
    const audio = player.querySelector('audio');
    
    const dot = player.parentElement.querySelector('.v-unread-dot');
    if (dot) {
        dot.remove();
        const msgEl = player.closest('.msg');
        if (msgEl) localStorage.setItem(`played_voice_${msgEl.getAttribute('data-id')}`, '1');
    }

    if (player.classList.contains('voice-player')) {
        boostAudio(audio);
    }

    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');
    
    if (audio.paused) {
        pauseAllMedia(audio);
        if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
            audio.load();
        }
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            }).catch(e => {
                if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
                    globalAudioCtx.resume().then(() => audio.play());
                }
            });
        } else {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        }
    } else {
        audio.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}
const _originalRenderMessageAudio = window.renderMessage;
window.renderMessage = function(...args) {
    _originalRenderMessageAudio.apply(this, args);
    const d = args[0];
    const msgId = d.id || d.tempId;
    const msgEl = document.getElementById(`msg-${msgId}`);
    if(msgEl) {
        const audioNodes = msgEl.querySelectorAll('audio');
        audioNodes.forEach(audio => {
            if(!audio.hasAttribute('crossorigin')) {
                audio.setAttribute('crossorigin', 'anonymous');
            }
        });
    }
};

function updateVoiceUI(audio){
    const player=audio.closest('.voice-player')??audio.closest('.music-player');
    if(!player)return;
    const timeEl=player.querySelector('.v-time');
    const bars=player.querySelectorAll('.v-bar');
    const progressLine=player.querySelector('.v-progress');
    const cur=Math.floor(audio.currentTime);
    const timeText=`${Math.floor(cur/60)}:${(cur%60).toString().padStart(2,'0')}`;
    if(player.classList.contains('music-player')){
        const dur=Math.floor(audio.duration||0);
        timeEl.innerText=`${timeText} / ${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}`;
    }else timeEl.innerText=timeText;
    const progress=audio.currentTime/audio.duration;
    if(bars.length>0){
        const activeIdx=Math.floor(bars.length*progress);
        bars.forEach((b,i)=>Object.assign(b.style,i<=activeIdx?{background:'#a74fff',opacity:'1'}:{background:'rgba(167,79,255,0.2)',opacity:'0.5'}));
    }
    if(progressLine)progressLine.style.width=(progress*100)+'%';
}
function resetVoiceUI(audio){
    const player=audio.closest('.voice-player');
    if(!player)return;
    player.querySelector('.play-icon').style.display='block';
    player.querySelector('.pause-icon').style.display='none';
    player.querySelectorAll('.v-bar').forEach(b=>b.style.background='rgba(167,79,255,0.2)');
    initVoiceDuration(audio);
    playNextMedia(audio);
}
function setTimer(min, label, isQuiet = false) {
    activeTimerMinutes = min;
    const icon = document.getElementById('timer-icon');
    const menu = document.getElementById('timer-menu');
    
    if (min > 0) {
        if (icon) Object.assign(icon.style, { fill: '#a74fff', filter: 'drop-shadow(0 0 5px rgba(167,79,255,0.6))' });
        if (!isQuiet) showToast(t('Автоудаление через:') + ' ' + label, false);
    } else {
        if (icon) Object.assign(icon.style, { fill: 'rgba(255,255,255,0.4)', filter: 'none' });
        if (!isQuiet && label !== t('Выкл')) showToast(t("Таймер отключен"), false);
    }
    
    if (menu && menu.style.display !== 'none') {
        menu.classList.add('timer-closing');
        setTimeout(() => {
            menu.style.display = 'none';
            menu.classList.remove('timer-closing');
        }, 200);
    }
}
document.getElementById('msg-container')?.addEventListener('click', e => {
    if (window.isMultiSelectMode) {
        const wrapper = e.target.closest('.msg-wrapper-cv');
        if (wrapper) {
            e.preventDefault();
            e.stopPropagation();
            const targetMsg = wrapper.querySelector('.msg');
            if (targetMsg) {
                toggleMultiSelect(targetMsg.getAttribute('data-id'));
            }
        }
    }
}, true);
document.getElementById('msg-container')?.addEventListener('dblclick',e=>{
    const msg=e.target.closest('.message');
    if(msg){
        prepareReply((msg.querySelector('.text-content')??msg.querySelector('.text-msg')??msg).innerText);
        Object.assign(msg.style,{transition:'0.1s',transform:'translateX(8px)'});
        setTimeout(()=>msg.style.transform='translateX(0)',100);
    }
});
function showToast(text,isError=true){
    const toast=document.getElementById('toast-notify');
    const toastText=document.getElementById('toast-text');
    if(!toast||!toastText)return;
    toastText.innerText=text;
    Object.assign(toast.style,{background:isError?'rgba(255,69,58,0.85)':'rgba(167,79,255,0.85)',display:'block',animation:'toastIn 0.5s cubic-bezier(0.2,1,0.2,1) forwards'});
    if(toast.timeoutId)clearTimeout(toast.timeoutId);
    toast.timeoutId=setTimeout(()=>{
        toast.style.animation='toastOut 0.4s cubic-bezier(0.4,0,1,1) forwards';
        setTimeout(()=>{if(toast.style.animationName==='toastOut')toast.style.display='none';},400);
    },3000);
}
let chatUserToDelete=null;
function prepareDeleteChat(username, isRoom = '0', roomType = ''){
    const modal=document.getElementById('delete-chat-confirm-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    const content=modal?.querySelector('div');
    const info=document.getElementById('del-chat-info');

    const el = document.querySelector(`.contact-item[data-username="${username}"]`);
    let displayName = el ? el.getAttribute('data-display') : username;
    if(!displayName||displayName==='null'||displayName==='undefined') displayName=window.currentMenuUser||target||t("Удаленный аккаунт");

    window.chatToDelete=username;

    let typeText = t('всю переписку с');
    if (isRoom === '1') {
        typeText = roomType === 'channel' ? t('канал') : t('группу');
    }

    if(info)info.innerText=`${t('Вы точно хотите удалить')} ${typeText} ${displayName}? ${t('Это действие нельзя будет отменить.')}`;
    const menu=document.getElementById('sidebar-context-menu');
    if(menu)menu.style.display='none';
    if(modal){
        Object.assign(modal.style,{display:'flex',opacity:'0',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)',pointerEvents:'none',transition:'all 0.5s cubic-bezier(0.4,0,0.2,1)'});
        if(content)Object.assign(content.style,{opacity:'0',transform:'scale(0.85) translateY(30px)',transition:'all 0.5s cubic-bezier(0.34,1.56,0.64,1)'});
        setTimeout(()=>{
            Object.assign(modal.style,{opacity:'1',backdropFilter:'blur(12px)',webkitBackdropFilter:'blur(12px)',pointerEvents:'auto'});
            if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1) translateY(0)'});
            if (wasHidden) {
                typeof pushNavigationState==='function'&&pushNavigationState();
            }
        },15);
    }
    document.getElementById('confirm-del-btn').onclick=()=>{
        if (isRoom === '1') {
            socket.emit('leave_room', window.chatToDelete);
        } else {
            socket.emit('clear_history',{user:me||localStorage.getItem('4send_user'),contact:window.chatToDelete});
        }
        if(target===window.chatToDelete) {
            document.getElementById('msg-container').innerHTML='';
            resetToHome();
        }
        const chatEl = document.querySelector(`.contact-item[data-username="${window.chatToDelete}"]`);
        if (chatEl) chatEl.remove();
        
        showToast(`${isRoom === '1' ? (roomType === 'channel' ? t('Канал') : t('Группа')) : t('Чат')} ${displayName} ${t('удален(а)')}`,false);
        closeDeleteChatModal();
    };
}
function closeDeleteChatModal(){
    const modal=document.getElementById('delete-chat-confirm-modal');
    const content=modal?.querySelector('div');
    if(modal){
        Object.assign(modal.style,{pointerEvents:'none',transition:'all 0.5s cubic-bezier(0.4,0,0.2,1)',opacity:'0',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)'});
        if(content)Object.assign(content.style,{transition:'all 0.4s cubic-bezier(0.4,0,0.2,1)',transform:'scale(0.85) translateY(30px)',opacity:'0'});
        setTimeout(()=>{modal.style.display='none';window.chatToDelete=null;},500);
        typeof backIfNav==='function'&&backIfNav();
    }
}
function scrollToReply(msgId){
    if(!msgId||msgId==='null')return;
    setTimeout(()=>{
        const targetMsg=document.getElementById(`msg-${msgId}`);
        if(targetMsg){
            targetMsg.scrollIntoView({behavior:'smooth',block:'center'});
            Object.assign(targetMsg.style,{transition:'all 0.5s ease',boxShadow:'0 0 25px rgba(167,79,255,0.7)',transform:'scale(1.03)',zIndex:'10'});
            setTimeout(()=>Object.assign(targetMsg.style,{boxShadow:'none',transform:'scale(1)',zIndex:'1'}),1000);
        }
    },50);
}
function showFilePreviewModal(files, initialCaption, callback) {
    let modal = document.getElementById('file-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'file-preview-modal';
        Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
        document.body.appendChild(modal);
    }
    
    const objectUrls =[];
    let previewContent = '';
    let canEdit = false;

    if (files.length === 1) {
        const file = files[0];
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const objectUrl = (isImage || isVideo) ? URL.createObjectURL(file) : null;
        if (objectUrl) objectUrls.push(objectUrl);
        const safeFileName = escapeHTML(file.name);
        
        if (isImage) {
            canEdit = true;
            previewContent = `
                <div style="position:relative; display:inline-block; margin-bottom:15px; width:100%;">
                    <img id="preview-single-img" src="${objectUrl}" style="max-width: 100%; max-height: 220px; border-radius: 12px; object-fit: contain; background: rgba(0,0,0,0.2); box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
                    <button id="file-preview-edit-btn" style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.6); border:none; border-radius:50%; width:36px; height:36px; color:#fff; cursor:pointer; backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='rgba(167,79,255,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                        <svg viewBox="0 0 24 24" style="width:20px; fill:#fff;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                </div>
            `;
        } else if (isVideo) {
            previewContent = `<video src="${objectUrl}" controls style="max-width: 100%; max-height: 220px; border-radius: 12px; margin-bottom: 15px; background: #000;"></video>`;
        } else {
            previewContent = `<div style="color: #a74fff; font-size: 14px; margin-bottom: 15px; word-break: break-all; background: rgba(167,79,255,0.1); padding: 10px; border-radius: 12px;">${safeFileName}</div>`;
        }
    } else {
        let gridHtml = '';
        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const objectUrl = (isImage || isVideo) ? URL.createObjectURL(file) : null;
            if (objectUrl) objectUrls.push(objectUrl);
            
            if (isImage) {
                gridHtml += `<img src="${objectUrl}" style="width:100%; height:60px; object-fit:cover; border-radius:6px;">`;
            } else if (isVideo) {
                gridHtml += `<div style="position:relative; width:100%; height:60px; background:#000; border-radius:6px; overflow:hidden;"><video src="${objectUrl}" style="width:100%; height:100%; object-fit:cover;"></video><div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff;"><svg viewBox="0 0 24 24" style="width:20px;fill:#fff"><path d="M8 5v14l11-7z"/></svg></div></div>`;
            } else {
                gridHtml += `<div style="width:100%; height:60px; background:rgba(167,79,255,0.2); border-radius:6px; display:flex; align-items:center; justify-content:center; color:#a74fff;"><svg viewBox="0 0 24 24" style="width:24px;fill:currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div>`;
            }
        });
        previewContent = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(60px, 1fr)); gap:5px; max-height:200px; overflow-y:auto; margin-bottom:15px; padding-right:5px;">${gridHtml}</div><div style="color:#aaa; font-size:12px; margin-bottom:10px;">${t('Выбрано файлов:')} ${files.length}</div>`;
    }

    modal.innerHTML = `
        <div style="background: #1c1c23; width: 320px; padding: 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5); box-sizing: border-box;">
            <h3 style="color: #fff; margin-bottom: 15px; font-family: 'Inter', sans-serif; font-size: 18px;">${t('Отправка')} ${files.length > 1 ? t('файлов') : t('файла')}</h3>
            ${previewContent}
            <input type="text" id="file-preview-caption" value="${escapeHTML(initialCaption || '')}" placeholder="${t('Добавить подпись...')}" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); color: #fff; outline: none; box-sizing: border-box; font-family: 'Inter', sans-serif;">
            <div style="display: flex; gap: 10px;">
                <button id="file-preview-send" style="flex: 1; padding: 12px; background: #a74fff; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${t('ОТПРАВИТЬ')}</button>
                <button id="file-preview-cancel" style="flex: 1; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#2a2a3a'">${t('ОТМЕНА')}</button>
            </div>
        </div>
    `;
    
    let wasHidden = modal.style.display === 'none' || modal.style.display === '';
    modal.style.display = 'flex';
    
    let editedFileObj = null;

    if (canEdit) {
        document.getElementById('file-preview-edit-btn').onclick = () => {
            openMediaEditor(files[0], (newFile) => {
                editedFileObj = newFile;
                const newUrl = URL.createObjectURL(newFile);
                objectUrls.push(newUrl);
                document.getElementById('preview-single-img').src = newUrl;
            });
        };
    }

    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
        const captionInput = document.getElementById('file-preview-caption');
        captionInput.focus();
        if (captionInput.value) {
            captionInput.selectionStart = captionInput.selectionEnd = captionInput.value.length;
        }
        if (wasHidden) {
            typeof pushNavigationState === 'function' && pushNavigationState();
        }
    }, 10);

    window.activeFilePreviewCleanup = () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.style.display = 'none';
            objectUrls.forEach(url => URL.revokeObjectURL(url));
        }, 300);
        window.activeFilePreviewCleanup = null;
    };

    document.getElementById('file-preview-send').onclick = () => { 
        const caption = document.getElementById('file-preview-caption').value.trim();
        window.activeFilePreviewCleanup();
        typeof backIfNav === 'function' && backIfNav();
        callback(true, caption, editedFileObj); 
    };
    document.getElementById('file-preview-cancel').onclick = () => { 
        window.activeFilePreviewCleanup();
        typeof backIfNav === 'function' && backIfNav();
        callback(false); 
    };
    
    document.getElementById('file-preview-caption').onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('file-preview-send').click();
        }
    };
}

window.openMediaEditor = function(file, onSave) {
    let modal = document.getElementById('media-editor-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'media-editor-modal';
        document.body.appendChild(modal);
    }
    
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: '#000', zIndex: '200000', display: 'flex', flexDirection: 'column',
        opacity: '0', transition: 'opacity 0.3s ease', touchAction: 'none'
    });

    modal.innerHTML = `
        <div style="display:flex; justify-content:space-between; padding:15px 20px; background:rgba(0,0,0,0.5); position:absolute; top:0; width:100%; z-index:10; box-sizing:border-box;">
            <button id="me-cancel" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer;">${t('Отмена')}</button>
            <button id="me-save" style="background:none; border:none; color:#a74fff; font-size:16px; font-weight:bold; cursor:pointer;">${t('Готово')}</button>
        </div>
        <div id="me-canvas-container" style="flex:1; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
            <canvas id="me-canvas" style="max-width:100%; max-height:100%; object-fit:contain;"></canvas>
        </div>
        <div style="padding:15px 20px; background:rgba(0,0,0,0.8); display:flex; flex-direction:column; gap:15px; position:absolute; bottom:0; width:100%; box-sizing:border-box; z-index:10;">
            <div style="display:flex; justify-content:center; gap:15px;">
                ${['#ff4d4d', '#4caf50', '#2196f3', '#ffeb3b', '#ffffff', '#000000'].map(c => 
                    `<div class="me-color-btn" data-color="${c}" style="width:24px; height:24px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid ${c === '#ff4d4d' ? '#fff' : 'transparent'};"></div>`
                ).join('')}
            </div>
            <div style="display:flex; justify-content:center; gap:20px;">
                <button id="me-undo" style="background:none; border:none; color:#fff; cursor:pointer;"><svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C20.08 11.03 16.69 8 12.5 8z"/></svg></button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
    typeof pushNavigationState === 'function' && pushNavigationState();

    const canvas = document.getElementById('me-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    let isDrawing = false;
    let currentColor = '#ff4d4d';
    let paths = [];
    let currentPath = null;

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        redraw();
    };
    img.src = URL.createObjectURL(file);

    function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        paths.forEach(p => {
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            p.points.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
        });
    }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    const startDraw = (e) => {
        isDrawing = true;
        const pos = getPos(e);
        currentPath = { color: currentColor, width: canvas.width * 0.01, points: [pos] };
        paths.push(currentPath);
        redraw();
    };

    const doDraw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        currentPath.points.push(getPos(e));
        redraw();
    };

    const endDraw = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', doDraw);
    window.addEventListener('mouseup', endDraw);
    
    canvas.addEventListener('touchstart', startDraw, {passive: false});
    canvas.addEventListener('touchmove', doDraw, {passive: false});
    window.addEventListener('touchend', endDraw);

    document.querySelectorAll('.me-color-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.me-color-btn').forEach(b => b.style.borderColor = 'transparent');
            btn.style.borderColor = '#fff';
            currentColor = btn.getAttribute('data-color');
        };
    });

    document.getElementById('me-undo').onclick = () => {
        paths.pop();
        redraw();
    };

    window.closeMediaEditor = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
        window.removeEventListener('mouseup', endDraw);
        window.removeEventListener('touchend', endDraw);
    };

    document.getElementById('me-cancel').onclick = () => {
        closeMediaEditor();
        typeof backIfNav === 'function' && backIfNav();
    };

    document.getElementById('me-save').onclick = () => {
        canvas.toBlob((blob) => {
            const editedFile = new File([blob], file.name, { type: file.type });
            onSave(editedFile);
            closeMediaEditor();
            typeof backIfNav === 'function' && backIfNav();
        }, file.type, 0.9);
    };
};

window.switchCamera = async function() {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    isFlashOn = false;
    const flashBtn = document.getElementById('flash-btn');
    if (flashBtn) flashBtn.style.background = 'rgba(0,0,0,0.5)';
    const flashOverlay = document.getElementById('front-flash-overlay');
    if (flashOverlay) flashOverlay.remove();
    
    videoPreviewEl.style.transform = currentFacingMode === 'user' ? 'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%) scaleX(1)';
    
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 400 }, height: { ideal: 400 } }
        });
        
        if (videoPreviewStream) {
            videoPreviewStream.getVideoTracks().forEach(t => t.stop());
        }
        
        const audioTrack = videoPreviewStream.getAudioTracks()[0];
        if (audioTrack) newStream.addTrack(audioTrack);
        
        videoPreviewStream = newStream;
        videoPreviewEl.srcObject = newStream;
        await videoPreviewEl.play();
    } catch (e) {
        typeof showToast === 'function' && showToast(t("Ошибка смены камеры"));
    }
};
function renderReactionsUI(msgId, reactions) {
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;
    let container = msgEl.querySelector('.reactions-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'reactions-container';
        container.style = `display:flex;gap:4px;flex-wrap:wrap;pointer-events:auto;position:absolute;bottom:-14px;${msgEl.classList.contains('sent') ? 'right:10px;' : 'left:10px;'}z-index:2;`;
        msgEl.appendChild(container);
        const wrapper = msgEl.parentElement;
        if (wrapper && wrapper.classList.contains('msg-wrapper-cv')) {
            wrapper.style.marginBottom = '28px';
        }
    }
    container.innerHTML = reactions.map(r => `<div onclick="sendReaction('${escapeAttr(msgId)}','${escapeAttr(r.emoji)}','${escapeAttr(target)}')" style="background:rgba(167,79,255,0.15);border:1px solid rgba(167,79,255,0.3);border-radius:10px;padding:1px 7px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;color:#eee;transition:.2s;box-shadow:0 2px 5px rgba(0,0,0,0.3);" onmouseover="this.style.background='rgba(167,79,255,0.25)'" onmouseout="this.style.background='rgba(167,79,255,0.15)'">${escapeHTML(r.emoji)} <span style="opacity:0.8;font-weight:600">${r.count}</span></div>`).join('');
    if (reactions.length === 0) {
        container.remove();
        const wrapper = msgEl.parentElement;
        if (wrapper && wrapper.classList.contains('msg-wrapper-cv')) {
            wrapper.style.marginBottom = '14px';
        }
    }
}

function showFileLimitModal() {
    let modal = document.getElementById('file-limit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'file-limit-modal';
        Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
        
        modal.innerHTML = `
            <div style="background: #1c1c23; width: 320px; padding: 30px 25px; border-radius: 24px; border: 1px solid rgba(255,77,77,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5); box-sizing: border-box;">
                <div style="width: 60px; height: 60px; background: rgba(255,77,77,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
                    <svg viewBox="0 0 24 24" style="width: 30px; height: 30px; fill: #ff4d4d;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                </div>
                <h3 style="color: #fff; margin-bottom: 10px; font-family: 'Inter', sans-serif; font-size: 18px;">${t('Файл')} слишком большой</h3>
                <p style="color: #aaa; font-size: 14px; margin-bottom: 25px; line-height: 1.5;">${t('Максимальный размер файла для загрузки составляет <b>25 МБ</b>. Пожалуйста, выберите файл меньшего размера.')}</p>
                <button onclick="document.getElementById('file-limit-modal').style.opacity='0'; document.getElementById('file-limit-modal').querySelector('div').style.transform='scale(0.9)'; setTimeout(()=>document.getElementById('file-limit-modal').style.display='none', 300);" style="width: 100%; padding: 14px; background: #ff4d4d; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 14px;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${t('ПОНЯТНО')}</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);
}
async function upFile(draggedFiles=null){
    const input=document.getElementById('f-input');
    const msgInput = document.getElementById('messageText');
    const uploadTarget = target;
    
    if (msgInput?.disabled) {
        typeof showToast === 'function' && showToast(t("Отправка сообщений ограничена"), true);
        if(input) input.value = '';
        return;
    }
    
    let files =[];
    if (draggedFiles && draggedFiles.length) {
        files = Array.from(draggedFiles);
    } else if (input && input.files && input.files.length) {
        files = Array.from(input.files);
    }
    
    if(files.length === 0 || !uploadTarget) return;

    if (files.length > 10) {
        typeof showToast === 'function' && showToast(t("Максимум 10 файлов за раз"), true);
        if(input) input.value = '';
        return;
    }

    for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
            typeof showFileLimitModal === 'function' && showFileLimitModal();
            if(input) input.value = '';
            return;
        }
    }

    const currentText = msgInput ? msgInput.value.trim() : '';

    showFilePreviewModal(files, currentText, async (confirmed, caption, editedFile) => {
        if (!confirmed) {
            if(input) input.value = '';
            return;
        }

        const finalFiles = editedFile ? [editedFile] : files;

        if (msgInput) {
            msgInput.value = '';
            msgInput.style.height = 'auto';
            msgInput.style.overflowY = 'hidden';
            const wrapper = msgInput.parentElement.parentElement;
            if(wrapper) wrapper.style.borderColor = "#252530";
            toggleActionBtn(msgInput);
        }

        window.isUploading = true;
        const tempId = '4S_up_' + Date.now();
        
        const isMp3 = finalFiles[0].name.toLowerCase().endsWith('.mp3');
        
        const tempMsg = {
            id: tempId,
            tempId: tempId,
            sender: me,
            receiver: uploadTarget,
            text: caption ? caption : (finalFiles.length > 1 ? '' : (isMp3 ? '' : finalFiles[0].name)),
            fileUrl: finalFiles.length === 1 ? URL.createObjectURL(finalFiles[0]) : 'dummy',
            fileUrls: finalFiles.length > 1 ? finalFiles.map(f => URL.createObjectURL(f)) :[],
            fileName: finalFiles.length === 1 ? finalFiles[0].name : `${finalFiles.length} ${t('файлов')}`,
            isAudio: false,
            isMusic: isMp3,
            timestamp: new Date().toISOString(),
            isLoading: true
        };
        
        const delayMinutes = window.scheduledMessageTime || 0;

        if (delayMinutes === 0) {
            if (typeof renderMessage === 'function') {
                renderMessage(tempMsg);
                scrollToBottom();
            }
        }

        const fd = new FormData();
        finalFiles.forEach(f => fd.append(finalFiles.length > 1 ? 'files' : 'file', f));
        
        try {
            const token = localStorage.getItem('4send_token');
            const endpoint = finalFiles.length > 1 ? '/upload-multiple' : '/upload';
            const res = await fetch(endpoint, {method: 'POST', headers: {'Authorization': `Bearer ${token}`}, body: fd});
            if (!res.ok) throw new Error();
            const d = await res.json();
            
            const textValue = caption ? caption : (finalFiles.length > 1 ? '' : (isMp3 ? '' : finalFiles[0].name));
            
            const emitData = {
                sender: me, 
                receiver: uploadTarget, 
                fileUrl: finalFiles.length === 1 ? d.url : '', 
                fileUrls: finalFiles.length > 1 ? d.urls :[],
                text: textValue, 
                isMusic: isMp3 ? 1 : 0, 
                fileName: finalFiles.length === 1 ? finalFiles[0].name : `${finalFiles.length} ${t('файлов')}`, 
                is_encrypted: false, 
                reply_to: typeof replyText !== 'undefined' ? replyText : null, 
                reply_to_id: typeof replyMsgId !== 'undefined' ? replyMsgId : null, 
                tempId: tempId
            };
            
            if (delayMinutes > 0) {
                addScheduledTask(delayMinutes, () => {
                    if (typeof renderMessage === 'function') {
                        tempMsg.fileUrl = emitData.fileUrl;
                        tempMsg.fileUrls = emitData.fileUrls;
                        tempMsg.isLoading = false;
                        renderMessage(tempMsg);
                        scrollToBottom();
                    }
                    if (socket?.connected) socket.emit('chat_message', emitData);
                }, textValue);
                window.scheduledMessageTime = 0;
            } else {
                const tempEl = document.getElementById(`msg-${tempId}`);
                if (tempEl) tempEl.parentElement.remove();
                if (socket?.connected) socket.emit('chat_message', emitData);
            }
        } catch (err) {
            const tempEl = document.getElementById(`msg-${tempId}`);
            if (tempEl) tempEl.parentElement.remove();
            typeof showToast === 'function' && showToast(t("Ошибка загрузки файла"));
        }
        window.isUploading = false;
        if (input) input.value = '';
        if (typeof replyMsgId !== 'undefined') replyMsgId = null;
        if (typeof replyText !== 'undefined') replyText = null;
        typeof closeReply === 'function' && closeReply();
    });
}
function initMusicDuration(audio){
    const timeEl=audio.closest('.music-player')?.querySelector('.v-time');
    if(!timeEl)return;
    if(audio.duration === Infinity || isNaN(audio.duration)){
        audio.currentTime = 1e6;
        audio.onseeked = function() {
            audio.onseeked = null;
            audio.currentTime = 0;
            const dur=Math.floor(audio.duration);
            timeEl.innerText=`0:00 / ${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}`;
        };
    } else {
        const dur=Math.floor(audio.duration);
        timeEl.innerText=`0:00 / ${Math.floor(dur/60)}:${(dur%60).toString().padStart(2,'0')}`;
    }
}
function updateMusicUI(audio){
    const player=audio.closest('.music-player');
    if(!player)return;
    player.querySelector('.v-time').innerText=`${new Date(Math.floor(audio.currentTime)*1000).toISOString().substr(14,5)} / ${new Date((Math.floor(audio.duration)||0)*1000).toISOString().substr(14,5)}`;
    player.querySelector('.v-progress').style.width=(audio.currentTime/audio.duration*100)+'%';
}
function cancelReply(){
    if (replyText) {
        replyText=null;
        replyMsgId=null;
        const bar = document.getElementById('reply-preview-bar');
        if (bar) bar.style.display='none';
        const inp = document.getElementById('messageText');
        if (inp) {
            const wrapper = inp.parentElement.parentElement;
            if (wrapper) wrapper.style.borderColor = "#252530";
        }
        typeof backIfNav==='function'&&backIfNav();
    } else {
        const bar = document.getElementById('reply-preview-bar');
        if (bar) bar.style.display='none';
    }
}
function prepareReply(txt,id){
    if(!id)return;
    replyText=txt;
    replyMsgId=id;
    const previewText=document.getElementById('reply-preview-text');
    const previewBar=document.getElementById('reply-preview-bar');
    
    let displayT = txt;
    const replyMap = {
        [t('📹 Видеосообщение')]: `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('Видео')}`,
        [t('🎤 Голосовое сообщение')]: `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>${t('Голосовое сообщение')}`,
        [t('🎵 Аудиозапись')]: `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>${t('Аудиозапись')}`,
        [t('📁 Файл')]: `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${t('Файл')}`,
        [t('📷 Фотография')]: `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>${t('Фотография')}`,
        [t('Стикер')]: `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg>${t('Стикер')}`,
        "GIF": `<svg style="width:14px;height:14px;fill:#a74fff;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>GIF`
    };
    if (replyMap[txt]) {
        displayT = replyMap[txt];
    } else {
        displayT = escapeHTML(txt);
    }

    if(previewText)previewText.innerHTML="<span style='color:#a74fff;font-weight:bold;margin-right:4px;'>" + t('Ответ на:') + "</span> " + displayT;
    if(previewBar) {
        let wasHidden = previewBar.style.display === 'none' || previewBar.style.display === '';
        previewBar.style.display='flex';
        if (wasHidden) {
            typeof pushNavigationState === 'function' && pushNavigationState();
        }
    }
    document.getElementById('messageText')?.focus();
}
function prepareEdit(id,t){
    if (!editingMsgId) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    editingMsgId=id;
    const i=document.getElementById('messageText');
    i.value=t;
    i.style.height='auto';
    i.style.height=(i.scrollHeight)+'px';
    i.style.overflowY=(i.scrollHeight>150?'auto':'hidden');
    i.focus();
    
    const wrapper = i.parentElement.parentElement;
    if(wrapper) wrapper.style.borderColor = "#a74fff";
    
    toggleActionBtn(i);
}
window.executeLogout = async function() {
    try {
        const token = localStorage.getItem('4send_token');
        if (token) {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch {}
    localStorage.clear();
    location.reload();
};

window.logout = function() {
    typeof forceCloseMenu === 'function' && forceCloseMenu(true);
    const drawer = document.getElementById('menu-drawer');
    if(drawer) drawer.classList.remove('open');
    const ov = document.getElementById('overlay');
    if(ov) {
        ov.classList.remove('active');
        setTimeout(() => ov.style.display = 'none', 300);
    }

    let modal = document.getElementById('logout-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'logout-confirm-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: '100001', display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
            opacity: '0', transition: 'all 0.3s ease'
        });
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background: #1c1c23; width: 320px; padding: 30px 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div style="width: 72px; height: 72px; background: rgba(255,77,77,0.1); border-radius: 22px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 10px 25px rgba(255,77,77,0.2); position: relative; overflow: hidden;">
                <svg viewBox="0 0 24 24" style="width: 36px; height: 36px; fill: none; stroke: #ff4d4d; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; animation: doorOpen 1.5s infinite ease-in-out;">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </div>
            <style>
                @keyframes doorOpen {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(4px); }
                }
            </style>
            <h3 style="color: #fff; margin-bottom: 10px; font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 800;">${t('Выход из аккаунта')}</h3>
            <p style="color: #aaa; font-size: 14px; margin-bottom: 25px; line-height: 1.5;">${t('Вы действительно хотите выйти из своего аккаунта?')}</p>
            <div style="display: flex; gap: 10px;">
                <button id="logout-confirm-yes" style="flex: 1; padding: 14px; background: #ff4d4d; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(255,77,77,0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255,77,77,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(255,77,77,0.3)'">${t('ВЫЙТИ')}</button>
                <button id="logout-confirm-no" style="flex: 1; padding: 14px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#2a2a3a'">${t('ОТМЕНА')}</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    document.getElementById('logout-confirm-no').onclick = () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.style.display = 'none', 300);
    };

    document.getElementById('logout-confirm-yes').onclick = () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.style.display = 'none';
            executeLogout();
        }, 300);
    };
};

socket.on('msg_deleted', id => {
    typeof removeMsgFromCache === 'function' && removeMsgFromCache(id);
    
    const el = document.getElementById(`msg-${id}`);
    if (el) {
        const wrapper = el.parentElement;
        const prev = wrapper.previousElementSibling;
        const next = wrapper.nextElementSibling;
        
        const container = document.getElementById('msg-container');
        const isAtBottom = container && (container.scrollHeight - container.scrollTop - container.clientHeight < 80);

        wrapper.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'scale(0.9) translateX(30px)';
        
        if (!next || next.classList.contains('date-separator')) {
            let prevMsgWrapper = prev;
            while (prevMsgWrapper && !prevMsgWrapper.classList.contains('msg-wrapper-cv')) {
                prevMsgWrapper = prevMsgWrapper.previousElementSibling;
            }
            
            if (prevMsgWrapper) {
                const prevMsg = prevMsgWrapper.querySelector('.msg');
                if (prevMsg) {
                    let txt = t("Сообщение");
                    let isVideoNote = !!prevMsg.querySelector('.video-note-wrapper') || !!prevMsg.querySelector('.custom-video-wrapper');
                    let isAudio = !!prevMsg.querySelector('.voice-player');
                    let isMusic = !!prevMsg.querySelector('.music-player');
                    let img = prevMsg.querySelector('img');
                    let fileUrl = img?.src || prevMsg.querySelector('video')?.src || null;
                    let textEl = prevMsg.querySelector('.msg-text');
                    
                    if (textEl) txt = textEl.innerText;
                    else if (img && img.getAttribute('data-is-sticker') === 'true') txt = t('Стикер');
                    else if (img && img.getAttribute('data-is-gif') === 'true') txt = "GIF";
                    else if (prevMsg.querySelector('.file-message')) txt = t('📁 Файл');
                    
                    const isMe = prevMsg.classList.contains('sent');
                    
                    updateSidebarPreview(target, {
                        sender: isMe ? me : target,
                        text: txt,
                        isVideoNote,
                        isAudio,
                        isMusic,
                        fileUrl,
                        timestamp: new Date().toISOString() 
                    }, false);
                }
            } else {
                updateSidebarPreview(target, {
                    sender: target,
                    text: "",
                    timestamp: new Date().toISOString()
                }, false);
            }
        }

        setTimeout(() => {
            wrapper.style.height = '0px';
            wrapper.style.marginBottom = '0px';
            wrapper.style.padding = '0px';
            wrapper.style.display = 'none'; 
            
            wrapper.remove();

            if (prev?.classList.contains('date-separator')) {
                if (!next || next.classList.contains('date-separator')) {
                    prev.style.transition = "all 0.3s ease";
                    prev.style.opacity = "0";
                    prev.style.transform = "scale(0.8) translateY(-10px)";
                    setTimeout(() => {
                        prev.style.display = 'none';
                        prev.remove();
                    }, 300);
                }
            }

            if (isAtBottom && typeof scrollToBottom === 'function') {
                scrollToBottom();
            }
            
            typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
        }, 300);
    }
});
socket.on('user_updated', async (data) => {
    if (data.oldUsername === me) {
        me = data.newUsername;
        localStorage.setItem('4send_user', me);
    }
    try {
        const db = await dbPromise;
        const tx = db.transaction('cache', 'readwrite');
        tx.objectStore('cache').clear();
    } catch {}
    typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
});
socket.on('online_list',l=>{
    onlineUsers=new Set(l);
    typeof updateOnlineUI==='function'&&updateOnlineUI();
    typeof updateHeaderStatus==='function'&&updateHeaderStatus();
});
let typingTimeouts = {};
document.addEventListener('DOMContentLoaded', () => {
    const msgInput = document.getElementById('messageText');
    if (!msgInput) return;
    msgInput.style.resize = 'none';
    msgInput.style.overflowY = 'hidden';
    msgInput.addEventListener('input', function() {
        if (target) localStorage.setItem('4send_draft_' + target, this.value);
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 150);
        this.style.height = newHeight + 'px';
        this.style.overflowY = this.scrollHeight > 150 ? 'auto' : 'hidden';
        if(!target) return;
        const currentTarget = target;
        socket.emit('typing', {sender: me, receiver: currentTarget});
        clearTimeout(typingTimeouts[currentTarget]);
        typingTimeouts[currentTarget] = setTimeout(() => {
            socket.emit('typing', {sender: me, receiver: currentTarget, stop: true});
        }, 3000);
    });
});
let statusResetTimeout;
socket.on('is_typing', async data => {
    const s = String(data.sender || "").toLowerCase().trim();
    const currentTarget = String(target || "").toLowerCase().trim();
    
    if (data.is_blocked || s === me) return;
    if (currentTarget.startsWith('room_') && window.currentRoomType === 'channel') return;
    
    const dotsHtml = '<span class="typing-dots" style="display:inline-block; width:16px; text-align:left;"><span>.</span><span>.</span><span>.</span></span>';
    const previewEl = document.getElementById(`preview-${s}`);
    
    if (previewEl) {
        if (!previewEl.hasAttribute('data-original')) previewEl.setAttribute('data-original', previewEl.innerHTML);
        if (data.stop) {
            clearTimeout(previewResetTimeouts[s]);
            const original = previewEl.getAttribute('data-original');
            if (original) previewEl.innerHTML = original;
            previewEl.style.color = '#777';
            previewEl.removeAttribute('data-original');
        } else {
            const actionText = data.isVideo ? t('записывает видео') : data.isVoice ? t('записывает голос') : t('печатает');
            const newHtml = `${actionText}${dotsHtml}`;
            if (previewEl.innerHTML !== newHtml) {
                previewEl.innerHTML = newHtml;
                previewEl.style.color = '#a74fff';
            }
            clearTimeout(previewResetTimeouts[s]);
            previewResetTimeouts[s] = setTimeout(() => {
                const original = previewEl.getAttribute('data-original');
                if (original) {
                    previewEl.innerHTML = original;
                    previewEl.style.color = '#777';
                    previewEl.removeAttribute('data-original');
                }
            }, 4000);
        }
    }
    
    if (s === currentTarget || (currentTarget.startsWith('room_') && data.receiver === currentTarget)) {
        const statusEl = document.getElementById('chat-status');
        if (!statusEl || currentTarget === me) return;
        
        window.isTypingActive = !data.stop;

        if (data.stop) {
            clearTimeout(statusResetTimeout);
            updateHeaderStatus(); 
            return;
        }
        
        const prefix = currentTarget.startsWith('room_') ? `${s} ` : '';
        const actionText = data.isVideo ? t('записывает видеосообщение') : data.isVoice ? t('записывает голосовое сообщение') : t('печатает');
        const newHtml = `${prefix}${actionText}${dotsHtml}`;
        
        if (statusEl.innerHTML !== newHtml) {
            statusEl.innerHTML = newHtml;
            statusEl.style.color = '#a74fff';
        }
        
        clearTimeout(statusResetTimeout);
        statusResetTimeout = setTimeout(() => {
            window.isTypingActive = false;
            updateHeaderStatus(); 
        }, data.isVoice || data.isVideo ? 7000 : 3000);
    }
});
const chatNotify=new Audio('notify.mp3');
window.isTypingActive = false;
async function updateHeaderStatus() {
    if (window.isTypingActive) return; 

    const statusEl = document.getElementById('chat-status');
    if (!statusEl || !target) return;
    
    if (target.startsWith('room_')) {
        try {
            const res = await fetch(`/api/room/${target}`);
            if (!target) return;
            const roomData = await res.json();
            if (roomData.error) return;
            const mCount = roomData.members ? roomData.members.length : 1;
            if (roomData.type === 'channel') {
                statusEl.innerText = pluralize(mCount, [t('подписчик'), t('подписчика'), t('подписчиков')]);
            } else {
                statusEl.innerText = pluralize(mCount,[t('участник'), t('участника'), t('участников')]);
            }
            statusEl.style.color = '#777';
        } catch {}
        return;
    }

    if (String(target).toLowerCase() === String(me).toLowerCase()) {
        statusEl.innerText = t('сохраненные сообщения');
        statusEl.style.color = '#777';
        return;
    }
    
    if (target === '4send_system' || target === '4send_help') {
        statusEl.innerText = t('системный бот');
        statusEl.style.color = '#777';
        return;
    }
    
    if (!checkPrivacySetting(target, window.me, 'status')) {
        statusEl.innerText = t('был(а) недавно');
        statusEl.style.color = '#777';
        return;
    }
    
    try {
        const res = await fetch(`/api/status/${target}?me=${me}`);
        if (!target) return;
        const data = await res.json();
        
        if (data.is_blocked) {
            statusEl.innerText = t('был(а) давно');
            statusEl.style.color = '#777';
            return;
        }

        if (window.currentChatHasHistory === false) {
            statusEl.innerText = t('был(а) недавно');
            statusEl.style.color = '#777';
            return;
        }
        
        const isOn = Array.from(onlineUsers).some(u => String(u).toLowerCase() === String(target).toLowerCase());
        if (isOn) {
            statusEl.innerText = t('в сети');
            statusEl.style.color = '#4caf50';
        } else if (data.last_seen) {
            const lastDate = new Date(data.last_seen);
            if (!isNaN(lastDate.getTime())) {
                const now = new Date();
                const isToday = lastDate.toDateString() === now.toDateString();
                const timeStr = lastDate.toLocaleTimeString(globalLocale, { hour: '2-digit', minute: '2-digit' });
                statusEl.innerText = isToday ? t('online_at_time', {time: timeStr}) : t('online_date_at_time', {date: lastDate.toLocaleDateString(globalLocale, { day: 'numeric', month: 'short' }), time: timeStr});
            } else {
                statusEl.innerText = t('был(а) недавно');
            }
            statusEl.style.color = '#777';
        } else {
            statusEl.innerText = t('был(а) недавно');
            statusEl.style.color = '#777';
        }
    } catch {
        statusEl.innerText = t('был(а) недавно');
        statusEl.style.color = '#777';
    }
}

if (window.socket) {
    window.socket.on('user_status_update', data => { 
        if(data.username === target) updateHeaderStatus(); 
    });
}
socket.on('update_msg_reactions', ({msgId, reactions}) => {
    if (reactions) {
        typeof renderReactionsUI === 'function' && renderReactionsUI(msgId, reactions);
    } else {
        fetch(`/api/reactions/${msgId}?t=${Date.now()}`).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{typeof renderReactionsUI==='function'&&renderReactionsUI(msgId,data||[]);}).catch(()=>{});
    }
});
socket.on('pin_update',data=>{
    const chatKey=data.chatId.toLowerCase();
    if(data.type==='me'&&data.pinnerId!==me.toLowerCase())return;
    if(!allPinned[chatKey])allPinned[chatKey]=[];
    if(data.action==='add'){
        const decryptedText = typeof clarify === 'function' ? clarify(data.text) : data.text;
        if(!allPinned[chatKey].find(m=>m.id==data.messageId))allPinned[chatKey].unshift({id:data.messageId,text:decryptedText});
    }else if(data.action==='remove'){
        allPinned[chatKey]=allPinned[chatKey].filter(m=>m.id!=data.messageId);
        if(currentPinnedIndex>=allPinned[chatKey].length)currentPinnedIndex=0;
    }
    target&&chatKey===target.toLowerCase()&&updatePinnedUI();
});
socket.on('mute_confirmed',()=>typeof loadChatsWithPreview==='function'&&loadChatsWithPreview());
window.preloadedProfileUser = null;

function clearProfileModal() {
    window.preloadedProfileUser = null;
    const avBox = document.getElementById('p-view-av');
    const nameEl = document.getElementById('p-view-name');
    const statusEl = document.getElementById('p-view-status');
    const btnContainer = document.getElementById('p-view-btn-container');
    
    if(avBox) avBox.innerHTML = '';
    if(nameEl) nameEl.innerHTML = '';
    if(statusEl) statusEl.innerHTML = '';
    if(btnContainer) btnContainer.innerHTML = '';
}

window.preloadProfileModal = function(userToShow, data, options = {}) {
    const modal = document.getElementById('user-profile-modal');
    if (!modal) return;
    
    const userToShowLower = String(userToShow).toLowerCase();
    const meLower = String(window.me || '').toLowerCase();
    const contactItem = document.querySelector(`.contact-item[data-username="${userToShow}"]`);
    const isMuted = contactItem ? contactItem.getAttribute('data-muted') === '1' : false;

    let contentHtml = '';

    if (options.isRoom) {
        const room = data;
        const isOwner = String(room.owner).toLowerCase() === meLower;
        
        let roomAvatarClick = '';
        let roomAvatarCursor = 'default';
        if (room.avatar) {
            let lightboxUrl = room.avatar;
            if (lightboxUrl.includes('res.cloudinary.com') && lightboxUrl.includes('/upload/')) {
                lightboxUrl = lightboxUrl.replace('/upload/', '/upload/q_auto,f_auto,w_1920,c_limit/');
            }
            roomAvatarClick = `onclick="event.stopPropagation(); openLightbox('${escapeHTML(lightboxUrl)}')"`;
            roomAvatarCursor = 'pointer';
        }
        
        let membersListHtml = '';
        if (room.type !== 'channel' && room.memberDetails && room.memberDetails.length > 0) {
            membersListHtml = `
                <div style="width:100%; height:8px; background:rgba(0,0,0,0.2); flex-shrink:0;"></div>
                <div style="padding:15px 20px; flex-shrink:0;">
                    <div style="color:#a74fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${t('Участники')} (${room.memberDetails.length})</div>
                    <div class="ep-content" style="display:flex;flex-direction:column;gap:10px;max-height:200px;overflow-y:auto;scrollbar-width:none;padding:0;">
                        ${room.memberDetails.map(m => `
                            <div onclick="closeProfile(); setTimeout(() => showUserProfile('${escapeAttr(m.username)}'), 300);" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px;border-radius:10px;transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:#252530;display:flex;align-items:center;justify-content:center;color:#a74fff;font-weight:bold;font-size:14px;">
                                    ${typeof getAvatarHtml === 'function' ? getAvatarHtml(m.displayName || m.username, m.avatar, 36) : ''}
                                </div>
                                <div style="color:#eee;font-size:14px;font-weight:600;display:flex;align-items:center;gap:4px;">
                                    ${escapeHTML(m.displayName || m.username)}
                                    ${m.isVerified ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '') : ''}
                                </div>
                                ${m.username === room.owner ? `<div style="margin-left:auto;color:#a74fff;font-size:11px;background:rgba(167,79,255,0.1);padding:2px 6px;border-radius:6px;">${t('Владелец')}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        contentHtml = `
            <div onclick="event.stopPropagation()" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;min-height:450px;max-height:85vh;overflow-y:auto;scrollbar-width:none;border-radius:24px;border:1px solid rgba(167,79,255,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;padding-bottom:20px;display:flex;flex-direction:column;">
                <button onclick="closeProfile()" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:#aaa;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.color='#aaa'">✕</button>
                
                <div style="padding:30px 20px 20px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div ${roomAvatarClick} style="width:100px;height:100px;border-radius:50%;overflow:hidden;border:2px solid #a74fff;box-shadow:0 4px 15px rgba(167,79,255,0.3);margin-bottom:15px;cursor:${roomAvatarCursor};">
                        ${typeof getAvatarHtml === 'function' ? getAvatarHtml(room.name, room.avatar, 100) : ''}
                    </div>
                    <div style="font-size:22px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px;text-align:center;line-height:1.2;justify-content:center;overflow:hidden;">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(room.name)}</span>${room.isVerified ? (typeof getVerifyBadgeHtml === 'function' ? getVerifyBadgeHtml(room.type) : '') : ''}${isMuted ? (typeof mutedSvg !== 'undefined' ? mutedSvg : '') : ''}
                    </div>
                    <div style="color:#a74fff;font-size:14px;font-weight:600;margin-top:6px;">${room.type === 'channel' ? t('Канал') : t('Группа')}</div>
                </div>

                ${room.description ? `
                <div style="width:100%; height:8px; background:rgba(0,0,0,0.2); flex-shrink:0;"></div>
                <div style="padding:15px 20px; flex-shrink:0;">
                    <div style="color:#a74fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${t('Описание')}</div>
                    <div style="color:#eee;font-size:14px;line-height:1.5;word-break:break-word;">${escapeHTML(room.description)}</div>
                </div>` : ''}

                ${membersListHtml}

                <div style="width:100%; height:8px; background:rgba(0,0,0,0.2); flex-shrink:0;"></div>
                <div style="padding:20px;display:flex;flex-direction:column;gap:10px; flex-shrink:0;">
                    ${isOwner ? `<button onclick="openRoomSettings('${escapeAttr(room.roomId)}')" style="width:100%;padding:14px;background:rgba(167,79,255,0.15);color:#a74fff;border:1px solid rgba(167,79,255,0.3);border-radius:14px;font-weight:700;cursor:pointer;font-size:14px;transition:0.2s;" onmouseover="this.style.background='rgba(167,79,255,0.25)'" onmouseout="this.style.background='rgba(167,79,255,0.15)'">${t('НАСТРОЙКИ')}</button>` : ''}
                    <button onclick="leaveRoom('${escapeAttr(room.roomId)}')" style="width:100%;padding:14px;background:rgba(255,77,77,0.15);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3);border-radius:14px;font-weight:700;cursor:pointer;font-size:14px;transition:0.2s;" onmouseover="this.style.background='rgba(255,77,77,0.25)'" onmouseout="this.style.background='rgba(255,77,77,0.15)'">${t('ПОКИНУТЬ')} ${room.type === 'channel' ? t('КАНАЛ') : t('ГРУППУ')}</button>
                </div>
            </div>
        `;
    } else {
        const isMe = userToShowLower === meLower;
        const isSystem = userToShowLower === '4send_system' || userToShowLower === '4send_help';
        const displayName = isMe ? `${t('Вы')} (${t('Избранное')})` : escapeHTML(data.displayName || userToShow);
        const usernameDisplay = isMe ? '' : (isSystem ? '' : `<span onclick="navigator.clipboard.writeText('@${escapeHTML(userToShow)}').then(() => { if(typeof showToast === 'function') showToast(t('Имя скопировано'), false); })" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">@${escapeHTML(userToShow)}</span>`);
        
        let statusText = t('был(а) недавно');
        let statusColor = '#777';
        
        if (isMe) {
            statusText = t('сохраненные сообщения');
        } else if (isSystem) {
            statusText = t('системный бот');
            statusColor = '#a74fff';
        } else if (data.is_blocked) {
            statusText = t('был(а) давно');
        } else {
            const isOn = typeof onlineUsers !== 'undefined' && Array.from(onlineUsers).some(u => String(u).toLowerCase() === userToShowLower);
            if (isOn) {
                statusText = t('в сети');
                statusColor = '#4caf50';
            } else if (data.last_seen) {
                const lastDate = new Date(data.last_seen);
                if (!isNaN(lastDate.getTime())) {
                    const now = new Date();
                    const isToday = lastDate.toDateString() === now.toDateString();
                    const timeStr = lastDate.toLocaleTimeString(globalLocale, { hour: '2-digit', minute: '2-digit' });
                    statusText = isToday ? `${t('был(а) в сети в')} ${timeStr}` : `${t('был(а) в сети')} ${lastDate.toLocaleDateString(globalLocale, { day: 'numeric', month: 'short' })} ${t('в')} ${timeStr}`;
                }
            }
        }

        const chatIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M12 3c5.5 0 10 4.5 10 10s-4.5 10-10 10c-1.7 0-3.3-.4-4.8-1.1l-4.2 1.1 1.1-4.2C3.4 17.3 3 15.7 3 13 3 7.5 7.5 3 12 3z"/></svg>`;
        const soundIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
        const muteIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6zM4.41 2.86L3 4.27l16.73 16.73 1.41-1.41L4.41 2.86z"/></svg>`;
        const deleteIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#ff4d4d;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        const moreIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;

        const avatarContent = isMe 
            ? `<div style="width:100%;height:100%;background:#a74fff;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" style="width:60%;height:60%;fill:white"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg></div>` 
            : (typeof getAvatarHtml === 'function' ? getAvatarHtml(data.displayName || userToShow, data.avatar, 100) : '');

        let userAvatarClick = '';
        let userAvatarCursor = 'default';
        if (!isMe && data.avatar) {
            let lightboxUrl = data.avatar;
            if (lightboxUrl.includes('res.cloudinary.com') && lightboxUrl.includes('/upload/')) {
                lightboxUrl = lightboxUrl.replace('/upload/', '/upload/q_auto,f_auto,w_1920,c_limit/');
            }
            userAvatarClick = `onclick="event.stopPropagation(); openLightbox('${escapeHTML(lightboxUrl)}')"`;
            userAvatarCursor = 'pointer';
        }

        contentHtml = `
            <div onclick="event.stopPropagation()" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;min-height:450px;max-height:85vh;overflow-y:auto;scrollbar-width:none;border-radius:24px;border:1px solid rgba(167,79,255,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;padding-bottom:10px;display:flex;flex-direction:column;">
                <button onclick="closeProfile()" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:#aaa;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.color='#aaa'">✕</button>
                
                <div style="padding:30px 20px 20px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div ${userAvatarClick} style="width:100px;height:100px;border-radius:50%;overflow:hidden;border:2px solid #a74fff;box-shadow:0 4px 15px rgba(167,79,255,0.3);margin-bottom:15px;cursor:${userAvatarCursor};">
                        ${avatarContent}
                    </div>
                    <div style="font-size:22px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px;text-align:center;line-height:1.2;justify-content:center;overflow:hidden;">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</span>${!isMe && data.isVerified ? (typeof getVerifyBadgeHtml === 'function' ? getVerifyBadgeHtml('user') : '') : ''}${isMuted ? (typeof mutedSvg !== 'undefined' ? mutedSvg : '') : ''}
                    </div>
                    ${usernameDisplay ? `<div style="color:#a74fff;font-size:14px;font-weight:600;margin-top:4px;">${usernameDisplay}</div>` : ''}
                    <div style="color:${statusColor};font-size:13px;margin-top:6px;">${statusText}</div>
                </div>

                ${(!isMe && !isSystem) ? `
                <div style="display:flex; justify-content:center; gap:8px; padding: 0 20px 20px; flex-shrink:0;">
                    <div onclick="closeProfile(); selectChat('${escapeAttr(userToShow)}')" style="flex:1; background:rgba(255,255,255,0.08); border-radius:14px; padding:10px 5px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        ${chatIcon}
                        <span style="color:#fff; font-size:12px; font-weight:500;">${t('Чат')}</span>
                    </div>
                    <div id="profile-mute-btn" onclick="toggleProfileMute('${escapeAttr(userToShow)}')" data-muted="${isMuted ? '1' : '0'}" style="flex:1; background:rgba(255,255,255,0.08); border-radius:14px; padding:10px 5px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        ${isMuted ? muteIcon : soundIcon}
                        <span style="color:#fff; font-size:12px; font-weight:500;">${t('Звук')}</span>
                    </div>
                    <div onclick="prepareDeleteChat('${escapeAttr(userToShow)}')" style="flex:1; background:rgba(255,255,255,0.08); border-radius:14px; padding:10px 5px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        ${deleteIcon}
                        <span style="color:#ff4d4d; font-size:12px; font-weight:500;">${t('Удалить')}</span>
                    </div>
                    <div id="profile-more-btn" onclick="openProfileMoreMenu(event, '${escapeAttr(userToShow)}', ${options.iBlockedHim ? 'true' : 'false'}, ${data.copyRestriction ? 'true' : 'false'}, ${data.forwardRestriction ? 'true' : 'false'})" style="flex:1; background:rgba(255,255,255,0.08); border-radius:14px; padding:10px 5px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        ${moreIcon}
                        <span style="color:#fff; font-size:12px; font-weight:500;">${t('Ещё')}</span>
                    </div>
                </div>` : ''}

                ${(!isMe && data.bio) ? `
                <div style="width:100%; height:8px; background:rgba(0,0,0,0.2); flex-shrink:0;"></div>
                <div style="padding:15px 20px; flex-shrink:0;">
                    <div style="color:#a74fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${t('О себе')}</div>
                    <div style="color:#eee;font-size:14px;line-height:1.5;word-break:break-word;">${escapeHTML(data.bio)}</div>
                </div>` : ''}

                <div id="profile-media-container" style="flex:1; display:flex; flex-direction:column; min-height: 200px;">
                    <div style="text-align:center; padding:20px; color:#888; font-size:13px;">${t('Загрузка медиа...')}</div>
                </div>
            </div>
        `;
    }

    modal.innerHTML = contentHtml;
    window.preloadedProfileUser = userToShowLower;
};

const originalFetch = window.fetch;
window.fetch = async function(resource, config = {}) {
    const token = localStorage.getItem('4send_token');
    if (typeof resource === 'string' && resource.startsWith('/')) {
        if (token) {
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${token}`
            };
        }
    }
    const response = await originalFetch(resource, config);
    
    if (response.status === 401 && typeof resource === 'string' && !resource.includes('/auth/')) {
        const authScreen = document.getElementById('auth-screen');
        const isAuthVisible = authScreen && authScreen.style.display !== 'none' && !authScreen.classList.contains('auth-exit');
        
        if (!isAuthVisible) {
            localStorage.removeItem('4send_token');
            
            if (authScreen) {
                authScreen.style.display = 'flex';
                authScreen.style.opacity = '1';
                authScreen.classList.remove('auth-exit');
            }
            const mainApp = document.getElementById('main-app');
            if (mainApp) {
                mainApp.style.display = 'none';
            }
        }
    }
    return response;
};


window.updateDrawerNameUI = function(displayName, username, isVer) {
    const drawerName = document.getElementById('drawer-name');
    if (!drawerName) return;
    
    const safeDName = escapeHTML(displayName);
    const safeUser = escapeHTML(username);
    const badge = isVer ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '') : '';
    
    const plusIcon = `<svg onclick="openMultiAccountModal()" viewBox="0 0 24 24" style="width:18px;height:18px;fill:#a74fff;cursor:pointer;margin-left:4px;transition:0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
    
    drawerName.style.display = 'flex';
    drawerName.style.alignItems = 'center';
    drawerName.style.overflow = 'hidden';
    drawerName.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;"><div style="display:flex;align-items:center;gap:4px;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeDName}</span>${badge}${plusIcon}</div><div style="font-size:12px;color:#888;font-weight:500;margin-top:2px;">@${safeUser}</div></div>`;
};

window.saveCurrentAccount = function() {
    const user = localStorage.getItem('4send_user');
    const token = localStorage.getItem('4send_token');
    if (!user || !token) return;
    
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('4send_accounts') || '[]'); } catch(e){}
    
    const avatar = localStorage.getItem('4send_avatar') || '';
    const displayName = localStorage.getItem('4send_displayName') || '';
    const isVerified = localStorage.getItem('4send_isVerified') || '0';
    
    const existingIdx = accounts.findIndex(a => a.username === user);
    const accData = { username: user, token, avatar, displayName, isVerified };
    
    if (existingIdx > -1) {
        accounts[existingIdx] = accData;
    } else {
        accounts.push(accData);
    }
    localStorage.setItem('4send_accounts', JSON.stringify(accounts));
};

window.switchAccount = function(username) {
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('4send_accounts') || '[]'); } catch(e){}
    const acc = accounts.find(a => a.username === username);
    if (acc) {
        localStorage.setItem('4send_user', acc.username);
        localStorage.setItem('4send_token', acc.token);
        if (acc.avatar) localStorage.setItem('4send_avatar', acc.avatar); else localStorage.removeItem('4send_avatar');
        if (acc.displayName) localStorage.setItem('4send_displayName', acc.displayName); else localStorage.removeItem('4send_displayName');
        localStorage.setItem('4send_isVerified', acc.isVerified || '0');
        location.reload();
    }
};

window.addNewAccount = function() {
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('4send_accounts') || '[]'); } catch(e){}
    if (accounts.length >= 5) {
        if (typeof showToast === 'function') showToast(t('Максимум 5 аккаунтов'), true);
        return;
    }
    localStorage.removeItem('4send_token');
    localStorage.removeItem('4send_user');
    localStorage.removeItem('4send_displayName');
    localStorage.removeItem('4send_avatar');
    localStorage.removeItem('4send_isVerified');
    location.reload();
};

window.removeAccount = function(e, username) {
    e.stopPropagation();
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('4send_accounts') || '[]'); } catch(e){}
    accounts = accounts.filter(a => a.username !== username);
    localStorage.setItem('4send_accounts', JSON.stringify(accounts));
    
    if (username === localStorage.getItem('4send_user')) {
        if (accounts.length > 0) {
            switchAccount(accounts[0].username);
        } else {
            if (typeof executeLogout === 'function') executeLogout();
            else {
                localStorage.clear();
                location.reload();
            }
        }
    } else {
        openMultiAccountModal(); 
    }
};

window.openMultiAccountModal = function() {
    typeof forceCloseMenu === 'function' && forceCloseMenu(true);
    const drawer = document.getElementById('menu-drawer');
    if(drawer) drawer.classList.remove('open');
    const ov = document.getElementById('overlay');
    if(ov) {
        ov.classList.remove('active');
        setTimeout(() => ov.style.display = 'none', 300);
    }
    
    if (typeof saveCurrentAccount === 'function') saveCurrentAccount();
    
    let modal = document.getElementById('multi-account-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'multi-account-modal';
        document.body.appendChild(modal);
    }
    
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('4send_accounts') || '[]'); } catch(e){}
    const currentUser = localStorage.getItem('4send_user');
    
    let accountsHtml = accounts.map(acc => {
        const isActive = acc.username === currentUser;
        const avatarHtml = typeof getAvatarHtml === 'function' ? getAvatarHtml(acc.displayName || acc.username, acc.avatar, 40) : '';
        return `
            <div onclick="${isActive ? '' : `switchAccount('${escapeAttr(acc.username)}')`}" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:${isActive ? 'rgba(167,79,255,0.15)' : 'rgba(255,255,255,0.05)'};border:1px solid ${isActive ? 'rgba(167,79,255,0.3)' : 'transparent'};border-radius:14px;margin-bottom:8px;cursor:${isActive ? 'default' : 'pointer'};transition:0.2s;">
                <div style="display:flex;align-items:center;gap:12px;overflow:hidden;">
                    <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;">${avatarHtml}</div>
                    <div style="display:flex;flex-direction:column;align-items:flex-start;overflow:hidden;">
                        <div style="color:#fff;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px;">
                            ${escapeHTML(acc.displayName || acc.username)}
                            ${acc.isVerified === '1' ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '') : ''}
                        </div>
                        <div style="color:#888;font-size:12px;">@${escapeHTML(acc.username)}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    ${isActive ? `<div style="width:8px;height:8px;background:#a74fff;border-radius:50%;box-shadow:0 0 8px #a74fff;"></div>` : ''}
                    <button onclick="removeAccount(event, '${escapeAttr(acc.username)}')" style="background:none;border:none;color:#ff4d4d;cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                        <svg viewBox="0 0 24 24" style="width:18px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    const animatedSvg = `
        <svg viewBox="0 0 100 100" style="width:60px;height:60px;margin:0 auto 15px;display:block;">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#a74fff" />
                    <stop offset="100%" stop-color="#6a11cb" />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#grad)" stroke-width="4" stroke-dasharray="283" stroke-dashoffset="283">
                <animate attributeName="stroke-dashoffset" values="283;0" dur="1.5s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1"/>
            </circle>
            <g transform="translate(50, 50) scale(0)">
                <animateTransform attributeName="transform" type="scale" values="0;1" dur="0.5s" begin="0.5s" fill="freeze" calcMode="spline" keySplines="0.34 1.56 0.64 1" keyTimes="0;1"/>
                <circle cx="0" cy="-10" r="12" fill="url(#grad)"/>
                <path d="M-20,20 Q0,0 20,20 L20,30 L-20,30 Z" fill="url(#grad)"/>
            </g>
        </svg>
    `;

    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.7)', zIndex: '110000', display: 'flex',
        alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
        opacity: '0', transition: 'all 0.3s ease'
    });

    modal.innerHTML = `
        <div style="background:#1c1c23; width:90%; max-width:360px; border-radius:24px; padding:24px; border:1px solid rgba(167,79,255,0.3); transform:scale(0.9); transition:all 0.3s ease; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            ${animatedSvg}
            <h3 style="color:#fff; margin:0 0 20px 0; font-family:'Inter',sans-serif; text-align:center; font-size:20px;">${t('Ваши аккаунты')}</h3>
            <div class="ep-content" style="max-height:300px; overflow-y:auto; scrollbar-width:none; margin-bottom:15px; padding:0;">
                ${accountsHtml}
            </div>
            ${accounts.length < 5 ? `
                <button onclick="addNewAccount()" style="width:100%; padding:14px; background:rgba(167,79,255,0.15); border:1px dashed #a74fff; border-radius:14px; color:#a74fff; font-weight:bold; cursor:pointer; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:10px;" onmouseover="this.style.background='rgba(167,79,255,0.25)'" onmouseout="this.style.background='rgba(167,79,255,0.15)'">
                    <svg viewBox="0 0 24 24" style="width:20px;fill:currentColor;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    ${t('Добавить аккаунт')}
                </button>
            ` : ''}
            <button onclick="closeMultiAccountModal()" style="width:100%; padding:14px; background:#2a2a3a; border:none; border-radius:14px; color:#eee; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#2a2a3a'">${t('ЗАКРЫТЬ')}</button>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);
};

window.closeMultiAccountModal = function() {
    const modal = document.getElementById('multi-account-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    }
};

window.openProfileMoreMenu = function(e, user, isBlocked, isRestricted, isForwardRestricted) {
    e.stopPropagation();
    let m = document.getElementById('profile-more-menu');
    if (m) {
        closeProfileMoreMenu();
        return;
    }
    
    m = document.createElement('div');
    m.id = 'profile-more-menu';
    Object.assign(m.style, {
        position: 'absolute', background: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100000, minWidth: '200px',
        opacity: '0', transform: 'scale(0.9) translateY(-10px)', transformOrigin: 'top right',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)'
    });
    
    const blockText = isBlocked ? t('Разблокировать') : t('Заблокировать');
    const blockColor = isBlocked ? '#4caf50' : '#ff4d4d';
    const blockIcon = isBlocked 
        ? `<svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>` 
        : `<svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`;
    
    m.innerHTML = `
        <div class="menu-item" onclick="event.stopPropagation(); toggleBlockUser('${escapeAttr(user)}'); closeProfileMoreMenu();" style="color:${blockColor}; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            ${blockIcon} ${blockText}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); openForwardInfoModal('${escapeAttr(user)}', ${isForwardRestricted}); closeProfileMoreMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
            ${t('Информация пересылки')}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); openCopyRestrictionModal('${escapeAttr(user)}', ${isRestricted}); closeProfileMoreMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path><line x1="3" y1="3" x2="21" y2="21"></line></svg>
            ${t('Запрет копирования')}
        </div>
    `;
    
    document.body.appendChild(m);
    const rect = e.currentTarget.getBoundingClientRect();
    m.style.top = (rect.bottom + 5) + 'px';
    m.style.left = (rect.right - 200) + 'px';
    
    requestAnimationFrame(() => {
        m.style.opacity = '1';
        m.style.transform = 'scale(1) translateY(0)';
    });

    setTimeout(() => {
        document.addEventListener('click', closeProfileMoreMenu, { once: true });
    }, 10);
};

window.closeProfileMoreMenu = function() {
    const m = document.getElementById('profile-more-menu');
    if (m) {
        m.style.opacity = '0';
        m.style.transform = 'scale(0.9) translateY(-10px)';
        setTimeout(() => m.remove(), 200);
    }
};

window.profileMediaCache = window.profileMediaCache || {};

window.renderProfileMedia = function(media, targetUser) {
    const container = document.getElementById('profile-media-container');
    if (!container) return;
    
    const hasMedia = media && (media.photos > 0 || media.videos > 0 || media.voices > 0 || media.music > 0 || media.files > 0);
    
    if (!hasMedia) {
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;color:#888;text-align:center;flex:1;">
                <svg viewBox="0 0 24 24" style="width:50px;height:50px;fill:none;stroke:#a74fff;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;margin-bottom:15px;animation:floatEmptyMedia 3s ease-in-out infinite;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <div style="font-size:14px;font-weight:500;color:#aaa;">${t('В чате еще нет медиа')}</div>
                <style>@keyframes floatEmptyMedia { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }</style>
            </div>
        `;
        return;
    }

    const mediaRow = (icon, count, forms, type) => count > 0 ? `
        <div onclick="event.stopPropagation(); openMediaGallery('${escapeAttr(type)}', '${escapeAttr(targetUser)}')" style="display:flex;align-items:center;gap:15px;padding:12px 20px;cursor:pointer;transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <div style="width:24px;display:flex;align-items:center;justify-content:center;color:#888;">${icon}</div>
            <div style="flex:1;color:#eee;font-size:15px;font-weight:500;">${pluralize(count, forms)}</div>
        </div>
    ` : '';

    container.innerHTML = `
        <div style="width:100%; height:8px; background:rgba(0,0,0,0.2); flex-shrink:0;"></div>
        <div style="display:flex;flex-direction:column;padding:10px 0; flex:1;">
            ${mediaRow(`<svg viewBox="0 0 24 24" style="width:22px;fill:currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`, media.photos, [t('фотография'), t('фотографии'), t('фотографий')], 'photos')}
            ${mediaRow(`<svg viewBox="0 0 24 24" style="width:22px;fill:currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`, media.videos, [t('видео'), t('видео'), t('видео')], 'videos')}
            ${mediaRow(`<svg viewBox="0 0 24 24" style="width:22px;fill:currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`, media.voices, [t('голосовое сообщение'), t('голосовых сообщения'), t('голосовых сообщений')], 'voices')}
            ${mediaRow(`<svg viewBox="0 0 24 24" style="width:22px;fill:currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`, media.music, [t('аудиозапись'), t('аудиозаписи'), t('аудиозаписей')], 'music')}
            ${mediaRow(`<svg viewBox="0 0 24 24" style="width:22px;fill:currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`, media.files, [t('файл'), t('файла'), t('файлов')], 'files')}
        </div>
    `;
};

window.openMediaGallery = async function(type, targetUser) {
    let modal = document.getElementById('media-gallery-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'media-gallery-modal';
        document.body.appendChild(modal);
    }
    
    const titles = {
        'photos': t('Фотографии'),
        'videos': t('Видео'),
        'voices': t('Голосовые сообщения'),
        'music': t('Аудиозаписи'),
        'files': t('Файлы')
    };

    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.7)', zIndex: '2147483647', display: 'flex',
        alignItems: 'center', justifyContent: 'center', opacity: '0', transition: 'opacity 0.3s ease'
    });
    
    modal.style.setProperty('z-index', '2147483647', 'important');
    modal.style.setProperty('-webkit-transform', 'translateZ(0)', 'important');

    modal.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px); width:90%; max-width:450px; height:80vh; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform:scale(0.9); transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); border:1px solid rgba(167,79,255,0.2);">
            <div style="display:flex;align-items:center;padding:15px 20px;background:transparent;border-bottom:1px solid rgba(255,255,255,0.05);z-index:10;">
                <button onclick="closeMediaGallery()" style="background:none;border:none;color:#aaa;cursor:pointer;display:flex;align-items:center;padding:0;margin-right:20px;transition:0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#aaa'">
                    <svg viewBox="0 0 24 24" style="width:24px;fill:currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
                <div style="color:#fff;font-size:18px;font-weight:600;flex:1;font-family:'Inter',sans-serif;">${titles[type]}</div>
                <button onclick="closeMediaGallery()" style="background:none;border:none;color:#aaa;cursor:pointer;display:flex;align-items:center;padding:0;transition:0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#aaa'">
                    <svg viewBox="0 0 24 24" style="width:24px;fill:currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div id="gallery-content" style="flex:1;overflow-y:auto;padding:0;scrollbar-width:none;background:transparent;">
                <div style="text-align:center;padding:20px;color:#888;">${t('Загрузка...')}</div>
            </div>
        </div>
    `;

    modal.onclick = closeMediaGallery;

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch(`/api/shared-media-list/${targetUser}?type=${type}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const items = await res.json();
        
        const content = document.getElementById('gallery-content');
        content.innerHTML = '';

        if (items.length === 0) {
            content.innerHTML = `<div style="text-align:center;padding:20px;color:#888;">${t('Пусто')}</div>`;
            return;
        }

        const grouped = {};
        const monthNames = [t("Январь"), t("Февраль"), t("Март"), t("Апрель"), t("Май"), t("Июнь"), t("Июль"), t("Август"), t("Сентябрь"), t("Октябрь"), t("Ноябрь"), t("Декабрь")];
        
        items.forEach(item => {
            const d = new Date(item.timestamp);
            const year = d.getFullYear();
            const currentYear = new Date().getFullYear();
            const monthStr = monthNames[d.getMonth()] + (year !== currentYear ? ' ' + year : '');
            
            if (!grouped[monthStr]) grouped[monthStr] = [];
            grouped[monthStr].push(item);
        });

        const playIcon = `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M8 5v14l11-7z"/></svg>`;
        const pauseIcon = `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

        for (const[month, monthItems] of Object.entries(grouped)) {
            const monthHeader = document.createElement('div');
            monthHeader.style = 'padding:15px 15px 10px 15px; color:#fff; font-weight:600; font-size:15px; position:sticky; top:0; background:rgba(42,38,51,0.8); backdrop-filter:blur(10px); z-index:2; font-family:"Inter",sans-serif;';
            monthHeader.innerText = month;
            content.appendChild(monthHeader);

            if (type === 'photos' || type === 'videos') {
                const grid = document.createElement('div');
                grid.style = 'display:grid;grid-template-columns:repeat(4, 1fr);gap:2px;padding:0 2px;';
                
                monthItems.forEach(item => {
                    const div = document.createElement('div');
                    div.style = 'aspect-ratio:1;background:#252530;position:relative;cursor:pointer;overflow:hidden;';
                    
                    if (type === 'photos') {
                        div.innerHTML = `<img src="${item.fileUrl}" style="width:100%;height:100%;object-fit:cover;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">`;
                        div.onclick = () => openLightbox(item.fileUrl);
                    } else {
                        div.innerHTML = `
                            <video src="${item.fileUrl}" style="width:100%;height:100%;object-fit:cover;"></video>
                            <div style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,0.5);border-radius:4px;padding:2px 4px;display:flex;align-items:center;gap:2px;color:#fff;font-size:10px;font-weight:bold;">
                                <svg viewBox="0 0 24 24" style="width:12px;fill:#fff;"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                            </div>
                        `;
                        div.onclick = () => openFullscreenVideo(item.fileUrl);
                    }

                    div.oncontextmenu = (e) => showGalleryContextMenu(e, item.id);
                    addLongPressEvent(div, (e) => showGalleryContextMenu(e, item.id));
                    
                    grid.appendChild(div);
                });
                content.appendChild(grid);
            } else {
                const list = document.createElement('div');
                list.style = 'padding: 0 10px;';
                monthItems.forEach(item => {
                    const div = document.createElement('div');
                    div.style = 'display:flex;align-items:center;gap:12px;padding:10px;background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:0.2s;';
                    div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.08)';
                    div.onmouseout = () => div.style.background = 'rgba(255,255,255,0.03)';
                    
                    let icon = '';
                    if (type === 'voices') {
                        icon = item.isVideoNote 
                            ? `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
                            : `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
                    }
                    else if (type === 'music') icon = `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
                    else icon = `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;

                    const date = new Date(item.timestamp).toLocaleDateString(globalLocale, {day:'numeric', month:'short'});
                    
                    let name = escapeHTML(item.fileName || t('Файл'));
                    if (type === 'voices') name = item.isVideoNote ? t('Видосообщение') : t('Голосовое сообщение');
                    if (type === 'music') name = escapeHTML(item.fileName || t('Аудиозапись'));

                    div.innerHTML = `
                        <div class="gallery-audio-ctrl" style="width:44px;height:44px;background:#a74fff;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 10px rgba(167,79,255,0.3);">${type === 'voices' || type === 'music' ? (item.isVideoNote ? icon : playIcon) : icon}</div>
                        <div style="flex:1;overflow:hidden;">
                            <div style="color:#eee;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                            <div style="color:#888;font-size:13px;margin-top:4px;">${date}</div>
                        </div>
                    `;
                    
                    if (type === 'voices' || type === 'music') {
                        div.onclick = (e) => {
                            if (item.isVideoNote) {
                                openFullscreenVideo(item.fileUrl);
                            } else {
                                let audio = div.querySelector('audio');
                                const iconDiv = div.querySelector('.gallery-audio-ctrl');
                                if (!audio) {
                                    audio = document.createElement('audio');
                                    audio.src = item.fileUrl;
                                    audio.onended = () => { iconDiv.innerHTML = playIcon; };
                                    div.appendChild(audio);
                                }
                                if (audio.paused) {
                                    document.querySelectorAll('#gallery-content audio').forEach(a => { 
                                        if(a !== audio) { 
                                            a.pause(); 
                                            const ctrl = a.parentElement.querySelector('.gallery-audio-ctrl');
                                            if(ctrl) ctrl.innerHTML = playIcon; 
                                        } 
                                    });
                                    audio.play();
                                    iconDiv.innerHTML = pauseIcon;
                                } else {
                                    audio.pause();
                                    iconDiv.innerHTML = playIcon;
                                }
                            }
                        };
                    } else {
                        div.onclick = () => window.open(item.fileUrl, '_blank');
                    }

                    div.oncontextmenu = (e) => showGalleryContextMenu(e, item.id);
                    addLongPressEvent(div, (e) => showGalleryContextMenu(e, item.id));

                    list.appendChild(div);
                });
                content.appendChild(list);
            }
        }
    } catch (e) {
        document.getElementById('gallery-content').innerHTML = `<div style="text-align:center;padding:20px;color:#ff4d4d;">${t('Ошибка загрузки')}</div>`;
    }
};

window.closeMediaGallery = function() {
    const modal = document.getElementById('media-gallery-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

function addLongPressEvent(element, callback) {
    let timer;
    element.addEventListener('touchstart', (e) => {
        timer = setTimeout(() => {
            callback(e.touches[0]);
        }, 500);
    }, {passive: true});
    element.addEventListener('touchend', () => clearTimeout(timer));
    element.addEventListener('touchmove', () => clearTimeout(timer));
}

window.showGalleryContextMenu = function(e, msgId) {
    e.preventDefault();
    e.stopPropagation();
    
    let m = document.getElementById('modern-menu');
    let wasOpen = !!m;
    if (!m) {
        m = document.createElement('div');
        m.id = 'modern-menu';
        document.body.appendChild(m);
    }
    if (!wasOpen) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    
    Object.assign(m.style, { position: 'fixed', display: 'block', zIndex: '2147483650', minWidth: '180px', background: 'rgba(23,23,30,0.98)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '6px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)', pointerEvents: 'auto' });
    
    m.innerHTML = `
        <div class="menu-item" onclick="jumpToMessage('${escapeAttr(msgId)}'); forceCloseMenu();">
            <svg viewBox="0 0 24 24" style="fill:#fff"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg> ${t('Перейти к сообщению')}
        </div>
    `;
    
    let posX = e.clientX || (e.touches && e.touches[0].clientX);
    let posY = e.clientY || (e.touches && e.touches[0].clientY);
    if (posX + 180 > window.innerWidth) posX = window.innerWidth - 180 - 10;
    if (posY + 60 > window.innerHeight) posY = window.innerHeight - 60 - 10;
    
    m.style.left = posX + 'px';
    m.style.top = posY + 'px';
    m.style.bottom = 'auto';
    
    m.style.opacity = '0.01';
    m.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        m.style.transition = 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)';
        Object.assign(m.style, { opacity: '1', transform: 'scale(1) translateY(0)' });
    }, 10);
};

window.jumpToMessage = function(msgId) {
    closeMediaGallery();
    closeProfile();
    
    setTimeout(() => {
        const msgEl = document.getElementById(`msg-${msgId}`);
        if (msgEl) {
            scrollToReply(msgId);
        } else {
            // Если сообщения нет в DOM, просто скроллим наверх, чтобы подгрузить историю
            // В идеале тут нужен сложный фетч, но пока просто покажем уведомление
            if (typeof showToast === 'function') showToast(t("Сообщение слишком далеко в истории. Пролистайте чат вверх."), false);
            const c = document.getElementById('msg-container');
            if (c) c.scrollTo({top: 0, behavior: 'smooth'});
        }
    }, 400);
};

window.toggleProfileMute = function(contact) {
    const btn = document.getElementById('profile-mute-btn');
    if (!btn) return;
    const isMuted = btn.getAttribute('data-muted') === '1';
    const newMuted = !isMuted;
    
    socket.emit('toggle_mute', { contact: contact, me: window.me });
    
    btn.setAttribute('data-muted', newMuted ? '1' : '0');
    
    const soundIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
    const muteIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#fff;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6zM4.41 2.86L3 4.27l16.73 16.73 1.41-1.41L4.41 2.86z"/></svg>`;
    
    btn.innerHTML = `
        ${newMuted ? muteIcon : soundIcon}
        <span style="color:#fff; font-size:12px; font-weight:500;">${t('Звук')}</span>
    `;
    
    const contactItem = document.querySelector(`.contact-item[data-username="${contact}"]`);
    if (contactItem) contactItem.setAttribute('data-muted', newMuted ? '1' : '0');
};

window.updateProfileBlockUI = function(contact) {
    const btn = document.getElementById('profile-block-btn');
    if (!btn) return;
    
    fetch(`/api/is-blocked/${me}/${contact}`).then(r=>r.json()).then(data => {
        const isBlocked = data.blocked;
        btn.setAttribute('data-blocked', isBlocked ? '1' : '0');
        
        const blockIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#ff4d4d;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`;
        const unblockIcon = `<svg viewBox="0 0 24 24" style="width:24px; fill:#4caf50;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
        
        btn.innerHTML = `
            ${isBlocked ? unblockIcon : blockIcon}
            <span style="color:${isBlocked ? '#4caf50' : '#ff4d4d'}; font-size:12px; font-weight:500;">${isBlocked ? t('Разблок.') : t('Блок')}</span>
        `;
    });
};

window.isProfileOpening = false;

async function showUserProfile(uName){
    if (window.isProfileOpening) return;
    let modal = document.getElementById('user-profile-modal');
    if (modal && modal.classList.contains('active')) return;
    
    const userToShow=uName||target;
    if(!userToShow||userToShow===t('Выберите чат')) return;
    
    window.isProfileOpening = true;
    
    const userToShowLower = String(userToShow).toLowerCase();
    const meLower = String(me || '').toLowerCase();

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'user-profile-modal';
        document.body.appendChild(modal);
    }

    let profileData = null;
    let isRoom = false;
    let iBlockedHim = false;

    if (userToShow.startsWith('room_')) {
        try {
            const res = await fetch(`/api/room/${userToShow}`);
            profileData = await res.json();
            isRoom = true;
        } catch {}
    } else {
        try {
            const token = localStorage.getItem('4send_token');
            const statusRes = await fetch(`/api/status/${userToShow}?me=${me}`, { headers: { 'Authorization': `Bearer ${token}` } });
            profileData = await statusRes.json();
            
            if(userToShowLower !== meLower){
                const blockRes = await fetch(`/api/is-blocked/${me}/${userToShow}`);
                const blockData = await blockRes.json();
                iBlockedHim = blockData.blocked;
            }
        } catch {}
    }

    if (!profileData) {
        window.isProfileOpening = false;
        return;
    }

    clearProfileModal();
    preloadProfileModal(userToShow, profileData, { isRoom, iBlockedHim });

    const content = modal.querySelector('div');

    modal.classList.remove('closing');
    Object.assign(modal.style,{display:'flex',opacity:'0',pointerEvents:'none',backdropFilter:'blur(0px)',webkitBackdropFilter:'blur(0px)'});
    if(content)Object.assign(content.style,{transform:'scale(0.85) translateY(30px)',opacity:'0',transition:'all 0.5s cubic-bezier(0.34,1.56,0.64,1)'});
    
    modal.onclick = (e) => { if (e.target === modal) closeProfile(); };

    void modal.offsetWidth;

    setTimeout(()=>{
        modal.classList.add('active');
        Object.assign(modal.style,{transition:'all 0.5s cubic-bezier(0.4,0,0.2,1)',opacity:'1',backdropFilter:'blur(12px)',webkitBackdropFilter:'blur(12px)',pointerEvents:'auto'});
        if(content)Object.assign(content.style,{opacity:'1',transform:'scale(1) translateY(0)'});
        const scrollWrapper=document.getElementById('scroll-down-wrapper');
        if(scrollWrapper){scrollWrapper.style.setProperty('opacity','0','important');scrollWrapper.style.setProperty('pointer-events','none','important');}
        typeof pushNavigationState==='function'&&pushNavigationState();
        window.isProfileOpening = false;
    },15);

    if (!isRoom) {
        if (window.profileMediaCache && window.profileMediaCache[userToShowLower]) {
            renderProfileMedia(window.profileMediaCache[userToShowLower], userToShow);
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const token = localStorage.getItem('4send_token');
            fetch(`/api/shared-media/${userToShow}`, { 
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            })
            .then(r => {
                clearTimeout(timeoutId);
                if (!r.ok) throw new Error('Server error');
                return r.json();
            })
            .then(mediaData => {
                if (!window.profileMediaCache) window.profileMediaCache = {};
                window.profileMediaCache[userToShowLower] = mediaData;
                renderProfileMedia(mediaData, userToShow);
            })
            .catch(() => {
                clearTimeout(timeoutId);
                renderProfileMedia({ photos: 0, videos: 0, voices: 0, music: 0, files: 0 }, userToShow);
            });
        }
    }
}
let tempEditRoomAvatarUrl = null;

async function openRoomSettings(roomId) {
    closeProfile();
    try {
        const res = await fetch(`/api/room/${roomId}`);
        const room = await res.json();
        tempEditRoomAvatarUrl = room.avatar;

        let modal = document.getElementById('room-settings-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'room-settings-modal';
            Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
            document.body.appendChild(modal);
        }

        let membersHtml = room.members.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="color:#eee; font-size:14px;">${m} ${m === room.owner ? `<span style="color:#a74fff; font-size:11px;">(${t('Владелец')})</span>` : ''}</span>
                ${m !== room.owner ? `<button onclick="removeRoomMember('${escapeAttr(roomId)}', '${escapeAttr(m)}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:12px;">${t('Удалить')}</button>` : ''}
            </div>
        `).join('');

        let requestsHtml = room.joinRequests && room.joinRequests.length > 0 ? room.joinRequests.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="color:#eee; font-size:14px;">${m}</span>
                <div style="display:flex; gap:5px;">
                    <button onclick="handleJoinRequest('${escapeAttr(roomId)}', '${escapeAttr(m)}', true)" style="background:rgba(76,175,80,0.2); border:none; color:#4caf50; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;">${t('Принять')}</button>
                    <button onclick="handleJoinRequest('${escapeAttr(roomId)}', '${escapeAttr(m)}', false)" style="background:rgba(255,77,77,0.2); border:none; color:#ff4d4d; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;">${t('Отклонить')}</button>
                </div>
            </div>
        `).join('') : `<div style="color:#777; font-size:13px; text-align:center; padding:10px 0;">${t('Нет заявок')}</div>`;

        const avatarContent = room.avatar 
            ? `<img src="${room.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<svg viewBox="0 0 24 24" style="width:30px; fill:#a74fff;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        let currentLink = room.publicLink;
        if (!currentLink && !room.isPublic) {
            currentLink = 'join_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        }

        modal.innerHTML = `
            <style>#room-settings-content::-webkit-scrollbar { display: none; }</style>
            <div id="room-settings-content" style="background: #1c1c23; width: 360px; max-height: 85vh; overflow-y: auto; scrollbar-width: none; padding: 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <h3 style="color: #fff; margin-bottom: 15px; font-family: 'Inter', sans-serif; text-align:center;">${t('Настройки')}</h3>

                <div id="edit-room-av-preview" onclick="document.getElementById('edit-room-av-input').click()" style="width:80px; height:80px; border-radius:50%; margin:0 auto 15px; background:rgba(167,79,255,0.1); border:${room.avatar ? 'none' : '2px dashed #a74fff'}; cursor:pointer; overflow:hidden; display:flex; align-items:center; justify-content:center; transition: transform 0.2s ease;">
                    ${avatarContent}
                </div>
                <input type="file" id="edit-room-av-input" hidden accept="image/*" onchange="uploadEditRoomAvatar(this)">

                <div style="margin-bottom: 15px; text-align:left;">
                    <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px;">${t('Название')}</label>
                    <input type="text" id="edit-room-name" maxlength="30" value="${escapeHTML(room.name)}" style="width: 100%; padding: 12px; margin-top:4px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); color: #fff; outline: none; box-sizing: border-box;">
                </div>

                <div style="margin-bottom: 15px; text-align:left;">
                    <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px;">${t('Описание')}</label>
                    <textarea id="edit-room-desc" maxlength="100" style="width: 100%; padding: 12px; margin-top:4px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); color: #fff; outline: none; box-sizing: border-box; resize: none; height: 60px;">${escapeHTML(room.description || '')}</textarea>
                </div>

                <div style="margin-bottom: 15px; text-align:left;">
                    <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px;">${t('Тип')}</label>
                    <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:12px; padding:4px; margin-top:4px; border:1px solid rgba(255,255,255,0.05);">
                        <div id="edit-btn-priv-private" onclick="setEditRoomPrivacy('private')" style="flex:1; padding:8px; border-radius:10px; background:${!room.isPublic ? '#a74fff' : 'transparent'}; color:${!room.isPublic ? '#fff' : '#888'}; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s; text-align:center;">${t('Частный')}</div>
                        <div id="edit-btn-priv-public" onclick="setEditRoomPrivacy('public')" style="flex:1; padding:8px; border-radius:10px; background:${room.isPublic ? '#a74fff' : 'transparent'}; color:${room.isPublic ? '#fff' : '#888'}; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s; text-align:center;">${t('Публичный')}</div>
                    </div>
                    <input type="hidden" id="edit-room-privacy-val" value="${room.isPublic ? 'public' : 'private'}">
                </div>

                <div id="edit-room-link-container" style="margin-bottom: 20px; text-align:left;">
                    <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px;">${t('Ссылка')}</label>
                    <div style="display:flex; align-items:center; margin-top:4px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); overflow:hidden;">
                        <input type="text" id="edit-room-link" maxlength="30" value="${escapeHTML(currentLink)}" ${!room.isPublic ? 'readonly' : ''} style="flex:1; padding: 12px; background: transparent; color: ${room.isPublic ? '#fff' : '#888'}; border: none; outline: none; box-sizing: border-box;">
                        <button onclick="copyRoomLink()" style="padding:0 15px; background:transparent; border:none; color:#a74fff; cursor:pointer; font-weight:bold;" title="${t('Копировать ссылку')}">
                            <svg viewBox="0 0 24 24" style="width:18px; fill:currentColor;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        </button>
                    </div>
                    <div style="font-size:10px; color:#777; margin-top:4px; margin-left:5px;">${room.isPublic ? t('Публичная ссылка для поиска') : t('Пригласительная ссылка')}</div>
                </div>

                <div style="margin-bottom: 20px; text-align:left;">
                    <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px; display:block;">${t('Заявки на вступление')}</label>
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 10px; max-height: 120px; overflow-y: auto; margin-top:4px;">
                        ${requestsHtml}
                    </div>
                </div>

                <div style="margin-bottom: 20px; text-align:left;">
                    <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px; display:block;">${t('Участники')} (${room.members.length})</label>
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 10px; max-height: 150px; overflow-y: auto; margin-top:4px;">
                        ${membersHtml}
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button onclick="saveRoomSettings('${escapeAttr(roomId)}')" style="flex: 1; padding: 12px; background: #a74fff; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer;">${t('СОХРАНИТЬ')}</button>
                    <button onclick="closeRoomSettings()" style="flex: 1; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer;">${t('ОТМЕНА')}</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('div#room-settings-content').style.transform = 'scale(1)';
        }, 10);
    } catch {}
}

function setEditRoomPrivacy(priv) {
    document.getElementById('edit-room-privacy-val').value = priv;
    document.getElementById('edit-btn-priv-private').style.background = priv === 'private' ? '#a74fff' : 'transparent';
    document.getElementById('edit-btn-priv-private').style.color = priv === 'private' ? '#fff' : '#888';
    document.getElementById('edit-btn-priv-public').style.background = priv === 'public' ? '#a74fff' : 'transparent';
    document.getElementById('edit-btn-priv-public').style.color = priv === 'public' ? '#fff' : '#888';
    
    const linkInput = document.getElementById('edit-room-link');
    if (priv === 'public') {
        linkInput.readOnly = false;
        linkInput.style.color = '#fff';
        document.querySelector('#edit-room-link-container div:last-child').innerText = t('Публичная ссылка для поиска');
    } else {
        linkInput.readOnly = true;
        linkInput.style.color = '#888';
        document.querySelector('#edit-room-link-container div:last-child').innerText = t('Пригласительная ссылка');
    }
}
async function uploadEditRoomAvatar(input) {
    if(!input.files?.[0]) return;
    showAvatarCropper(input.files[0], async (croppedFile) => {
        const fd = new FormData();
        fd.append('file', croppedFile);
        try {
            const token = localStorage.getItem('4send_token');
            const res = await fetch('/upload', {method: 'POST', headers:{'Authorization':`Bearer ${token}`}, body: fd});
            const d = await res.json();
            if(d.url) {
                tempEditRoomAvatarUrl = d.url;
                document.getElementById('edit-room-av-preview').innerHTML = `<img src="${d.url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
                document.getElementById('edit-room-av-preview').style.border = 'none';
            }
        } catch {}
    });
    input.value = '';
}
function copyRoomLink() {
    const link = document.getElementById('edit-room-link').value;
    if (!link) return;
    const fullLink = window.location.origin + '/?join=' + link;
    navigator.clipboard.writeText(fullLink).then(() => {
        showToast(t('Ссылка скопирована!'), false);
    });
}
function closeRoomSettings() {
    const modal = document.getElementById('room-settings-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('div').style.transform = 'scale(0.9)';
    setTimeout(() => modal.style.display = 'none', 300);
}
function saveRoomSettings(roomId) {
    const name = document.getElementById('edit-room-name').value.trim();
    const description = document.getElementById('edit-room-desc').value.trim();
    const isPublic = document.getElementById('edit-room-privacy-val').value === 'public';
    const publicLink = document.getElementById('edit-room-link').value.trim();

    if (!name) return showToast(t("Введите название"));
    if (isPublic && !publicLink) return showToast(t("Введите публичную ссылку"));
    if (isPublic && !/^[a-zA-Z_]+$/.test(publicLink)) return showToast(t("Ссылка может содержать только буквы и _"));

    socket.emit('update_room', { roomId, name, description, isPublic, publicLink, avatar: tempEditRoomAvatarUrl });
    closeRoomSettings();
    showToast(t("Настройки сохранены"), false);
}
function removeRoomMember(roomId, user) {
    socket.emit('remove_member', { roomId, user });
    setTimeout(() => openRoomSettings(roomId), 200);
}

function handleJoinRequest(roomId, user, approve) {
    socket.emit('handle_join_request', { roomId, user, approve });
    setTimeout(() => openRoomSettings(roomId), 200);
}
function getVerifyBadgeHtml(type) {
    let title = type === 'channel' ? t('Верифицированный канал') : (type === 'group' ? t('Верифицированная группа') : t('Верифицированный пользователь'));
    return `<svg title="${title}" style="width:15px;height:15px;fill:#a74fff;flex-shrink:0;margin-left:4px;display:block;" viewBox="0 0 24 24"><path d="M23 11.99l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 11.99l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 11.99zm-12.93 4.46l-3.53-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.65 5.66z"/></svg>`;
}
window.openAdminPanel = function() {
    let modal = document.getElementById('admin-modal');
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = 'admin-modal';
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: '#0f0f13', zIndex: '100000', display: 'flex', flexDirection: 'column',
        opacity: '0', transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'
    });

    modal.innerHTML = `
    <style>
        .admin-layout { display: flex; width: 100%; height: 100%; overflow: hidden; }
        .admin-sidebar { width: 260px; background: #15151a; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 20px; transition: 0.3s; }
        .admin-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0f0f13; }
        .admin-header { height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(15,15,19,0.8); backdrop-filter: blur(10px); }
        .admin-content { flex: 1; overflow-y: auto; padding: 30px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .admin-content::-webkit-scrollbar { width: 8px; display: block; }
        .admin-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 4px; }
        .admin-content::-webkit-scrollbar-thumb { background: rgba(167,79,255,0.5); border-radius: 4px; }
        .admin-content::-webkit-scrollbar-thumb:hover { background: rgba(167,79,255,0.8); }
        
        .admin-nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; color: #888; border-radius: 12px; cursor: pointer; transition: 0.2s; font-weight: 600; margin-bottom: 8px; }
        .admin-nav-item:hover { background: rgba(255,255,255,0.03); color: #eee; }
        .admin-nav-item.active { background: linear-gradient(135deg, rgba(167,79,255,0.15), rgba(106,17,203,0.15)); color: #a74fff; border: 1px solid rgba(167,79,255,0.3); }
        .admin-nav-item svg { width: 20px; height: 20px; fill: currentColor; }
        
        .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .admin-card { background: #15151a; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 24px; position: relative; overflow: hidden; transition: 0.3s; }
        .admin-card:hover { transform: translateY(-5px); border-color: rgba(167,79,255,0.3); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .admin-card-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        .admin-card-value { font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .admin-card-label { color: #888; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        
        .admin-section { display: none; animation: fadeIn 0.3s ease; }
        .admin-section.active { display: block; }
        
        .admin-table-container { background: #15151a; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; overflow: hidden; }
        .admin-table-header { display: grid; grid-template-columns: 2fr 1fr 1fr auto; padding: 16px 24px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05); color: #888; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .admin-table-row { display: grid; grid-template-columns: 2fr 1fr 1fr auto; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.02); align-items: center; transition: 0.2s; cursor: pointer; }
        .admin-table-row:hover { background: rgba(167,79,255,0.05); }
        .admin-table-row:last-child { border-bottom: none; }
        
        .admin-mobile-nav { display: none; }
        .admin-close-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .admin-close-btn:hover { background: rgba(255,77,77,0.2); color: #ff4d4d; border-color: rgba(255,77,77,0.4); }
        
        @media (max-width: 768px) {
            .admin-layout { flex-direction: column; }
            .admin-sidebar { display: none; }
            .admin-header { padding: 0 20px; height: 60px; }
            .admin-content { padding: 20px; }
            .admin-mobile-nav { display: flex; overflow-x: auto; padding: 15px 20px; background: #15151a; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 10px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
            .admin-mobile-nav::-webkit-scrollbar { display: none; }
            .admin-mobile-tab { flex-shrink: 0; padding: 8px 16px; border-radius: 20px; background: rgba(255,255,255,0.05); color: #888; font-size: 13px; font-weight: 600; white-space: nowrap; transition: 0.2s; }
            .admin-mobile-tab.active { background: #a74fff; color: #fff; }
            .admin-table-header { display: none; }
            .admin-table-row { grid-template-columns: 1fr auto; gap: 10px; }
            .admin-hide-mobile { display: none !important; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
    
    <div class="admin-layout">
        <div class="admin-sidebar">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:40px; padding:0 10px;">
                <div style="width:36px; height:36px; background:linear-gradient(135deg, #a74fff, #6a11cb); border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(167,79,255,0.4);">
                    <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#fff;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                </div>
                <div style="font-size:20px; font-weight:800; color:#fff; letter-spacing:1px;">4SEND</div>
            </div>
            
            <div class="admin-nav-item active" onclick="switchAdminTab('dashboard')">
                <svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                ${t('Главная')}
            </div>
            <div class="admin-nav-item" onclick="switchAdminTab('users')">
                <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-2.99 1.34-2.99 3S14.34 11 16 11zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5.01 6.34 5.01 8S6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                ${t('Пользователи')}
            </div>
            <div class="admin-nav-item" onclick="switchAdminTab('rooms')">
                <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                ${t('Каналы и Группы')}
            </div>
        </div>
        
        <div class="admin-main">
            <div class="admin-header">
                <h2 style="color:#fff; font-size:20px; font-weight:700; margin:0;" id="admin-header-title">${t('Главная')}</h2>
                <button class="admin-close-btn" onclick="closeAdminPanel()">
                    <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:currentColor;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            
            <div class="admin-mobile-nav">
                <div class="admin-mobile-tab active" onclick="switchAdminTab('dashboard')">${t('Главная')}</div>
                <div class="admin-mobile-tab" onclick="switchAdminTab('users')">${t('Пользователи')}</div>
                <div class="admin-mobile-tab" onclick="switchAdminTab('rooms')">${t('Каналы/Группы')}</div>
            </div>
            
            <div class="admin-content">
                <div id="admin-sec-dashboard" class="admin-section active">
                    <div class="admin-grid">
                        <div class="admin-card">
                            <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:radial-gradient(circle, rgba(167,79,255,0.2) 0%, transparent 70%); border-radius:50%;"></div>
                            <div class="admin-card-icon" style="background:rgba(167,79,255,0.15); color:#a74fff;">
                                <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-2.99 1.34-2.99 3S14.34 11 16 11zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5.01 6.34 5.01 8S6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                            </div>
                            <div class="admin-card-value" id="admin-stat-users">...</div>
                            <div class="admin-card-label">${t('Всего пользователей')}</div>
                            <div id="admin-stat-users-today" style="position:absolute; bottom:24px; right:24px; color:#4caf50; font-weight:bold; font-size:14px;"></div>
                        </div>
                        
                        <div class="admin-card">
                            <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:radial-gradient(circle, rgba(0,198,255,0.2) 0%, transparent 70%); border-radius:50%;"></div>
                            <div class="admin-card-icon" style="background:rgba(0,198,255,0.15); color:#00c6ff;">
                                <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                            </div>
                            <div class="admin-card-value" id="admin-stat-rooms">...</div>
                            <div class="admin-card-label">${t('Групп и Каналов')}</div>
                            <div id="admin-stat-rooms-today" style="position:absolute; bottom:24px; right:24px; color:#4caf50; font-weight:bold; font-size:14px;"></div>
                        </div>

                        <div class="admin-card">
                            <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:radial-gradient(circle, rgba(255,149,0,0.2) 0%, transparent 70%); border-radius:50%;"></div>
                            <div class="admin-card-icon" style="background:rgba(255,149,0,0.15); color:#ff9500;">
                                <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12zM7 9h10v2H7zm0 4h10v2H7z"/></svg>
                            </div>
                            <div class="admin-card-value" id="admin-stat-msgs-total">...</div>
                            <div class="admin-card-label">${t('Всего сообщений')}</div>
                            <div id="admin-stat-msgs" style="position:absolute; bottom:24px; right:24px; color:#4caf50; font-weight:bold; font-size:14px;"></div>
                        </div>
                        
                        <div class="admin-card">
                            <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; background:radial-gradient(circle, rgba(52,199,89,0.2) 0%, transparent 70%); border-radius:50%;"></div>
                            <div class="admin-card-icon" style="background:rgba(52,199,89,0.15); color:#34c759;">
                                <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            </div>
                            <div class="admin-card-value" id="admin-stat-online">...</div>
                            <div class="admin-card-label">${t('Пользователей онлайн')}</div>
                        </div>
                    </div>
                    
                    <div class="admin-charts" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:30px;">
                        <div class="admin-card" style="height:250px; padding:15px;"><canvas id="chart-users"></canvas></div>
                        <div class="admin-card" style="height:250px; padding:15px;"><canvas id="chart-rooms"></canvas></div>
                        <div class="admin-card" style="height:250px; padding:15px;"><canvas id="chart-msgs"></canvas></div>
                    </div>
                </div>
                
                <div id="admin-sec-users" class="admin-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="color:#fff; margin:0; font-size:16px;">${t('Список пользователей')}</h3>
                        <select id="admin-users-filter" onchange="applyAdminUsersFilter()" style="background:#15151a; color:#fff; border:1px solid rgba(167,79,255,0.3); padding:8px 12px; border-radius:10px; outline:none; cursor:pointer;">
                            <option value="all">${t('Все пользователи')}</option>
                            <option value="online">${t('В сети')}</option>
                            <option value="recent">${t('Сначала новые')}</option>
                            <option value="old">${t('Сначала старые')}</option>
                            <option value="avatar">${t('С аватаркой')}</option>
                            <option value="no_avatar">${t('Без аватарки')}</option>
                            <option value="admins">${t('Админы')}</option>
                            <option value="banned">${t('Забаненные')}</option>
                        </select>
                    </div>
                    <div class="admin-table-container">
                        <div class="admin-table-header">
                            <div>${t('Пользователь')}</div>
                            <div class="admin-hide-mobile">${t('Роль')}</div>
                            <div class="admin-hide-mobile">${t('Статус')}</div>
                            <div>${t('Действия')}</div>
                        </div>
                        <div id="admin-users-list">
                            <div style="padding:30px; text-align:center; color:#888;">${t('Загрузка...')}</div>
                        </div>
                    </div>
                </div>
                
                <div id="admin-sec-rooms" class="admin-section">
                    <div class="admin-table-container">
                        <div class="admin-table-header">
                            <div>${t('Название')}</div>
                            <div class="admin-hide-mobile">${t('Тип')}</div>
                            <div class="admin-hide-mobile">${t('Владелец')}</div>
                            <div>${t('Действия')}</div>
                        </div>
                        <div id="admin-rooms-list">
                            <div style="padding:30px; text-align:center; color:#888;">${t('Загрузка...')}</div>
                        </div>
                    </div>
                </div>
                
                <div id="admin-sec-details" class="admin-section">
                    <div id="admin-details-content"></div>
                </div>
                
            </div>
        </div>
    </div>
    `;
    
    document.body.appendChild(modal);
    
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
    
    loadAdminUsers();
    loadAdminRooms();
    
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => loadAdminStats();
        document.head.appendChild(script);
    } else {
        loadAdminStats();
    }
        
    typeof toggleMenu==='function'&&toggleMenu(false);
};

window.adminUsersData = [];
window.loadAdminUsers = async function() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    try {
        const res = await fetch(`/api/admin/users?me=${me}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('4send_token')}` } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.adminUsersData = await res.json();
        applyAdminUsersFilter();
    } catch (err) {
        list.innerHTML = `<div style="padding:30px; text-align:center; color:#ff4d4d;">${t('Ошибка')}: ${escapeHTML(err.message)}</div>`;
    }
};

window.applyAdminUsersFilter = function() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    const filter = document.getElementById('admin-users-filter')?.value || 'all';
    
    let users = [...(window.adminUsersData || [])];
    
    if (filter === 'online') users = users.filter(u => u.isOnline);
    else if (filter === 'avatar') users = users.filter(u => u.avatar);
    else if (filter === 'no_avatar') users = users.filter(u => !u.avatar);
    else if (filter === 'admins') users = users.filter(u => u.role === 'admin');
    else if (filter === 'banned') users = users.filter(u => u.role === 'banned');
    
    if (filter === 'recent') {
        users.sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0));
    } else if (filter === 'old') {
        users.sort((a, b) => new Date(a.last_seen || 0) - new Date(b.last_seen || 0));
    }
    
    list.innerHTML = '';
    if (users.length === 0) {
        list.innerHTML = `<div style="padding:30px; text-align:center; color:#888;">${t('Список пуст')}</div>`;
        return;
    }
    
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'admin-table-row';
        div.onclick = () => openAdminUserDetails(u.username);
        
        const safeName = escapeHTML(u.username);
        const badge = u.isVerified ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '✔️') : '';
        const avatar = typeof getAvatarHtml === 'function' ? getAvatarHtml(u.username, u.avatar, 36) : '';
        const roleText = u.role === 'banned' ? `<span style="color:#ff4d4d;background:rgba(255,77,77,0.1);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Забанен')}</span>` : (u.role === 'admin' ? `<span style="color:#a74fff;background:rgba(167,79,255,0.1);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Админ')}</span>` : `<span style="color:#888;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Пользователь')}</span>`);

        let statusText = '';
        if (u.isOnline) {
            statusText = `<span style="color:#4caf50;font-size:12px;font-weight:600;">${t('В сети')}</span>`;
        } else {
            const lastSeen = u.last_seen ? new Date(u.last_seen).toLocaleString(globalLocale, {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : t('Неизвестно');
            statusText = `<span style="color:#888;font-size:12px;font-weight:600;">${t('Был(а):')} ${lastSeen}</span>`;
        }

        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;overflow:hidden;">
                <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:1px solid ${u.isVerified?'#a74fff':'#333'};flex-shrink:0;">${avatar}</div>
                <div style="color:#eee;font-weight:600;font-size:14px;display:flex;align-items:center;overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeName}</span>${badge}</div>
            </div>
            <div class="admin-hide-mobile">${roleText}</div>
            <div class="admin-hide-mobile">${statusText}</div>
            <div style="color:#a74fff;font-size:13px;font-weight:600;">${t('Детали')} ›</div>
        `;
        list.appendChild(div);
    });
};

function leaveRoom(roomId) {
    socket.emit('leave_room', roomId);
    closeProfile();
    if (target === roomId) {
        document.getElementById('msg-container').innerHTML = '';
        if (window.innerWidth <= 768) {
            closeChatMobile();
        } else {
            resetToHome();
        }
    }
    const chatEl = document.querySelector(`.contact-item[data-username="${roomId}"]`);
    if (chatEl) chatEl.remove();
    showToast(t("Вы покинули группу/канал"), false);
}
async function previewRoom(roomId) {
    const myUser = window.me || localStorage.getItem('4send_user');
    if (!myUser) {
        closeRoomPreview();
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) {
            authScreen.style.display = 'flex';
            authScreen.style.opacity = '1';
            authScreen.classList.remove('auth-exit');
        }
        const mainApp = document.getElementById('main-app');
        if (mainApp) mainApp.style.display = 'none';
        if (typeof showToast === 'function') showToast(t("Сначала войдите в аккаунт"), true);
        return;
    }

    try {
        const res = await fetch(`/api/room/${roomId}`);
        const room = await res.json();

        if (res.status === 403 || room.error) {
            let modal = document.getElementById('room-preview-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'room-preview-modal';
                Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div style="background: #1c1c23; width: 320px; padding: 30px 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 15px auto; overflow: hidden; border: 2px solid #a74fff; display:flex; align-items:center; justify-content:center; background:rgba(167,79,255,0.1);">
                        <svg viewBox="0 0 24 24" style="width:40px; fill:#a74fff;"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9V6z"/></svg>
                    </div>
                    <h3 style="color: #fff; margin-bottom: 5px; font-family: 'Inter', sans-serif; font-size: 20px;">${t('Частная группа/канал')}</h3>
                    <div style="color: #aaa; font-size: 13px; line-height: 1.4; margin-bottom: 20px; padding: 0 10px;">${t('Для вступления необходимо подать заявку.')}</div>
                    <div style="display: flex; gap: 10px; flex-direction: column;">
                        <button onclick="joinOrRequestRoom('${escapeAttr(roomId)}', false)" style="width: 100%; padding: 14px; background: #a74fff; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${t('ПОДАТЬ ЗАЯВКУ')}</button>
                        <button onclick="closeRoomPreview()" style="width: 100%; padding: 14px; background: transparent; border: none; color: #777; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#eee'" onmouseout="this.style.color='#777'">${t('ОТМЕНА')}</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.style.opacity = '1';
                modal.querySelector('div').style.transform = 'scale(1)';
            }, 10);
            return;
        }

        if (room.members.includes(me)) {
            selectChat(roomId, room.name, true, room.type);
            return;
        }

        let modal = document.getElementById('room-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'room-preview-modal';
            Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
            document.body.appendChild(modal);
        }

        const isRequested = room.joinRequests && room.joinRequests.includes(me);

        modal.innerHTML = `
            <div style="background: #1c1c23; width: 320px; padding: 30px 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <div style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 15px auto; overflow: hidden; border: 2px solid #a74fff;">
                    ${getAvatarHtml(room.name, room.avatar, 80)}
                </div>
                <h3 style="color: #fff; margin-bottom: 5px; font-family: 'Inter', sans-serif; font-size: 20px; display:flex; align-items:center; justify-content:center; gap:5px; overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(room.name)}</span>${room.isVerified ? getVerifyBadgeHtml(room.type) : ''}</h3>
                <div style="color: #a74fff; font-size: 13px; font-weight: 600; margin-bottom: 10px;">${room.type === 'channel' ? t('Канал') : t('Группа')} • ${room.members.length} ${t('участников')}</div>
                ${room.description ? `<div style="color: #aaa; font-size: 13px; line-height: 1.4; margin-bottom: 20px; padding: 0 10px;">${escapeHTML(room.description)}</div>` : '<div style="margin-bottom: 20px;"></div>'}
                
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    ${isRequested ? 
                        `<button disabled style="width: 100%; padding: 14px; background: rgba(167,79,255,0.2); border: 1px solid #a74fff; border-radius: 14px; color: #a74fff; font-weight: bold; cursor: not-allowed;">${t('ЗАЯВКА ОТПРАВЛЕНА')}</button>` :
                        `<button onclick="joinOrRequestRoom('${escapeAttr(roomId)}', ${room.isPublic})" style="width: 100%; padding: 14px; background: #a74fff; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${room.isPublic ? t('ПРИСОЕДИНИТЬСЯ') : t('ПОДАТЬ ЗАЯВКУ')}</button>`
                    }
                    <button onclick="closeRoomPreview()" style="width: 100%; padding: 14px; background: transparent; border: none; color: #777; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#eee'" onmouseout="this.style.color='#777'">${t('ОТМЕНА')}</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('div').style.transform = 'scale(1)';
        }, 10);
    } catch {}
}


function closeRoomPreview() {
    const modal = document.getElementById('room-preview-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('div').style.transform = 'scale(0.9)';
    setTimeout(() => modal.style.display = 'none', 300);
}

function joinOrRequestRoom(roomId, isPublic) {
    if (isPublic) {
        socket.emit('join_public_room', roomId);
        showToast(t("Вы присоединились!"), false);
        closeRoomPreview();
        setTimeout(() => selectChat(roomId, null, true), 300);
    } else {
        socket.emit('request_join_room', roomId);
        showToast(t("Заявка отправлена"), false);
        closeRoomPreview();
    }
}
async function toggleBlockUser(username){
    const userToBlock = username || target;
    if(!userToBlock) return;
    
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/toggle-block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ me, target: userToBlock })
        });
        
        const data = await res.json();
        showToast(data.status === 'blocked' ? t("Пользователь заблокирован") : t("Пользователь разблокирован"), data.status === 'blocked');
        
        if (window.preloadedProfileUser === userToBlock.toLowerCase()) {
            window.preloadedProfileUser = null;
            if (typeof showUserProfile === 'function') {
                showUserProfile(userToBlock);
            }
        }
        
        if (target === userToBlock.toLowerCase()) {
            const msgInput = document.getElementById('messageText');
            const sendBtn = document.querySelector('button[onclick="send()"]');
            
            if (data.status === 'blocked') {
                if(msgInput) {
                    msgInput.disabled = true;
                    msgInput.placeholder = t("Отправка сообщений ограничена");
                    msgInput.style.opacity = "0.5";
                    msgInput.value = "";
                }
                if(sendBtn) Object.assign(sendBtn.style, {pointerEvents: "none", opacity: "0.5"});
            } else {
                if(msgInput) {
                    msgInput.disabled = false;
                    msgInput.placeholder = t("Написать...");
                    msgInput.style.opacity = "1";
                }
                if(sendBtn) Object.assign(sendBtn.style, {pointerEvents: "auto", opacity: "1"});
            }
        }
        
        loadChatsWithPreview();
    } catch (e) {
        showToast(t("Ошибка соединения с сервером"), true);
    }
}
async function loadChatsWithPreview() {
    if (window.isChatLoading) return;
    if (!window.me) window.me = localStorage.getItem('4send_user');
    if (!window.me) { setTimeout(loadChatsWithPreview, 100); return; }
    
    const parseDate = (ts) => {
        if (!ts || ts === 'null') return 0;
        let d = new Date(ts);
        if (isNaN(d.getTime())) d = new Date(ts.replace(' ', 'T'));
        if (isNaN(d.getTime())) d = new Date(ts.replace(' ', 'T') + 'Z');
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const renderChats = (chatsArray) => {
        if (!Array.isArray(chatsArray)) return;

        if (!window.chatSettings) window.chatSettings = {};
        chatsArray.forEach(c => {
            if (!window.chatSettings[c.username]) window.chatSettings[c.username] = {};
            window.chatSettings[c.username].copyRestriction = c.copyRestriction;
        });

        const uniqueChats = new Map();
        chatsArray.forEach(chat => {
            const existing = uniqueChats.get(chat.username);
            if (!existing) {
                uniqueChats.set(chat.username, chat);
            } else {
                const existingTime = parseDate(existing.timestamp);
                const newTime = parseDate(chat.timestamp);
                if (newTime > existingTime) {
                    uniqueChats.set(chat.username, chat);
                }
            }
        });

        let chats = Array.from(uniqueChats.values()).filter(c => typeof viewingArchive !== 'undefined' && viewingArchive ? c.is_archived : !c.is_archived);
        
        const container = document.getElementById('contacts');
        if (!container) return;

        Array.from(container.children).forEach(child => {
            if (child.getAttribute('data-search') === 'true' || !child.classList.contains('contact-item') || !child.querySelector('.avatar-box')) {
                child.remove();
            }
        });

        chats.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return (b.is_pinned || 0) - (a.is_pinned || 0);
            const tA = parseDate(a.timestamp);
            const tB = parseDate(b.timestamp);
            if (tB !== tA) return tB - tA;
            return a.username.localeCompare(b.username);
        });
        
        if (chats.length === 0) {
            if (typeof viewingArchive !== 'undefined' && viewingArchive) {
                container.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:40px 20px; color:#888; text-align:center;"><svg viewBox="0 0 24 24" style="width:64px; height:64px; fill:none; stroke:#a74fff; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; margin-bottom:15px; animation: floatAnim 3s ease-in-out infinite;"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"></path></svg><div style="font-size:14px; font-weight:500; color:#aaa;">${t('В архиве никого нет')}</div><style>@keyframes floatAnim {0%, 100% { transform: translateY(0); }50% { transform: translateY(-10px); }}</style></div>`;
            } else {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:40px 20px; color:#888; text-align:center;">
                        <div style="position:relative; margin-bottom:20px;">
                            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:80px; height:80px; background:radial-gradient(circle, rgba(167,79,255,0.2) 0%, transparent 70%); animation: pulseBg 3s infinite ease-in-out; border-radius:50%;"></div>
                            <svg viewBox="0 0 24 24" style="position:relative; z-index:1; width:72px; height:72px; fill:none; stroke:#a74fff; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; animation: floatChat 3s ease-in-out infinite; filter: drop-shadow(0 4px 8px rgba(167,79,255,0.3));">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                <line x1="9" y1="9" x2="15" y2="9" stroke-linecap="round"></line>
                                <line x1="9" y1="13" x2="13" y2="13" stroke-linecap="round"></line>
                            </svg>
                        </div>
                        <div style="font-size:16px; font-weight:600; color:#eee; margin-bottom:6px; letter-spacing:0.5px;">${t('У вас пока нет чатов')}</div>
                        <div style="font-size:13px; color:#888; max-width:200px; line-height:1.4;">${t('Воспользуйтесь поиском, чтобы найти друзей и начать общение')}</div>
                        <style>
                            @keyframes floatChat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                            @keyframes pulseBg { 0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); } }
                        </style>
                    </div>
                `;
            }
            return;
        }

        const meLower = String(me).toLowerCase();
        const targetLower = String(typeof target !== 'undefined' ? target : '').toLowerCase();
        
        const currentNodes = Array.from(container.children);
        const currentMap = new Map();
        currentNodes.forEach(node => {
            const username = node.getAttribute('data-username');
            if (username) currentMap.set(username, node);
        });

        let needsReorder = false;
        if (currentNodes.length !== chats.length) {
            needsReorder = true;
        } else {
            for (let i = 0; i < chats.length; i++) {
                if (currentNodes[i].getAttribute('data-username') !== chats[i].username) {
                    needsReorder = true;
                    break;
                }
            }
        }

        chats.forEach((chat, index) => {
            const chatUserLower = String(chat.username).toLowerCase();
            const isSaved = chatUserLower === meLower;
            const isActive = chatUserLower === targetLower;
            const isOn = typeof onlineUsers !== 'undefined' && Array.from(onlineUsers).some(u => String(u).toLowerCase() === chatUserLower);
            const isPinned = chat.is_pinned === 1;
            const amIBlocked = chat.is_blocked_me === 1;
            const isMuted = chat.is_muted === 1;
            const iBlockedHim = chat.i_blocked_him === 1;
            
            let timeStr = "";
            if (chat.timestamp && chat.timestamp !== 'null' && !amIBlocked) {
                let date = new Date(chat.timestamp);
                if (isNaN(date.getTime())) date = new Date(chat.timestamp.replace(' ', 'T'));
                if (isNaN(date.getTime())) date = new Date(chat.timestamp.replace(' ', 'T') + 'Z');
                
                if (!isNaN(date.getTime())) {
                    const now = new Date();
                    if (date.toDateString() === now.toDateString()) {
                        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        timeStr = date.toLocaleDateString(globalLocale, { day: '2-digit', month: '2-digit' });
                    }
                }
            }

            let displayPreview = chat.lastText || "";
            if (typeof clarify === 'function') displayPreview = clarify(displayPreview);
            let isMediaPreview = false;
            
            if (displayPreview.includes('Переслано от') || displayPreview.includes('Forwarded from') || displayPreview.startsWith('📂')) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>${t('Пересланное сообщение')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastIsVideoNote) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('📹 Видеосообщение')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastIsMusic || chat.lastFileUrl?.toLowerCase().endsWith('.mp3')) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>${t('Аудиозапись')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastIsAudio) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>${t('Голосовое сообщение')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastCallType) {
                const isMissed = chat.lastCallType === 'missed';
                const isRejected = chat.lastCallType === 'rejected';
                const callColor = (isMissed || isRejected) ? '#ff4d4d' : '#a74fff';
                const label = isMissed ? t('Пропущенный звонок') : isRejected ? t('Отклонённый звонок') : t('Исходящий звонок');
                const callIcon = chat.lastCallWithVideo
                    ? `<svg style="width:14px;height:14px;fill:${callColor}" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
                    : `<svg style="width:14px;height:14px;fill:${callColor}" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom">${callIcon}${label}</span>`;
                isMediaPreview = true;
            } else if (chat.lastFileUrl) {
                const extMatch = chat.lastFileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
                const ext = extMatch ? extMatch[1].toLowerCase() : '';
                const isGif = ext === 'gif' || displayPreview === "GIF";
                const isSticker = displayPreview === t('Стикер');
                const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) && !isSticker;
                const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
                
                if (isGif) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>GIF</span>`;
                    isMediaPreview = true;
                } else if (isSticker) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg>${t('Стикер')}</span>`;
                    isMediaPreview = true;
                } else if (isImage) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>${t('Фотография')}</span>`;
                    isMediaPreview = true;
                } else if (isVideo) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('Видео')}</span>`;
                    isMediaPreview = true;
                } else {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${escapeHTML(chat.lastFileName || t('📁 Файл'))}</span>`;
                    isMediaPreview = true;
                }
            }
            if (!isMediaPreview && displayPreview !== "Сохраненные сообщения") {
                displayPreview = escapeHTML(displayPreview);
            }
            let senderPrefix = "";
            if (!amIBlocked && chat.lastSender) {
                const isLastSenderMe = String(chat.lastSender).toLowerCase() === meLower;
                if (chat.username === '4send_system' || chat.lastCallType) {
                    senderPrefix = "";
                } else if (chat.isRoom && chat.roomType !== 'channel') {
                    senderPrefix = `<span style="color:#a74fff">${isLastSenderMe ? t("Вы") : escapeHTML(chat.lastSender)}: </span>`;
                } else if (!chat.isRoom) {
                    senderPrefix = `<span style="color:#a74fff">${isLastSenderMe ? t("Вы") : escapeHTML(chat.lastSender)}: </span>`;
                }
            }

            const draftText = localStorage.getItem('4send_draft_' + chat.username);
            if (draftText && chatUserLower !== targetLower) {
                displayPreview = `<span style="color:#ff4d4d; font-weight:600;">${t('Черновик:')}</span> ${escapeHTML(draftText)}`;
                senderPrefix = "";
            }

            const unreadBadge = chat.unreadCount > 0 && !isSaved && !amIBlocked ? `<div class="${isMuted ? 'unread-badge muted-badge' : 'unread-badge'}">${chat.unreadCount}</div>` : '';
            const pinIcon = isPinned ? `<svg style="width:12px;height:12px;fill:#a74fff;margin-left:5px" viewBox="0 0 24 24"><path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z"/></svg>` : '';
            const avatarHtml = isSaved ? (typeof savedIconSvg !== 'undefined' ? savedIconSvg : '') : getAvatarHtml(chat.displayName || chat.username, amIBlocked ? null : chat.avatar, 48);
            const borderCol = isSaved ? '#a74fff' : amIBlocked ? '#333' : (isOn && !chat.isRoom) ? '#4caf50' : '#333';
            
            const contactNameHtml = `${isSaved ? t('Избранное') : escapeHTML(chat.displayName || chat.username)}${!isSaved && chat.isVerified ? getVerifyBadgeHtml(chat.isRoom ? chat.roomType : 'user') : ''}${isMuted ? typeof mutedSvg !== 'undefined' ? mutedSvg : '' : ''}`;
            
            let div = currentMap.get(chat.username);
            if (!div) {
                div = document.createElement('div');
                div.className = 'contact-item';
                div.onclick = () => selectChat(chat.username, chat.displayName, chat.isRoom, chat.roomType, chat.roomOwner);
                div.innerHTML = `<div class="avatar-box" style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid transparent;flex-shrink:0;transition:.3s"></div><div class="info-box" style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:2px"></div>`;
                if (needsReorder) {
                    container.appendChild(div);
                }
            } else {
                currentMap.delete(chat.username);
            }

            div.style.padding = '12px 15px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #1a1a24';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '12px';
            div.style.background = isActive ? 'rgba(167,79,255,0.15)' : 'transparent';

            if (!div.hasAttribute('data-rendered')) {
                div.style.animationDelay = `${index * 20}ms`;
                div.setAttribute('data-rendered', 'true');
            }

            div.setAttribute('data-username', chat.username);
            div.setAttribute('data-display', chat.displayName || chat.username);
            div.setAttribute('data-pinned', isPinned ? '1' : '0');
            div.setAttribute('data-muted', isMuted ? '1' : '0');
            div.setAttribute('data-archived', chat.is_archived === 1 ? '1' : '0');
            div.setAttribute('data-i-blocked', iBlockedHim ? '1' : '0');
            div.setAttribute('data-is-room', chat.isRoom ? '1' : '0');
            div.setAttribute('data-room-type', chat.roomType || '');
            div.setAttribute('data-room-owner', chat.roomOwner || '');
            div.setAttribute('data-restricted', chat.copyRestriction ? '1' : '0');

            const avBox = div.querySelector('.avatar-box');
            const infoBox = div.querySelector('.info-box');

            avBox.style.borderColor = borderCol;
            if (avBox.innerHTML !== avatarHtml) avBox.innerHTML = avatarHtml;

            const newInfoHtml = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:10px;display:flex;align-items:center;">${contactNameHtml}</b><small style="color:#555;font-size:11px;flex-shrink:0">${amIBlocked ? '' : timeStr}</small></div><div style="display:flex;justify-content:space-between;align-items:center"><div id="preview-${chat.username.toLowerCase()}" style="color:#777;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${amIBlocked ? t('был(а) давно') : senderPrefix + displayPreview}</div><div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:8px">${pinIcon}${unreadBadge}</div></div>`;
            
            if (infoBox.innerHTML !== newInfoHtml) infoBox.innerHTML = newInfoHtml;

            if (needsReorder && container.children[index] !== div) {
                container.insertBefore(div, container.children[index]);
            }
        });

        currentMap.forEach(node => node.remove());
    };
    
    const container = document.getElementById('contacts');
    const hasContacts = container && container.children.length > 0;
    const cacheKey = '4send_chats_cache_' + window.me;
    
    if (!hasContacts) {
        try { 
            const cachedData = await idbGet(cacheKey); 
            if (cachedData) {
                const targetLower = String(typeof target !== 'undefined' ? target : '').toLowerCase();
                const activeChat = cachedData.find(c => c.username.toLowerCase() === targetLower);
                if (activeChat) activeChat.unreadCount = 0;
                renderChats(cachedData);
                updateAppBadge();
            }
        } catch (e) {}
    }
    
    await new Promise(r => setTimeout(r, 50));
    try {
        const res = await fetch(`/chats-extended/${me}?t=${Date.now()}`);
        let chats = await res.json();
        if (!Array.isArray(chats)) return;
        try { await idbSet(cacheKey, chats); } catch (e) {}
        renderChats(chats);
        updateAppBadge();
        
        const loader = document.getElementById('global-loader');
        if (loader && loader.style.opacity !== '0') {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.visibility = 'hidden', 600);
        }

        if (!window._historyPreloaded) {
            window._historyPreloaded = true;
            setTimeout(() => {
                const topChats = chats.slice(0, 10);
                Promise.all(topChats.map(async (chat) => {
                    const u1 = String(me).toLowerCase();
                    const u2 = String(chat.username).toLowerCase();
                    const chatCacheKey = 'history_' + u2;
                    
                    let cached = await idbGet(chatCacheKey) || [];
                    let sinceIdParam = '';
                    if (cached.length > 0) {
                        const lastCachedMsg = cached[cached.length - 1];
                        if (lastCachedMsg && lastCachedMsg.id) {
                            sinceIdParam = `&sinceId=${lastCachedMsg.id}`;
                        }
                    }

                    try {
                        const hRes = await fetch(`/history/${encodeURIComponent(u1)}/${encodeURIComponent(u2)}?t=${Date.now()}${sinceIdParam}`, {
                            headers: {'Authorization': `Bearer ${localStorage.getItem('4send_token')}`}
                        });
                        const newMsgs = await hRes.json();
                        if (Array.isArray(newMsgs) && newMsgs.length > 0) {
                            const uniqueMsgs = new Map();
                            cached.forEach(m => uniqueMsgs.set(m.id, m));
                            newMsgs.forEach(m => uniqueMsgs.set(m.id, m));
                            const mergedMsgs = Array.from(uniqueMsgs.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                            await idbSet(chatCacheKey, mergedMsgs);
                        }
                    } catch {}
                }));
            }, 1500);
        }
    } catch {}
}

const _originalUpdateSidebarPreview = window.updateSidebarPreview;
window.updateSidebarPreview = function(chatId, msgData, isNewMessage = true) {
    if (window.isChatLoading) {
        isNewMessage = false;
    }
    if (_originalUpdateSidebarPreview) {
        _originalUpdateSidebarPreview.call(this, chatId, msgData, isNewMessage);
    }
};


const _originalLoadChatsWithPreview = window.loadChatsWithPreview;
window.loadChatsWithPreview = async function(...args) {
    if (window.isChatLoading) return;
    if (!window.me) window.me = localStorage.getItem('4send_user');
    if (!window.me) { setTimeout(loadChatsWithPreview, 100); return; }
    
    const parseDate = (ts) => {
        if (!ts || ts === 'null') return 0;
        let d = new Date(ts);
        if (isNaN(d.getTime())) d = new Date(ts.replace(' ', 'T'));
        if (isNaN(d.getTime())) d = new Date(ts.replace(' ', 'T') + 'Z');
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const renderChats = (chatsArray) => {
        if (!Array.isArray(chatsArray)) return;

        if (!window.chatSettings) window.chatSettings = {};
        chatsArray.forEach(c => {
            if (!window.chatSettings[c.username]) window.chatSettings[c.username] = {};
            window.chatSettings[c.username].copyRestriction = c.copyRestriction;
            window.chatSettings[c.username].autoDeleteTimer = c.autoDeleteTimer || 0;
        });

        const uniqueChats = new Map();
        chatsArray.forEach(chat => {
            const existing = uniqueChats.get(chat.username);
            if (!existing) {
                uniqueChats.set(chat.username, chat);
            } else {
                const existingTime = parseDate(existing.timestamp);
                const newTime = parseDate(chat.timestamp);
                if (newTime > existingTime) {
                    uniqueChats.set(chat.username, chat);
                }
            }
        });

        let chats = Array.from(uniqueChats.values()).filter(c => typeof viewingArchive !== 'undefined' && viewingArchive ? c.is_archived : !c.is_archived);
        
        const container = document.getElementById('contacts');
        if (!container) return;

        Array.from(container.children).forEach(child => {
            if (child.getAttribute('data-search') === 'true' || !child.classList.contains('contact-item') || !child.querySelector('.avatar-box')) {
                child.remove();
            }
        });

        let pinnedOrder = [];
        try { pinnedOrder = JSON.parse(localStorage.getItem('4send_pinned_order') || '[]'); } catch(e){}

        chats.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return (b.is_pinned || 0) - (a.is_pinned || 0);
            if (a.is_pinned) {
                const idxA = pinnedOrder.indexOf(a.username);
                const idxB = pinnedOrder.indexOf(b.username);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }
            const tA = parseDate(a.timestamp);
            const tB = parseDate(b.timestamp);
            if (tB !== tA) return tB - tA;
            return a.username.localeCompare(b.username);
        });
        
        if (chats.length === 0) {
            if (typeof viewingArchive !== 'undefined' && viewingArchive) {
                container.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:40px 20px; color:#888; text-align:center;"><svg viewBox="0 0 24 24" style="width:64px; height:64px; fill:none; stroke:#a74fff; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; margin-bottom:15px; animation: floatAnim 3s ease-in-out infinite;"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"></path></svg><div style="font-size:14px; font-weight:500; color:#aaa;">${t('В архиве никого нет')}</div><style>@keyframes floatAnim {0%, 100% { transform: translateY(0); }50% { transform: translateY(-10px); }}</style></div>`;
            } else {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:40px 20px; color:#888; text-align:center;">
                        <div style="position:relative; margin-bottom:20px;">
                            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:80px; height:80px; background:radial-gradient(circle, rgba(167,79,255,0.2) 0%, transparent 70%); animation: pulseBg 3s infinite ease-in-out; border-radius:50%;"></div>
                            <svg viewBox="0 0 24 24" style="position:relative; z-index:1; width:72px; height:72px; fill:none; stroke:#a74fff; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; animation: floatChat 3s ease-in-out infinite; filter: drop-shadow(0 4px 8px rgba(167,79,255,0.3));">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                <line x1="9" y1="9" x2="15" y2="9" stroke-linecap="round"></line>
                                <line x1="9" y1="13" x2="13" y2="13" stroke-linecap="round"></line>
                            </svg>
                        </div>
                        <div style="font-size:16px; font-weight:600; color:#eee; margin-bottom:6px; letter-spacing:0.5px;">${t('У вас пока нет чатов')}</div>
                        <div style="font-size:13px; color:#888; max-width:200px; line-height:1.4;">${t('Воспользуйтесь поиском, чтобы найти друзей и начать общение')}</div>
                        <style>
                            @keyframes floatChat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                            @keyframes pulseBg { 0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); } }
                        </style>
                    </div>
                `;
            }
            return;
        }

        const meLower = String(me).toLowerCase();
        const targetLower = String(typeof target !== 'undefined' ? target : '').toLowerCase();
        
        const currentNodes = Array.from(container.children);
        const currentMap = new Map();
        currentNodes.forEach(node => {
            const username = node.getAttribute('data-username');
            if (username) currentMap.set(username, node);
        });

        let needsReorder = false;
        if (currentNodes.length !== chats.length) {
            needsReorder = true;
        } else {
            for (let i = 0; i < chats.length; i++) {
                if (currentNodes[i].getAttribute('data-username') !== chats[i].username) {
                    needsReorder = true;
                    break;
                }
            }
        }

        chats.forEach((chat, index) => {
            const chatUserLower = String(chat.username).toLowerCase();
            const isSaved = chatUserLower === meLower;
            const isActive = chatUserLower === targetLower;
            const isOn = typeof onlineUsers !== 'undefined' && Array.from(onlineUsers).some(u => String(u).toLowerCase() === chatUserLower);
            const isPinned = chat.is_pinned === 1;
            const amIBlocked = chat.is_blocked_me === 1;
            const isMuted = chat.is_muted === 1;
            const iBlockedHim = chat.i_blocked_him === 1;
            
            let timeStr = "";
            if (chat.timestamp && chat.timestamp !== 'null' && !amIBlocked) {
                let date = new Date(chat.timestamp);
                if (isNaN(date.getTime())) date = new Date(chat.timestamp.replace(' ', 'T'));
                if (isNaN(date.getTime())) date = new Date(chat.timestamp.replace(' ', 'T') + 'Z');
                
                if (!isNaN(date.getTime())) {
                    const now = new Date();
                    if (date.toDateString() === now.toDateString()) {
                        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        timeStr = date.toLocaleDateString(globalLocale, { day: '2-digit', month: '2-digit' });
                    }
                }
            }

            let displayPreview = chat.lastText || "";
            if (typeof clarify === 'function') displayPreview = clarify(displayPreview);
            let isMediaPreview = false;
            
            if (displayPreview.includes('Переслано от') || displayPreview.includes('Forwarded from') || displayPreview.startsWith('📂')) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>${t('Пересланное сообщение')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastIsVideoNote) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('📹 Видеосообщение')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastIsMusic || chat.lastFileUrl?.toLowerCase().endsWith('.mp3')) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>${t('Аудиозапись')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastIsAudio) {
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>${t('Голосовое сообщение')}</span>`;
                isMediaPreview = true;
            } else if (chat.lastCallType) {
                const isMissed = chat.lastCallType === 'missed';
                const isRejected = chat.lastCallType === 'rejected';
                const callColor = (isMissed || isRejected) ? '#ff4d4d' : '#a74fff';
                const label = isMissed ? t('Пропущенный звонок') : isRejected ? t('Отклонённый звонок') : t('Исходящий звонок');
                const callIcon = chat.lastCallWithVideo
                    ? `<svg style="width:14px;height:14px;fill:${callColor}" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
                    : `<svg style="width:14px;height:14px;fill:${callColor}" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
                displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom">${callIcon}${label}</span>`;
                isMediaPreview = true;
            } else if (chat.lastFileUrl) {
                const extMatch = chat.lastFileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
                const ext = extMatch ? extMatch[1].toLowerCase() : '';
                const isGif = ext === 'gif' || displayPreview === "GIF";
                const isSticker = displayPreview === t('Стикер');
                const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) && !isSticker;
                const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
                
                if (isGif) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>GIF</span>`;
                    isMediaPreview = true;
                } else if (isSticker) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg>${t('Стикер')}</span>`;
                    isMediaPreview = true;
                } else if (isImage) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>${t('Фотография')}</span>`;
                    isMediaPreview = true;
                } else if (isVideo) {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('Видео')}</span>`;
                    isMediaPreview = true;
                } else {
                    displayPreview = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${escapeHTML(chat.lastFileName || t('📁 Файл'))}</span>`;
                    isMediaPreview = true;
                }
            }
            if (!isMediaPreview && displayPreview !== "Сохраненные сообщения") {
                displayPreview = escapeHTML(displayPreview);
            }
            let senderPrefix = "";
            if (!amIBlocked && chat.lastSender) {
                const isLastSenderMe = String(chat.lastSender).toLowerCase() === meLower;
                const senderName = chat.lastSenderDisplay || chat.lastSender;
                if (chat.username === '4send_system' || chat.username === '4send_help' || chat.lastSender === '4send_system' || chat.lastSender === '4send_help' || chat.lastCallType) {
                    senderPrefix = "";
                } else if (chat.isRoom && chat.roomType !== 'channel') {
                    senderPrefix = `<span style="color:#a74fff">${isLastSenderMe ? t("Вы") : escapeHTML(senderName)}: </span>`;
                } else if (!chat.isRoom) {
                    senderPrefix = `<span style="color:#a74fff">${isLastSenderMe ? t("Вы") : escapeHTML(senderName)}: </span>`;
                }
            }

            const draftText = localStorage.getItem('4send_draft_' + chat.username);
            if (draftText && chatUserLower !== targetLower) {
                displayPreview = `<span style="color:#ff4d4d; font-weight:600;">${t('Черновик:')}</span> ${escapeHTML(draftText)}`;
                senderPrefix = "";
            }

            let ticksHtml = '';
            if (String(chat.lastSender).toLowerCase() === meLower && !isSaved && !amIBlocked) {
                const isRead = chat.isLastMessageRead;
                const tickSvg = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg>`;
                if (isRead) {
                    ticksHtml = `<span style="display:inline-block;position:relative;width:18px;height:14px;color:#a74fff;vertical-align:middle;margin-right:4px;"><svg viewBox="0 0 24 24" style="position:absolute;left:0;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg><svg viewBox="0 0 24 24" style="position:absolute;left:6px;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg></span>`;
                } else {
                    ticksHtml = `<span style="display:inline-block;position:relative;width:14px;height:14px;color:#888;vertical-align:middle;margin-right:4px;"><svg viewBox="0 0 24 24" style="position:absolute;left:0;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg></span>`;
                }
            }

            const unreadBadge = chat.unreadCount > 0 && !isSaved && !amIBlocked ? `<div class="${isMuted ? 'unread-badge muted-badge' : 'unread-badge'}">${chat.unreadCount}</div>` : '';
            const pinIcon = isPinned ? `<svg style="width:12px;height:12px;fill:#a74fff;margin-left:5px" viewBox="0 0 24 24"><path d="M16 5h.99L17 3H7v2h1v7l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2V5z"/></svg>` : '';
            const avatarHtml = isSaved ? (typeof savedIconSvg !== 'undefined' ? savedIconSvg : '') : getAvatarHtml(chat.displayName || chat.username, amIBlocked ? null : chat.avatar, 48);
            const borderCol = isSaved ? '#a74fff' : amIBlocked ? '#333' : (isOn && !chat.isRoom) ? '#4caf50' : '#333';
            
            const nameText = isSaved ? t('Избранное') : escapeHTML(chat.displayName || chat.username);
            const badgeHtml = !isSaved && chat.isVerified ? getVerifyBadgeHtml(chat.isRoom ? chat.roomType : 'user') : '';
            const muteHtml = isMuted ? (typeof mutedSvg !== 'undefined' ? mutedSvg : '') : '';
            const contactNameHtml = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nameText}</span>${badgeHtml}${muteHtml}`;
            
            let div = currentMap.get(chat.username);
            if (!div) {
                div = document.createElement('div');
                div.className = 'contact-item';
                div.onclick = () => selectChat(chat.username, chat.displayName, chat.isRoom, chat.roomType, chat.roomOwner);
                div.innerHTML = `<div class="avatar-box" style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid transparent;flex-shrink:0;transition:.3s"></div><div class="info-box" style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:2px"></div>`;
                if (needsReorder) {
                    container.appendChild(div);
                }
            } else {
                currentMap.delete(chat.username);
            }

            div.style.padding = '12px 15px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #1a1a24';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '12px';
            div.style.background = isActive ? 'rgba(167,79,255,0.15)' : 'transparent';

            if (!div.hasAttribute('data-rendered')) {
                div.style.animationDelay = `${index * 20}ms`;
                div.setAttribute('data-rendered', 'true');
            }

            div.setAttribute('data-username', chat.username);
            div.setAttribute('data-display', chat.displayName || chat.username);
            div.setAttribute('data-pinned', isPinned ? '1' : '0');
            div.setAttribute('data-muted', isMuted ? '1' : '0');
            div.setAttribute('data-archived', chat.is_archived === 1 ? '1' : '0');
            div.setAttribute('data-i-blocked', iBlockedHim ? '1' : '0');
            div.setAttribute('data-is-room', chat.isRoom ? '1' : '0');
            div.setAttribute('data-room-type', chat.roomType || '');
            div.setAttribute('data-room-owner', chat.roomOwner || '');
            div.setAttribute('data-restricted', chat.copyRestriction ? '1' : '0');

            const avBox = div.querySelector('.avatar-box');
            const infoBox = div.querySelector('.info-box');

            avBox.style.borderColor = borderCol;
            if (avBox.innerHTML !== avatarHtml) avBox.innerHTML = avatarHtml;

            const newInfoHtml = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px;color:#fff;margin-right:10px;display:flex;align-items:center;overflow:hidden;">${contactNameHtml}</b><small style="color:#555;font-size:11px;flex-shrink:0;display:flex;align-items:center;">${amIBlocked ? '' : ticksHtml + timeStr}</small></div><div style="display:flex;justify-content:space-between;align-items:center"><div id="preview-${chat.username.toLowerCase()}" style="color:#777;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${amIBlocked ? t('был(а) давно') : senderPrefix + displayPreview}</div><div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:8px">${pinIcon}${unreadBadge}</div></div>`;
            
            if (infoBox.innerHTML !== newInfoHtml) infoBox.innerHTML = newInfoHtml;

            if (needsReorder && container.children[index] !== div) {
                container.insertBefore(div, container.children[index]);
            }
        });

        currentMap.forEach(node => node.remove());

        const pinnedItems = Array.from(container.children).filter(child => child.getAttribute('data-pinned') === '1');
        pinnedItems.forEach(item => {
            item.setAttribute('draggable', 'true');
            item.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', item.getAttribute('data-username'));
                item.style.opacity = '0.5';
                item.classList.add('dragging');
            };
            item.ondragend = () => {
                item.style.opacity = '1';
                item.classList.remove('dragging');
                const newOrder = Array.from(container.children)
                    .filter(c => c.getAttribute('data-pinned') === '1')
                    .map(c => c.getAttribute('data-username'));
                localStorage.setItem('4send_pinned_order', JSON.stringify(newOrder));
            };
            item.ondragover = (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (!dragging || dragging === item) return;
                const rect = item.getBoundingClientRect();
                const offset = e.clientY - rect.top - (rect.height / 2);
                if (offset > 0) {
                    item.after(dragging);
                } else {
                    item.before(dragging);
                }
            };
        });
    };
    
    const container = document.getElementById('contacts');
    const hasContacts = container && container.children.length > 0;
    const cacheKey = '4send_chats_cache_' + window.me;
    
    if (!hasContacts) {
        try { 
            const cachedData = await idbGet(cacheKey); 
            if (cachedData) {
                const targetLower = String(typeof target !== 'undefined' ? target : '').toLowerCase();
                const activeChat = cachedData.find(c => c.username.toLowerCase() === targetLower);
                if (activeChat) activeChat.unreadCount = 0;
                renderChats(cachedData);
                updateAppBadge();
            }
        } catch (e) {}
    }
    
    await new Promise(r => setTimeout(r, 50));
    try {
        const res = await fetch(`/chats-extended/${me}?t=${Date.now()}`);
        let chats = await res.json();
        if (!Array.isArray(chats)) return;
        try { await idbSet(cacheKey, chats); } catch (e) {}
        renderChats(chats);
        updateAppBadge();
        
        const loader = document.getElementById('global-loader');
        if (loader && loader.style.opacity !== '0') {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.visibility = 'hidden', 600);
        }

        if (!window._historyPreloaded) {
            window._historyPreloaded = true;
            setTimeout(() => {
                const topChats = chats.slice(0, 10);
                Promise.all(topChats.map(async (chat) => {
                    const u1 = String(me).toLowerCase();
                    const u2 = String(chat.username).toLowerCase();
                    const chatCacheKey = 'history_' + u2;
                    
                    let cached = await idbGet(chatCacheKey) || [];
                    let sinceIdParam = '';
                    if (cached.length > 0) {
                        const lastCachedMsg = cached[cached.length - 1];
                        if (lastCachedMsg && lastCachedMsg.id) {
                            sinceIdParam = `&sinceId=${lastCachedMsg.id}`;
                        }
                    }

                    try {
                        const hRes = await fetch(`/history/${encodeURIComponent(u1)}/${encodeURIComponent(u2)}?t=${Date.now()}${sinceIdParam}`, {
                            headers: {'Authorization': `Bearer ${localStorage.getItem('4send_token')}`}
                        });
                        const newMsgs = await hRes.json();
                        if (Array.isArray(newMsgs) && newMsgs.length > 0) {
                            const uniqueMsgs = new Map();
                            cached.forEach(m => uniqueMsgs.set(m.id, m));
                            newMsgs.forEach(m => uniqueMsgs.set(m.id, m));
                            const mergedMsgs = Array.from(uniqueMsgs.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                            await idbSet(chatCacheKey, mergedMsgs);
                        }
                    } catch {}
                }));
            }, 1500);
        }
    } catch {}
};

window.openChatAutoDeleteModal = function(chatTarget, currentTimer) {
    let modal = document.getElementById('chat-auto-delete-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chat-auto-delete-modal';
        document.body.appendChild(modal);
    }
    
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.6)', zIndex: '110000', display: 'flex',
        alignItems: 'center', justifyContent: 'center', opacity: '0', transition: '0.3s'
    });

    const buildOpt = (val, label) => `
        <div onclick="setChatAutoDelete('${escapeAttr(chatTarget)}', ${val})" style="padding:16px;border-radius:14px;background:${currentTimer === val ? 'rgba(167,79,255,0.15)' : 'rgba(255,255,255,0.05)'};border:2px solid ${currentTimer === val ? '#a74fff' : 'transparent'};color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;text-align:center;position:relative;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;" onmouseover="this.style.background='${currentTimer === val ? 'rgba(167,79,255,0.25)' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${currentTimer === val ? 'rgba(167,79,255,0.15)' : 'rgba(255,255,255,0.05)'}'">
            <span>${label}</span>
            ${currentTimer === val ? '<div style="width:20px;height:20px;background:#a74fff;border-radius:50%;display:flex;align-items:center;justify-content:center;position:absolute;right:16px"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>' : ''}
        </div>
    `;

    modal.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#1c1c23; width:90%; max-width:340px; border-radius:24px; padding:24px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform:scale(0.9); transition:0.3s; border:1px solid rgba(167,79,255,0.2); text-align:center;">
            <h3 style="color:#fff; margin:0 0 10px 0; font-family:'Inter',sans-serif; font-size:19px; font-weight:700;">${t('Автоудаление')}</h3>
            <p style="color:#888; font-size:13px; margin-bottom:20px; line-height:1.4;">${t('Новые сообщения в этом чате будут автоматически удаляться для всех участников.')}</p>
            
            ${buildOpt(0, t('Выключено'))}
            ${buildOpt(604800, t('1 неделя'))}
            ${buildOpt(2592000, t('1 месяц'))}
            ${buildOpt(7776000, t('3 месяца'))}
            ${buildOpt(31536000, t('1 год'))}
            
            <button onclick="closeChatAutoDeleteModal()" style="width:100%; padding:14px; margin-top:10px; background:rgba(255,255,255,0.05); color:#eee; border:1px solid rgba(255,255,255,0.1); border-radius:14px; font-weight:700; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">${t('ОТМЕНА')}</button>
        </div>
    `;
    
    modal.onclick = closeChatAutoDeleteModal;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);
};

window.closeChatAutoDeleteModal = function() {
    const modal = document.getElementById('chat-auto-delete-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    }
};

window.setChatAutoDelete = async function(chatTarget, seconds) {
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/toggle-chat-auto-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ target: chatTarget, timer: seconds })
        });
        if (res.ok) {
            if (!window.chatSettings) window.chatSettings = {};
            if (!window.chatSettings[chatTarget]) window.chatSettings[chatTarget] = {};
            window.chatSettings[chatTarget].autoDeleteTimer = seconds;
            
            closeChatAutoDeleteModal();
            if (typeof showToast === 'function') showToast(t("Настройки автоудаления сохранены"), false);
            loadChatsWithPreview();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast(t("Ошибка"), true);
    }
};

window.ondragstart = (e) => {
    if (e.target.closest('.contact-item[data-pinned="1"]')) return true;
    return false;
};

window.updateSidebarPreview = function(chatId, msgData, isNewMessage = true) {
    if (window.isChatLoading) {
        isNewMessage = false;
    }
    const container = document.getElementById('contacts');
    if (!container) return;
    const item = container.querySelector(`.contact-item[data-username="${chatId}"]`);
    if (!item) return;
    
    if (isNewMessage) {
        const isPinned = item.getAttribute('data-pinned') === '1';
        if (isPinned) {
            container.insertBefore(item, container.firstChild);
        } else {
            const firstNonPinned = Array.from(container.children).find(child => child.getAttribute('data-pinned') !== '1');
            if (firstNonPinned) {
                container.insertBefore(item, firstNonPinned);
            } else {
                container.appendChild(item);
            }
        }
    }
    
    const timeEl = item.querySelector('small');
    if (timeEl) {
        let date = msgData.timestamp ? new Date(msgData.timestamp) : new Date();
        if (isNaN(date.getTime()) && msgData.timestamp) date = new Date(msgData.timestamp.replace(' ', 'T') + 'Z');
        let timeStr = "";
        if (!isNaN(date.getTime())) {
            const now = new Date();
            if (date.toDateString() === now.toDateString()) {
                timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                timeStr = date.toLocaleDateString(globalLocale, { day: '2-digit', month: '2-digit' });
            }
        }
        
        let ticksHtml = '';
        if (msgData.sender === window.me && chatId.toLowerCase() !== window.me.toLowerCase()) {
            const isRead = msgData.is_read;
            const tickSvg = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg>`;
            if (isRead) {
                ticksHtml = `<span style="display:inline-block;position:relative;width:18px;height:14px;color:#a74fff;vertical-align:middle;margin-right:4px;"><svg viewBox="0 0 24 24" style="position:absolute;left:0;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg><svg viewBox="0 0 24 24" style="position:absolute;left:6px;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg></span>`;
            } else {
                ticksHtml = `<span style="display:inline-block;position:relative;width:14px;height:14px;color:#888;vertical-align:middle;margin-right:4px;"><svg viewBox="0 0 24 24" style="position:absolute;left:0;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><path d="M4 12l4 4L18 6"></path></svg></span>`;
            }
        }
        timeEl.innerHTML = ticksHtml + timeStr;
    }
    
    const previewEl = item.querySelector(`#preview-${chatId.toLowerCase()}`);
    if (previewEl) {
        let prefix = msgData.sender === window.me ? `<span style="color:#a74fff">${t("Вы")}: </span>` : '';
        let previewText = msgData.text || "";
        
        if (previewText.includes('Переслано от') || previewText.includes('Forwarded from') || previewText.startsWith('📂')) {
            previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>${t('Пересланное сообщение')}</span>`;
        } else if (msgData.isVideoNote) {
            previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('📹 Видеосообщение')}</span>`;
        } else if (msgData.isAudio) {
            previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>${t('Голосовое сообщение')}</span>`;
        } else if (msgData.isMusic) {
            previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>${t('Аудиозапись')}</span>`;
        } else if (msgData.callType) {
            const isMissed = msgData.callType === 'missed';
            const isRejected = msgData.callType === 'rejected';
            const callColor = (isMissed || isRejected) ? '#ff4d4d' : '#a74fff';
            const label = isMissed ? t('Пропущенный звонок') : isRejected ? t('Отклонённый звонок') : (msgData.callType === 'outgoing' ? t('Исходящий звонок') : t('Входящий звонок'));
            const callIcon = msgData.callWithVideo
                ? `<svg style="width:14px;height:14px;fill:${callColor}" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`
                : `<svg style="width:14px;height:14px;fill:${callColor}" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
            previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom">${callIcon}${label}</span>`;
        } else if (msgData.fileUrl) {
            const extMatch = msgData.fileName ? msgData.fileName.match(/\.([^.?#]+)(?:[?#]|$)/i) : msgData.fileUrl.match(/\.([^.?#]+)(?:[?#]|$)/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : '';
            const isGif = ext === 'gif' || msgData.text === "GIF";
            const isSticker = msgData.text === t('Стикер');
            const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) && !isSticker;
            const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
            
            if (isGif) previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M19 19H5V5h14v14zM5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm6.5 10h-2v-2h2v2zm0-4h-2V7h2v2zm4 4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>GIF</span>`;
            else if (isSticker) previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.83L18.17 19H5.83L12 5.83z"/></svg>${t('Стикер')}</span>`;
            else if (isImage) previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>${t('Фотография')}</span>`;
            else if (isVideo) previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>${t('Видео')}</span>`;
            else previewText = `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:bottom"><svg style="width:14px;height:14px;fill:#a74fff" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${escapeHTML(msgData.fileName || t('📁 Файл'))}</span>`;
        } else {
            previewText = escapeHTML(previewText);
        }
        
        previewEl.innerHTML = prefix + previewText;
    }
};

if (window.socket) {
    window.socket.on('messages_read', data => {
        if (target === me) return;
        if (data.room && target !== data.room) return;
        document.querySelectorAll('.sent:not(.msg-read)').forEach(msg => {
            const statusBlock=msg.querySelector('.msg-status-block')??msg.querySelector('.status-icon')??msg.querySelector('div[style*="right:12px"]');
            if(!statusBlock)return;
            msg.classList.add('msg-read');
            statusBlock.classList.add('status-read');
            const timeText=msg.getAttribute('data-time')||"";
            const isEdited=!!msg.querySelector('.edit-mark')||(msg.querySelector('small')&&msg.querySelector('small').innerText.includes(t('ред.')));
            
            const timerEl = statusBlock.querySelector('.timer-icon-svg');
            const timerHtml = timerEl ? timerEl.outerHTML : '';
            
            const tick=`<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;transform:translateY(0.5px)"><path d="M4 12l4 4L18 6"></path></svg>`;
            
            const isDarkPill = statusBlock.style.background.includes('rgba(0, 0, 0, 0.5)') || statusBlock.style.background.includes('rgba(0,0,0,0.5)');
            const timeColor = isDarkPill ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
            const tickColor = isDarkPill ? '#d4aaff' : '#a74fff';
            
            statusBlock.innerHTML=`${timerHtml}${isEdited?`<span class="edit-mark" style="font-size:11px;color:${timeColor};font-family:'Inter',sans-serif;line-height:14px">${t('ред.')}</span>`:''}<span style="font-size:11px;color:${timeColor};font-family:'Inter',sans-serif;line-height:14px">${timeText}</span><div style="position:relative;width:18px;height:14px;color:${tickColor};display:flex;align-items:center"><div style="position:absolute;left:0;display:flex;align-items:center">${tick}</div><div style="position:absolute;left:6px;display:flex;align-items:center;animation:tickArrival 0.4s forwards cubic-bezier(0.175,0.885,0.32,1.275)">${tick}</div></div>`;
        });
        typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
    });
}

window.openActiveSessionsModal = async function() {
    let modal = document.getElementById('active-sessions-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'active-sessions-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    const styleTag = document.createElement('style');
    styleTag.textContent = `#active-sessions-content::-webkit-scrollbar { display: none; }`;
    if (!document.getElementById('active-sessions-style')) {
        styleTag.id = 'active-sessions-style';
        document.head.appendChild(styleTag);
    }

    modal.innerHTML = `<div id="active-sessions-content" class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:600px;max-height:85vh;overflow-y:auto;scrollbar-width:none;padding:24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);margin:0 auto">
        <div style="display:flex;align-items:center;margin-bottom:24px;">
            <button onclick="closeActiveSessionsModal()" style="background:rgba(255,255,255,0.1);border:none;color:#9d4edd;font-size:24px;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:0.2s;flex-shrink:0;">‹</button>
            <h2 style="flex:1;text-align:center;margin:0;color:#fff;font-size:20px;font-weight:700;margin-right:40px">${t('Активные сеансы')}</h2>
        </div>
        <button onclick="revokeAllSessions()" style="width:100%;padding:14px;background:rgba(255,77,77,0.15);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3);border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;margin-bottom:20px;">${t('Завершить все другие сеансы')}</button>
        <div id="sessions-list" style="display:flex;flex-direction:column;gap:10px;">
            <div style="color:#888;text-align:center;padding:20px;">${t('Загрузка...')}</div>
        </div>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    content.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });

    const parseDevice = (ua) => {
        if (!ua) return t('Неизвестное устройство');
        if (/iPhone|iPad|iPod/i.test(ua)) return 'Apple (iOS)';
        if (/Mac/i.test(ua)) return 'Apple (Mac)';
        if (/Android/i.test(ua)) return 'Android';
        if (/Windows/i.test(ua)) return 'Windows';
        if (/Linux/i.test(ua)) return 'Linux';
        return t('Неизвестное устройство');
    };

    const getDeviceIcon = (deviceName) => {
        if (deviceName.includes('Windows')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#00a4ef"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.85z"/></svg>`;
        if (deviceName.includes('Apple') || deviceName.includes('iOS') || deviceName.includes('Mac')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#fff"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.59-.76 1.56.04 2.87.74 3.62 1.9-3.22 1.96-2.64 6.58.51 7.86-.68 1.64-1.53 3.22-2.8 4.17zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.3 2.4-2.02 4.36-3.74 4.25z"/></svg>`;
        if (deviceName.includes('Android')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#3DDC84"><path d="M17.523 15.341c-.725 0-1.311-.586-1.311-1.311s.586-1.311 1.311-1.311 1.311.586 1.311 1.311-.586 1.311-1.311 1.311zm-11.046 0c-.725 0-1.311-.586-1.311-1.311s.586-1.311 1.311-1.311 1.311.586 1.311 1.311-.586 1.311-1.311 1.311zm11.436-7.25l1.938-3.357a.43.43 0 00-.156-.586.432.432 0 00-.586.156l-1.973 3.418c-1.484-.684-3.164-1.055-4.951-1.055s-3.467.371-4.951 1.055l-1.973-3.418a.432.432 0 00-.586-.156.43.43 0 00-.156.586l1.938 3.357C2.891 9.668.508 13.535.117 18.164h23.766c-.391-4.629-2.773-8.496-5.969-10.073z"/></svg>`;
        if (deviceName.includes('Linux')) return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#FCC624"><path d="M11.97 0C5.36 0 0 5.36 0 11.97s5.36 11.97 11.97 11.97 11.97-5.36 11.97-11.97S18.58 0 11.97 0zm0 21.82c-5.44 0-9.85-4.41-9.85-9.85s4.41-9.85 9.85-9.85 9.85 4.41 9.85 9.85-4.41 9.85-9.85 9.85z"/></svg>`;
        return `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#888"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>`;
    };

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/sessions', { headers: { 'Authorization': `Bearer ${token}` } });
        const sessions = await res.json();
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';
        
        sessions.sort((a, b) => (a.token === token ? -1 : (b.token === token ? 1 : 0))).forEach(s => {
            const isCurrent = s.token === token;
            const date = new Date(s.lastActive).toLocaleString(globalLocale);
            const deviceName = parseDevice(s.device);
            const deviceIcon = getDeviceIcon(deviceName);
            list.innerHTML += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:#2a2633;border-radius:16px;border:1px solid ${isCurrent ? '#a74fff' : 'transparent'}">
                    <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:rgba(255,255,255,0.05);border-radius:12px;margin-right:14px;flex-shrink:0;">
                        ${deviceIcon}
                    </div>
                    <div style="flex:1;overflow:hidden;">
                        <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${deviceName}</div>
                        <div style="color:#8e8e93;font-size:13px;">IP: ${escapeHTML(s.ip)}</div>
                        <div style="color:#8e8e93;font-size:13px;">${t('Активность')}: ${date}</div>
                        ${isCurrent ? `<div style="color:#a74fff;font-size:12px;font-weight:bold;margin-top:4px;">${t('Текущий сеанс')}</div>` : ''}
                    </div>
                    ${!isCurrent ? `<button onclick="revokeSession('${escapeAttr(s.token)}')" style="background:rgba(255,77,77,0.15);color:#ff4d4d;border:none;padding:8px 12px;border-radius:10px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Завершить')}</button>` : ''}
                </div>
            `;
        });
    } catch {
        document.getElementById('sessions-list').innerHTML = `<div style="color:#ff4d4d;text-align:center;">${t('Ошибка загрузки')}</div>`;
    }
};
window.deleteUserAdmin = function(username) {
    let modal = document.getElementById('admin-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-confirm-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: '100001', display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
            opacity: '0', transition: 'all 0.3s ease'
        });
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background: #1c1c23; width: 320px; padding: 25px; border-radius: 24px; border: 1px solid rgba(255,77,77,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color: #fff; margin-bottom: 10px; font-family: 'Inter', sans-serif; font-size: 18px;">${t('Подтвердите действие')}</h3>
            <p style="color: #aaa; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">${t('Точно удалить аккаунт')} <b>${escapeHTML(username)}</b>? ${t('Это действие необратимо.')}</p>
            <div style="display: flex; gap: 10px;">
                <button id="admin-confirm-yes" style="flex: 1; padding: 12px; background: #ff4d4d; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s;">${t('УДАЛИТЬ')}</button>
                <button id="admin-confirm-no" style="flex: 1; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer; transition: 0.2s;">${t('ОТМЕНА')}</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    document.getElementById('admin-confirm-no').onclick = () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.style.display = 'none', 300);
    };

    document.getElementById('admin-confirm-yes').onclick = async () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.style.display = 'none', 300);
        
        try {
            await fetch('/api/admin/delete-user', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ targetUsername: username })
            });
            showToast(t("Аккаунт удален"), false);
            loadAdminUsers();
        } catch {}
    };
};
window.switchAdminTab = function(tab) {
    document.querySelectorAll('.admin-nav-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-mobile-tab').forEach(t => t.classList.remove('active'));
    
    const desktopTab = document.querySelector(`.admin-nav-item[onclick="switchAdminTab('${tab}')"]`);
    const mobileTab = document.querySelector(`.admin-mobile-tab[onclick="switchAdminTab('${tab}')"]`);
    
    if (desktopTab) desktopTab.classList.add('active');
    if (mobileTab) mobileTab.classList.add('active');
    
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`admin-sec-${tab}`);
    if (section) section.classList.add('active');
    
    const titles = {
        'dashboard': t('Главная'),
        'users': t('Пользователи'),
        'rooms': t('Каналы и Группы'),
        'settings': t('Настройки'),
        'details': t('Детали')
    };
    document.getElementById('admin-header-title').innerText = titles[tab] || t('Админ панель');
};
async function loadAdminRooms() {
    const list = document.getElementById('admin-rooms-list');
    if (!list) return;
    try {
        const res = await fetch(`/api/admin/rooms?me=${me}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rooms = await res.json();
        list.innerHTML = '';
        
        if (!Array.isArray(rooms) || rooms.length === 0) {
            list.innerHTML = `<div style="padding:30px; text-align:center; color:#888;">${t('Список пуст')}</div>`;
            return;
        }
        
        rooms.forEach(r => {
            const div = document.createElement('div');
            div.className = 'admin-table-row';
            div.onclick = () => openAdminRoomDetails(r.roomId);
            
            const safeName = escapeHTML(r.name);
            const typeText = r.type === 'channel' ? `<span style="color:#00c6ff;background:rgba(0,198,255,0.1);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Канал')}</span>` : `<span style="color:#ff9500;background:rgba(255,149,0,0.1);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Группа')}</span>`;
            const badge = r.isVerified ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '✔️') : '';
            
            div.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;overflow:hidden;">
                    <div style="width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;color:#888;flex-shrink:0;">
                        <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                    </div>
                    <div style="color:#eee;font-weight:600;font-size:14px;display:flex;align-items:center;overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeName}</span>${badge}</div>
                </div>
                <div class="admin-hide-mobile">${typeText}</div>
                <div class="admin-hide-mobile" style="color:#888;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(r.owner)}</div>
                <div style="color:#a74fff;font-size:13px;font-weight:600;">${t('Детали ›')}</div>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        list.innerHTML = `<div style="padding:30px; text-align:center; color:#ff4d4d;">${t('Ошибка: ')}${escapeHTML(err.message)}</div>`;
    }
}
window.openAdminRoomDetails = async function(roomId) {
    switchAdminTab('details');
    const content = document.getElementById('admin-details-content');
    content.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">${t('Загрузка данных...')}</div>`;
    
    try {
        const res = await fetch(`/api/admin/room/${roomId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('4send_token')}` }
        });
        const r = await res.json();
        
        let membersHtml = r.memberDetails.map(m => `
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.03);">
                <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">${getAvatarHtml(m.username, m.avatar, 36)}</div>
                <div style="color:#eee;font-size:14px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(m.username)} ${m.username === r.owner ? `<span style="color:#a74fff;font-size:11px;background:rgba(167,79,255,0.1);padding:2px 6px;border-radius:4px;margin-left:6px;">${t('Владелец')}</span>` : ''}</div>
            </div>
        `).join('');

        content.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:25px; cursor:pointer; color:#888; font-weight:600; transition:0.2s; width:fit-content;" onclick="switchAdminTab('rooms')" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">
                <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg> ${t('Назад к списку')}
            </div>
            
            <div class="admin-card" style="display:flex; flex-direction:column; align-items:center; text-align:center; margin-bottom:20px;">
                <div style="width:100px;height:100px;border-radius:24px;overflow:hidden;border:3px solid ${r.isVerified?'#a74fff':'rgba(255,255,255,0.1)'}; margin-bottom:15px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">${getAvatarHtml(r.name, r.avatar, 100)}</div>
                <div style="font-size:24px; font-weight:800; color:#fff; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:5px;">${escapeHTML(r.name)}${r.isVerified?verifyBadge:''}</div>
                <div style="color:#888; font-size:14px; margin-bottom:20px;">${t('Тип')}: <span style="color:#eee;">${r.type === 'channel' ? t('Канал') : t('Группа')}</span> • ${t('Участников')}: <span style="color:#eee;">${r.members.length}</span></div>
                
                <div style="display:flex; gap:15px; width:100%; max-width:400px;">
                    <button onclick="toggleRoomVerify('${escapeAttr(r.roomId)}', ${!r.isVerified}); setTimeout(()=>openAdminRoomDetails('${escapeAttr(r.roomId)}'), 500);" style="flex:1; padding:14px; border-radius:14px; border:none; background:${r.isVerified?'rgba(255,77,77,0.1)':'rgba(167,79,255,0.15)'}; color:${r.isVerified?'#ff4d4d':'#a74fff'}; font-weight:700; cursor:pointer; transition:0.2s; border:1px solid ${r.isVerified?'rgba(255,77,77,0.3)':'rgba(167,79,255,0.3)'};" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">${r.isVerified?t('ЗАБРАТЬ ВЕРИФИКАЦИЮ'):t('ВЫДАТЬ ВЕРИФИКАЦИЮ')}</button>
                    <button onclick="deleteRoomAdmin('${escapeAttr(r.roomId)}', '${escapeAttr(r.name)}')" style="flex:1; padding:14px; border-radius:14px; border:none; background:rgba(255,77,77,0.1); color:#ff4d4d; font-weight:700; cursor:pointer; transition:0.2s; border:1px solid rgba(255,77,77,0.3);" onmouseover="this.style.background='rgba(255,77,77,0.2)'" onmouseout="this.style.background='rgba(255,77,77,0.1)'">${t('УДАЛИТЬ')} ${r.type === 'channel' ? t('КАНАЛ') : t('ГРУППУ')}</button>
                </div>
            </div>
            
            <div class="admin-card" style="padding:20px;">
                <h4 style="color:#fff; margin:0 0 15px 0; font-size:16px;">${t('Список участников')}</h4>
                <div style="max-height:300px; overflow-y:auto; padding-right:10px;">
                    ${membersHtml}
                </div>
            </div>
        `;
    } catch {
        content.innerHTML = `<div style="padding:40px; text-align:center; color:#ff4d4d;">${t('Ошибка загрузки данных')}</div>`;
    }
};

window.deleteRoomAdmin = function(roomId, roomName) {
    let modal = document.getElementById('admin-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-confirm-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: '100001', display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)',
            opacity: '0', transition: 'all 0.3s ease'
        });
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background: #1c1c23; width: 320px; padding: 25px; border-radius: 24px; border: 1px solid rgba(255,77,77,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color: #fff; margin-bottom: 10px; font-family: 'Inter', sans-serif; font-size: 18px;">${t('Подтвердите действие')}</h3>
            <p style="color: #aaa; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">${t('Точно удалить {name}? Это действие необратимо.', {name: roomName})}</p>
            <div style="display: flex; gap: 10px;">
                <button id="admin-confirm-yes" style="flex: 1; padding: 12px; background: #ff4d4d; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer; transition: 0.2s;">${t('УДАЛИТЬ')}</button>
                <button id="admin-confirm-no" style="flex: 1; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer; transition: 0.2s;">${t('ОТМЕНА')}</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    document.getElementById('admin-confirm-no').onclick = () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.style.display = 'none', 300);
    };

    document.getElementById('admin-confirm-yes').onclick = async () => {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.style.display = 'none', 300);
        
        try {
            await fetch('/api/admin/delete-room', {
                method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('4send_token')}`},
                body: JSON.stringify({ roomId })
            });
            showToast(t("Удалено"), false);
            loadAdminRooms();
        } catch {}
    };
};
window.toggleRoomVerify = async function(roomId, verify) {
    try {
        const res = await fetch('/api/admin/toggle-room-verify', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ me, roomId, verify })
        });
        if(res.ok) loadAdminRooms();
    } catch {}
};
async function openSettings() {
    typeof forceCloseMenu === 'function' && forceCloseMenu(true);
    const drawer = document.getElementById('menu-drawer');
    if(drawer) drawer.classList.remove('open');
    const ov = document.getElementById('overlay');
    if(ov) {
        ov.classList.remove('active');
        setTimeout(() => ov.style.display = 'none', 300);
    }

    typeof backIfNav === 'function' && backIfNav();
    tempAvatarUrl = null;

    let currentDisplayName = '';
    let currentBio = '';
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch(`/api/status/${me}?me=${me}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            currentDisplayName = data.displayName || '';
            currentBio = data.bio || '';
        }
    } catch (e) {}

    setTimeout(() => {
        let modal = document.getElementById('settings-modal');
        let wasHidden = !modal;
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'settings-modal';
        }
        
        document.body.appendChild(modal);
        modal.style.setProperty('z-index', '2147483647', 'important');
        
        const currentAv = document.getElementById('drawer-av-box')?.innerHTML || getAvatarHtml(currentDisplayName || me, localStorage.getItem('4send_avatar'), 90, true);
        
        document.body.style.overflow = 'hidden';
        
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(30,27,36,0.95)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)',
            webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease',
            pointerEvents: 'auto'
        });
        
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            body.modal-open { overflow: hidden !important; }
            #settings-modal-content::-webkit-scrollbar { display: none; }
            #p-bio::-webkit-scrollbar { display: none; }
        `;
        if (!document.getElementById('settings-modal-style')) {
            styleTag.id = 'settings-modal-style';
            document.head.appendChild(styleTag);
        }
        
        modal.innerHTML = `
            <div id="settings-modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;max-height:85vh;overflow-y:auto;scrollbar-width:none;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);text-align:center;transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative">
                <h3 style="color:#fff;margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700">${t('Профиль')}</h3>
                
                <div id="p-av-preview" onclick="document.getElementById('p-av-input').click()" style="width:100px;height:100px;border-radius:50%;margin:0 auto 12px;background:rgba(157,78,221,0.1);border:3px solid #9d4edd;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;box-shadow:0 4px 16px rgba(157,78,221,0.3)" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 20px rgba(157,78,221,0.4)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 16px rgba(157,78,221,0.3)'">
                    ${currentAv}
                </div>
                <div style="color:#8e8e93;font-size:13px;margin-bottom:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${t('Нажмите на круг, чтобы сменить фото')}</div>
                <input type="file" id="p-av-input" hidden accept="image/*" onchange="uploadNewAvatar(this)">
                
                <div style="margin-bottom:16px; position:relative;">
                    <label style="display:block;color:#8e8e93;font-size:12px;font-weight:600;margin-bottom:8px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('Имя')}</label>
                    <input type="text" id="p-display-name" maxlength="30" value="${escapeHTML(currentDisplayName)}" placeholder="${t('Введите имя')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;transition:all 0.2s ease" onfocus="this.style.borderColor='#9d4edd';this.style.background='rgba(157,78,221,0.1)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)'">
                </div>

                <div style="margin-bottom:16px; position:relative;">
                    <label style="display:block;color:#8e8e93;font-size:12px;font-weight:600;margin-bottom:8px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('Имя пользователя')}</label>
                    <input type="text" id="p-new-name" maxlength="20" value="${me}" placeholder="${t('Введите username')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;transition:all 0.2s ease" onfocus="this.style.borderColor='#9d4edd';this.style.background='rgba(157,78,221,0.1)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)'">
                    <div id="p-name-status" style="font-size:12px; margin-top:6px; text-align:left; height:14px; font-weight:600;"></div>
                </div>

                <div style="margin-bottom:24px; position:relative;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <label style="color:#8e8e93;font-size:12px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:0.5px">${t('О себе')}</label>
                        <span id="bio-counter" style="color:#8e8e93;font-size:11px;font-weight:600;">${currentBio.length}/100</span>
                    </div>
                    <textarea id="p-bio" maxlength="100" placeholder="${t('Стриптизер, 43 года, из Чебоксар.')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;transition:all 0.2s ease;resize:none;height:80px;scrollbar-width:none;" onfocus="this.style.borderColor='#9d4edd';this.style.background='rgba(157,78,221,0.1)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)'" oninput="document.getElementById('bio-counter').innerText = this.value.length + '/100'">${escapeHTML(currentBio)}</textarea>
                </div>
                
                <div style="display:flex;gap:12px">
                    <button onclick="saveProfile()" style="flex:1;padding:16px;background:linear-gradient(135deg,#9d4edd,#a020f0);border:none;border-radius:14px;color:#fff;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 12px rgba(157,78,221,0.3)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(157,78,221,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(157,78,221,0.3)'">${t('Сохранить')}</button>
                    <button onclick="closeSettings()" style="flex:1;padding:16px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.1);border-radius:14px;color:#8e8e93;font-weight:600;cursor:pointer;transition:all 0.2s ease;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border:none" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#8e8e93'">${t('Отмена')}</button>
                </div>
            </div>
        `;
        
        document.body.classList.add('modal-open');
        
        requestAnimationFrame(() => {
            Object.assign(modal.style, { opacity: '1' });
            const content = document.getElementById('settings-modal-content');
            if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
            if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();

            const nameInput = document.getElementById('p-new-name');
            const statusDiv = document.getElementById('p-name-status');
            let checkTimeout;
            if (nameInput && statusDiv) {
                nameInput.addEventListener('input', () => {
                    clearTimeout(checkTimeout);
                    const val = nameInput.value.trim();
                    if (val === window.me) {
                        statusDiv.innerText = '';
                        return;
                    }
                    if (!/^[a-z]+$/.test(val) || val.length < 4 || val.length > 20) {
                        statusDiv.innerText = t('Неверный формат (только a-z, от 4 до 20)');
                        statusDiv.style.color = '#ff4d4d';
                        return;
                    }
                    statusDiv.innerText = t('Проверка...');
                    statusDiv.style.color = '#888';
                    checkTimeout = setTimeout(async () => {
                        try {
                            const res = await fetch(`/api/check-username?username=${val}`, {
                                headers: { 'Authorization': `Bearer ${localStorage.getItem('4send_token')}` }
                            });
                            const data = await res.json();
                            if (data.available) {
                                statusDiv.innerText = t('Никнейм свободен');
                                statusDiv.style.color = '#34c759';
                            } else {
                                statusDiv.innerText = t('Никнейм занят');
                                statusDiv.style.color = '#ff4d4d';
                            }
                        } catch (e) {
                            statusDiv.innerText = '';
                        }
                    }, 500);
                });
            }
        });
    }, 150);
}

function injectQRButton() {
    const drawer = document.getElementById('menu-drawer');
    if (drawer && !document.getElementById('qr-btn')) {
        const qrBtn = document.createElement('div');
        qrBtn.id = 'qr-btn';
        qrBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:#a74fff;cursor:pointer;transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2z"/></svg>`;
        qrBtn.style.position = 'absolute';
        qrBtn.style.top = 'max(20px, calc(env(safe-area-inset-top) + 20px))';
        qrBtn.style.left = '20px';
        qrBtn.style.zIndex = '100';
        qrBtn.onclick = openQRModal;
        drawer.appendChild(qrBtn);

        const editBtn = document.createElement('div');
        editBtn.id = 'edit-profile-btn';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:#a74fff;cursor:pointer;transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>`;
        editBtn.style.position = 'absolute';
        editBtn.style.top = 'max(20px, calc(env(safe-area-inset-top) + 20px))';
        editBtn.style.right = '20px';
        editBtn.style.zIndex = '100';
        editBtn.onclick = openSettings;
        drawer.appendChild(editBtn);

        const oldEditItem = Array.from(drawer.querySelectorAll('.menu-item')).find(el => el.getAttribute('onclick') === 'openSettings()');
        if (oldEditItem) oldEditItem.style.display = 'none';
    }
}
function openQRModal() {
    typeof toggleMenu === 'function' && toggleMenu(false);
    let modal = document.getElementById('qr-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qr-modal';
        Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
        document.body.appendChild(modal);
    }
    const link = window.location.origin + '/?join=' + me;
    modal.innerHTML = `
        <style>
            #qr-reader { border: none !important; background: transparent !important; }
            #qr-reader video { object-fit: cover !important; border-radius: 16px !important; width: 100% !important; }
            #qr-reader__dashboard_section_csr span { color: #fff !important; }
            #qr-reader__dashboard_section_swaplink { color: #a74fff !important; text-decoration: none !important; font-weight: bold !important; }
            #qr-reader button { background: #a74fff !important; color: #fff !important; border: none !important; padding: 8px 16px !important; border-radius: 10px !important; cursor: pointer !important; margin-top: 10px !important; font-weight: bold !important; }
            #qr-reader select { background: #14141b !important; color: #fff !important; border: 1px solid rgba(167,79,255,0.3) !important; padding: 8px !important; border-radius: 10px !important; margin-bottom: 10px !important; width: 100% !important; outline: none !important; }
            #qr-reader__status_span { color: #fff !important; }
        </style>
        <div style="background: #1c1c23; width: 320px; padding: 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <div id="qr-tab-show" onclick="switchQRTab('show')" style="flex:1; padding:8px; border-radius:10px; background:#a74fff; color:#fff; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s;">${t('Мой QR')}</div>
                <div id="qr-tab-scan" onclick="switchQRTab('scan')" style="flex:1; padding:8px; border-radius:10px; background:transparent; color:#888; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s;">${t('Сканер')}</div>
            </div>
            <div id="qr-show-section">
                <div id="qrcode-container" style="background:#fff; padding:15px; border-radius:16px; display:inline-block; margin-bottom:15px;"></div>
                <div style="color:#a74fff; font-size:14px; font-weight:bold; margin-bottom:5px;">@${me}</div>
                <div style="color:#888; font-size:12px; margin-bottom:20px;">${t('Отсканируйте, чтобы начать чат')}</div>
            </div>
            <div id="qr-scan-section" style="display:none;">
                <div id="qr-reader" style="width:100%; border-radius:16px; overflow:hidden; margin-bottom:15px; border:2px solid #a74fff; background:transparent; min-height:200px;"></div>
            </div>
            <button onclick="closeQRModal()" style="width: 100%; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer;">${t('ЗАКРЫТЬ')}</button>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
        if (typeof QRCode === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            script.onload = () => {
                new QRCode(document.getElementById("qrcode-container"), { text: link, width: 200, height: 200, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
            };
            document.head.appendChild(script);
        } else {
            new QRCode(document.getElementById("qrcode-container"), { text: link, width: 200, height: 200, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
        }
    }, 10);
}

let isQrProcessing = false;

function closeQRModal() {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('div').style.transform = 'scale(0.9)';
    
    if (window.html5QrCode) {
        const qr = window.html5QrCode;
        window.html5QrCode = null;
        
        setTimeout(() => {
            qr.stop().then(() => {
                qr.clear();
            }).catch(() => {});
        }, 10);
    }
    
    setTimeout(() => {
        modal.style.display = 'none';
        isQrProcessing = false;
    }, 300);
}

function switchQRTab(tab) {
    document.getElementById('qr-tab-show').style.background = tab === 'show' ? '#a74fff' : 'transparent';
    document.getElementById('qr-tab-show').style.color = tab === 'show' ? '#fff' : '#888';
    document.getElementById('qr-tab-scan').style.background = tab === 'scan' ? '#a74fff' : 'transparent';
    document.getElementById('qr-tab-scan').style.color = tab === 'scan' ? '#fff' : '#888';
    document.getElementById('qr-show-section').style.display = tab === 'show' ? 'block' : 'none';
    document.getElementById('qr-scan-section').style.display = tab === 'scan' ? 'block' : 'none';
    
    if (tab === 'scan') {
        if (typeof Html5Qrcode === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode';
            script.onload = initScanner;
            document.head.appendChild(script);
        } else {
            initScanner();
        }
    } else {
        if (window.html5QrCode) {
            const qr = window.html5QrCode;
            window.html5QrCode = null;
            setTimeout(() => {
                qr.stop().then(() => qr.clear()).catch(()=>{});
            }, 10);
        }
    }
}

function initScanner() {
    if (window.html5QrCode) return;
    
    window.html5QrCode = new Html5Qrcode("qr-reader");
    
    window.html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText) => {
            if (isQrProcessing) return;
            isQrProcessing = true;

            if (navigator.vibrate) navigator.vibrate(50);

            closeQRModal();
            
            setTimeout(() => {
                try {
                    const url = new URL(decodedText);
                    const joinUser = url.searchParams.get('join');
                    if (joinUser) {
                        if (joinUser.startsWith('room_')) previewRoom(joinUser);
                        else selectChat(joinUser);
                    } else {
                        showToast(t("Неверный QR код"), true);
                    }
                } catch {
                    showToast(t("Неверный QR код"), true);
                }
            }, 350);
        },
        (errorMessage) => {
        }
    ).catch((err) => {
        showToast(t("Ошибка доступа к камере"), true);
    });
}

async function requestSafariPush() {
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS && !isStandalone) return;

    if ('Notification' in window && 'serviceWorker' in navigator) {
        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    getAndSendFCMToken();
                }
            } catch (e) {}
        } else if (Notification.permission === 'granted') {
            getAndSendFCMToken();
        }
    }
}

async function getAndSendFCMToken() {
    try {
        if (typeof firebase !== 'undefined' && firebase.messaging && window.firebaseVapidKey) {
            const messaging = firebase.messaging();
            
            const registration = await navigator.serviceWorker.register('/sw.js');
            
            const token = await messaging.getToken({ 
                vapidKey: window.firebaseVapidKey,
                serviceWorkerRegistration: registration 
            });
            
            if (token) {
                window.receiveFcmToken(token);
            }
        } else if (window.median && window.median.firebaseMessaging) {
            window.median.firebaseMessaging.getToken().then(token => {
                if (token) window.receiveFcmToken(token);
            });
        }
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof injectQRButton === 'function') injectQRButton();
    document.addEventListener('click', requestSafariPush, { once: true });
});

document.addEventListener('DOMContentLoaded', () => {
    injectQRButton();
    document.addEventListener('click', requestSafariPush, { once: true });
});
async function toggleArchiveView() {
    if (viewingArchive) {
        viewingArchive = false;
        const archiveBtn = document.querySelector('.menu-item[onclick="toggleArchiveView()"] span');
        if (archiveBtn) archiveBtn.innerText = t("Архив чатов");
        typeof toggleMenu === 'function' && toggleMenu();
        loadChatsWithPreview();
    } else {
        try {
            const token = localStorage.getItem('4send_token');
            const res = await fetch('/api/archive/password/status', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.hasPassword) {
                typeof toggleMenu === 'function' && toggleMenu(false);
                openArchiveUnlockModal();
            } else {
                executeArchiveEnter();
            }
        } catch {
            executeArchiveEnter();
        }
    }
}

function executeArchiveEnter() {
    viewingArchive = true;
    const archiveBtn = document.querySelector('.menu-item[onclick="toggleArchiveView()"] span');
    if (archiveBtn) archiveBtn.innerText = t("Выйти из архива");
    typeof toggleMenu === 'function' && toggleMenu();
    loadChatsWithPreview();
}

async function openArchiveSettingsModal() {
    let modal = document.getElementById('archive-settings-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'archive-settings-modal';
        document.body.appendChild(modal);
    }
    
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center">${t('Настройки архива')}</h3>
        <div id="archive-settings-loading" style="color:#888;text-align:center;margin-bottom:20px;">${t('Загрузка...')}</div>
        <div id="archive-settings-content" style="display:none;flex-direction:column;gap:12px;margin-bottom:24px;"></div>
        <button onclick="closeArchiveSettingsModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-size:16px;font-weight:600;transition:all 0.2s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" onmouseover="this.style.background='rgba(157,78,221,0.25)';this.style.borderColor='rgba(157,78,221,0.5)'" onmouseout="this.style.background='rgba(157,78,221,0.15)';this.style.borderColor='rgba(157,78,221,0.3)'">${t('Закрыть')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/archive/password/status', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        document.getElementById('archive-settings-loading').style.display = 'none';
        const contentDiv = document.getElementById('archive-settings-content');
        contentDiv.style.display = 'flex';
        
        if (data.hasPassword) {
            contentDiv.innerHTML = `
                <div style="color:#4caf50;font-size:14px;margin-bottom:10px;text-align:center;font-weight:bold;">${t('Пароль установлен')}</div>
                <button onclick="closeArchiveSettingsModal(openArchivePasswordRemoveModal)" style="width:100%;padding:16px;background:rgba(255,77,77,0.15);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3);border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Удалить пароль')}</button>
            `;
        } else {
            contentDiv.innerHTML = `
                <div style="color:#888;font-size:14px;margin-bottom:10px;text-align:center;">${t('Пароль не установлен')}</div>
                <button onclick="closeArchiveSettingsModal(openArchivePasswordSetupModal)" style="width:100%;padding:16px;background:linear-gradient(135deg,#00c6ff,#0072ff);color:#fff;border:none;border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;">${t('Установить пароль')}</button>
            `;
        }
    } catch {
        document.getElementById('archive-settings-loading').innerText = t('Ошибка загрузки');
    }
}

function closeArchiveSettingsModal(callback) {
    const modal = document.getElementById('archive-settings-modal');
    if (!modal) { 
        if (typeof callback === 'function') callback(); 
        return; 
    }
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

function openArchivePasswordSetupModal() {
    let modal = document.getElementById('archive-password-setup-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'archive-password-setup-modal';
        document.body.appendChild(modal);
    }
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;text-align:center">${t('Пароль на архив')}</h3>
        <input type="password" id="archive-new-pass" maxlength="30" placeholder="${t('Введите пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:20px;font-size:15px;">
        <button onclick="setupArchivePassword()" style="width:100%;padding:16px;background:linear-gradient(135deg,#00c6ff,#0072ff);color:#fff;border:none;border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;margin-bottom:12px;">${t('Установить')}</button>
        <button onclick="closeArchivePasswordSetupModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-weight:bold;transition:0.2s;">${t('Отмена')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
}

function closeArchivePasswordSetupModal(callback) {
    const modal = document.getElementById('archive-password-setup-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

async function setupArchivePassword() {
    const password = document.getElementById('archive-new-pass').value;
    if (!password) return showToast(t("Введите пароль"), true);
    if (password.length < 4 || password.length > 30) return showToast(t("Пароль от 4 до 30 символов"), true);
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/archive/password/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password })
        });
        if (res.ok) {
            showToast(t("Пароль установлен"), false);
            closeArchivePasswordSetupModal();
        } else {
            const err = await res.json();
            showToast(err.error || t("Ошибка"), true);
        }
    } catch { showToast(t("Ошибка соединения"), true); }
}

function openArchivePasswordRemoveModal() {
    let modal = document.getElementById('archive-password-remove-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'archive-password-remove-modal';
        document.body.appendChild(modal);
    }
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;text-align:center">${t('Удаление пароля')}</h3>
        <input type="password" id="archive-remove-pass" maxlength="30" placeholder="${t('Введите текущий пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:20px;font-size:15px;">
        <button onclick="removeArchivePassword()" style="width:100%;padding:16px;background:rgba(255,77,77,0.15);color:#ff4d4d;border:1px solid rgba(255,77,77,0.3);border-radius:14px;font-weight:bold;cursor:pointer;transition:0.2s;margin-bottom:12px;">${t('Удалить')}</button>
        <button onclick="closeArchivePasswordRemoveModal()" style="width:100%;padding:16px;background:rgba(157,78,221,0.15);color:#fff;border:2px solid rgba(157,78,221,0.3);border-radius:14px;cursor:pointer;font-weight:bold;transition:0.2s;">${t('Отмена')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
    });
}

function closeArchivePasswordRemoveModal(callback) {
    const modal = document.getElementById('archive-password-remove-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

async function removeArchivePassword() {
    const password = document.getElementById('archive-remove-pass').value;
    if (!password) return showToast(t("Введите пароль"), true);
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/archive/password/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password })
        });
        if (res.ok) {
            showToast(t("Пароль удален"), false);
            closeArchivePasswordRemoveModal();
        } else {
            const err = await res.json();
            showToast(err.error || t("Ошибка"), true);
        }
    } catch { showToast(t("Ошибка соединения"), true); }
}

function openArchiveUnlockModal() {
    let modal = document.getElementById('archive-unlock-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'archive-unlock-modal';
        document.body.appendChild(modal);
    }
    document.body.style.overflow = 'hidden';
    Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '11000', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,27,36,0.95)', backdropFilter: 'blur(20px)', webkitBackdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease' });
    
    modal.innerHTML = `<div class="modal-content" style="background:rgba(42,38,51,0.95);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);width:90%;max-width:380px;padding:32px 24px;border-radius:24px;border:1px solid rgba(157,78,221,0.2);box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9);opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)">
        <style>
            @keyframes archiveLockFloat {
                0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 4px 8px rgba(167,79,255,0.3)); }
                50% { transform: translateY(-6px) scale(1.05); filter: drop-shadow(0 12px 20px rgba(167,79,255,0.6)); }
            }
            @keyframes archiveLockPulseBg {
                0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 0.4; transform: translate(-50%, -50%) scale(1.4); }
            }
        </style>
        <div style="display:flex;justify-content:center;margin-bottom:20px;position:relative;height:60px;align-items:center;">
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:45px; height:45px; background:#a74fff; filter:blur(15px); border-radius:50%; animation: archiveLockPulseBg 3s infinite ease-in-out;"></div>
            <svg viewBox="0 0 24 24" style="width:52px;height:52px;fill:none;stroke:#a74fff;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round; animation: archiveLockFloat 3s infinite ease-in-out; position:relative; z-index:1;">
                <rect x="3" y="11" width="18" height="11" rx="3" ry="3"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                <circle cx="12" cy="16" r="1.5" fill="#a74fff" stroke="none"></circle>
            </svg>
        </div>
        <h3 style="margin:0 0 24px 0;color:#fff;font-size:22px;font-weight:700;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${t('Доступ к архиву')}</h3>
        <input type="password" id="archive-unlock-pass" maxlength="30" placeholder="${t('Введите пароль')}" style="width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;outline:none;box-sizing:border-box;margin-bottom:20px;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:all 0.2s ease;" onfocus="this.style.borderColor='#a74fff';this.style.background='rgba(167,79,255,0.05)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.background='rgba(255,255,255,0.05)'">
        <button onclick="unlockArchive()" style="width:100%;padding:16px;background:linear-gradient(135deg,#a74fff,#6a11cb);color:#fff;border:none;border-radius:14px;font-weight:bold;cursor:pointer;transition:all 0.2s ease;margin-bottom:12px;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 15px rgba(167,79,255,0.3);" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(167,79,255,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(167,79,255,0.3)'">${t('Войти')}</button>
        <button onclick="closeArchiveUnlockModal()" style="width:100%;padding:16px;background:rgba(255,255,255,0.05);color:#eee;border:1px solid rgba(255,255,255,0.1);border-radius:14px;cursor:pointer;font-weight:bold;transition:all 0.2s ease;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#eee'">${t('Отмена')}</button>
    </div>`;
    
    const content = modal.querySelector('.modal-content');
    modal.classList.remove('closing');
    document.body.classList.add('modal-open');
    Object.assign(modal.style, { display: 'flex', pointerEvents: 'auto' });
    
    requestAnimationFrame(() => {
        modal.classList.add('active');
        Object.assign(modal.style, { opacity: '1' });
        if (content) Object.assign(content.style, { opacity: '1', transform: 'scale(1)' });
        if (wasHidden && typeof pushNavigationState === 'function') pushNavigationState();
        setTimeout(() => document.getElementById('archive-unlock-pass')?.focus(), 100);
    });

    document.getElementById('archive-unlock-pass').onkeydown = e => {
        if (e.key === 'Enter') unlockArchive();
    };
}

function closeArchiveUnlockModal(callback) {
    const modal = document.getElementById('archive-unlock-modal');
    if (!modal) { if (typeof callback === 'function') callback(); return; }
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    const content = modal.querySelector('.modal-content');
    modal.classList.add('closing');
    modal.classList.remove('active');
    if (content) Object.assign(content.style, { opacity: '0', transform: 'scale(0.9)' });
    Object.assign(modal.style, { opacity: '0', pointerEvents: 'none' });
    setTimeout(() => {
        if (modal.classList.contains('closing')) modal.remove();
        if (typeof callback === 'function') callback();
    }, 300);
    if (typeof callback !== 'function' && typeof backIfNav === 'function') backIfNav();
}

async function unlockArchive() {
    const password = document.getElementById('archive-unlock-pass').value;
    if (!password) return showToast(t("Введите пароль"), true);
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/archive/password/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password })
        });
        if (res.ok) {
            closeArchiveUnlockModal(() => {
                executeArchiveEnter();
            });
        } else {
            const err = await res.json();
            showToast(err.error || t("Неверный пароль"), true);
            const inp = document.getElementById('archive-unlock-pass');
            if (inp) {
                inp.value = '';
                inp.focus();
            }
        }
    } catch { showToast(t("Ошибка соединения"), true); }
}

function showAvatarCropper(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        let modal = document.getElementById('avatar-cropper-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'avatar-cropper-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.9)', zIndex: '2147483648', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                opacity: '0', transition: 'opacity 0.3s'
            });
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div style="color:#fff; font-family:'Inter',sans-serif; font-size:18px; font-weight:bold; margin-bottom:20px;">${t('Редактирование фото')}</div>
            <div style="position:relative; width:300px; height:300px; overflow:hidden; border-radius:50%; border:2px solid #a74fff; touch-action:none; background:#000;">
                <img id="cropper-img" src="${e.target.result}" style="position:absolute; transform-origin:0 0; cursor:grab;">
            </div>
            <input type="range" id="cropper-zoom" min="1" max="3" step="0.01" value="1" style="width:250px; margin-top:30px; accent-color:#a74fff; position:relative; z-index:10;">
            <div style="display:flex; gap:15px; margin-top:30px; width:300px;">
                <button id="cropper-save" style="flex:1; padding:14px; background:#a74fff; border:none; border-radius:14px; color:#fff; font-weight:bold; cursor:pointer; transition:0.2s;">${t('СОХРАНИТЬ')}</button>
                <button id="cropper-cancel" style="flex:1; padding:14px; background:#2a2a3a; border:none; border-radius:14px; color:#fff; font-weight:bold; cursor:pointer; transition:0.2s;">${t('ОТМЕНА')}</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        setTimeout(() => modal.style.opacity = '1', 10);
        
        const img = document.getElementById('cropper-img');
        const zoomSlider = document.getElementById('cropper-zoom');
        let scale = 1, posX = 0, posY = 0;
        let isDragging = false, startX, startY, initialPosX, initialPosY;
        
        img.onload = () => {
            const minScale = Math.max(300 / img.naturalWidth, 300 / img.naturalHeight);
            scale = minScale;
            zoomSlider.min = minScale;
            zoomSlider.max = minScale * 3;
            zoomSlider.value = scale;
            
            posX = (300 - img.naturalWidth * scale) / 2;
            posY = (300 - img.naturalHeight * scale) / 2;
            updateTransform();
        };
        
        const updateTransform = () => {
            img.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        };
        
        zoomSlider.oninput = (ev) => {
            const newScale = parseFloat(ev.target.value);
            const centerX = 150;
            const centerY = 150;
            posX = centerX - (centerX - posX) * (newScale / scale);
            posY = centerY - (centerY - posY) * (newScale / scale);
            scale = newScale;
            updateTransform();
        };
        
        const startDrag = (ev) => {
            if(ev.target.tagName === 'INPUT') return;
            isDragging = true;
            startX = ev.clientX || ev.touches[0].clientX;
            startY = ev.clientY || ev.touches[0].clientY;
            initialPosX = posX;
            initialPosY = posY;
        };
        const doDrag = (ev) => {
            if (!isDragging) return;
            ev.preventDefault();
            const currentX = ev.clientX || ev.touches[0].clientX;
            const currentY = ev.clientY || ev.touches[0].clientY;
            posX = initialPosX + (currentX - startX);
            posY = initialPosY + (currentY - startY);
            updateTransform();
        };
        const endDrag = () => { isDragging = false; };
        
        img.addEventListener('mousedown', startDrag);
        img.addEventListener('touchstart', startDrag, {passive: false});
        window.addEventListener('mousemove', doDrag, {passive: false});
        window.addEventListener('touchmove', doDrag, {passive: false});
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchend', endDrag);
        
        document.getElementById('cropper-cancel').onclick = () => {
            modal.style.opacity = '0';
            setTimeout(() => modal.style.display = 'none', 300);
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('touchmove', doDrag);
            window.removeEventListener('mouseup', endDrag);
            window.removeEventListener('touchend', endDrag);
        };
        
        document.getElementById('cropper-save').onclick = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 300; canvas.height = 300;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, -posX / scale, -posY / scale, 300 / scale, 300 / scale, 0, 0, 300, 300);
            
            canvas.toBlob((blob) => {
                const croppedFile = new File([blob], "avatar.jpg", { type: "image/jpeg" });
                callback(croppedFile);
                document.getElementById('cropper-cancel').click();
            }, 'image/jpeg', 0.9);
        };
    };
    reader.readAsDataURL(file);
}
async function uploadNewAvatar(input){
    if(!input.files?.[0])return;
    showAvatarCropper(input.files[0], async (croppedFile) => {
        const fd=new FormData();
        fd.append('file', croppedFile);
        const token = localStorage.getItem('4send_token');
        const res=await fetch('/upload',{method:'POST',headers:{'Authorization':`Bearer ${token}`},body:fd});
        const d=await res.json();
        if(d.url){
            tempAvatarUrl=d.url;
            document.getElementById('p-av-preview').innerHTML=`<img src="${d.url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        }
    });
    input.value = '';
}
async function saveProfile(){
    const newName = document.getElementById('p-new-name')?.value.trim();
    const displayName = document.getElementById('p-display-name')?.value.trim();
    const bio = document.getElementById('p-bio')?.value.trim();
    
    if(!newName) return typeof showToast==='function'?showToast(t("Введите имя пользователя"), true):alert(t("Введите имя пользователя"));
    if(!/^[a-z]+$/.test(newName) || newName.length < 4 || newName.length > 20) return typeof showToast==='function'?showToast(t("Логин: только строчные буквы, от 4 до 20 символов"), true):alert(t("Неверный формат логина"));
    if(displayName && displayName.length > 30) return typeof showToast==='function'?showToast(t("Имя не должно превышать 30 символов"), true):alert(t("Имя слишком длинное"));

    try{
        const token = localStorage.getItem('4send_token');
        const res=await fetch('/auth/profile-update',{
            method:'POST',
            headers:{
                'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`
            },
            body:JSON.stringify({
                newUsername: newName, 
                avatarUrl: typeof tempAvatarUrl!=='undefined'?tempAvatarUrl:null,
                displayName: displayName,
                bio: bio
            })
        });
        if(res.ok){
            const d = await res.json();
            
            const oldUser = localStorage.getItem('4send_user');
            if (oldUser && oldUser !== d.newUsername) {
                let accounts = [];
                try { accounts = JSON.parse(localStorage.getItem('4send_accounts') || '[]'); } catch(e){}
                accounts = accounts.filter(a => a.username !== oldUser);
                localStorage.setItem('4send_accounts', JSON.stringify(accounts));
            }
            
            localStorage.setItem('4send_user', d.newUsername);
            if(d.avatarUrl) localStorage.setItem('4send_avatar', d.avatarUrl);
            if(d.newToken) localStorage.setItem('4send_token', d.newToken);
            if(d.displayName) localStorage.setItem('4send_displayName', d.displayName);
            
            if (typeof saveCurrentAccount === 'function') saveCurrentAccount();
            
            const currentAv = d.avatarUrl || localStorage.getItem('4send_avatar');
            const drawerAv = document.getElementById('drawer-av-box');
            const nameToDisplay = d.displayName || d.newUsername;
            const isVer = localStorage.getItem('4send_isVerified') === '1';
            
            if (typeof updateDrawerNameUI === 'function') {
                updateDrawerNameUI(nameToDisplay, d.newUsername, isVer);
            }
            
            if(drawerAv) drawerAv.innerHTML = getAvatarHtml(nameToDisplay, currentAv, 90, true);
            
            closeSettings();
            typeof showToast==='function'&&showToast(t("Профиль обновлен!"), false);
            setTimeout(() => location.reload(), 1000);
        }else{
            const err=await res.json();
            typeof showToast==='function'?showToast(err.error||t("Не удалось сохранить"), true):alert(t("Ошибка: ")+(err.error||t("Не удалось сохранить")));
        }
    }catch{
        typeof showToast==='function'?showToast(t("Нет связи с сервером"), true):alert(t("Нет связи с сервером"));
    }
}

socket.on('messages_read', data => {
    if (target === me) return;
    if (data.room && target !== data.room) return;
    document.querySelectorAll('.sent:not(.msg-read)').forEach(msg => {
        const statusBlock=msg.querySelector('.msg-status-block')??msg.querySelector('.status-icon')??msg.querySelector('div[style*="right:12px"]');
        if(!statusBlock)return;
        msg.classList.add('msg-read');
        statusBlock.classList.add('status-read');
        const timeText=msg.getAttribute('data-time')||"";
        const isEdited=!!msg.querySelector('.edit-mark')||(msg.querySelector('small')&&msg.querySelector('small').innerText.includes(t('ред.')));
        
        const timerEl = statusBlock.querySelector('.timer-icon-svg');
        const timerHtml = timerEl ? timerEl.outerHTML : '';
        
        const tick=`<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;transform:translateY(0.5px)"><path d="M4 12l4 4L18 6"/></svg>`;
        
        const isDarkPill = statusBlock.style.background.includes('rgba(0, 0, 0, 0.5)') || statusBlock.style.background.includes('rgba(0,0,0,0.5)');
        const timeColor = isDarkPill ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
        const tickColor = isDarkPill ? '#d4aaff' : '#a74fff';
        
        statusBlock.innerHTML=`${timerHtml}${isEdited?`<span class="edit-mark" style="font-size:11px;color:${timeColor};font-family:'Inter',sans-serif;line-height:14px">${t('ред.')}</span>`:''}<span style="font-size:11px;color:${timeColor};font-family:'Inter',sans-serif;line-height:14px">${timeText}</span><div style="position:relative;width:18px;height:14px;color:${tickColor};display:flex;align-items:center"><div style="position:absolute;left:0;display:flex;align-items:center">${tick}</div><div style="position:absolute;left:6px;display:flex;align-items:center;animation:tickArrival 0.4s forwards cubic-bezier(0.175,0.885,0.32,1.275)">${tick}</div></div>`;
    });
});
socket.on('archive_confirmed', (data) => {
    if (data && data.status === 'added') {
        typeof showToast === 'function' && showToast(t("Чат перенесен в архив"), false);
    } else if (data && data.status === 'removed') {
        typeof showToast === 'function' && showToast(t("Чат вынесен из архива"), false);
    }
    typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
});
socket.on('update_chat_list',()=>loadChatsWithPreview());
socket.on('msg_updated', data => {
    const msgElement = document.getElementById(`msg-${data.id}`);
    if (msgElement) {
        let textSpan = msgElement.querySelector('.msg-text');
        const contentWrapper = msgElement.querySelector('.msg-content-wrapper');
        
        if (!textSpan && data.text.trim() !== '' && contentWrapper) {
            textSpan = document.createElement('div');
            textSpan.className = 'msg-text';
            textSpan.style.cssText = "font-size:var(--msg-text-size, 15px);line-height:1.4;color:#eee;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap;max-width:100%;overflow:hidden;margin-top:8px";
            const statusBlock = msgElement.querySelector('.msg-status-block');
            if (statusBlock) contentWrapper.insertBefore(textSpan, statusBlock);
            else contentWrapper.appendChild(textSpan);
        }
        
        if (textSpan) {
            if (data.text.trim() === '') {
                textSpan.remove();
            } else {
                textSpan.innerHTML = typeof formatMessageText === 'function' ? formatMessageText(data.text) : escapeHTML(data.text);
                textSpan.setAttribute('data-original', data.text);
            }
        }
        
        const statusBlock = msgElement.querySelector('.msg-status-block');
        if (statusBlock && !statusBlock.querySelector('.edit-mark')) {
            const editMark = document.createElement('span');
            editMark.className = 'edit-mark';
            Object.assign(editMark.style, { color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: "'Inter',sans-serif", lineHeight: '14px' });
            editMark.innerText = t('ред.');
            
            const timerIcon = statusBlock.querySelector('.timer-icon-svg');
            if (timerIcon && timerIcon.nextSibling) {
                statusBlock.insertBefore(editMark, timerIcon.nextSibling);
            } else {
                statusBlock.insertBefore(editMark, statusBlock.firstChild);
            }
        }
        typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
    }
});
function scatterPattern(){
    const container=document.querySelector('.auth-pattern');
    if(!container)return;
    container.innerHTML='';
    const icons=['M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z','M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z','M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z','M7 2v11h3v9l7-12h-4l4-8z','M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z','M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z'];
    let html='';
    for(let i=0;i<9;i++){
        for(let j=0;j<7;j++){
            const d=icons[Math.floor(Math.random()*icons.length)];
            const size=Math.floor(Math.random()*35)+65;
            const x=(i*100/9)+(100/9/2)+(Math.random()*12-6);
            const y=(j*100/7)+(100/7/2)+(Math.random()*12-6);
            const rot=Math.floor(Math.random()*100)-50;
            const op=(Math.random()*0.05+0.04).toFixed(3);
            html+=`<svg class="pattern-svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="width:${size}px;height:${size}px;left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rot}deg);opacity:${op}"><path d="${d}"/></svg>`;
        }
    }
    container.innerHTML=html;
}
document.addEventListener('mousemove',e=>{
    const cx=window.innerWidth/2;
    const cy=window.innerHeight/2;
    const mouseX=(e.clientX-cx)/cx;
    const mouseY=(e.clientY-cy)/cy;
    document.querySelectorAll('.pattern-svg').forEach(svg=>{
        const depth=(parseFloat(svg.getAttribute('width'))||60)/100;
        const rotation=svg.style.transform.match(/rotate\((.*?)\)/)?.[0]||'rotate(0deg)';
        svg.style.transform=`translate(calc(-50% + ${mouseX*25*depth}px), calc(-50% + ${mouseY*25*depth}px)) ${rotation}`;
    });
});
window.addEventListener('load',scatterPattern);
function openDeleteMenu(){
    typeof toggleMenu==='function'&&toggleMenu(false);
    const modal=document.getElementById('delete-modal');
    let wasHidden = !modal || modal.style.display === 'none' || modal.style.display === '';
    const card=document.getElementById('delete-modal-card');
    
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    
    const userInput = document.getElementById('confirm-user-input');
    if (userInput && !userInput.dataset.styled) {
        userInput.dataset.styled = 'true';
        userInput.setAttribute('maxlength', '20');
        userInput.onfocus = () => {
            userInput.style.borderColor = '#ff3b30';
            userInput.style.background = 'rgba(255,59,48,0.1)';
        };
        userInput.onblur = () => {
            userInput.style.borderColor = 'rgba(255,59,48,0.3)';
            userInput.style.background = 'rgba(255,255,255,0.05)';
        };
    }

    if(card && !document.getElementById('confirm-pass-input')) {
        const passInput = document.createElement('input');
        passInput.type = 'password';
        passInput.id = 'confirm-pass-input';
        passInput.placeholder = t('Введите ваш пароль');
        passInput.setAttribute('maxlength', '30');
        Object.assign(passInput.style, {
            width: '100%',
            padding: '14px 16px',
            marginBottom: '24px',
            borderRadius: '14px',
            border: '2px solid rgba(255,59,48,0.3)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            fontSize: '15px',
            transition: 'all 0.2s ease'
        });
        passInput.onfocus = () => {
            passInput.style.borderColor = '#ff3b30';
            passInput.style.background = 'rgba(255,59,48,0.1)';
        };
        passInput.onblur = () => {
            passInput.style.borderColor = 'rgba(255,59,48,0.3)';
            passInput.style.background = 'rgba(255,255,255,0.05)';
        };
        
        if (userInput) {
            userInput.parentNode.insertBefore(passInput, userInput.nextSibling);
        }
    }

    if (card) {
        const cancelBtn = card.querySelector('button[onclick*="closeDeleteMenu"]');
        if (cancelBtn) {
            cancelBtn.onclick = () => closeDeleteMenu();
            cancelBtn.innerText = t("ЗАКРЫТЬ");
        }
    }

    if(modal&&card){
        Object.assign(modal.style,{
            display:'flex',
            opacity:'0',
            backdropFilter:'blur(20px)',
            webkitBackdropFilter:'blur(20px)',
            transition:'opacity 0.3s ease',
            pointerEvents:'auto'
        });
        Object.assign(card.style,{
            opacity:'0',
            transform:'scale(0.9)',
            transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'
        });
        
        requestAnimationFrame(()=>{
            Object.assign(modal.style,{opacity:'1'});
            Object.assign(card.style,{opacity:'1',transform:'scale(1)'});
            setTimeout(() => {
                document.getElementById('confirm-user-input')?.focus();
            }, 100);
            if (wasHidden && typeof pushNavigationState==='function') pushNavigationState();
        });
    }
}

function closeDeleteMenu(callback){
    const modal=document.getElementById('delete-modal');
    const card=document.getElementById('delete-modal-card');
    
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    
    if(modal&&card){
        Object.assign(modal.style,{
            opacity:'0',
            pointerEvents:'none'
        });
        Object.assign(card.style,{
            opacity:'0',
            transform:'scale(0.9)'
        });
        
        setTimeout(()=>{
            modal.style.display='none';
            const input=document.getElementById('confirm-user-input');
            if(input) input.value='';
            const passInput=document.getElementById('confirm-pass-input');
            if(passInput) passInput.value='';
            if(typeof callback === 'function') callback();
        },300);
        
        if(typeof callback !== 'function' && typeof backIfNav==='function') backIfNav();
    } else if (typeof callback === 'function') {
        callback();
    }
}

async function processAccountDeletion(){
    const inputVal=document.getElementById('confirm-user-input')?.value.trim();
    const passVal=document.getElementById('confirm-pass-input')?.value.trim();
    if(inputVal!==me)return showToast(t("Логин введен неверно!"));
    if(!passVal)return showToast(t("Введите пароль!"));
    try{
        const token = localStorage.getItem('4send_token');
        const res=await fetch('/api/delete-account',{
            method:'POST',
            headers:{
                'Content-Type':'application/json',
                'Authorization': `Bearer ${token}`
            },
            body:JSON.stringify({ password: passVal })
        });
        const data=await res.json();
        if(data.success){
            showToast(t("Аккаунт успешно удален"),false);
            setTimeout(()=>{localStorage.clear();location.reload();},1000);
        }else showToast(t("Ошибка: ")+data.error);
    }catch{showToast(t("Ошибка связи с сервером!"));}
}
async function prepareForward(id){
    msgToForward=id;
    const modal=document.getElementById('forward-modal');
    let wasHidden = modal.style.display === 'none' || modal.style.display === '';
    const list=document.getElementById('forward-list');
    modal.style.display='flex';
    if (wasHidden) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    list.innerHTML=`<div style="text-align:center;padding:20px;color:#555">${t('Загрузка...')}</div>`;
    try{
        const res=await fetch(`/chats-extended/${me}?t=${Date.now()}`);
        const chats=await res.json();
        list.innerHTML='';
        chats.filter(chat => !(chat.isRoom && chat.roomType === 'channel')).forEach(chat=>{
            const isSaved=chat.username===me;
            const displayName = chat.displayName || chat.name || chat.username;
            const row=document.createElement('div');
            Object.assign(row.style,{padding:'10px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer',borderRadius:'12px',transition:'0.2s',marginBottom:'5px'});
            row.onmouseover=()=>row.style.background="rgba(167,79,255,0.1)";
            row.onmouseout=()=>row.style.background="transparent";
            row.onclick=()=>confirmForward(chat.username);
            row.innerHTML=`<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:1px solid #333;flex-shrink:0">${isSaved?savedIconSvg:getAvatarHtml(displayName,chat.avatar,40)}</div><div style="font-weight:bold;font-size:14px;color:#eee">${isSaved?t('Избранное'):escapeHTML(displayName)}</div>`;
            list.appendChild(row);
        });
    }catch{list.innerHTML=`<div style="color:red">${t('Ошибка загрузки')}</div>`;}}
window.confirmForward = function(targetUser) {
    if (!msgToForward || (Array.isArray(msgToForward) && msgToForward.length === 0)) return;
    
    if (Array.isArray(msgToForward)) {
        msgToForward.forEach(id => {
            socket.emit('forward_message', {msgId: id, fromUser: me, toUser: targetUser});
        });
    } else {
        socket.emit('forward_message', {msgId: msgToForward, fromUser: me, toUser: targetUser});
    }
    
    closeForward();
    if (targetUser.toLowerCase() === target.toLowerCase()) target = '';
    selectChat(targetUser);
    if (window.isMultiSelectMode) closeMultiSelect();
};
function closeForward(){
    const modal = document.getElementById('forward-modal');
    if (modal.style.display === 'none') return;
    modal.style.display='none';
    msgToForward=null;
    typeof backIfNav==='function'&&backIfNav();
}
let scrollUnreadCount=0;
window.scrollTimeouts = window.scrollTimeouts ||[];
function scrollToBottom(smooth=false, force=false){
    const c=document.getElementById('msg-container');
    if(!c)return;
    
    const isNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 500;
    if (!smooth && !force && !isNearBottom) {
        return; 
    }

    if(typeof scrollUnreadCount!=='undefined'){
        scrollUnreadCount=0;
        typeof updateScrollBadge==='function'&&updateScrollBadge();
    }

    window.scrollTimeouts.forEach(clearTimeout);
    window.scrollTimeouts =[];

    const doScroll = () => { if(c) c.scrollTop = c.scrollHeight + 1500; };
    if(smooth){
        c.scrollTo({top:c.scrollHeight + 1500,behavior:'smooth'});
        window.scrollTimeouts.push(setTimeout(doScroll, 300));
    }else{
        doScroll();
        window.scrollTimeouts.push(setTimeout(doScroll, 100));
        window.scrollTimeouts.push(setTimeout(doScroll, 300));
    }
}
function updateScrollBadge(){
    const badge=document.getElementById('scroll-unread-badge');
    if(!badge)return;
    if(typeof scrollUnreadCount!=='undefined'&&scrollUnreadCount>0){
        badge.innerText=scrollUnreadCount;
        badge.style.display='flex';
    }else badge.style.display='none';
}
let tempRoomAvatarUrl = null;

function openCreateRoomModal() {
    typeof toggleMenu === 'function' && toggleMenu(false);
    tempRoomAvatarUrl = null;
    let modal = document.getElementById('create-room-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'create-room-modal';
        Object.assign(modal.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', opacity: '0', transition: 'all 0.3s ease' });
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background: #1c1c23; width: 340px; padding: 25px; border-radius: 24px; border: 1px solid rgba(167,79,255,0.3); text-align: center; transform: scale(0.9); transition: all 0.3s ease; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color: #fff; margin-bottom: 15px; font-family: 'Inter', sans-serif;">${t('Создать')}</h3>
            
            <div id="room-av-preview" onclick="document.getElementById('room-av-input').click()" style="width:80px; height:80px; border-radius:50%; margin:0 auto 15px; background:rgba(167,79,255,0.1); border:2px dashed #a74fff; cursor:pointer; overflow:hidden; display:flex; align-items:center; justify-content:center; transition: transform 0.2s ease;">
                <svg viewBox="0 0 24 24" style="width:30px; fill:#a74fff;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <input type="file" id="room-av-input" hidden accept="image/*" onchange="uploadRoomAvatar(this)">
            
            <input type="text" id="room-name-input" maxlength="30" oninput="autoGenerateLink()" placeholder="${t('Название')}" style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); color: #fff; outline: none; box-sizing: border-box;">
            <textarea id="room-desc-input" maxlength="100" placeholder="${t('Описание')}" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); color: #fff; outline: none; box-sizing: border-box; resize: none; height: 60px;"></textarea>
            
            <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:12px; padding:4px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);">
                <div id="btn-type-group" onclick="setRoomType('group')" style="flex:1; padding:8px; border-radius:10px; background:#a74fff; color:#fff; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s;">${t('Группа')}</div>
                <div id="btn-type-channel" onclick="setRoomType('channel')" style="flex:1; padding:8px; border-radius:10px; background:transparent; color:#888; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s;">${t('Канал')}</div>
            </div>
            <input type="hidden" id="room-type-val" value="group">

            <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:12px; padding:4px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);">
                <div id="btn-priv-private" onclick="setRoomPrivacy('private')" style="flex:1; padding:8px; border-radius:10px; background:#a74fff; color:#fff; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s;">${t('Частный')}</div>
                <div id="btn-priv-public" onclick="setRoomPrivacy('public')" style="flex:1; padding:8px; border-radius:10px; background:transparent; color:#888; font-size:13px; font-weight:bold; cursor:pointer; transition:0.2s;">${t('Публичный')}</div>
            </div>
            <input type="hidden" id="room-privacy-val" value="private">

            <div id="room-link-container" style="margin-bottom: 20px; display: none; text-align:left;">
                <label style="color:#a74fff; font-size:11px; font-weight:bold; margin-left:5px;">${t('Ссылка для поиска')}</label>
                <input type="text" id="room-link-input" maxlength="30" placeholder="${t('Название')}" style="width: 100%; padding: 12px; margin-top:4px; border-radius: 12px; border: 1px solid rgba(167,79,255,0.3); background: rgba(0,0,0,0.2); color: #fff; outline: none; box-sizing: border-box;">
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="confirmCreateRoom()" style="flex: 1; padding: 12px; background: #a74fff; border: none; border-radius: 14px; color: #fff; font-weight: bold; cursor: pointer;">${t('СОЗДАТЬ')}</button>
                <button onclick="closeCreateRoomModal()" style="flex: 1; padding: 12px; background: #2a2a3a; border: none; border-radius: 14px; color: #eee; font-weight: bold; cursor: pointer;">${t('ОТМЕНА')}</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    setTimeout(() => {
        const linkInput = document.getElementById('room-link-input');
        if(linkInput) {
            linkInput.addEventListener('input', () => {
                linkInput.dataset.userEdited = 'true';
            });
        }
    }, 100);
}

function closeCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('div').style.transform = 'scale(0.9)';
    setTimeout(() => modal.style.display = 'none', 300);
}

function toggleRoomLinkInput() {
    const privacy = document.getElementById('room-privacy-select').value;
    const linkInput = document.getElementById('room-link-input');
    linkInput.style.display = privacy === 'public' ? 'block' : 'none';
}
function setRoomType(type) {
    document.getElementById('room-type-val').value = type;
    document.getElementById('btn-type-group').style.background = type === 'group' ? '#a74fff' : 'transparent';
    document.getElementById('btn-type-group').style.color = type === 'group' ? '#fff' : '#888';
    document.getElementById('btn-type-channel').style.background = type === 'channel' ? '#a74fff' : 'transparent';
    document.getElementById('btn-type-channel').style.color = type === 'channel' ? '#fff' : '#888';
}

function setRoomPrivacy(priv) {
    document.getElementById('room-privacy-val').value = priv;
    document.getElementById('btn-priv-private').style.background = priv === 'private' ? '#a74fff' : 'transparent';
    document.getElementById('btn-priv-private').style.color = priv === 'private' ? '#fff' : '#888';
    document.getElementById('btn-priv-public').style.background = priv === 'public' ? '#a74fff' : 'transparent';
    document.getElementById('btn-priv-public').style.color = priv === 'public' ? '#fff' : '#888';
    
    document.getElementById('room-link-container').style.display = priv === 'public' ? 'block' : 'none';
    autoGenerateLink();
}

function transliterate(text) {
    const ru = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 
        'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 
        'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 
        'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 
        'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 
        'ш': 'sh', 'щ': 'sch', 'ь': 'y', 'ы': 'y', 'ъ': 'y', 
        'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return text.toLowerCase().split('').map(char => ru[char] || char).join('');
}

function autoGenerateLink() {
    const isPublic = document.getElementById('room-privacy-val').value === 'public';
    const name = document.getElementById('room-name-input').value.trim();
    const linkInput = document.getElementById('room-link-input');
    
    if (isPublic && name) {
        let generated = transliterate(name).replace(/[^a-z]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (!linkInput.dataset.userEdited) {
            linkInput.value = generated;
        }
    }
}
let recordMode = 'audio';
let recPressTimer;
let isRecording = false;
let isRecBtnPressed = false;
let isRecordingLocked = false;
let shouldSendRecord = false;
let startX = 0;
let startY = 0;
let isFlashOn = false;
let currentFacingMode = "user";
let videoPreviewStream = null;
let videoPreviewEl = null;
let hiddenCanvas = null;
let hiddenCtx = null;
let currentAudioTrack = null;
let canvasStream = null;

const micSvg = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:#fff;transition:0.2s;"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
const camSvg = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:0.2s;"><rect x="4" y="4" width="16" height="16" rx="5" ry="5"></rect><circle cx="12" cy="12" r="4"></circle></svg>`;
const trashSvg = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:#ff4d4d;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const flashSvg = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`;
const switchCamSvg = `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;

window.startRecording = async function() {
    if (document.getElementById('messageText')?.disabled) {
        if (typeof showToast === 'function') showToast(t("Отправка сообщений ограничена"), true);
        return;
    }
    if (isRecording) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (typeof showToast === 'function') showToast(t("Ваш браузер не поддерживает запись медиа"), true);
        return;
    }

    seconds = 0;
    isRecording = true;
    shouldSendRecord = true;

    if (!document.getElementById('rec-anim-style')) {
        const s = document.createElement('style');
        s.id = 'rec-anim-style';
        s.innerHTML = `
            @keyframes slideUpPill { 0% { transform: translate(-50%, 30px) scale(0.9); opacity: 0; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
            @keyframes slideUpLock { 0% { transform: translateY(30px) scale(0.9); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
            @keyframes slideUpVideoFront { 0% { transform: translate(-50%, calc(-50% + 30px)) scaleX(-1) scale(0.9); opacity: 0; } 100% { transform: translate(-50%, -50%) scaleX(-1) scale(1); opacity: 1; } }
            @keyframes slideUpVideoBack { 0% { transform: translate(-50%, calc(-50% + 30px)) scaleX(1) scale(0.9); opacity: 0; } 100% { transform: translate(-50%, -50%) scaleX(1) scale(1); opacity: 1; } }
        `;
        document.head.appendChild(s);
    }

    const ui = document.createElement('div');
    ui.id = 'recording-ui-pill';
    ui.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; background:#1c1c23; padding:10px 20px; border-radius:30px; border:1px solid #a74fff; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div class="rec-dot" style="width:10px; height:10px; background:#ff4d4d; border-radius:50%; animation: pulse 1s infinite;"></div>
            <div id="rec-timer-display" style="color:#fff; font-weight:bold; font-variant-numeric: tabular-nums;">00:00</div>
            <canvas id="rec-waveform" width="80" height="24" style="display:none; margin-left:5px;"></canvas>
            <div id="rec-slide-cancel" style="color:#888; font-size:13px; margin-left:10px; white-space:nowrap;">&lt; ${t('Отмена')}</div>
            <div id="rec-locked-controls" style="display:${isRecordingLocked ? 'flex' : 'none'}; gap:15px; align-items:center; margin-left:10px;">
                <button onclick="cancelRecording()" style="background:none; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">${typeof trashSvg !== 'undefined' ? trashSvg : '🗑️'}</button>
                <button onclick="stopRecording(true)" style="background:#a74fff; border:none; border-radius:50%; width:32px; height:32px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;"><svg viewBox="0 0 24 24" style="width:16px; fill:#fff;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
            </div>
        </div>
        <style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }</style>
    `;
    Object.assign(ui.style, {
        position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000, width: 'max-content',
        animation: 'slideUpPill 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
    });
    document.getElementById('chat-window').appendChild(ui);

    if (!isRecordingLocked) {
        const lockIndicator = document.createElement('div');
        lockIndicator.id = 'rec-lock-indicator';
        lockIndicator.innerHTML = `<div style="background:rgba(0,0,0,0.5); border-radius:20px; padding:10px; display:flex; flex-direction:column; align-items:center; gap:5px; backdrop-filter:blur(5px);"><svg viewBox="0 0 24 24" style="width:20px; fill:#fff;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg><svg viewBox="0 0 24 24" style="width:16px; fill:#fff; animation: slideUpAnim 1s infinite;"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg></div>`;
        Object.assign(lockIndicator.style, {
            position: 'absolute', bottom: '70px', right: '15px', zIndex: 9999, transition: 'transform 0.1s',
            animation: 'slideUpLock 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        });
        document.getElementById('chat-window').appendChild(lockIndicator);
    }

    if (recordMode === 'video') {
        videoPreviewEl = document.createElement('video');
        videoPreviewEl.muted = true;
        videoPreviewEl.playsInline = true;
        Object.assign(videoPreviewEl.style, {
            position: 'fixed', top: '35vh', left: '50%', 
            transform: currentFacingMode === 'user' ? 'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%) scaleX(1)',
            width: '280px', height: '280px', borderRadius: '50%', objectFit: 'cover',
            zIndex: '10001', border: '4px solid #a74fff', boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
            animation: (currentFacingMode === 'user' ? 'slideUpVideoFront' : 'slideUpVideoBack') + ' 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        });
        document.body.appendChild(videoPreviewEl);

        const camControls = document.createElement('div');
        camControls.id = 'cam-controls';
        camControls.innerHTML = `
            <button id="flash-btn" onclick="toggleFlash()" style="background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(5px); transition:0.2s;">${typeof flashSvg !== 'undefined' ? flashSvg : '⚡'}</button>
            <button onclick="switchCamera()" style="background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(5px); transition:0.2s;">${typeof switchCamSvg !== 'undefined' ? switchCamSvg : '🔄'}</button>
        `;
        Object.assign(camControls.style, {
            position: 'fixed', top: 'calc(35vh + 160px)', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '30px', zIndex: '10001',
            animation: 'slideUpPill 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        });
        document.body.appendChild(camControls);
    }

    window.isRequestingMedia = true;

    try {
        if (videoPreviewStream) {
            videoPreviewStream.getTracks().forEach(t => t.stop());
            videoPreviewStream = null;
        }

        const constraints = recordMode === 'video' 
            ? { audio: true, video: { facingMode: currentFacingMode, width: { ideal: 720 }, height: { ideal: 720 } } }
            : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100 } };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        window.isRequestingMedia = false;
        localStorage.setItem('4send_media_perms', 'granted');
        
        let finalAudioStream = stream;
        if (recordMode === 'audio') {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioCtx.createMediaStreamSource(stream);
                
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 64;
                source.connect(analyser);
                
                window.recAnalyser = analyser;
                window.recDataArray = new Uint8Array(analyser.frequencyBinCount);
                window.recCanvas = document.getElementById('rec-waveform');
                if (window.recCanvas) {
                    window.recCanvas.style.display = 'block';
                    window.recCanvasCtx = window.recCanvas.getContext('2d');
                    drawWaveform();
                }

                const gainNode = audioCtx.createGain();
                gainNode.gain.value = 3.5; 
                const destination = audioCtx.createMediaStreamDestination();
                analyser.connect(gainNode);
                gainNode.connect(destination);
                finalAudioStream = destination.stream;
            } catch(e) {}
        }

        let mimeType = recordMode === 'video' ? 'video/webm' : 'audio/ogg';
        if (recordMode === 'video' && !MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
        }
        
        audioChunks = [];
        let options = { mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : '' };

        if (recordMode === 'video') {
            hiddenCanvas = document.createElement('canvas');
            hiddenCanvas.width = 600;
            hiddenCanvas.height = 600;
            hiddenCtx = hiddenCanvas.getContext('2d');

            videoPreviewStream = stream;
            currentAudioTrack = stream.getAudioTracks()[0];
            videoPreviewEl.srcObject = stream;
            await videoPreviewEl.play();

            canvasStream = hiddenCanvas.captureStream(30);
            canvasStream.addTrack(currentAudioTrack);
            
            options.videoBitsPerSecond = 2500000;
            mediaRecorder = new MediaRecorder(canvasStream, options);

            const drawFrame = () => {
                if (!isRecording) return;
                if (videoPreviewEl && videoPreviewEl.readyState >= 2) {
                    hiddenCtx.save();
                    const minDim = Math.min(videoPreviewEl.videoWidth, videoPreviewEl.videoHeight);
                    const sx = (videoPreviewEl.videoWidth - minDim) / 2;
                    const sy = (videoPreviewEl.videoHeight - minDim) / 2;
                    hiddenCtx.drawImage(videoPreviewEl, sx, sy, minDim, minDim, 0, 0, 600, 600);
                    hiddenCtx.restore();
                }
                requestAnimationFrame(drawFrame);
            };
            drawFrame();

        } else {
            videoPreviewStream = stream;
            options.audioBitsPerSecond = 128000;
            mediaRecorder = new MediaRecorder(finalAudioStream, options);
        }

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

        if (target && socket.connected) {
            socket.emit('typing', {sender: me, receiver: target, isVoice: recordMode === 'audio', isVideo: recordMode === 'video'});
        }
        
        mediaRecorder.onstop = async () => {
            if (videoPreviewStream) videoPreviewStream.getTracks().forEach(t => t.stop());
            if (!shouldSendRecord) return; 
            
            if (audioChunks.length === 0) return;
            const blob = new Blob(audioChunks, {type: recordMode === 'video' ? 'video/mp4' : 'audio/ogg'});
            
            if (blob.size > 25 * 1024 * 1024) {
                if (typeof showFileLimitModal === 'function') showFileLimitModal();
                return;
            }
            
            const tempId = '4S_up_' + Date.now();
            const localUrl = URL.createObjectURL(blob);
            const tempMsg = {
                id: tempId, tempId: tempId, sender: me, receiver: target,
                text: recordMode === 'video' ? t('📹 Видеосообщение') : t('🎤 Голосовое сообщение'),
                fileUrl: localUrl, isAudio: recordMode === 'audio', isVideoNote: recordMode === 'video',
                timestamp: new Date().toISOString(), isLoading: true
            };
            
            const delayMinutes = window.scheduledMessageTime || 0;

            if (delayMinutes === 0) {
                if (typeof renderMessage === 'function') { renderMessage(tempMsg); scrollToBottom(); }
            }

            const fd = new FormData();
            fd.append('file', blob, recordMode === 'video' ? 'v.mp4' : 'v.ogg');
            try {
                const token = localStorage.getItem('4send_token');
                const r = await fetch('/upload', {method: 'POST', headers: {'Authorization': `Bearer ${token}`}, body: fd});
                if (!r.ok) throw new Error();
                const d = await r.json();
                const textValue = recordMode === 'video' ? t('📹 Видеосообщение') : t('🎤 Голосовое сообщение');

                const emitData = {
                    sender: me, receiver: target, fileUrl: d.url, text: textValue, 
                    isAudio: recordMode === 'audio', isVideoNote: recordMode === 'video', is_encrypted: true, 
                    reply_to: typeof replyText !== 'undefined' ? replyText : null, 
                    reply_to_id: typeof replyMsgId !== 'undefined' ? replyMsgId : null
                };

                if (delayMinutes > 0) {
                    addScheduledTask(delayMinutes, () => {
                        if (typeof renderMessage === 'function') {
                            tempMsg.fileUrl = d.url;
                            tempMsg.isLoading = false;
                            renderMessage(tempMsg);
                            scrollToBottom();
                        }
                        if (socket.connected) socket.emit('chat_message', emitData);
                    }, textValue);
                    window.scheduledMessageTime = 0;
                } else {
                    const tempEl = document.getElementById(`msg-${tempId}`);
                    if (tempEl) tempEl.parentElement.remove();
                    URL.revokeObjectURL(localUrl);
                    if (socket.connected) socket.emit('chat_message', emitData);
                }
            } catch(err) {
                const tempEl = document.getElementById(`msg-${tempId}`);
                if (tempEl) tempEl.parentElement.remove();
                URL.revokeObjectURL(localUrl);
                if (typeof showToast === 'function') showToast(t("Ошибка загрузки"));
            }
        };
        
        mediaRecorder.start();
        if (typeof recordInterval !== 'undefined') clearInterval(recordInterval);
        recordInterval = setInterval(() => {
            seconds++;
            const timerEl = document.getElementById('rec-timer-display');
            if (timerEl) {
                const m = Math.floor(seconds / 60);
                const s = seconds % 60;
                timerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            if (target && socket.connected && seconds % 2 === 0) {
                socket.emit('typing', {sender: me, receiver: target, isVoice: recordMode === 'audio', isVideo: recordMode === 'video'});
            }
        }, 1000);

    } catch(err) {
        window.isRequestingMedia = false;
        cleanupRecordingUI();
        if (typeof showToast === 'function') showToast(t("Разрешите доступ к камере/микрофону"), true);
    }
};

window.drawWaveform = function() {
    if (!isRecording || recordMode !== 'audio') return;
    requestAnimationFrame(drawWaveform);
    if (!window.recAnalyser || !window.recCanvasCtx) return;
    
    window.recAnalyser.getByteFrequencyData(window.recDataArray);
    const ctx = window.recCanvasCtx;
    const width = window.recCanvas.width;
    const height = window.recCanvas.height;
    
    ctx.clearRect(0, 0, width, height);
    const barWidth = (width / window.recAnalyser.frequencyBinCount) * 2.5;
    let x = 0;
    
    for(let i = 0; i < window.recAnalyser.frequencyBinCount; i++) {
        const barHeight = (window.recDataArray[i] / 255) * height;
        if (barHeight > 0) {
            ctx.fillStyle = '#a74fff';
            ctx.beginPath();
            ctx.roundRect(x, height - barHeight, barWidth - 1, barHeight, 2);
            ctx.fill();
        }
        x += barWidth;
    }
};

window.toggleVideoNotePlayback = function(container) {
    const v = container.querySelector('video');
    const icon = container.querySelector('.vn-sound-icon');
    const circle = container.querySelector('.vn-progress-circle');
    
    if (v.paused || v.muted) {
        pauseAllMedia(v);
        v.muted = false;
        v.loop = false;
        v.currentTime = 0;
        v.play();
        icon.style.display = 'none';
        
        const updateFrame = () => {
            if(!v.muted && !v.paused) {
                const progress = v.currentTime / v.duration;
                const offset = 760 - (progress * 760);
                if(circle) circle.style.strokeDashoffset = offset;
                requestAnimationFrame(updateFrame);
            }
        };
        requestAnimationFrame(updateFrame);
        
        v.onended = () => {
            v.muted = true;
            v.loop = true;
            v.pause();
            v.currentTime = 0;
            icon.style.display = 'flex';
            icon.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px; fill:#fff;"><path d="M8 5v14l11-7z"/></svg>`;
            if(circle) circle.style.strokeDashoffset = 760;
            playNextMedia(v);
        };
    } else {
        v.muted = true;
        v.loop = true;
        v.pause();
        icon.style.display = 'flex';
        icon.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px; fill:#fff;"><path d="M8 5v14l11-7z"/></svg>`;
        if(circle) circle.style.strokeDashoffset = 760;
    }
};
function pluralize(n, forms) {
    if (window.currentLang === 'en') {
        return n + ' ' + (n === 1 ? forms[0] : (forms[1] || forms[0]));
    }
    let idx;
    if (n % 10 === 1 && n % 100 !== 11) idx = 0;
    else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) idx = 1;
    else idx = 2;
    return n + ' ' + forms[idx];
}
function stopRecording() {
    if(mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    const pan = document.getElementById('record-panel');
    if(pan) pan.style.display = 'none';
    clearInterval(recordInterval);
    target && socket.connected && socket.emit('typing', {sender: me, receiver: target, stop: true});
    seconds = 0;
}
async function uploadRoomAvatar(input) {
    if(!input.files?.[0]) return;
    showAvatarCropper(input.files[0], async (croppedFile) => {
        const fd = new FormData();
        fd.append('file', croppedFile);
        try {
            const token = localStorage.getItem('4send_token');
            const res = await fetch('/upload', {method: 'POST', headers:{'Authorization':`Bearer ${token}`}, body: fd});
            const d = await res.json();
            if(d.url) {
                tempRoomAvatarUrl = d.url;
                document.getElementById('room-av-preview').innerHTML = `<img src="${d.url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
                document.getElementById('room-av-preview').style.border = 'none';
            }
        } catch {}
    });
    input.value = '';
}
function confirmCreateRoom() {
    const name = document.getElementById('room-name-input').value.trim();
    const description = document.getElementById('room-desc-input').value.trim();
    const type = document.getElementById('room-type-val').value;
    const isPublic = document.getElementById('room-privacy-val').value === 'public';
    let publicLink = document.getElementById('room-link-input').value.trim();
    
    if (!name) return showToast(t("Введите название"));
    
    if (isPublic) {
        if (!publicLink) return showToast(t("Введите публичную ссылку"));
        if (!/^[a-zA-Z_]+$/.test(publicLink)) return showToast(t("Ссылка может содержать только буквы и _"));
    } else {
        publicLink = 'join_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    }

    socket.emit('create_room', { name, description, type, isPublic, publicLink, avatar: tempRoomAvatarUrl });
    closeCreateRoomModal();
    showToast(t("Создано успешно"), false);
}

if(msgContainer){
    msgContainer.onscroll=function(){
        const wrapper=document.getElementById('scroll-down-wrapper');
        if(!wrapper)return;
        if(this.scrollHeight-this.scrollTop-this.clientHeight>300){
            if(wrapper.style.display!=='flex'){
                wrapper.style.display='flex';
                setTimeout(()=>Object.assign(wrapper.style,{opacity:'1',pointerEvents:'auto'}),10);
            }
        }else{
            if(wrapper.style.opacity==='1'){
                Object.assign(wrapper.style,{opacity:'0',pointerEvents:'none'});
                if(typeof scrollUnreadCount!=='undefined'){
                    scrollUnreadCount=0;
                    updateScrollBadge();
                }
                setTimeout(()=>{if(wrapper.style.opacity==='0')wrapper.style.display='none';},300);
            }
        }
    };
}
document.getElementById('forwardSearch')?.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('#forward-list > div').forEach(el=>el.style.display=el.innerText.toLowerCase().includes(q)?'flex':'none');
});
window.addEventListener('DOMContentLoaded',()=>{if(sessionStorage.getItem('4send_is_locked')==='1')lockApp();});
if(typeof initScrollArrow!=='undefined')clearInterval(initScrollArrow);
document.addEventListener('median_ready', () => {
    if (window.median?.firebaseMessaging) {
        window.median.firebaseMessaging.getToken().then(token => {
            if (token && typeof me !== 'undefined' && me) {
                const jwtToken = localStorage.getItem('4send_token');
                fetch('/api/save-push-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwtToken}` 
                    },
                    body: JSON.stringify({ token: token })
                }).catch(()=>{});
            }
        });
    } 
    else if (window.AndroidInterface && window.AndroidInterface.getFirebaseToken) {
        const token = window.AndroidInterface.getFirebaseToken();
        if (token && typeof me !== 'undefined' && me) {
            const jwtToken = localStorage.getItem('4send_token');
            fetch('/api/save-push-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({ token: token })
            }).catch(()=>{});
        }
    }
});

window.setFirebaseTokenFromApp = function(token) {
    if (token && typeof me !== 'undefined' && me) {
        const jwtToken = localStorage.getItem('4send_token');
        fetch('/api/save-push-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ token: token })
        }).catch(()=>{});
    }
};
const verifyBadge = `<svg title="${t('Верифицированный аккаунт')}" style="width:15px;height:15px;fill:#a74fff;margin-left:4px;flex-shrink:0;display:block;" viewBox="0 0 24 24"><path d="M23 11.99l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 11.99l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 11.99zm-12.93 4.46l-3.53-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.65 5.66z"/></svg>`;
window.closeAdminPanel = function() {
    const modal = document.getElementById('admin-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 400);
};
async function loadAdminUsers() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    try {
        const res = await fetch(`/api/admin/users?me=${me}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('4send_token')}` } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const users = await res.json();
        list.innerHTML = '';
        
        if (!Array.isArray(users) || users.length === 0) {
            list.innerHTML = `<div style="padding:30px; text-align:center; color:#888;">${t('Список пуст')}</div>`;
            return;
        }
        
        users.forEach(u => {
            const div = document.createElement('div');
            div.className = 'admin-table-row';
            div.onclick = () => openAdminUserDetails(u.username);
            
            const safeName = escapeHTML(u.username);
            const badge = u.isVerified ? (typeof verifyBadge !== 'undefined' ? verifyBadge : '✔️') : '';
            const avatar = typeof getAvatarHtml === 'function' ? getAvatarHtml(u.username, u.avatar, 36) : '';
        const roleText = u.role === 'banned' ? `<span style="color:#ff4d4d;background:rgba(255,77,77,0.1);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Забанен')}</span>` : (u.role === 'admin' ? `<span style="color:#a74fff;background:rgba(167,79,255,0.1);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Админ')}</span>` : `<span style="color:#888;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${t('Юзер')}</span>`);

            let statusText = '';
            if (u.isOnline) {
                statusText = `<span style="color:#4caf50;font-size:12px;font-weight:600;">${t('В сети')}</span>`;
            } else {
                const lastSeen = u.last_seen ? new Date(u.last_seen).toLocaleString(globalLocale, {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : t('Неизвестно');
                statusText = `<span style="color:#888;font-size:12px;font-weight:600;">${t('Был(а): ')}${lastSeen}</span>`;
            }

            div.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;overflow:hidden;">
                    <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:1px solid ${u.isVerified?'#a74fff':'#333'};flex-shrink:0;">${avatar}</div>
                    <div style="color:#eee;font-weight:600;font-size:14px;display:flex;align-items:center;overflow:hidden;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeName}</span>${badge}</div>
                </div>
                <div class="admin-hide-mobile">${roleText}</div>
                <div class="admin-hide-mobile">${statusText}</div>
                <div style="color:#a74fff;font-size:13px;font-weight:600;">${t('Детали ›')}</div>
            `;
            list.appendChild(div);
        });
    } catch (err) {
        list.innerHTML = `<div style="padding:30px; text-align:center; color:#ff4d4d;">${t('Ошибка: ')}${escapeHTML(err.message)}</div>`;
    }
}

window.openAdminUserDetails = async function(username) {
    switchAdminTab('details');
    const content = document.getElementById('admin-details-content');
    content.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">${t('Загрузка данных...')}</div>`;
    
    try {
        const res = await fetch(`/api/admin/user/${username}`);
        const u = await res.json();
        
        const isBanned = u.role === 'banned';
        const lastSeenDate = u.last_seen ? new Date(u.last_seen).toLocaleString(globalLocale) : t('Неизвестно');
        
        content.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:25px; cursor:pointer; color:#888; font-weight:600; transition:0.2s; width:fit-content;" onclick="switchAdminTab('users')" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">
                <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg> ${t('Назад к списку')}
            </div>
            
            <div class="admin-card" style="display:flex; flex-direction:column; align-items:center; text-align:center; margin-bottom:20px;">
                <div style="width:100px;height:100px;border-radius:50%;overflow:hidden;border:3px solid ${u.isVerified?'#a74fff':'rgba(255,255,255,0.1)'}; margin-bottom:15px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">${getAvatarHtml(u.username,u.avatar,100)}</div>
                <div style="font-size:24px; font-weight:800; color:#fff; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:5px;">${escapeHTML(u.username)}${u.isVerified?verifyBadge:''}</div>
                <div style="color:#888; font-size:14px; margin-bottom:20px;">${t('Роль')}: <span style="color:#eee;">${u.role}</span> • ${t('Был в сети')}: <span style="color:#eee;">${lastSeenDate}</span></div>
                
                <div style="display:flex; gap:15px; width:100%; max-width:400px;">
                    <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:16px; flex:1; border:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:24px; color:#a74fff; font-weight:800; margin-bottom:4px;">${u.msgCount || 0}</div>
                        <div style="font-size:12px; color:#888; text-transform:uppercase; font-weight:600;">${t('Сообщений')}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:16px; flex:1; border:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:24px; color:#00c6ff; font-weight:800; margin-bottom:4px;">${u.roomCount || 0}</div>
                        <div style="font-size:12px; color:#888; text-transform:uppercase; font-weight:600;">${t('Групп/Каналов')}</div>
                    </div>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px;">
                <button onclick="showUserProfile('${escapeAttr(u.username)}'); closeAdminPanel();" style="padding:16px; border-radius:16px; border:none; background:rgba(255,255,255,0.05); color:#fff; font-weight:700; cursor:pointer; transition:0.2s; border:1px solid rgba(255,255,255,0.1);" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">${t('ОТКРЫТЬ ПРОФИЛЬ')}</button>
                <button onclick="toggleUserVerify('${escapeAttr(u.username)}', ${!u.isVerified}); setTimeout(()=>openAdminUserDetails('${escapeAttr(u.username)}'), 500);" style="padding:16px; border-radius:16px; border:none; background:${u.isVerified?'rgba(255,77,77,0.1)':'rgba(167,79,255,0.15)'}; color:${u.isVerified?'#ff4d4d':'#a74fff'}; font-weight:700; cursor:pointer; transition:0.2s; border:1px solid ${u.isVerified?'rgba(255,77,77,0.3)':'rgba(167,79,255,0.3)'};" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">${u.isVerified?t('ЗАБРАТЬ ВЕРИФИКАЦИЮ'):t('ВЫДАТЬ ВЕРИФИКАЦИЮ')}</button>
                <button onclick="toggleUserBan('${escapeAttr(u.username)}', ${!isBanned}); setTimeout(()=>openAdminUserDetails('${escapeAttr(u.username)}'), 500);" style="padding:16px; border-radius:16px; border:none; background:${isBanned?'rgba(76,175,80,0.1)':'rgba(255,152,0,0.1)'}; color:${isBanned?'#4caf50':'#ff9800'}; font-weight:700; cursor:pointer; transition:0.2s; border:1px solid ${isBanned?'rgba(76,175,80,0.3)':'rgba(255,152,0,0.3)'};" onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">${isBanned?t('РАЗБЛОКИРОВАТЬ'):t('ЗАБЛОКИРОВАТЬ')}</button>
                <button onclick="deleteUserAdmin('${escapeAttr(u.username)}')" style="padding:16px; border-radius:16px; border:none; background:rgba(255,77,77,0.1); color:#ff4d4d; font-weight:700; cursor:pointer; transition:0.2s; border:1px solid rgba(255,77,77,0.3);" onmouseover="this.style.background='rgba(255,77,77,0.2)'" onmouseout="this.style.background='rgba(255,77,77,0.1)'">${t('УДАЛИТЬ АККАУНТ')}</button>
            </div>
        `;
    } catch {
        content.innerHTML = `<div style="padding:40px; text-align:center; color:#ff4d4d;">${t('Ошибка загрузки данных')}</div>`;
    }
};

window.loadAdminStats = function() {
    fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('4send_token')}` } })
        .then(r => r.json())
        .then(data => {
            document.getElementById('admin-stat-users').innerText = data.users || 0;
            document.getElementById('admin-stat-rooms').innerText = data.rooms || 0;
            document.getElementById('admin-stat-msgs-total').innerText = data.messagesTotal || 0;
            document.getElementById('admin-stat-online').innerText = data.onlineCount || 0;
            
            const usersTodayEl = document.getElementById('admin-stat-users-today');
            if(usersTodayEl) usersTodayEl.innerText = '+' + (data.usersToday || 0);
            
            const roomsTodayEl = document.getElementById('admin-stat-rooms-today');
            if(roomsTodayEl) roomsTodayEl.innerText = '+' + (data.roomsToday || 0);
            
            const msgsTodayEl = document.getElementById('admin-stat-msgs');
            if(msgsTodayEl) msgsTodayEl.innerText = '+' + (data.messagesToday || 0);

            if (data.charts && typeof Chart !== 'undefined') {
                const renderChart = (id, label, color, chartData) => {
                    const ctx = document.getElementById(id);
                    if (!ctx) return;
                    const labels = chartData.map(d => d._id);
                    const values = chartData.map(d => d.count);
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{
                                label,
                                data: values,
                                borderColor: color,
                                backgroundColor: color + '33',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { labels: { color: '#fff' } } },
                            scales: {
                                x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                                y: { ticks: { color: '#888', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
                            }
                        }
                    });
                };
                renderChart('chart-users', t('Новые пользователи'), '#a74fff', data.charts.users);
                renderChart('chart-rooms', t('Новые группы/каналы'), '#00c6ff', data.charts.rooms);
                renderChart('chart-msgs', t('Сообщения'), '#ff9500', data.charts.messages);
            }
        }).catch(()=>{});
};

window.cleanupDateSeparators = function() {
    const c = document.getElementById('msg-container');
    if (!c) return;
    let currentDate = null;
    Array.from(c.children).forEach(child => {
        if (child.classList.contains('date-separator')) {
            const dateText = child.innerText.trim();
            if (dateText === currentDate) {
                child.remove();
            } else {
                currentDate = dateText;
            }
        }
    });
};
window.toggleUserBan = async function(username, ban) {
    try {
        await fetch('/api/admin/ban-user', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ targetUsername: username, ban })
        });
        showToast(ban ? t("Пользователь заблокирован") : t("Пользователь разблокирован"), !ban);
    } catch {}
};

window.deleteUserAdmin = async function(username) {
    if (!confirm(t('Точно удалить аккаунт {name}? Это действие необратимо.', {name: username}))) return;
    try {
        await fetch('/api/admin/delete-user', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ targetUsername: username })
        });
        showToast(t("Аккаунт удален"), false);
        loadAdminUsers();
    } catch {}
};
async function toggleUserVerify(targetUsername,verify){try{const res=await fetch('/api/admin/toggle-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({me,targetUsername,verify})});if(res.ok)loadAdminUsers();}catch{}}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{const role=localStorage.getItem('4send_role');if(role==='admin'){const drawer=document.getElementById('menu-drawer');if(drawer){const adminBtn=document.createElement('div');adminBtn.className='menu-item';adminBtn.onclick=openAdminPanel;adminBtn.innerHTML=`<svg viewBox="0 0 24 24" style="fill:#a74fff"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg><span>${t('Админ панель')}</span>`;drawer.appendChild(adminBtn);}}},500);});
if (document.getElementById('msg-container')) {
    document.getElementById('msg-container').onscroll = null; 
}
(function setupScrollButton(){
    if(typeof initScrollArrow!=='undefined')clearInterval(initScrollArrow);
    if(typeof newInitScrollArrow!=='undefined')clearInterval(newInitScrollArrow);
    
    const oldContainer=document.getElementById('msg-container');
    if(oldContainer && oldContainer.onscroll){
        oldContainer.onscroll = null;
    }

    let wrapper=document.getElementById('scroll-down-wrapper');
    if(!wrapper){
        wrapper=document.createElement('div');
        wrapper.id='scroll-down-wrapper';
        wrapper.innerHTML=`<div id="scroll-unread-badge" style="display:none;background:#ff4b4b;color:white;font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:10px;align-items:center;justify-content:center;padding:0 6px;margin-bottom:5px;box-shadow:0 2px 8px rgba(0,0,0,0.5)">0</div><button id="scroll-down-btn" onclick="scrollToBottom(true)" style="width:38px;height:38px;border-radius:50%;background:#252530;border:1px solid rgba(167,79,255,0.4);color:#a74fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 25px rgba(0,0,0,0.6);backdrop-filter:blur(15px);transition:all 0.3s ease" onmouseover="this.style.background='rgba(167,79,255,0.15)';this.style.borderColor='#a74fff';this.style.transform='scale(1.05)'" onmouseout="this.style.background='#252530';this.style.borderColor='rgba(167,79,255,0.4)';this.style.transform='scale(1)'"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><path d="M6 9l6 6 6-6"/></svg></button>`;
        document.body.appendChild(wrapper);
    }
    Object.assign(wrapper.style,{position:'fixed',right:'20px',bottom:'85px',zIndex:'999999',display:'none',flexDirection:'column',alignItems:'center',opacity:'0',transition:'all 0.3s ease',transform:'translateY(20px)',pointerEvents:'none'});
    
    const container=document.getElementById('msg-container');
    if(!container){setTimeout(setupScrollButton,500);return;}
    
    const checkScroll = () => {
        const profileModal = document.getElementById('user-profile-modal');
        const isProfileOpen = profileModal && profileModal.classList.contains('active');
        
        if (container.scrollHeight - container.scrollTop - container.clientHeight > 100) {
            if (window.scrollTimeouts) {
                window.scrollTimeouts.forEach(clearTimeout);
                window.scrollTimeouts =[];
            }
        }

        if(target && !isProfileOpen && container.scrollHeight-container.scrollTop-container.clientHeight>300){
            if(wrapper.style.display==='none'||wrapper.style.opacity==='0'){
                wrapper.style.setProperty('display','flex','important');
                void wrapper.offsetWidth;
                wrapper.style.setProperty('opacity','1','important');
                wrapper.style.setProperty('transform','translateY(0)','important');
                wrapper.style.setProperty('pointer-events','auto','important');
            }
        }else{
            if(wrapper.style.opacity==='1'){
                wrapper.style.setProperty('opacity','0','important');
                wrapper.style.setProperty('transform','translateY(20px)','important');
                wrapper.style.setProperty('pointer-events','none','important');
                if(typeof scrollUnreadCount!=='undefined'){
                    scrollUnreadCount=0;
                    typeof updateScrollBadge==='function'&&updateScrollBadge();
                }
                setTimeout(()=>{if(wrapper.style.opacity==='0')wrapper.style.setProperty('display','none','important');},300);
            }
        }

        if (container.scrollTop <= 800 && !window.allLoaded && !window.isLoadingHistory && target) {
            loadMoreHistory(target);
        }
    };
    
    container.addEventListener('scroll', checkScroll);
    setInterval(checkScroll, 500);
})();
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #menu-drawer { top: 0 !important; bottom: 0 !important; height: auto !important; padding-top: max(20px, env(safe-area-inset-top)) !important; padding-bottom: max(20px, env(safe-area-inset-bottom)) !important; }
        #menu-drawer .menu-item { display: flex !important; align-items: center !important; gap: 14px !important; }
        #menu-drawer .menu-item svg { width: 22px !important; height: 22px !important; min-width: 22px !important; margin: 0 !important; flex-shrink: 0 !important; }
        #toast-notify { z-index: 2147483647 !important; top: max(20px, env(safe-area-inset-top)) !important; width: max-content !important; max-width: 90vw !important; }
        @keyframes iconPop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideUpAnim { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
        .icon-anim { animation: iconPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; transform-origin: bottom center; transition: transform 0.1s; }
        #main-action-btn.mic-mode { background: var(--accent) !important; color: #fff !important; }
        #main-action-btn { width: 40px; height: 40px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: background-color 0.3s ease, color 0.3s ease, transform 0.2s ease; touch-action: none; }
        #main-action-btn.mic-mode { background: transparent; color: #888; }
        #main-action-btn.send-mode { background: var(--accent); color: #fff; }
        #icon-mic, #icon-send { position: absolute; display: flex; align-items: center; justify-content: center; transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease; }
        #main-action-btn.mic-mode #icon-mic { transform: scale(1) rotate(0deg); opacity: 1; }
        #main-action-btn.mic-mode #icon-send { transform: scale(0.5) rotate(-60deg); opacity: 0; }
        #main-action-btn.send-mode #icon-mic { transform: scale(0.5) rotate(60deg); opacity: 0; }
        #main-action-btn.send-mode #icon-send { transform: scale(1) rotate(0deg); opacity: 1; }
        #main-action-btn:active { transform: scale(0.9) !important; }
        #main-action-btn.media-restricted.mic-mode { pointer-events: none !important; color: #555 !important; }
        #main-action-btn.media-restricted.mic-mode svg { fill: #555 !important; }
    `;
    document.head.appendChild(style);

    const actionBtn = document.getElementById('main-action-btn');
    if (actionBtn) {
        let pressTimer;
        let isLongPress = false;

        const handleDown = (e) => {
            if (e.type !== 'touchstart' && e.button !== 0 && e.button !== 2) return;
            
            const isSendMode = actionBtn.classList.contains('send-mode');

            if (e.button === 2) {
                e.preventDefault();
                if (isSendMode) toggleSendOptionsMenu(e, actionBtn);
                return;
            }

            if (e.pointerId) actionBtn.setPointerCapture(e.pointerId);

            isLongPress = false;
            isRecBtnPressed = true;

            if (isSendMode) {
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    toggleSendOptionsMenu(e, actionBtn);
                }, 400);
            } else {
                e.preventDefault();
                shouldSendRecord = false;
                startX = e.clientX;
                startY = e.clientY;
                
                isRecordingLocked = false;
                recPressTimer = setTimeout(() => {
                    if(isRecBtnPressed) startRecording();
                }, 300);
            }
        };

        const handleMove = (e) => {
            if (!isRecBtnPressed) return;
            if (actionBtn.classList.contains('send-mode')) {
                clearTimeout(pressTimer);
                return;
            }
            
            if (!isRecording || isRecordingLocked) return;
            
            const x = e.clientX;
            const y = e.clientY;
            
            const diffY = startY - y;
            const diffX = startX - x;

            const wrapper = document.getElementById('icon-mic');

            if (diffY > 0) {
                const lockInd = document.getElementById('rec-lock-indicator');
                if (lockInd) lockInd.style.transform = `translateY(-${Math.min(diffY, 60)}px)`;
                
                if (wrapper) {
                    const stretch = Math.min(diffY / 30, 1.5);
                    wrapper.style.transform = `scaleY(${1 + stretch}) translateY(-${stretch * 8}px)`;
                }
            }

            if (diffY > 60) { 
                isRecordingLocked = true;
                if (wrapper) wrapper.style.transform = 'scale(1) translateY(0)';
                const cancelText = document.getElementById('rec-slide-cancel');
                const lockedControls = document.getElementById('rec-locked-controls');
                const lockInd = document.getElementById('rec-lock-indicator');
                if (cancelText) cancelText.style.display = 'none';
                if (lockedControls) lockedControls.style.display = 'flex';
                if (lockInd) lockInd.remove();
            } else if (diffX > 80) { 
                cancelRecording();
                isRecBtnPressed = false;
                if (wrapper) wrapper.style.transform = 'scale(1) translateY(0)';
            }
        };

        const handleUp = (e) => {
            if (e.pointerId) actionBtn.releasePointerCapture(e.pointerId);
            clearTimeout(pressTimer);
            
            const wrapper = document.getElementById('icon-mic');
            if (wrapper) wrapper.style.transform = 'scale(1) translateY(0)';

            if (!isRecBtnPressed) return;
            isRecBtnPressed = false;

            if (actionBtn.classList.contains('send-mode')) {
                if (!isLongPress && e.button !== 2) {
                    send();
                }
                return;
            }

            e.preventDefault();
            clearTimeout(recPressTimer);

            if(isRecording) {
                if (!isRecordingLocked) {
                    stopRecording(true);
                }
            } else {
                if (window.isRequestingMedia) return;
                recordMode = recordMode === 'audio' ? 'video' : 'audio';
                if (wrapper) {
                    const oldSvg = wrapper.querySelector('svg');
                    if (oldSvg) {
                        oldSvg.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
                        oldSvg.style.transform = 'scale(0.5) rotate(-90deg)';
                        oldSvg.style.opacity = '0';
                        setTimeout(() => {
                            wrapper.innerHTML = recordMode === 'audio' ? micSvg : camSvg;
                            const newSvg = wrapper.querySelector('svg');
                            if (newSvg) {
                                newSvg.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease';
                                newSvg.style.transform = 'scale(0.5) rotate(90deg)';
                                newSvg.style.opacity = '0';
                                void newSvg.offsetWidth;
                                newSvg.style.transform = 'scale(1) rotate(0deg)';
                                newSvg.style.opacity = '1';
                            }
                        }, 150);
                    } else {
                        wrapper.innerHTML = recordMode === 'audio' ? micSvg : camSvg;
                    }
                }
            }
        };

        actionBtn.addEventListener('pointerdown', handleDown);
        document.addEventListener('pointermove', handleMove);
        document.addEventListener('pointerup', handleUp);
        document.addEventListener('pointercancel', handleUp);
        actionBtn.addEventListener('contextmenu', e => e.preventDefault());
    }
});
window.cancelRecording = function() {
    shouldSendRecord = false;
    if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    cleanupRecordingUI();
};

window.stopRecording = function(send = true) {
    shouldSendRecord = send;
    if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    cleanupRecordingUI();
};
window.toggleSendOptionsMenu = function(e, btnElement) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById('send-options-menu');
    const btn = btnElement || document.getElementById('main-action-btn');
    if (!menu || !btn) return;

    const closeMenu = () => {
        menu.classList.add('timer-closing');
        setTimeout(() => {
            menu.style.display = 'none';
            menu.classList.remove('timer-closing');
        }, 200);
    };

    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.classList.remove('timer-closing');
        menu.style.display = 'flex';
        
        const btnRect = btn.getBoundingClientRect();
        const bottomPos = window.innerHeight - btnRect.top + 12;
        
        menu.style.bottom = `${bottomPos}px`;
        menu.style.top = 'auto';
        menu.style.right = '12px';
        menu.style.left = 'auto';
        
        window.currentMenuBtnRect = btnRect;
    } else {
        closeMenu();
    }
};
window.openTimerMenuFromOptions = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const optionsMenu = document.getElementById('send-options-menu');
    if (optionsMenu) optionsMenu.style.display = 'none';
    
    const timerMenu = document.getElementById('timer-menu');
    if (timerMenu && window.currentMenuBtnRect) {
        timerMenu.classList.remove('timer-closing');
        timerMenu.style.display = 'flex';
        const bottomPos = window.innerHeight - window.currentMenuBtnRect.top + 12;
        timerMenu.style.bottom = `${bottomPos}px`;
        timerMenu.style.top = 'auto';
        timerMenu.style.right = '12px';
        timerMenu.style.left = 'auto';
    }
};
window.openScheduleMenuFromOptions = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const optionsMenu = document.getElementById('send-options-menu');
    if (optionsMenu) optionsMenu.style.display = 'none';
    
    const scheduleMenu = document.getElementById('schedule-menu');
    if (scheduleMenu && window.currentMenuBtnRect) {
        scheduleMenu.classList.remove('timer-closing');
        scheduleMenu.style.display = 'flex';
        const bottomPos = window.innerHeight - window.currentMenuBtnRect.top + 12;
        scheduleMenu.style.bottom = `${bottomPos}px`;
        scheduleMenu.style.top = 'auto';
        scheduleMenu.style.right = '12px';
        scheduleMenu.style.left = 'auto';
    }
};

window.scheduledMessageTime = 0;
window.setSchedule = function(min, label) {
    window.scheduledMessageTime = min;
    const menu = document.getElementById('schedule-menu');
    if (menu) {
        menu.classList.add('timer-closing');
        setTimeout(() => { menu.style.display = 'none'; menu.classList.remove('timer-closing'); }, 200);
    }
    if (min > 0) {
        if (typeof showToast === 'function') showToast(t('Сообщение будет отправлено: {label}', {label}), false);
    } else {
        if (typeof showToast === 'function') showToast(t('Отправка по расписанию отменена'), false);
    }
};
function cleanupRecordingUI() {
    isRecording = false;
    const ui = document.getElementById('recording-ui-pill');
    if (ui) ui.remove();
    const lockInd = document.getElementById('rec-lock-indicator');
    if (lockInd) lockInd.remove();
    if (videoPreviewEl) {
        videoPreviewStream?.getTracks().forEach(t => t.stop());
        videoPreviewEl.remove();
        videoPreviewEl = null;
    }
    const camControls = document.getElementById('cam-controls');
    if (camControls) camControls.remove();
    const flash = document.getElementById('front-flash-overlay');
    if (flash) flash.remove();
    isFlashOn = false;
    clearInterval(recordInterval);
    seconds = 0;
    target && socket.connected && socket.emit('typing', {sender: me, receiver: target, stop: true});
}
window.toggleFlash = async function() {
    isFlashOn = !isFlashOn;
    const btn = document.getElementById('flash-btn');
    if (btn) btn.style.background = isFlashOn ? '#a74fff' : 'rgba(0,0,0,0.5)';

    if (currentFacingMode === 'environment' && videoPreviewStream) {
        const track = videoPreviewStream.getVideoTracks()[0];
        try {
            await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
        } catch (e) {}
    } else {
        let flashOverlay = document.getElementById('front-flash-overlay');
        if (isFlashOn) {
            if (!flashOverlay) {
                flashOverlay = document.createElement('div');
                flashOverlay.id = 'front-flash-overlay';
                Object.assign(flashOverlay.style, {
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: '#fff', opacity: 0.85, zIndex: 9999, pointerEvents: 'none'
                });
                document.body.appendChild(flashOverlay);
            }
        } else {
            if (flashOverlay) flashOverlay.remove();
        }
    }
};
window.switchCamera = function() {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    cancelRecording();
    setTimeout(() => startRecording(), 300);
};
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chat-header { padding-top: max(15px, env(safe-area-inset-top)) !important; }
        #sidebar > div:first-child { padding-top: max(20px, env(safe-area-inset-top)) !important; }
    `;
    document.head.appendChild(style);
});
document.addEventListener('DOMContentLoaded', () => {
    const timerBtn = document.getElementById('timer-btn');
    if (timerBtn) {
        timerBtn.removeAttribute('onclick');
        timerBtn.addEventListener('pointerdown', e => {
            e.preventDefault(); 
            toggleTimerMenu(e);
        });
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (typeof isRecording !== 'undefined' && isRecording) {
            cancelRecording();
        }
    } else {
        if (window.me) {
            if (socket && !socket.connected) socket.connect();
            
            const msgInput = document.getElementById('messageText');
            if (msgInput && !msgInput.disabled) {
                msgInput.blur();
            }
            
            if (target) {
                if (target.startsWith('room_')) {
                    socket.emit('mark_read', {sender: target, receiver: me, isRoom: true});
                } else {
                    socket.emit('mark_read', {sender: target, receiver: me});
                }

                fetch(`/api/is-blocked/${me}/${target}`).then(r=>r.json()).then(data => {
                    if (!data.blocked && msgInput) {
                        msgInput.disabled = false;
                    msgInput.placeholder = t("Написать...");
                        msgInput.style.opacity = "1";
                        const sendBtn = document.querySelector('button[onclick="send()"]');
                        if (sendBtn) Object.assign(sendBtn.style, {pointerEvents: "auto", opacity: "1"});
                    }
                }).catch(()=>{});

                fetch(`/history/${me.toLowerCase()}/${target.toLowerCase()}?t=${Date.now()}`, {
                    headers: {'Authorization': `Bearer ${localStorage.getItem('4send_token')}`}
                }).then(r => r.json()).then(async serverMsgs => {
                    if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
                        const cacheKey = 'history_' + target.toLowerCase();
                        let cached = await idbGet(cacheKey) ||[];
                        
                        const uniqueMsgs = new Map();
                        cached.forEach(m => uniqueMsgs.set(m.id, m));
                        serverMsgs.forEach(m => uniqueMsgs.set(m.id, m));
                        const mergedMsgs = Array.from(uniqueMsgs.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                        await idbSet(cacheKey, mergedMsgs);
                        
                        serverMsgs.forEach(m => {
                            if (typeof renderMessage === 'function') renderMessage(m, true);
                        });
                        
                        if (typeof scrollToBottom === 'function') scrollToBottom(false, false);
                    }
                }).catch(()=>{});
            }
            typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
        }
    }
});
window.removeMsgFromCache = async function(id) {
    try {
        const db = await dbPromise;
        const tx = db.transaction('cache', 'readwrite');
        const store = tx.objectStore('cache');
        const keysReq = store.getAllKeys();
        const keys = await new Promise(r => { keysReq.onsuccess = () => r(keysReq.result); keysReq.onerror = () => r([]); });
        for (const key of keys) {
            if (key.startsWith('history_')) {
                const getReq = store.get(key);
                const msgs = await new Promise(r => { getReq.onsuccess = () => r(getReq.result); getReq.onerror = () => r(null); });
                if (Array.isArray(msgs)) {
                    const filtered = msgs.filter(m => m.id !== id && m.tempId !== id);
                    if (filtered.length !== msgs.length) {
                        store.put(filtered, key);
                    }
                }
            }
        }
    } catch (e) {}
};
window.deleteMessageClient = function(id) {
    if (socket && socket.connected) {
        socket.emit('delete_msg', id);
    }
    
    typeof removeMsgFromCache === 'function' && removeMsgFromCache(id);
    
    const el = document.getElementById(`msg-${id}`);
    if (el) {
        const wrapper = el.parentElement;
        const prev = wrapper.previousElementSibling;
        const next = wrapper.nextElementSibling;
        
        const container = document.getElementById('msg-container');
        const isAtBottom = container && (container.scrollHeight - container.scrollTop - container.clientHeight < 80);

        wrapper.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'scale(0.9) translateX(30px)';
        
        if (!next || next.classList.contains('date-separator')) {
            let prevMsgWrapper = prev;
            while (prevMsgWrapper && !prevMsgWrapper.classList.contains('msg-wrapper-cv')) {
                prevMsgWrapper = prevMsgWrapper.previousElementSibling;
            }
            
            if (prevMsgWrapper) {
                const prevMsg = prevMsgWrapper.querySelector('.msg');
                if (prevMsg) {
                    let txt = t("Сообщение");
                    let isVideoNote = !!prevMsg.querySelector('.video-note-wrapper') || !!prevMsg.querySelector('.custom-video-wrapper');
                    let isAudio = !!prevMsg.querySelector('.voice-player');
                    let isMusic = !!prevMsg.querySelector('.music-player');
                    let img = prevMsg.querySelector('img');
                    let fileUrl = img?.src || prevMsg.querySelector('video')?.src || null;
                    let textEl = prevMsg.querySelector('.msg-text');
                    
                    if (textEl) txt = textEl.innerText;
                    else if (img && img.getAttribute('data-is-sticker') === 'true') txt = t('Стикер');
                    else if (img && img.getAttribute('data-is-gif') === 'true') txt = "GIF";
                    else if (prevMsg.querySelector('.file-message')) txt = t('📁 Файл');
                    
                    const isMe = prevMsg.classList.contains('sent');
                    
                    updateSidebarPreview(target, {
                        sender: isMe ? me : target,
                        text: txt,
                        isVideoNote,
                        isAudio,
                        isMusic,
                        fileUrl,
                        timestamp: new Date().toISOString() 
                    }, false);
                }
            } else {
                updateSidebarPreview(target, {
                    sender: target,
                    text: "",
                    timestamp: new Date().toISOString()
                }, false);
            }
        }

        setTimeout(() => {
            wrapper.style.height = '0px';
            wrapper.style.marginBottom = '0px';
            wrapper.style.padding = '0px';
            wrapper.style.display = 'none'; 
            wrapper.remove();

            if (prev?.classList.contains('date-separator')) {
                if (!next || next.classList.contains('date-separator')) {
                    prev.style.transition = "all 0.3s ease";
                    prev.style.opacity = "0";
                    prev.style.transform = "scale(0.8) translateY(-10px)";
                    setTimeout(() => {
                        prev.style.display = 'none';
                        prev.remove();
                    }, 300);
                }
            }

            if (isAtBottom && typeof scrollToBottom === 'function') {
                scrollToBottom();
            }
            
            typeof loadChatsWithPreview === 'function' && loadChatsWithPreview();
        }, 300);
    }
};

socket.on('connect', () => {
    if (window.me) {
        socket.emit('join', window.me);
        if (target) {
            fetch(`/api/is-blocked/${me}/${target}`).then(r=>r.json()).then(data => {
                const msgInput = document.getElementById('messageText');
                if (!data.blocked && msgInput) {
                    msgInput.disabled = false;
                    msgInput.placeholder = t("Написать...");
                    msgInput.style.opacity = "1";
                    const sendBtn = document.querySelector('button[onclick="send()"]');
                    if (sendBtn) Object.assign(sendBtn.style, {pointerEvents: "auto", opacity: "1"});
                }
            }).catch(()=>{});
        }
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const generatePattern = () => {
        let svg = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#a74fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.08">`;
        
        const icons = [
            (x,y) => `<path d="M${x-8},${y-4} c0,-6 16,-6 16,0 c0,6 -16,6 -16,0 m3,4 l-3,4 m8,-8 l3,-4"/><circle cx="${x+3}" cy="${y}" r="1"/><circle cx="${x+5}" cy="${y}" r="1"/>`, // Геймпад
            (x,y) => `<path d="M${x-4},${y-3} a4,4 0 0,1 8,0 a4,4 0 0,1 8,0 q0,8 -8,14 q-8,-6 -8,-14 z"/>`,
            (x,y) => `<circle cx="${x}" cy="${y}" r="6"/><path d="M${x-9},${y+3} q9,-6 18,3"/>`, 
            (x,y) => `<path d="M${x},${y-8} l2.4,5.6 l6,0 l-4.8,3.6 l1.8,6 l-5.4,-4 l-5.4,4 l1.8,-6 l-4.8,-3.6 l6,0 z"/>`, 
            (x,y) => `<path d="M${x-4},${y-6} l0,10 a3,3 0 1,1 -4,0 a3,3 0 0,1 4,0 m0,-10 l8,-2 l0,10 a3,3 0 1,1 -4,0 a3,3 0 0,1 4,0 m-8,4 l8,-2"/>`, // Ноты
            (x,y) => `<path d="M${x+8},${y-8} l-16,6 l6,2 l10,-8 m-10,8 l2,6 l2,-4 l6,-10 m-10,8 l4,4"/>`,
            (x,y) => `<path d="M${x-5},${y-2} l10,0 m-10,4 l10,0 m-3,-7 l0,10 m-4,-10 l0,10"/>`, 
            (x,y) => `<path d="M${x-4},${y} l8,0 m-4,-4 l0,8"/>`, 
            (x,y) => `<path d="M${x},${y-5} l6,10 l-12,0 z"/>`, 
            (x,y) => `<circle cx="${x}" cy="${y}" r="5"/>`, 
            (x,y) => `<path d="M${x-6},${y-6} l12,12 m0,-12 l-12,12"/>`, 
            (x,y) => `<rect x="${x-5}" y="${y-5}" width="10" height="10" rx="2"/>` 
        ];

        const positions = [
            [20, 20], [70, 15], [120, 25], [170, 10],
            [40, 60], [90, 50], [150, 65], [190, 55],
            [15, 100], [65, 110], [115, 95], [175, 105],
            [35, 150], [85, 160], [140, 145], [185, 165],
            [10, 180], [60, 190], [110, 185], [160, 195],
            [100, 140], [140, 20], [20, 80], [180, 130]
        ];

        positions.forEach((pos, i) => {
            const icon = icons[i % icons.length];
            const x = pos[0];
            const y = pos[1];
            const rot = (i * 77) % 360; 
            
            const draw = (px, py) => {
                svg += `<g transform="rotate(${rot} ${px} ${py})">${icon(px, py)}</g>`;
            };
            
            draw(x, y);
            if (x < 20) draw(x + 200, y);
            if (x > 180) draw(x - 200, y);
            if (y < 20) draw(x, y + 200);
            if (y > 180) draw(x, y - 200);
            if (x < 20 && y < 20) draw(x + 200, y + 200);
            if (x > 180 && y < 20) draw(x - 200, y + 200);
            if (x < 20 && y > 180) draw(x + 200, y - 200);
            if (x > 180 && y > 180) draw(x - 200, y - 200);
        });

        for(let i=0; i<50; i++) {
            const x = (i * 43) % 200;
            const y = (i * 67) % 200;
            svg += `<circle cx="${x}" cy="${y}" r="1"/>`;
        }

        svg += `</g></svg>`;
        return "data:image/svg+xml," + encodeURIComponent(svg);
    };

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes spin { to { transform: rotate(360deg); } }
        
        #msg-container {
            background-color: #0f0f13;
            background-image: url("${generatePattern()}");
            background-size: 250px; /* Оптимальный размер узора */
            background-repeat: repeat;
            background-attachment: fixed;
        }
        
        .msg { backdrop-filter: blur(3px); }
        
        #menu-drawer .menu-item {
            display: flex !important;
            align-items: center !important;
            gap: 14px !important;
        }
        
        #menu-drawer .menu-item svg {
            width: 22px !important;
            height: 22px !important;
            min-width: 22px !important;
            margin: 0 !important;
            flex-shrink: 0 !important;
        }
    `;
    document.head.appendChild(style);
});
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        html, body { overscroll-behavior-y: none !important; overscroll-behavior-x: auto !important; }
        body.is-chat-active, body.is-chat-active #main-app { overscroll-behavior-y: none !important; }
        body.is-chat-active #msg-container { overscroll-behavior-y: contain !important; }
        #bottom-bar-container { padding-bottom: max(12px, env(safe-area-inset-bottom)) !important; }
        #menu-drawer { top: 0 !important; bottom: 0 !important; height: auto !important; padding-top: max(20px, env(safe-area-inset-top)) !important; padding-bottom: max(20px, env(safe-area-inset-bottom)) !important; }
        #menu-drawer .menu-item { display: flex !important; align-items: center !important; gap: 14px !important; }
        #menu-drawer .menu-item svg { width: 22px !important; height: 22px !important; min-width: 22px !important; margin: 0 !important; flex-shrink: 0 !important; }
        #toast-notify { z-index: 2147483647 !important; top: max(20px, env(safe-area-inset-top)) !important; width: max-content !important; max-width: 90vw !important; }
        @keyframes iconPop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideUpAnim { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
        .icon-anim { animation: iconPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; transform-origin: bottom center; transition: transform 0.1s; }
        #main-action-btn.mic-mode { background: var(--accent) !important; color: #fff !important; }
        #chat-header { padding-top: max(15px, env(safe-area-inset-top)) !important; }
        #sidebar > div:first-child { padding-top: max(20px, env(safe-area-inset-top)) !important; }
    `;
    document.head.appendChild(style);

    const urlParams = new URLSearchParams(window.location.search);
    const joinId = urlParams.get('join');
    const chatId = urlParams.get('chat');
    
    if (joinId) {
        setTimeout(() => previewRoom(joinId), 1000);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (chatId) {
        setTimeout(() => selectChat(chatId), 1000);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const msgInput = document.getElementById('messageText');
    if (msgInput) {
        msgInput.style.resize = 'none';
        msgInput.style.overflowY = 'hidden';
        msgInput.addEventListener('input', function() {
            if (target) localStorage.setItem('4send_draft_' + target, this.value);
            this.style.height = 'auto';
            const newHeight = Math.min(this.scrollHeight, 150);
            this.style.height = newHeight + 'px';
            this.style.overflowY = this.scrollHeight > 150 ? 'auto' : 'hidden';
            
            if (target) {
                socket.emit('typing', {sender: me, receiver: target});
                clearTimeout(typingTimeouts[target]);
                typingTimeouts[target] = setTimeout(() => {
                    socket.emit('typing', {sender: me, receiver: target, stop: true});
                }, 3000);
            }
        });
    }

    const timerBtn = document.getElementById('timer-btn');
    if (timerBtn) {
        timerBtn.removeAttribute('onclick');
        timerBtn.addEventListener('pointerdown', e => {
            e.preventDefault(); 
            toggleTimerMenu(e);
        });
    }

    const savedSize = localStorage.getItem('4send_text_size') || 'medium';
    applyTextSize(savedSize);
    
    if (typeof injectQRButton === 'function') injectQRButton();
    document.addEventListener('click', requestSafariPush, { once: true });
});
document.addEventListener('DOMContentLoaded', () => {
    const bottomBar = document.getElementById('bottom-bar-container');
    if (bottomBar && !window.target) {
        bottomBar.style.display = 'none';
    }
});
window.playReactionParticles = function(msgId, emoji) {
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;
    const rect = msgEl.getBoundingClientRect();
    const isSent = msgEl.classList.contains('sent');
    const startX = isSent ? rect.right - 20 : rect.left + 20;
    const startY = rect.bottom;

    for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.innerText = emoji;
        p.style.position = 'fixed';
        p.style.left = startX + 'px';
        p.style.top = startY + 'px';
        p.style.fontSize = (Math.random() * 10 + 14) + 'px';
        p.style.pointerEvents = 'none';
        p.style.zIndex = 9999;
        p.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease-out';
        p.style.transform = 'translate(-50%, -50%) scale(0.5)';
        p.style.opacity = '1';
        document.body.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 40 + 20;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 20;

        setTimeout(() => {
            p.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.2)`;
            p.style.opacity = '0';
        }, 10);

        setTimeout(() => p.remove(), 600);
    }
};
window.reactionLocks = {};
window.sendReaction = function(msgId, emoji, targetUser) {
    if (window.reactionLocks[msgId]) return;
    window.reactionLocks[msgId] = true;
    setTimeout(() => { delete window.reactionLocks[msgId]; }, 400);

    socket.emit('set_reaction', { msgId, emoji, receiver: targetUser });
    
    playReactionParticles(msgId, emoji);

    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;

    let container = msgEl.querySelector('.reactions-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'reactions-container';
        container.style = `display:flex;gap:4px;flex-wrap:wrap;pointer-events:auto;position:absolute;bottom:-14px;${msgEl.classList.contains('sent') ? 'right:10px;' : 'left:10px;'}z-index:2;`;
        msgEl.appendChild(container);
        const wrapper = msgEl.parentElement;
        if (wrapper && wrapper.classList.contains('msg-wrapper-cv')) {
            wrapper.style.marginBottom = '28px';
        }
    }

    let existingReaction = null;
    const reactionDivs = container.querySelectorAll('div');
    reactionDivs.forEach(div => {
        if (div.innerText.includes(emoji)) {
            existingReaction = div;
        }
    });

    if (existingReaction) {
        const countSpan = existingReaction.querySelector('span');
        let count = parseInt(countSpan.innerText);
        if (count > 1) {
            countSpan.innerText = count - 1;
        } else {
            existingReaction.remove();
        }
    } else {
        const newReaction = document.createElement('div');
        newReaction.setAttribute('onclick', `sendReaction('${escapeAttr(msgId)}','${escapeAttr(emoji)}','${escapeAttr(targetUser)}')`);
        newReaction.style = `background:rgba(167,79,255,0.15);border:1px solid rgba(167,79,255,0.3);border-radius:10px;padding:1px 7px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;color:#eee;transition:.2s;box-shadow:0 2px 5px rgba(0,0,0,0.3);`;
        newReaction.onmouseover = () => newReaction.style.background = 'rgba(167,79,255,0.25)';
        newReaction.onmouseout = () => newReaction.style.background = 'rgba(167,79,255,0.15)';
        newReaction.innerHTML = `${escapeHTML(emoji)} <span style="opacity:0.8;font-weight:600">1</span>`;
        container.appendChild(newReaction);
    }

    if (container.children.length === 0) {
        container.remove();
        const wrapper = msgEl.parentElement;
        if (wrapper && wrapper.classList.contains('msg-wrapper-cv')) {
            wrapper.style.marginBottom = '14px';
        }
    }
};
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #menu-drawer { height: 100dvh !important; }
        #toast-notify { z-index: 2147483647 !important; top: max(20px, env(safe-area-inset-top)) !important; width: max-content !important; max-width: 90vw !important; }
    `;
    document.head.appendChild(style);
});
window.summarizeVoice = async function(msgId, fileUrl) {
    const btn = document.getElementById(`btn-summary-${msgId}`);
    const textContainer = document.getElementById(`summary-text-${msgId}`);
    if (!btn || !textContainer) return;

    if (textContainer.style.display === 'block') {
        textContainer.style.display = 'none';
        return;
    }

    if (textContainer.innerHTML !== '') {
        textContainer.style.display = 'block';
        return;
    }

    const originalBtnHtml = btn.innerHTML;
    btn.innerHTML = `<div style="width:12px;height:12px;border:2px solid #a74fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> ${t('Обработка...')}`;
    btn.style.pointerEvents = 'none';

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/summarize-voice', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fileUrl })
        });
        const data = await res.json();
        
        if (data.summary) {
            textContainer.innerHTML = `<b>${t('Краткий пересказ:')}</b><br>${escapeHTML(data.summary)}`;
            textContainer.style.display = 'block';
        } else {
            typeof showToast === 'function' && showToast(t("Не удалось пересказать голосовое"));
        }
    } catch (err) {
        typeof showToast === 'function' && showToast(t("Ошибка при запросе пересказа"));
    } finally {
        btn.innerHTML = originalBtnHtml;
        btn.style.pointerEvents = 'auto';
    }
};
window.copyMsgContent = async function(msgId) {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    
    const img = el.querySelector('img');
    const textEl = el.querySelector('.msg-text');
    
    try {
        if (img && !img.src.includes('youtube.com')) {
            try {
                const response = await fetch(img.src);
                const originalBlob = await response.blob();
                
                let pngBlob = originalBlob;
                if (originalBlob.type !== 'image/png') {
                    pngBlob = await new Promise((resolve, reject) => {
                        const image = new Image();
                        image.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = image.width;
                            canvas.height = image.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(image, 0, 0);
                            canvas.toBlob((b) => {
                                if (b) resolve(b);
                                else reject(new Error());
                            }, 'image/png');
                            URL.revokeObjectURL(image.src);
                        };
                        image.onerror = () => {
                            URL.revokeObjectURL(image.src);
                            reject(new Error());
                        };
                        image.src = URL.createObjectURL(originalBlob);
                    });
                }

                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': pngBlob })
                ]);
                if (typeof showToast === 'function') showToast(t('Фотография скопирована'), false);
                return;
            } catch (e) {
                await navigator.clipboard.writeText(img.src);
                if (typeof showToast === 'function') showToast(t('Ссылка на фото скопирована'), false);
                return;
            }
        }
        
        let textToCopy = "";
        if (textEl) {
            textToCopy = textEl.innerText;
        } else {
            if (el.querySelector('.video-note-wrapper') || el.querySelector('.custom-video-wrapper')) textToCopy = t('📹 Видеосообщение');
            else if (el.querySelector('.voice-player')) textToCopy = t('🎤 Голосовое сообщение');
            else if (el.querySelector('.music-player')) textToCopy = t('🎵 Аудиозапись');
            else if (el.querySelector('.file-message')) textToCopy = t('📁 Файл');
            else textToCopy = t("Сообщение");
        }
        
        await navigator.clipboard.writeText(textToCopy);
        if (typeof showToast === 'function') showToast(t('Текст скопирован'), false);
    } catch (err) {
        if (typeof showToast === 'function') showToast(t('Ошибка копирования'), true);
    }
};
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        .custom-video-wrapper { position: relative; border-radius: 12px; overflow: hidden; background: #000; max-width: 100%; width: fit-content; margin-top: 5px; display: flex; align-items: center; justify-content: center; }
        .custom-video-wrapper-fullscreen { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; }
        .custom-video-wrapper video { display: block; max-height: 400px; width: 100%; object-fit: contain; cursor: pointer; }
        .custom-video-wrapper-fullscreen video { max-height: 100%; width: 100%; object-fit: contain; }
        .custom-video-wrapper:-webkit-full-screen { width: 100%; height: 100%; max-height: none; border-radius: 0; }
        .custom-video-wrapper:-moz-full-screen { width: 100%; height: 100%; max-height: none; border-radius: 0; }
        .custom-video-wrapper:fullscreen { width: 100%; height: 100%; max-height: none; border-radius: 0; }
        .custom-video-wrapper:-webkit-full-screen video { max-height: 100%; height: 100%; }
        .custom-video-wrapper:fullscreen video { max-height: 100%; height: 100%; }
        .cv-controls { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 30px 12px 12px; display: flex; align-items: center; gap: 12px; opacity: 0; transition: opacity 0.3s ease; z-index: 2; }
        .custom-video-wrapper:hover .cv-controls, .custom-video-wrapper.active .cv-controls, .custom-video-wrapper-fullscreen:hover .cv-controls { opacity: 1; }
        @media (hover: none) { .cv-controls { opacity: 1; } }
        .cv-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; transition: 0.2s; }
        .cv-btn:hover { color: #a74fff; }
        .cv-btn svg { width: 22px; height: 22px; fill: currentColor; }
        .cv-volume-container { position: relative; display: flex; align-items: center; }
        .cv-volume-slider { width: 0; opacity: 0; transition: width 0.2s, opacity 0.2s; overflow: hidden; display: flex; align-items: center; margin-left: 5px; }
        .cv-volume-container:hover .cv-volume-slider { width: 60px; opacity: 1; }
        .cv-volume-slider input { width: 100%; cursor: pointer; accent-color: #a74fff; height: 4px; }
        .cv-progress { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; cursor: pointer; position: relative; transition: height 0.2s; }
        .cv-progress:hover { height: 6px; }
        .cv-progress-fill { height: 100%; background: #a74fff; border-radius: 2px; width: 0%; pointer-events: none; position: relative; }
        .cv-progress-fill::after { content: ''; position: absolute; right: -4px; top: 50%; transform: translateY(-50%) scale(0); width: 10px; height: 10px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
        .cv-progress:hover .cv-progress-fill::after { transform: translateY(-50%) scale(1); }
        .cv-time { color: #fff; font-size: 12px; font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums; pointer-events: none; }
        .cv-center-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 56px; height: 56px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; backdrop-filter: blur(4px); transition: 0.2s; pointer-events: none; opacity: 0; z-index: 1; }
        .custom-video-wrapper.paused .cv-center-play, .custom-video-wrapper-fullscreen.paused .cv-center-play { opacity: 1; }
        .cv-center-play svg { width: 28px; height: 28px; fill: #fff; margin-left: 4px; }
        
        .msg-swipe-wrap { position: relative; width: 100%; display: flex; align-items: center; }
        .msg-reply-icon { position: absolute; right: -45px; width: 34px; height: 34px; background: rgba(167,79,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.5); transition: opacity 0.2s, transform 0.2s, background 0.2s; z-index: 0; }
        .msg-reply-icon svg { width: 18px; height: 18px; fill: #a74fff; transition: fill 0.2s; }
    `;
    document.head.appendChild(style);

    const msgContainer = document.getElementById('msg-container');
    if (!msgContainer) return;

    msgContainer.addEventListener('dblclick', e => {
        e.stopPropagation();
        if (target === me) return; 
        
        const msg = e.target.closest('.msg');
        if (msg) {
            const id = msg.getAttribute('data-id');
            if (id) {
                const reaction = localStorage.getItem('4send_quick_reaction') || '❤️';
                sendReaction(id, reaction, target);
                msg.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
                msg.style.transform = 'scale(1.05)';
                setTimeout(() => msg.style.transform = 'scale(1)', 150);
            }
        }
    }, true);

    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeMsg = null;
    let swipeWrapper = null;
    let replyIcon = null;
    let isSwiping = false;

    msgContainer.addEventListener('touchstart', e => {
        const wrapper = e.target.closest('div[style*="width: 100%"]') || e.target.closest('.msg-swipe-wrap') || e.target.closest('.msg');
        const msg = wrapper ? (wrapper.classList.contains('msg') ? wrapper : wrapper.querySelector('.msg')) : null;
        
        if (msg && !e.target.closest('.custom-video-wrapper') && !e.target.closest('.video-note-wrapper') && !e.target.closest('.voice-player') && !e.target.closest('.music-player')) {
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
            swipeMsg = msg;
            isSwiping = false;
            
            if (!msg.parentElement.classList.contains('msg-swipe-wrap')) {
                const wrap = document.createElement('div');
                wrap.className = 'msg-swipe-wrap';
                wrap.style.justifyContent = msg.classList.contains('sent') ? 'flex-end' : 'flex-start';
                msg.parentNode.insertBefore(wrap, msg);
                wrap.appendChild(msg);
                
                const icon = document.createElement('div');
                icon.className = 'msg-reply-icon';
                icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>`;
                wrap.appendChild(icon);
            }
            
            swipeWrapper = msg.parentElement;
            replyIcon = swipeWrapper.querySelector('.msg-reply-icon');
            msg.style.transition = 'none';
        }
    }, { passive: true });

    msgContainer.addEventListener('touchmove', e => {
        if (!swipeMsg) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = swipeStartX - currentX;
        const diffY = Math.abs(swipeStartY - currentY);

        if (!isSwiping) {
            if (diffX > 10 && diffX > diffY) {
                isSwiping = true;
            } else if (diffY > 10) {
                swipeMsg = null; 
                return;
            }
        }

        if (isSwiping) {
            if (e.cancelable) e.preventDefault(); 
            if (diffX > 0) {
                const moveX = Math.min(diffX, 65);
                swipeMsg.style.transform = `translateX(-${moveX}px)`;
                
                if (replyIcon) {
                    const progress = moveX / 65;
                    replyIcon.style.opacity = progress;
                    replyIcon.style.transform = `scale(${0.5 + (progress * 0.5)})`;
                    
                    if (moveX >= 55) {
                        replyIcon.style.background = '#a74fff';
                        replyIcon.querySelector('svg').style.fill = '#fff';
                        if (!replyIcon.dataset.vibrated) {
                            navigator.vibrate && navigator.vibrate(30);
                            replyIcon.dataset.vibrated = 'true';
                        }
                    } else {
                        replyIcon.style.background = 'rgba(167,79,255,0.15)';
                        replyIcon.querySelector('svg').style.fill = '#a74fff';
                        replyIcon.dataset.vibrated = '';
                    }
                }
            }
        }
    }, { passive: false }); 

    msgContainer.addEventListener('touchend', e => {
        if (!swipeMsg) return;
        const diffX = swipeStartX - e.changedTouches[0].clientX;
        
        swipeMsg.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        swipeMsg.style.transform = 'translateX(0)';
        
        if (replyIcon) {
            replyIcon.style.opacity = '0';
            replyIcon.style.transform = 'scale(0.5)';
            replyIcon.dataset.vibrated = '';
        }

        if (isSwiping && diffX >= 55) {
            let txt = t('Сообщение');
            if (swipeMsg.querySelector('.video-note-wrapper') || swipeMsg.querySelector('.custom-video-wrapper')) txt = t('📹 Видеосообщение');
            else if (swipeMsg.querySelector('.voice-player')) txt = t('🎤 Голосовое сообщение');
            else if (swipeMsg.querySelector('.music-player')) txt = t('🎵 Аудиозапись');
            else if (swipeMsg.querySelector('.file-message')) txt = t('📁 Файл');
            else if (swipeMsg.querySelector('img')) {
                const imgEl = swipeMsg.querySelector('img');
                if (imgEl.getAttribute('data-is-sticker') === 'true') txt = t('Стикер');
                else if (imgEl.getAttribute('data-is-gif') === 'true') txt = "GIF";
                else txt = t('📷 Фотография');
            }
            else if (swipeMsg.querySelector('.msg-text')) txt = swipeMsg.querySelector('.msg-text').innerText;
            
            const id = swipeMsg.getAttribute('data-id');
            if (id) {
                prepareReply(txt, id);
            }
        }

        const msgToClean = swipeMsg;
        const wrapToClean = swipeWrapper;
        setTimeout(() => {
            if (wrapToClean && wrapToClean.classList.contains('msg-swipe-wrap') && wrapToClean.parentElement) {
                wrapToClean.parentElement.insertBefore(msgToClean, wrapToClean);
                wrapToClean.remove();
            }
            if (msgToClean) {
                msgToClean.style.transition = '';
                msgToClean.style.transform = '';
            }
        }, 320);
        
        swipeMsg = null;
        swipeWrapper = null;
        replyIcon = null;
        isSwiping = false;
    });
});
window.receiveFcmToken = function(token) {
    if (token && typeof me !== 'undefined' && me) {
        const jwtToken = localStorage.getItem('4send_token');
        if (!jwtToken) return;
        
        fetch('/api/save-push-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ token: token })
        }).catch(()=>{});
    }
};
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.AndroidApp && typeof window.AndroidApp.getFcmToken === 'function') {
            const token = window.AndroidApp.getFcmToken();
            if (token) window.receiveFcmToken(token);
        }
    }, 1500);
});
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        body.is-chat-active, 
        body.is-chat-active #main-app {
            overscroll-behavior-y: none !important;
            overscroll-behavior-x: auto !important;
        }
        body.is-chat-active #msg-container {
            overscroll-behavior-y: contain !important;
            overscroll-behavior-x: auto !important;
        }
        #bottom-bar-container {
            padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
        }
    `;
    document.head.appendChild(style);

    let edgeTouchStart = false;
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            const x = e.touches[0].clientX;
            edgeTouchStart = (x < 30);
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (edgeTouchStart) return;

        const isScrollable = e.target.closest('#msg-container, #contacts, .ep-content, .admin-content, #room-settings-content, textarea, #forward-list, #privacy-users-list, #gallery-content, #media-gallery-modal');
        if (!isScrollable) {
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });
});
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('4send_token');
    if (token) {
        try {
            const localP = localStorage.getItem('4send_privacy');
            if (localP) {
                const parsed = JSON.parse(localP);
                privacyState = { ...privacyState, ...parsed };
                privacyState.exceptions = { ...privacyState.exceptions, ...(parsed.exceptions || {}) };
            }

            if (socket && socket.connected) socket.emit('request_privacy_sync');
        } catch(e) {}
    }
});

window.formatMessageText = function(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    let formattedText = '';
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) {
            let safeUrl = escapeHTML(parts[i]);
            if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) safeUrl = 'http://' + safeUrl;
            const lowerUrl = safeUrl.toLowerCase();
            if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:')) {
                safeUrl = '#';
            }
            formattedText += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#50a2e9;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" onclick="event.stopPropagation()">${escapeHTML(parts[i])}</a>`;
        } else {
            let textPart = escapeHTML(parts[i]);
            textPart = textPart.replace(/@([a-zA-Z0-9_]{4,})/g, `<span onclick="event.stopPropagation(); checkAndSelectChat('\$1')" style="color:#a74fff;cursor:pointer;font-weight:bold;">@\$1</span>`);
            formattedText += textPart;
        }
    }
    return formattedText;
};

const linkPreviewCache = new Map();

window.fetchLinkPreview = async function(url) {
    if (linkPreviewCache.has(url)) return linkPreviewCache.get(url);
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.error) return null;
        const preview = { title: data.title || '', description: data.description || '', image: data.image || '', url: data.url || url };
        linkPreviewCache.set(url, preview);
        return preview;
    } catch { return null; }
};

window.extractFirstUrl = function(text) {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
};

window.renderLinkPreviewCard = function(preview) {
    if (!preview || (!preview.title && !preview.description && !preview.image)) return '';
    const imgHtml = preview.image ? `<img src="${escapeAttr(preview.image)}" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;display:block" onerror="this.remove()">` : '';
    let domain = '';
    try { domain = new URL(preview.url).hostname.replace('www.', ''); } catch { domain = preview.url; }
    return `<div style="margin-top:8px;background:rgba(0,0,0,0.2);border-left:3px solid #a74fff;border-radius:8px;overflow:hidden;max-width:320px;cursor:pointer" onclick="window.open('${escapeAttr(preview.url)}','_blank');event.stopPropagation()">
        ${imgHtml}
        <div style="padding:8px 10px">
            ${preview.title ? `<div style="font-size:13px;font-weight:600;color:#eee;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:2px">${escapeHTML(preview.title)}</div>` : ''}
            ${preview.description ? `<div style="font-size:12px;color:#8e8e93;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:4px">${escapeHTML(preview.description)}</div>` : ''}
            <div style="font-size:11px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(domain)}</div>
        </div>
    </div>`;
};

document.addEventListener('DOMContentLoaded', () => {
    const fInput = document.getElementById('f-input');
    if (fInput) fInput.setAttribute('multiple', 'multiple');
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!target) resetToHome();
    }, 150);
});

(function injectChatHeaderMenu() {
    const header = document.getElementById('chat-header');
    if (!header) {
        setTimeout(injectChatHeaderMenu, 500);
        return;
    }
    if (document.getElementById('chat-header-menu-btn')) return;

    const searchBtn = header.querySelector('button[onclick*="toggleInternalSearch"]');
    if (searchBtn) {
        const callBtn = document.createElement('button');
        callBtn.id = 'chat-header-call-btn';
        callBtn.className = 'control-btn';
        callBtn.style.marginLeft = '10px';
        callBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
        callBtn.onclick = (e) => {
            e.stopPropagation();
            startCall(false);
        };

        const menuBtn = document.createElement('button');
        menuBtn.id = 'chat-header-menu-btn';
        menuBtn.className = 'control-btn';
        menuBtn.style.marginLeft = '10px';
        menuBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            openChatHeaderMenu(e);
        };
        
        const rightControls = document.createElement('div');
        rightControls.style.display = 'flex';
        rightControls.style.alignItems = 'center';
        
        searchBtn.parentNode.insertBefore(rightControls, searchBtn);
        rightControls.appendChild(searchBtn);
        rightControls.appendChild(callBtn);
        rightControls.appendChild(menuBtn);
    }
})();

window.openChatHeaderMenu = function(e) {
    if (!target) return;
    let m = document.getElementById('chat-header-menu');
    if (m) {
        closeChatHeaderMenu();
        return;
    }
    
    const contactItem = document.querySelector(`.contact-item[data-username="${target}"]`);
    const isMuted = contactItem ? contactItem.getAttribute('data-muted') === '1' : false;
    const isRoom = target.startsWith('room_');
    const roomType = contactItem ? contactItem.getAttribute('data-room-type') : '';
    const roomOwner = contactItem ? contactItem.getAttribute('data-room-owner') : '';
    const myId = window.me || localStorage.getItem('4send_user');
    
    let deleteText = t('Удалить чат');
    let deleteAction = `prepareDeleteChat('${escapeAttr(target)}', '0', '')`;

    if (isRoom) {
        if (roomOwner === myId) {
            deleteText = roomType === 'channel' ? t('Удалить канал') : t('Удалить группу');
            deleteAction = `prepareDeleteChat('${escapeAttr(target)}', '1', '${escapeAttr(roomType)}')`;
        } else {
            deleteText = roomType === 'channel' ? t('Покинуть канал') : t('Покинуть группу');
            deleteAction = `leaveRoom('${escapeAttr(target)}')`;
        }
    }

    const muteText = isMuted ? t('Включить уведомления') : t('Выключить уведомления');
    const muteIcon = isMuted 
        ? `<svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`
        : `<svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zM4.41 2.86L3 4.27l16.73 16.73 1.41-1.41L4.41 2.86z"/></svg>`;

    let currentTimer = 0;
    if (window.chatSettings && window.chatSettings[target] && window.chatSettings[target].autoDeleteTimer) {
        currentTimer = window.chatSettings[target].autoDeleteTimer;
    }

    m = document.createElement('div');
    m.id = 'chat-header-menu';
    Object.assign(m.style, {
        position: 'absolute', background: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100000, minWidth: '220px',
        opacity: '0.01', transform: 'scale(0.9) translateY(-10px)', transformOrigin: 'top right',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)'
    });
    
    m.innerHTML = `
        <div class="menu-item" onclick="event.stopPropagation(); showUserProfile('${escapeAttr(target)}'); closeChatHeaderMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            ${t('Открыть профиль')}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); openChatAutoDeleteModal('${escapeAttr(target)}', ${currentTimer}); closeChatHeaderMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${t('Автоудаление')}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); socket.emit('toggle_mute',{contact:'${escapeAttr(target)}',me:'${escapeAttr(myId)}'}); closeChatHeaderMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            ${muteIcon}
            ${muteText}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); openChatStatsModal(); closeChatHeaderMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-2.99 1.34-2.99 3S14.34 11 16 11zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5.01 6.34 5.01 8S6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            ${t('Статистика чата')}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); ${deleteAction}; closeChatHeaderMenu();" style="color:#ff4d4d; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,77,77,0.1)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            ${deleteText}
        </div>
    `;
    
    document.body.appendChild(m);
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 220;
    const menuH = m.offsetHeight || 200;
    let top = rect.bottom + 10;
    let left = rect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 10;
    if (top < 8) top = 8;
    m.style.top = top + 'px';
    m.style.left = left + 'px';
    
    requestAnimationFrame(() => {
        m.style.opacity = '1';
        m.style.transform = 'scale(1) translateY(0)';
    });

    setTimeout(() => {
        document.addEventListener('click', closeChatHeaderMenu, { once: true });
    }, 10);
};

window.closeChatHeaderMenu = function() {
    const m = document.getElementById('chat-header-menu');
    if (m) {
        m.style.opacity = '0';
        m.style.transform = 'scale(0.9) translateY(-10px)';
        setTimeout(() => m.remove(), 200);
    }
};

window.openChatStatsModal = async function() {
    if (!target) return;
    
    let modal = document.getElementById('chat-stats-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chat-stats-modal';
        document.body.appendChild(modal);
    }
    
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.6)', zIndex: '110000', display: 'flex',
        alignItems: 'center', justifyContent: 'center', opacity: '0', transition: '0.3s'
    });
    
    modal.innerHTML = `
        <div style="background:#1c1c23; width:90%; max-width:340px; border-radius:24px; padding:24px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform:scale(0.9); transition:0.3s; border:1px solid rgba(167,79,255,0.2); text-align:center;">
            <h3 style="color:#fff; margin:0 0 20px 0; font-family:'Inter',sans-serif; font-size:19px; font-weight:700;">${t('Статистика чата')}</h3>
            <div id="chat-stats-content" style="color:#888; font-size:14px;">${t('Загрузка...')}</div>
            <button onclick="closeChatStatsModal()" style="width:100%; padding:14px; margin-top:20px; background:rgba(167,79,255,0.15); color:#fff; border:1px solid rgba(167,79,255,0.3); border-radius:14px; font-weight:700; cursor:pointer; transition:0.2s;">${t('ЗАКРЫТЬ')}</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);

    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch(`/api/chat-stats/${target}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const dateStr = new Date(data.createdAt).toLocaleDateString(globalLocale, { day: 'numeric', month: 'long', year: 'numeric' });
        
        document.getElementById('chat-stats-content').innerHTML = `
            <div style="margin-bottom:10px; display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:12px; border-radius:12px;">
                <span>${t('Создан:')}</span> <span style="color:#fff; font-weight:bold;">${dateStr}</span>
            </div>
            <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:12px; border-radius:12px;">
                <span>${t('Сообщений:')}</span> <span style="color:#a74fff; font-weight:bold;">${data.messageCount}</span>
            </div>
        `;
    } catch (e) {
        document.getElementById('chat-stats-content').innerHTML = `<span style="color:#ff4d4d;">${t('Ошибка загрузки')}</span>`;
    }
};

window.closeChatStatsModal = function() {
    const modal = document.getElementById('chat-stats-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    }
};

window.openProfileMoreMenu = function(e, user, isBlocked, isRestricted, isForwardRestricted, isScreenshotRestricted) {
    e.stopPropagation();
    let m = document.getElementById('profile-more-menu');
    if (m) {
        closeProfileMoreMenu();
        return;
    }
    
    m = document.createElement('div');
    m.id = 'profile-more-menu';
    Object.assign(m.style, {
        position: 'absolute', background: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100000, minWidth: '200px',
        opacity: '0', transform: 'scale(0.9) translateY(-10px)', transformOrigin: 'top right',
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)'
    });
    
    const blockText = isBlocked ? t('Разблокировать') : t('Заблокировать');
    const blockColor = isBlocked ? '#4caf50' : '#ff4d4d';
    const blockIcon = isBlocked 
        ? `<svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>` 
        : `<svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`;
    
    m.innerHTML = `
        <div class="menu-item" onclick="event.stopPropagation(); toggleBlockUser('${escapeAttr(user)}'); closeProfileMoreMenu();" style="color:${blockColor}; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            ${blockIcon} ${blockText}
        </div>
        <div class="menu-item" onclick="event.stopPropagation(); openChatPrivacyModal('${escapeAttr(user)}', ${isRestricted}, ${isForwardRestricted}, ${isScreenshotRestricted}); closeProfileMoreMenu();" style="color:#fff; padding:10px; cursor:pointer; display:flex; align-items:center; gap:12px; border-radius:8px; transition:0.2s; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" style="width:20px; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${t('Приватность чата')}
        </div>
    `;
    
    document.body.appendChild(m);
    const rect = e.currentTarget.getBoundingClientRect();
    m.style.top = (rect.bottom + 5) + 'px';
    m.style.left = (rect.right - 200) + 'px';
    
    requestAnimationFrame(() => {
        m.style.opacity = '1';
        m.style.transform = 'scale(1) translateY(0)';
    });

    setTimeout(() => {
        document.addEventListener('click', closeProfileMoreMenu, { once: true });
    }, 10);
};

window.openChatPrivacyModal = function(user, copyState, fwdState, screenState) {
    let modal = document.getElementById('chat-privacy-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chat-privacy-modal';
        document.body.appendChild(modal);
    }
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.6)', zIndex: '110000', display: 'flex',
        alignItems: 'center', justifyContent: 'center', opacity: '0', transition: '0.3s'
    });
    
    const toggleBtn = (id, label, desc, state, type) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:12px 16px; border-radius:14px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);">
            <div style="text-align:left; flex:1; padding-right:10px;">
                <div style="color:#fff; font-weight:600; font-size:14px; margin-bottom:4px;">${label}</div>
                <div style="color:#888; font-size:11px; line-height:1.3;">${desc}</div>
            </div>
            <div onclick="toggleChatPrivacySetting('${escapeAttr(user)}', '${escapeAttr(type)}', ${!state})" style="width:44px; height:24px; background:${state ? '#a74fff' : 'rgba(255,255,255,0.1)'}; border-radius:12px; position:relative; cursor:pointer; transition:0.3s; flex-shrink:0;">
                <div style="width:20px; height:20px; background:#fff; border-radius:50%; position:absolute; top:2px; left:${state ? '22px' : '2px'}; transition:0.3s; box-shadow:0 2px 5px rgba(0,0,0,0.2);"></div>
            </div>
        </div>
    `;

    modal.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#1c1c23; width:90%; max-width:380px; border-radius:24px; padding:24px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform:scale(0.9); transition:0.3s; border:1px solid rgba(167,79,255,0.2);">
            <button onclick="closeChatPrivacyModal()" style="position:absolute; top:16px; right:16px; background:none; border:none; color:#888; cursor:pointer; font-size:20px; transition:0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">✕</button>
            
            <div style="text-align:center; margin-bottom:15px;">
                <svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:none; stroke:#a74fff; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round;">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
            </div>
            
            <h3 style="color:#fff; text-align:center; margin:0 0 20px 0; font-family:'Inter',sans-serif; font-size:19px; font-weight:700;">${t('Приватность чата')}</h3>
            
            ${toggleBtn('cp-copy', t('Запрет копирования'), t('Нельзя копировать текст и сохранять медиа.'), copyState, 'copy')}
            ${toggleBtn('cp-fwd', t('Скрытие пересылки'), t('Уведомление о пересылке не появится.'), fwdState, 'forward')}
            ${toggleBtn('cp-screen', t('Уведомления о скриншотах'), t('В чат придет сообщение, если кто-то сделает скриншот.'), screenState, 'screenshot')}
            
            <button onclick="closeChatPrivacyModal()" style="width:100%; padding:14px; margin-top:10px; background:rgba(167,79,255,0.15); color:#fff; border:1px solid rgba(167,79,255,0.3); border-radius:14px; font-weight:700; cursor:pointer; transition:0.2s;">${t('ГОТОВО')}</button>
        </div>
    `;
    
    modal.onclick = closeChatPrivacyModal;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    }, 10);
};

window.closeChatPrivacyModal = function() {
    const modal = document.getElementById('chat-privacy-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    }
};

window.toggleChatPrivacySetting = async function(user, type, newState) {
    try {
        const token = localStorage.getItem('4send_token');
        const res = await fetch('/api/toggle-chat-privacy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ target: user, type, state: newState })
        });
        if (res.ok) {
            if (!window.chatSettings) window.chatSettings = {};
            if (!window.chatSettings[user]) window.chatSettings[user] = {};
            
            if (type === 'copy') window.chatSettings[user].copyRestriction = newState;
            if (type === 'forward') window.chatSettings[user].forwardRestriction = newState;
            if (type === 'screenshot') window.chatSettings[user].screenshotNotification = newState;
            
            openChatPrivacyModal(
                user, 
                window.chatSettings[user].copyRestriction, 
                window.chatSettings[user].forwardRestriction, 
                window.chatSettings[user].screenshotNotification
            );
            
            loadChatsWithPreview();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast(t("Ошибка"), true);
    }
};

window.notifyScreenshot = async function() {
    if (!target) return;
    try {
        const token = localStorage.getItem('4send_token');
        await fetch('/api/screenshot-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ target })
        });
    } catch (e) {}
};

document.addEventListener('keydown', (e) => {
    if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) {
        notifyScreenshot();
    }
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        notifyScreenshot();
    }
    if (e.key === 'PrintScreen') {
        notifyScreenshot();
    }
});

window.isMultiSelectMode = false;
window.selectedMessages = new Set();

window.toggleMultiSelect = function(id) {
    if (!window.isMultiSelectMode) {
        window.isMultiSelectMode = true;
        window.selectedMessages.clear();
        document.body.classList.add('multi-select-mode');
        showMultiSelectBar();
    }
    
    const msgEl = document.getElementById(`msg-${id}`);
    if (!msgEl) return;
    const wrapper = msgEl.parentElement;
    
    if (window.selectedMessages.has(id)) {
        window.selectedMessages.delete(id);
        wrapper.classList.remove('msg-selected-wrapper');
        
        if (window.selectedMessages.size === 0) {
            closeMultiSelect();
            return;
        }
    } else {
        if (window.selectedMessages.size >= 100) {
            if (typeof showToast === 'function') showToast(t('Максимум 100 сообщений'), true);
            return;
        }
        window.selectedMessages.add(id);
        wrapper.classList.add('msg-selected-wrapper');
    }
    updateMultiSelectBar();
};

window.deleteSelected = function() {
    if (window.selectedMessages.size === 0) return;
    window.selectedMessages.forEach(id => {
        deleteMessageClient(id);
    });
    closeMultiSelect();
};

window.forwardSelected = function() {
    if (window.selectedMessages.size === 0) return;
    msgToForward = Array.from(window.selectedMessages);
    const modal = document.getElementById('forward-modal');
    let wasHidden = modal.style.display === 'none' || modal.style.display === '';
    const list = document.getElementById('forward-list');
    modal.style.display = 'flex';
    if (wasHidden) {
        typeof pushNavigationState === 'function' && pushNavigationState();
    }
    list.innerHTML = `<div style="text-align:center;padding:20px;color:#555">${t('Загрузка...')}</div>`;
    fetch(`/chats-extended/${me}?t=${Date.now()}`).then(r=>r.json()).then(chats => {
        list.innerHTML = '';
        chats.filter(chat => !(chat.isRoom && chat.roomType === 'channel')).forEach(chat => {
            const isSaved = chat.username === me;
            const displayName = chat.displayName || chat.name || chat.username;
            const row = document.createElement('div');
            Object.assign(row.style, {padding:'10px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer',borderRadius:'12px',transition:'0.2s',marginBottom:'5px'});
            row.onmouseover = () => row.style.background = "rgba(167,79,255,0.1)";
            row.onmouseout = () => row.style.background = "transparent";
            row.onclick = () => confirmForward(chat.username);
            row.innerHTML = `<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:1px solid #333;flex-shrink:0">${isSaved?savedIconSvg:getAvatarHtml(displayName,chat.avatar,40)}</div><div style="font-weight:bold;font-size:14px;color:#eee">${isSaved?t('Избранное'):escapeHTML(displayName)}</div>`;
            list.appendChild(row);
        });
    }).catch(() => { list.innerHTML = `<div style="color:red">${t('Ошибка загрузки')}</div>`; });
};

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #modern-menu {
            transition: opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1), transform 0.2s cubic-bezier(0.25, 1, 0.5, 1) !important;
            will-change: transform, opacity;
        }

        .msg-wrapper-cv {
            transition: padding-left 0.25s cubic-bezier(0.25, 1, 0.5, 1);
            position: relative;
            box-sizing: border-box;
        }
        
        body.multi-select-mode .msg-wrapper-cv {
            padding-left: 38px !important;
        }
        
        .msg-wrapper-cv::before {
            content: '';
            position: absolute;
            left: -25px;
            top: 50%;
            transform: translateY(-50%) scale(0.5);
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            opacity: 0;
            transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);
            pointer-events: none;
            box-sizing: border-box;
            z-index: 10;
        }
        
        body.multi-select-mode .msg-wrapper-cv::before {
            left: 8px;
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }
        
        body.multi-select-mode .msg-wrapper-cv.msg-selected-wrapper::before {
            background: #a74fff;
            border-color: #a74fff;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>');
            background-size: 14px;
            background-position: center;
            background-repeat: no-repeat;
            transform: translateY(-50%) scale(1.1);
        }
        
        body.multi-select-mode .msg-wrapper-cv.msg-selected-wrapper > .msg {
            background-color: rgba(167,79,255,0.15) !important;
        }
    `;
    document.head.appendChild(style);
});

window.showMultiSelectBar = function() {
    let header = document.getElementById('chat-header');
    if (!header) return;

    let multiBar = document.getElementById('multi-select-header');
    if (!multiBar) {
        multiBar = document.createElement('div');
        multiBar.id = 'multi-select-header';
        Object.assign(multiBar.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'var(--sidebar)',
            zIndex: '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '15px 25px',
            paddingTop: 'max(15px, env(safe-area-inset-top))',
            boxSizing: 'border-box',
            borderBottom: '1px solid #252530',
            transform: 'translateY(-100%)',
            opacity: '0',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease'
        });

        multiBar.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center;">
                <button id="multi-forward-btn" onclick="forwardSelected()" style="background:rgba(167,79,255,0.15); color:#a74fff; border:1px solid rgba(167,79,255,0.3); border-radius:8px; padding:8px 16px; font-weight:600; cursor:pointer; font-size:13px; transition:0.2s; display:flex; align-items:center; justify-content:center;" onmouseover="this.style.background='rgba(167,79,255,0.25)'" onmouseout="this.style.background='rgba(167,79,255,0.15)'">${t('ПЕРЕСЛАТЬ')} <span class="multi-count" style="margin-left:4px;">0</span></button>
                <button id="multi-delete-btn" onclick="deleteSelected()" style="background:rgba(167,79,255,0.15); color:#a74fff; border:1px solid rgba(167,79,255,0.3); border-radius:8px; padding:8px 16px; font-weight:600; cursor:pointer; font-size:13px; transition:0.2s; display:flex; align-items:center; justify-content:center;" onmouseover="this.style.background='rgba(167,79,255,0.25)'" onmouseout="this.style.background='rgba(167,79,255,0.15)'">${t('УДАЛИТЬ')} <span class="multi-count" style="margin-left:4px;">0</span></button>
            </div>
            <button onclick="closeMultiSelect()" style="background:transparent; color:#888; border:none; font-weight:600; cursor:pointer; font-size:13px; transition:0.2s; display:flex; align-items:center; justify-content:center;" onmouseover="this.style.color='#eee'" onmouseout="this.style.color='#888'">${t('ОТМЕНА')}</button>
        `;
        header.style.position = 'relative';
        header.style.overflow = 'hidden';
        header.appendChild(multiBar);
    }
    
    multiBar.style.display = 'flex';
    void multiBar.offsetWidth;
    multiBar.style.transform = 'translateY(0)';
    multiBar.style.opacity = '1';
};

window.updateMultiSelectBar = function() {
    const count = window.selectedMessages.size;
    document.querySelectorAll('.multi-count').forEach(el => el.innerText = count);
};

window.closeMultiSelect = function() {
    window.isMultiSelectMode = false;
    window.selectedMessages.clear();
    document.body.classList.remove('multi-select-mode');
    
    document.querySelectorAll('.msg-selected-wrapper').forEach(el => {
        el.classList.remove('msg-selected-wrapper');
    });
    
    const multiBar = document.getElementById('multi-select-header');
    if (multiBar) {
        multiBar.style.transform = 'translateY(-100%)';
        multiBar.style.opacity = '0';
        setTimeout(() => {
            if (!window.isMultiSelectMode) {
                multiBar.style.display = 'none';
            }
        }, 300);
    }
};

window.initInviteBanner = function() {
    if (localStorage.getItem('4send_invite_closed') === '1') return;
    
    const contacts = document.getElementById('contacts');
    if (!contacts || document.getElementById('invite-promo-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'invite-promo-banner';
    Object.assign(banner.style, {
        margin: '10px 15px 15px 15px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(167,79,255,0.15), rgba(106,17,203,0.15))',
        border: '1px solid rgba(167,79,255,0.3)',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: 'scale(0.95) translateY(-10px)',
        opacity: '0',
        flexShrink: '0'
    });

    banner.onmouseover = () => {
        banner.style.background = 'linear-gradient(135deg, rgba(167,79,255,0.25), rgba(106,17,203,0.25))';
        banner.style.transform = 'scale(1.02)';
    };
    banner.onmouseout = () => {
        banner.style.background = 'linear-gradient(135deg, rgba(167,79,255,0.15), rgba(106,17,203,0.15))';
        banner.style.transform = 'scale(1)';
    };

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; pointer-events:none;">
            <div style="width:38px; height:38px; background:linear-gradient(135deg, #a74fff, #6a11cb); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(167,79,255,0.4);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></div>
            <div>
                <div style="color:#fff; font-size:14px; font-weight:700; margin-bottom:2px; font-family:'Inter',sans-serif;">${t('Безопаснее некуда!')}</div>
                <div style="color:#d4aaff; font-size:12px; font-weight:500; font-family:'Inter',sans-serif;">${t('Приглашай друзей в 4SEND')}</div>
            </div>
        </div>
        <div id="close-invite-banner" style="width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px; transition:0.2s; z-index:2;">✕</div>
    `;

    contacts.parentNode.insertBefore(banner, contacts);

    requestAnimationFrame(() => {
        banner.style.transform = 'scale(1) translateY(0)';
        banner.style.opacity = '1';
    });

    banner.onclick = (e) => {
        if (e.target.id === 'close-invite-banner') {
            localStorage.setItem('4send_invite_closed', '1');
            banner.style.transform = 'scale(0.9) translateY(-10px)';
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 300);
            return;
        }
        openInviteModal();
    };
};

window.openInviteModal = function() {
    let modal = document.getElementById('invite-friends-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'invite-friends-modal';
        document.body.appendChild(modal);
    }

    const link = window.location.origin + '/?join=' + (window.me || localStorage.getItem('4send_user'));
    const shareText = encodeURIComponent(`Привет! Я использую 4SEND самый безопасный мессенджер. Присоединяйся ко мне: ${link}`);

    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.7)', zIndex: '110000', display: 'flex',
        alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)', opacity: '0', transition: 'all 0.3s ease'
    });

    modal.innerHTML = `
        <div style="background:#1c1c23; width:90%; max-width:400px; border-radius:28px; padding:32px 24px; position:relative; box-shadow:0 25px 60px rgba(0,0,0,0.6); transform:scale(0.9); transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); border:1px solid rgba(167,79,255,0.3); text-align:center; overflow:hidden;">
            <div style="position:absolute; top:-50px; left:50%; transform:translateX(-50%); width:150px; height:150px; background:radial-gradient(circle, rgba(167,79,255,0.4) 0%, transparent 70%); border-radius:50%; pointer-events:none;"></div>
            
            <button onclick="closeInviteModal()" style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s; z-index:10;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
            
            <div style="width:72px; height:72px; background:linear-gradient(135deg, #a74fff, #6a11cb); border-radius:22px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; box-shadow:0 10px 25px rgba(167,79,255,0.5); position:relative; z-index:2; transform:rotate(-5deg);">
                <svg viewBox="0 0 24 24" style="width:36px; height:36px; fill:#fff; transform:rotate(5deg);"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-2.99 1.34-2.99 3S14.34 11 16 11zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5.01 6.34 5.01 8S6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </div>
            
            <h3 style="color:#fff; margin:0 0 12px 0; font-family:'Inter',sans-serif; font-size:24px; font-weight:800; position:relative; z-index:2;">${t('Пригласить друзей')}</h3>
            <p style="color:#aaa; font-size:14px; margin:0 0 24px 0; line-height:1.5; position:relative; z-index:2;">${t('4SEND - это место, где ваши данные в безопасности. Поделитесь ссылкой и общайтесь без границ!')}</p>
            
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:16px; margin-bottom:20px; position:relative; z-index:2;">
                <div style="color:#a74fff; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; text-align:left;">${t('Ваша персональная ссылка')}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; color:#fff; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:left; border:1px solid rgba(255,255,255,0.05);">${link}</div>
                    <button onclick="copyInviteLink('${escapeAttr(link)}')" style="width:44px; height:44px; background:#a74fff; border:none; border-radius:10px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s; flex-shrink:0; box-shadow:0 4px 12px rgba(167,79,255,0.3);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                </div>
            </div>
            
            <div style="display:flex; gap:12px; position:relative; z-index:2; margin-bottom: 12px;">
                <button onclick="shareInviteLink('${escapeAttr(link)}')" style="flex:1; padding:16px; background:linear-gradient(135deg, #a74fff, #6a11cb); border:none; border-radius:16px; color:#fff; font-weight:700; font-size:15px; cursor:pointer; transition:0.2s; box-shadow:0 8px 20px rgba(167,79,255,0.4); display:flex; align-items:center; justify-content:center; gap:8px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 25px rgba(167,79,255,0.5)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 20px rgba(167,79,255,0.4)'">
                    <svg viewBox="0 0 24 24" style="width:20px; fill:currentColor;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
                    ${t('ПОДЕЛИТЬСЯ')}
                </button>
            </div>
            <div style="display:flex; gap:12px; position:relative; z-index:2;">
                <button onclick="window.open('tg://msg?text=' + '${escapeAttr(shareText)}')" style="flex:1; padding:12px; background:#2AABEE; border:none; border-radius:12px; color:#fff; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <svg viewBox="0 0 24 24" style="width:20px; fill:#fff;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.18-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.21 3.47-.49.34-.94.5-1.35.49-.45-.01-1.32-.26-1.96-.47-.79-.26-1.42-.39-1.37-.83.03-.22.34-.45.94-.69 3.68-1.6 6.13-2.66 7.36-3.17 3.5-1.47 4.23-1.72 4.71-1.73.11 0 .34.03.47.14.11.09.14.22.15.34-.01.06-.01.13-.02.21z"/></svg>
                    Telegram
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
        if (typeof pushNavigationState === 'function') pushNavigationState();
    });
};

window.closeInviteModal = function() {
    const modal = document.getElementById('invite-friends-modal');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
        if (typeof backIfNav === 'function') backIfNav();
    }
};

window.copyInviteLink = function(link) {
    navigator.clipboard.writeText(link).then(() => {
        if (typeof showToast === 'function') showToast(t('Ссылка скопирована!'), false);
    });
};

window.shareInviteLink = function(link) {
    if (navigator.share) {
        navigator.share({
            title: t('Присоединяйся к 4SEND'),
            text: t('Привет! Я использую 4SEND самый безопасный мессенджер. Присоединяйся ко мне:'),
            url: link
        }).catch(() => {});
    } else {
        copyInviteLink(link);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initInviteBanner, 1000);
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.initInviteBanner, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        ::selection { background: #a74fff; color: #fff; }
        #u, #p { padding-left: 45px !important; }
    `;
    document.head.appendChild(style);
});

document.addEventListener('DOMContentLoaded', () => {
    const copyRestrictStyle = document.createElement('style');
    copyRestrictStyle.innerHTML = `
        #msg-container.copy-restricted .msg-text {
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
        }
    `;
    document.head.appendChild(copyRestrictStyle);
});

document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'modern-menu') {
                if (mutation.target.style.display === 'none' || mutation.target.style.opacity === '0') {
                    setTimeout(() => {
                        if (mutation.target.parentNode) {
                            mutation.target.remove();
                        }
                    }, 300);
                }
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
});

document.addEventListener('DOMContentLoaded', () => {
    const aiBtn = document.getElementById('ai-rewrite-btn');
    if (aiBtn) {
        aiBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor; transition: 0.2s; transform: translateY(2px);"><path d="M6.5 16.5l1.5-4.5h4l1.5 4.5h2.5l-4.5-12h-3l-4.5 12h2.5zm2.25-6.5l1.25-3.5 1.25 3.5h-2.5zM17 16.5h2.5v-8H17v8zm1.25-11c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z"/></svg>`;
        aiBtn.style.padding = '8px 6px';
    }
    const emojiBtn = document.getElementById('emoji-toggle-btn');
    if (emojiBtn) {
        emojiBtn.style.padding = '8px 6px';
    }

    const style = document.createElement('style');
    style.innerHTML = `
        #msg-container::-webkit-scrollbar-thumb:hover { background: rgba(167,79,255,0.8) !important; }
        #contacts::-webkit-scrollbar-thumb:hover { background: rgba(167,79,255,0.8) !important; }
    `;
    document.head.appendChild(style);
});

document.addEventListener('DOMContentLoaded', () => {
    const msgInput = document.getElementById('messageText');
    if (!msgInput) return;

    const mentionsBox = document.createElement('div');
    mentionsBox.id = 'mentions-autocomplete';
    Object.assign(mentionsBox.style, {
        position: 'absolute',
        bottom: '100%',
        left: '15px',
        width: 'calc(100% - 100px)',
        maxWidth: '300px',
        maxHeight: '200px',
        background: 'rgba(30,27,36,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(167,79,255,0.3)',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        overflowY: 'auto',
        display: 'none',
        zIndex: '1000',
        marginBottom: '10px',
        padding: '6px',
        scrollbarWidth: 'none'
    });
    
    const bottomBar = document.getElementById('bottom-bar-container');
    if (bottomBar) {
        bottomBar.style.position = 'relative';
        bottomBar.appendChild(mentionsBox);
    }

    let mentionMatch = null;
    let selectedMentionIndex = 0;

    msgInput.addEventListener('input', () => {
        if (!target || !target.startsWith('room_') || !window.currentRoomMembers) {
            mentionsBox.style.display = 'none';
            return;
        }

        const text = msgInput.value;
        const cursorPos = msgInput.selectionEnd;
        const textBeforeCursor = text.substring(0, cursorPos);
        
        const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
        
        if (match) {
            const query = match[1].toLowerCase();
            const filtered = window.currentRoomMembers.filter(m => 
                m.username.toLowerCase().includes(query) || 
                (m.displayName && m.displayName.toLowerCase().includes(query))
            ).filter(m => m.username !== window.me);

            if (filtered.length > 0) {
                mentionMatch = {
                    start: match.index + (textBeforeCursor[match.index] === ' ' ? 1 : 0),
                    end: cursorPos,
                    query: query,
                    users: filtered
                };
                renderMentions(filtered);
            } else {
                mentionsBox.style.display = 'none';
                mentionMatch = null;
            }
        } else {
            mentionsBox.style.display = 'none';
            mentionMatch = null;
        }
    });

    msgInput.addEventListener('keydown', (e) => {
        if (mentionsBox.style.display === 'block' && mentionMatch) {
            const items = mentionsBox.querySelectorAll('.mention-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedMentionIndex = (selectedMentionIndex + 1) % items.length;
                updateMentionSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedMentionIndex = (selectedMentionIndex - 1 + items.length) % items.length;
                updateMentionSelection(items);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(mentionMatch.users[selectedMentionIndex].username);
            } else if (e.key === 'Escape') {
                mentionsBox.style.display = 'none';
                mentionMatch = null;
            }
        }
    });

    function renderMentions(users) {
        selectedMentionIndex = 0;
        mentionsBox.innerHTML = users.map((u, idx) => {
            const avatar = typeof getAvatarHtml === 'function' ? getAvatarHtml(u.displayName || u.username, u.avatar, 28) : '';
            return `
                <div class="mention-item ${idx === 0 ? 'selected' : ''}" data-username="${escapeHTML(u.username)}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:10px; cursor:pointer; transition:0.2s; background:${idx === 0 ? 'rgba(167,79,255,0.2)' : 'transparent'};">
                    <div style="width:28px; height:28px; border-radius:50%; overflow:hidden; flex-shrink:0;">${avatar}</div>
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <div style="color:#fff; font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(u.displayName || u.username)}</div>
                        <div style="color:#a74fff; font-size:11px;">@${escapeHTML(u.username)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        mentionsBox.style.display = 'block';

        mentionsBox.querySelectorAll('.mention-item').forEach((item, idx) => {
            item.addEventListener('mouseover', () => {
                selectedMentionIndex = idx;
                updateMentionSelection(mentionsBox.querySelectorAll('.mention-item'));
            });
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                insertMention(item.getAttribute('data-username'));
            });
        });
    }

    function updateMentionSelection(items) {
        items.forEach((item, idx) => {
            if (idx === selectedMentionIndex) {
                item.style.background = 'rgba(167,79,255,0.2)';
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.style.background = 'transparent';
            }
        });
    }

    window.insertMention = function(username) {
        if (!mentionMatch) return;
        const text = msgInput.value;
        const before = text.substring(0, mentionMatch.start);
        const after = text.substring(mentionMatch.end);
        
        msgInput.value = before + '@' + username + ' ' + after;
        mentionsBox.style.display = 'none';
        mentionMatch = null;
        
        msgInput.focus();
        const newPos = before.length + username.length + 2;
        msgInput.setSelectionRange(newPos, newPos);
        
        if (typeof updateCounter === 'function') updateCounter(msgInput);
        if (typeof toggleActionBtn === 'function') toggleActionBtn(msgInput);
    };
});

let rtcPeer, localCallStream, remoteCallStream, callTimerInt, callSecs = 0, currentCallTarget = null, isCallActive = false, callRingtone = null;
const rtcConfig = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    { urls: 'stun:stun.nextcloud.com:3478' },
    { urls: 'stun:stunserver.stunprotocol.org:3478' },
    { urls: 'stun:stun.sipgate.net:3478' },
    { urls: 'stun:stun.voipgate.com:3478' },
    { urls: 'stun:stun.counterpath.com:3478' },
    { urls: 'stun:stun.voipawesome.com:3478' }
] };

function buildCallModal(state, callerName) {
    let modal = document.getElementById('call-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'call-modal';
        document.body.appendChild(modal);
    }
    
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(10,10,12,0.95)', zIndex: '2147483647', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(20px)', opacity: '0', transition: 'opacity 0.3s ease'
    });

    const avatarHtml = getAvatarHtml(callerName, null, 120);
    
    let controlsHtml = '';
    let statusText = '';
    
    if (state === 'outgoing') {
        statusText = t('Звонок...');
        controlsHtml = `
            <button onclick="endCall()" style="width:64px;height:64px;border-radius:50%;background:#ff4d4d;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(255,77,77,0.4);transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <svg viewBox="0 0 24 24" style="width:32px;fill:#fff;transform:rotate(135deg);"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
        `;
    } else if (state === 'incoming') {
        statusText = t('Входящий звонок');
        controlsHtml = `
            <button onclick="rejectCall()" style="width:64px;height:64px;border-radius:50%;background:#ff4d4d;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(255,77,77,0.4);transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <svg viewBox="0 0 24 24" style="width:32px;fill:#fff;transform:rotate(135deg);"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
            <button onclick="acceptCall()" style="width:64px;height:64px;border-radius:50%;background:#4caf50;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(76,175,80,0.4);transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <svg viewBox="0 0 24 24" style="width:32px;fill:#fff;"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
        `;
    } else if (state === 'active') {
        statusText = '00:00';
        controlsHtml = `
            <button id="call-video-btn" onclick="toggleCallVideo()" style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.2s;">
                <svg viewBox="0 0 24 24" style="width:24px;fill:#fff;"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            </button>
            <button id="call-flip-btn" onclick="flipCallCamera()" style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;cursor:pointer;display:none;align-items:center;justify-content:center;transition:0.2s;">
                <svg viewBox="0 0 24 24" style="width:24px;fill:#fff;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
            </button>
            <button id="call-mic-btn" onclick="toggleCallMic()" style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.2s;">
                <svg viewBox="0 0 24 24" style="width:24px;fill:#fff;"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            </button>
            <button onclick="endCall()" style="width:64px;height:64px;border-radius:50%;background:#ff4d4d;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(255,77,77,0.4);transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <svg viewBox="0 0 24 24" style="width:32px;fill:#fff;transform:rotate(135deg);"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
        `;
    }

    modal.innerHTML = `
        <style>
            @keyframes callPulse { 0% { box-shadow: 0 0 0 0 rgba(167,79,255,0.4); } 70% { box-shadow: 0 0 0 30px rgba(167,79,255,0); } 100% { box-shadow: 0 0 0 0 rgba(167,79,255,0); } }
        </style>
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <video id="remote-call-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:contain;display:none;background:#000;"></video>
            <audio id="remote-call-audio" autoplay></audio>
            <video id="local-call-video" autoplay playsinline muted style="position:absolute;bottom:120px;right:20px;width:100px;height:150px;border-radius:12px;object-fit:cover;border:2px solid rgba(255,255,255,0.2);display:none;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></video>
        </div>
        <div id="call-ui-layer" style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;width:100%;height:100%;padding:40px 20px;box-sizing:border-box;background:linear-gradient(to bottom, rgba(10,10,12,0.8) 0%, transparent 30%, transparent 70%, rgba(10,10,12,0.9) 100%);">
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:40px;">
                <div id="call-avatar-container" style="width:120px;height:120px;border-radius:50%;border:3px solid #a74fff;overflow:hidden;margin-bottom:20px;animation:${state !== 'active' ? 'callPulse 2s infinite' : 'none'};">
                    ${avatarHtml}
                </div>
                <div style="color:#fff;font-size:24px;font-weight:700;margin-bottom:8px;font-family:'Inter',sans-serif;">${escapeHTML(callerName)}</div>
                <div id="call-status-text" style="color:#a74fff;font-size:16px;font-weight:500;font-family:'Inter',sans-serif;">${statusText}</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:30px;padding-bottom:20px;">
                ${controlsHtml}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
    if (state === 'active' && callRingtone) { callRingtone.pause(); callRingtone.currentTime = 0; callRingtone.loop = false; }
}

async function startCall(withVideo = false) {
    if (!target || target.startsWith('room_') || target === me) return;
    try {
        localCallStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' } : false });
        currentCallTarget = target;
        isCallActive = true;
        
        const contactItem = document.querySelector(`.contact-item[data-username="${target}"]`);
        const displayName = contactItem ? contactItem.getAttribute('data-display') : target;
        
        buildCallModal('outgoing', displayName);
        const avContainer = document.getElementById('call-avatar-container');
        const origAv = contactItem ? contactItem.querySelector('.avatar-box') : null;
        if (avContainer && origAv) avContainer.innerHTML = origAv.innerHTML;
        if (withVideo) {
            const flipBtn = document.getElementById('call-flip-btn');
            if (flipBtn) flipBtn.style.display = 'flex';
            const localVideoEl = document.getElementById('local-call-video');
            if (localVideoEl) { localVideoEl.srcObject = localCallStream; localVideoEl.style.display = 'block'; }
        }

        const ringFile = Math.random() < 0.08 ? 'calling2.mp3' : 'calling.mp3';
        callRingtone = new Audio(ringFile);
        callRingtone.loop = true;
        callRingtone.currentTime = 0;
        callRingtone.play().catch(()=>{});

        socket.emit('call_request', { target: currentCallTarget, withVideo, ringFile });
    } catch (e) {
        if (typeof showToast === 'function') showToast(t("Нет доступа к микрофону/камере"), true);
    }
}

function handleIncomingCall(caller, withVideo, ringFile) {
    if (isCallActive) {
        socket.emit('call_response', { target: caller, answer: 'busy' });
        return;
    }
    currentCallTarget = caller;
    isCallActive = true;
    
    const contactItem = document.querySelector(`.contact-item[data-username="${caller}"]`);
    const displayName = contactItem ? contactItem.getAttribute('data-display') : caller;
    
    buildCallModal('incoming', displayName);
    const avContainer = document.getElementById('call-avatar-container');
    const origAv = contactItem ? contactItem.querySelector('.avatar-box') : null;
    if (avContainer && origAv) avContainer.innerHTML = origAv.innerHTML;
    
    callRingtone = new Audio(ringFile || 'calling.mp3');
    callRingtone.loop = true;
    callRingtone.currentTime = 0;
    window._ringInteractionHandler = null;
    callRingtone.play().catch(()=>{
        const handler = () => {
            if (callRingtone && callRingtone.paused) callRingtone.play().catch(()=>{});
            document.removeEventListener('click', handler);
            document.removeEventListener('touchstart', handler);
            window._ringInteractionHandler = null;
        };
        window._ringInteractionHandler = handler;
        document.addEventListener('click', handler);
        document.addEventListener('touchstart', handler);
    });
    if (navigator.vibrate) navigator.vibrate([500, 300, 500]);
}

async function acceptCall() {
    if (callRingtone) { callRingtone.pause(); callRingtone.currentTime = 0; callRingtone.loop = false; }
    if (typeof chatNotify !== 'undefined') {
        chatNotify.loop = false;
        chatNotify.pause();
        chatNotify.currentTime = 0;
    }
    try {
        localCallStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        socket.emit('call_response', { target: currentCallTarget, answer: 'accepted' });
        setupRTC(false);
        
        const contactItem = document.querySelector(`.contact-item[data-username="${currentCallTarget}"]`);
        const displayName = contactItem ? contactItem.getAttribute('data-display') : currentCallTarget;
        
        buildCallModal('active', displayName);
        const avContainer = document.getElementById('call-avatar-container');
        const origAv = contactItem ? contactItem.querySelector('.avatar-box') : null;
        if (avContainer && origAv) avContainer.innerHTML = origAv.innerHTML;
        
        startCallTimer();
    } catch (e) {
        rejectCall();
    }
}

function rejectCall() {
    if (callRingtone) { callRingtone.pause(); callRingtone.currentTime = 0; callRingtone.loop = false; }
    if (typeof chatNotify !== 'undefined') {
        chatNotify.loop = false;
        chatNotify.pause();
        chatNotify.currentTime = 0;
    }
    socket.emit('call_response', { target: currentCallTarget, answer: 'rejected' });
    cleanupCall();
}

function endCall() {
    if (currentCallTarget) {
        const hasVideo = localCallStream && localCallStream.getVideoTracks().length > 0;
        socket.emit('call_end', { target: currentCallTarget, callDuration: callSecs, withVideo: hasVideo });
    }
    cleanupCall();
}

function cleanupCall() {
    isCallActive = false;
    currentCallTarget = null;
    clearInterval(callTimerInt);
    callSecs = 0;
    if (window._ringInteractionHandler) {
        document.removeEventListener('click', window._ringInteractionHandler);
        document.removeEventListener('touchstart', window._ringInteractionHandler);
        window._ringInteractionHandler = null;
    }
    if (rtcPeer) { rtcPeer.close(); rtcPeer = null; }
    if (localCallStream) { localCallStream.getTracks().forEach(t => t.stop()); localCallStream = null; }
    if (remoteCallStream) { remoteCallStream.getTracks().forEach(t => t.stop()); remoteCallStream = null; }
    const modal = document.getElementById('call-modal');
    if (modal) { modal.style.opacity = '0'; setTimeout(() => modal.remove(), 300); }
    if (typeof chatNotify !== 'undefined') { chatNotify.loop = false; chatNotify.pause(); chatNotify.currentTime = 0; }
    if (callRingtone) { callRingtone.pause(); callRingtone.currentTime = 0; callRingtone.loop = false; }
}

async function setupRTC(isInitiator) {
    rtcPeer = new RTCPeerConnection(rtcConfig);
    localCallStream.getTracks().forEach(track => rtcPeer.addTrack(track, localCallStream));

    rtcPeer.ontrack = (event) => {
        if (!remoteCallStream) {
            remoteCallStream = new MediaStream();
        }
        if (event.track.kind === 'video') {
            const existingVideo = remoteCallStream.getVideoTracks();
            existingVideo.forEach(t => { remoteCallStream.removeTrack(t); t.stop(); });
            remoteCallStream.addTrack(event.track);
            const remoteVideo = document.getElementById('remote-call-video');
            if (remoteVideo) {
                remoteVideo.srcObject = null;
                remoteVideo.srcObject = remoteCallStream;
                remoteVideo.style.display = 'block';
                const avC = document.getElementById('call-avatar-container');
                if (avC) avC.style.display = 'none';
                event.track.onended = () => {
                    const rv = document.getElementById('remote-call-video');
                    if (rv) { rv.srcObject = null; rv.style.display = 'none'; }
                    const av = document.getElementById('call-avatar-container');
                    if (av) av.style.display = '';
                };
            }
        } else {
            remoteCallStream.addTrack(event.track);
            const remoteAudio = document.getElementById('remote-call-audio');
            if (remoteAudio) {
                remoteAudio.srcObject = remoteCallStream;
            }
        }
    };

    rtcPeer.onnegotiationneeded = async () => {
        if (!rtcPeer.localDescription) return;
        try {
            const offer = await rtcPeer.createOffer();
            await rtcPeer.setLocalDescription(offer);
            socket.emit('webrtc_signal', { target: currentCallTarget, signal: { type: 'offer', sdp: offer } });
        } catch (e) {}
    };

    rtcPeer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_signal', { target: currentCallTarget, signal: { type: 'candidate', candidate: event.candidate } });
        }
    };

    if (isInitiator) {
        const offer = await rtcPeer.createOffer();
        await rtcPeer.setLocalDescription(offer);
        socket.emit('webrtc_signal', { target: currentCallTarget, signal: { type: 'offer', sdp: offer } });
    }
}

function toggleCallMic() {
    if (!localCallStream) return;
    const audioTrack = localCallStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const btn = document.getElementById('call-mic-btn');
        if (btn) {
            btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.1)' : '#fff';
            btn.querySelector('svg').style.fill = audioTrack.enabled ? '#fff' : '#a74fff';
        }
    }
}

async function flipCallCamera() {
    if (!localCallStream || !rtcPeer) return;
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: currentFacingMode } });
        const newTrack = newStream.getVideoTracks()[0];
        const sender = rtcPeer.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
            const oldTrack = sender.track;
            sender.replaceTrack(newTrack);
            const idx = localCallStream.getTracks().indexOf(oldTrack);
            if (idx !== -1) { localCallStream.removeTrack(oldTrack); oldTrack.stop(); }
            localCallStream.addTrack(newTrack);
            const localVideoEl = document.getElementById('local-call-video');
            if (localVideoEl) { localVideoEl.srcObject = localCallStream; localVideoEl.style.display = 'block'; }
        }
    } catch (e) { currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user'; }
}

async function toggleCallVideo() {
    if (!localCallStream || !rtcPeer) return;
    let videoTrack = localCallStream.getVideoTracks()[0];
    const btn = document.getElementById('call-video-btn');
    const localVideoEl = document.getElementById('local-call-video');
    const flipBtn = document.getElementById('call-flip-btn');
    
    if (videoTrack && videoTrack.enabled) {
        videoTrack.enabled = false;
        if (btn) { btn.style.background = 'rgba(255,255,255,0.1)'; btn.querySelector('svg').style.fill = '#fff'; }
        if (localVideoEl) localVideoEl.style.display = 'none';
        if (flipBtn) flipBtn.style.display = 'none';
        const remoteVideo = document.getElementById('remote-call-video');
        const avContainer = document.getElementById('call-avatar-container');
        if (avContainer && (!remoteVideo || !remoteVideo.srcObject || remoteVideo.style.display === 'none')) {
            avContainer.style.display = '';
        }
    } else if (videoTrack && !videoTrack.enabled) {
        videoTrack.enabled = true;
        if (btn) { btn.style.background = '#fff'; btn.querySelector('svg').style.fill = '#a74fff'; }
        if (localVideoEl) { localVideoEl.srcObject = localCallStream; localVideoEl.style.display = 'block'; }
        if (flipBtn) flipBtn.style.display = 'flex';
    } else {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: currentFacingMode } });
            const newTrack = newStream.getVideoTracks()[0];
            localCallStream.addTrack(newTrack);
            rtcPeer.addTrack(newTrack, localCallStream);
            if (btn) { btn.style.background = '#fff'; btn.querySelector('svg').style.fill = '#a74fff'; }
            if (localVideoEl) { localVideoEl.srcObject = localCallStream; localVideoEl.style.display = 'block'; }
            if (flipBtn) flipBtn.style.display = 'flex';
        } catch (e) {}
    }
}

function startCallTimer() {
    callSecs = 0;
    const statusEl = document.getElementById('call-status-text');
    const avContainer = document.getElementById('call-avatar-container');
    if (avContainer) avContainer.style.animation = 'none';
    callTimerInt = setInterval(() => {
        callSecs++;
        if (statusEl) {
            const m = Math.floor(callSecs / 60).toString().padStart(2, '0');
            const s = (callSecs % 60).toString().padStart(2, '0');
            statusEl.innerText = `${m}:${s}`;
        }
    }, 1000);
}

if (socket) {
    socket.on('call_incoming', (data) => {
        handleIncomingCall(data.caller, data.withVideo, data.ringFile);
    });

    socket.on('call_answered', async (data) => {
        if (data.answer === 'accepted') {
            const contactItem = document.querySelector(`.contact-item[data-username="${currentCallTarget}"]`);
            const displayName = contactItem ? contactItem.getAttribute('data-display') : currentCallTarget;
            buildCallModal('active', displayName);
            const avContainer = document.getElementById('call-avatar-container');
            const origAv = contactItem ? contactItem.querySelector('.avatar-box') : null;
            if (avContainer && origAv) avContainer.innerHTML = origAv.innerHTML;
            setupRTC(true);
            startCallTimer();
        } else {
            if (typeof showToast === 'function') showToast(data.answer === 'busy' ? "Пользователь занят" : "Звонок отклонен", true);
            cleanupCall();
        }
    });

    socket.on('webrtc_signal', async (data) => {
        if (!rtcPeer || data.sender !== currentCallTarget) return;
        try {
            if (data.signal.type === 'offer') {
                await rtcPeer.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                const answer = await rtcPeer.createAnswer();
                await rtcPeer.setLocalDescription(answer);
                socket.emit('webrtc_signal', { target: currentCallTarget, signal: { type: 'answer', sdp: answer } });
            } else if (data.signal.type === 'answer') {
                await rtcPeer.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            } else if (data.signal.type === 'candidate') {
                await rtcPeer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            }
        } catch (e) {}
    });

    socket.on('call_ended', () => {
        cleanupCall();
    });

    socket.on('call_error', (data) => {
        if (data.reason === 'privacy') {
            if (typeof showToast === 'function') showToast(t("Пользователь ограничил звонки"), true);
        }
        cleanupCall();
    });
}