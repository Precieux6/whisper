// --- CONFIGURATION SUPABASE SÉCURISÉE ---
const SUPABASE_URL = "https://yhwgcexmwyuoezezastb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aYnG3MV_pacbBlHeMXBmKw_jqRjdG8F";

// Initialisation unique et sécurisée de l'instance Supabase
window.whisperDb = window.whisperDb || (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null);
const supabaseClient = window.whisperDb;

// Gestion utilisateur local
let currentUser = JSON.parse(localStorage.getItem('whisper_current_user')) || null;
let targetUser = null;
let messages = [];
let currentPaymentContext = { messageId: null };
let previousMessageCount = null;
let pollingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) updateCounter(messageInput);

    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('u');

    if (profileUsername) {
        await loadTargetUser(profileUsername);
    } else if (currentUser) {
        setupHeaderForOwner();
        switchView('dashboard');
        registerServiceWorkerAndSubscribe();
    } else {
        setupHeaderForGuest();
        // Affichage dynamique propre si aucun paramètre ni utilisateur connecté
        const targetElem = document.getElementById('targetUsername');
        if (targetElem) targetElem.textContent = "@mon_whisper";
    }
});

async function loadTargetUser(username) {
    if (!supabaseClient) return;
    const cleanUsername = username.startsWith('@') ? username : '@' + username;

    const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('username', cleanUsername)
        .single();

    if (error || !data) {
        alert("Ce lien Whisper n'existe pas ou a expiré.");
        return;
    }

    targetUser = data;
    const targetElem = document.getElementById('targetUsername');
    if (targetElem) targetElem.textContent = targetUser.username;

    const headerActions = document.getElementById('headerActions');
    if (headerActions) {
        headerActions.innerHTML = `
            <button onclick="openRegisterModal()" class="bg-amber-500/10 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl border border-amber-500/20">
                Créer mon lien
            </button>
        `;
    }
}

function setupHeaderForOwner() {
    if (!currentUser) return;
    const headerActions = document.getElementById('headerActions');
    if (headerActions) {
        headerActions.innerHTML = `
            <button onclick="switchView('dashboard')" id="btnDashboard" class="bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700">
                Mon Tableau de bord
            </button>
            <button onclick="switchView('public')" id="btnPublic" class="bg-amber-500/10 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl border border-amber-500/20 hidden">
                Envoyer un message
            </button>
        `;
    }
    const userDisplay = document.getElementById('myUsernameDisplay');
    const linkDisplay = document.getElementById('myLinkDisplay');
    if (userDisplay) userDisplay.textContent = currentUser.username;
    if (linkDisplay) linkDisplay.textContent = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
}

function setupHeaderForGuest() {
    const headerActions = document.getElementById('headerActions');
    if (headerActions) {
        headerActions.innerHTML = `
            <button onclick="openRegisterModal()" class="bg-amber-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-lg">
                Créer mon lien Whisper
            </button>
        `;
    }
}

function updateCounter(textarea) {
    const count = textarea.value.length;
    const counterElem = document.getElementById('charCount');
    if (counterElem) counterElem.textContent = count;
}

function switchView(view) {
    const publicView = document.getElementById('publicView');
    const dashboardView = document.getElementById('dashboardView');
    const successView = document.getElementById('successView');
    const btnDashboard = document.getElementById('btnDashboard');
    const btnPublic = document.getElementById('btnPublic');

    if (!publicView || !dashboardView) return;

    publicView.classList.add('hidden');
    dashboardView.classList.add('hidden');
    if (successView) successView.classList.add('hidden');

    if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        if (btnDashboard) btnDashboard.classList.add('hidden');
        if (btnPublic) btnPublic.classList.remove('hidden');
        fetchMessages();

        if (!pollingInterval) {
            pollingInterval = setInterval(fetchMessages, 10000);
        }
    } else {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }

        if (view === 'success') {
            if (successView) successView.classList.remove('hidden');
        } else {
            publicView.classList.remove('hidden');
            if (btnDashboard) btnDashboard.classList.remove('hidden');
            if (btnPublic) btnPublic.classList.add('hidden');
        }
    }
}

async function handleCreateUser(e) {
    e.preventDefault();
    const input = document.getElementById('newUsernameInput');
    if (!input) return;
    let username = input.value.trim().toLowerCase();
    if (!username) return;

    if (!username.startsWith('@')) username = '@' + username;
    const secretToken = "token_" + Math.random().toString(36).substring(2);

    if (!supabaseClient) {
        alert("Erreur de connexion à Supabase.");
        return;
    }

    const { data, error } = await supabaseClient
        .from('users')
        .insert([{ username: username, secret_token: secretToken }])
        .select()
        .single();

    if (error) {
        console.error("Erreur création utilisateur :", error);
        alert("Erreur : " + (error.message || "Ce pseudo est déjà pris."));
        return;
    }

    currentUser = data;
    localStorage.setItem('whisper_current_user', JSON.stringify(currentUser));
    closeRegisterModal();

    registerServiceWorkerAndSubscribe();

    window.location.href = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
}

async function handleSendConfession(e) {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    if (!input || !targetUser) {
        alert("Destinataire introuvable. Veuillez utiliser un lien Whisper valide.");
        return;
    }

    const text = input.value.trim();
    if (!text) return;

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString();

    const { error } = await supabaseClient
        .from('messages')
        .insert([
            {
                user_id: targetUser.id,
                content: text,
                device_info: navigator.userAgent.includes("Mobile") ? "Smartphone (Mobile)" : "Ordinateur (Desktop)",
                ip_address: "Client", 
                is_paid: false,
                expires_at: expiresAt
            }
        ]);

    if (error) {
        console.error("Erreur d'insertion message :", error);
        alert("Erreur lors de l'envoi du message : " + error.message);
        return;
    }

    // Déclencher l'API Serverless de Notification Push pour avertir le destinataire
    try {
        await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: targetUser.id, messageText: text })
        });
    } catch (pushErr) {
        console.log("Erreur mineure notification push :", pushErr);
    }

    input.value = '';
    updateCounter(input);
    switchView('success');
}

async function fetchMessages() {
    if (!supabaseClient || !currentUser) return;

    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) return;

    const newMessages = data || [];

    if (previousMessageCount !== null && newMessages.length > previousMessageCount) {
        playNotificationSound();
    }
    previousMessageCount = newMessages.length;

    messages = newMessages;
    renderDashboard();
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.log("Audio non pris en charge ou bloqué par le navigateur.");
    }
}

async function registerServiceWorkerAndSubscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const publicVapidKey = 'BP9QVbNfl-bvTRAdNRB0TudhJCrNxSPus_KucbL3thQryWi7XBGHE_2f_oacbndk_KDqGiKFGMZq_QN24sHpx4w';
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        if (currentUser && supabaseClient) {
            await supabaseClient
                .from('users')
                .update({ push_subscription: subscription })
                .eq('id', currentUser.id);
        }
    } catch (error) {
        console.error('Erreur enregistrement Push :', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function renderDashboard() {
    const container = document.getElementById('messagesContainer');
    const badge = document.getElementById('messageCountBadge');
    if (!container) return;

    if (badge) badge.textContent = `${messages.length} message${messages.length > 1 ? 's' : ''}`;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500 text-xs">
                Aucun message pour le moment. Partage ton lien en story pour recevoir des confessions !
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const timeAgo = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 relative space-y-3">
                <p class="text-sm italic text-gray-200">"${escapeHtml(msg.content)}"</p>

                ${msg.is_paid ? `
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs space-y-1 text-amber-300">
                        <div class="font-bold flex items-center gap-1">✨ Indices débloqués :</div>
                        <div>📱 Appareil : ${msg.device_info || 'Non spécifié'}</div>
                        <div>📍 Zone : Cotonou / Abomey-Calavi</div>
                        <div>🌐 IP : ${msg.ip_address || 'Masquée'}</div>
                        <div>⏱️ Reçu à : ${timeAgo}</div>
                    </div>
                ` : `
                    <div class="flex flex-wrap justify-between items-center pt-2 border-t border-slate-900 gap-2">
                        <span class="text-[11px] text-gray-500">Reçu à ${timeAgo} (Expire dans 30h)</span>
                        <button onclick="openCheckoutModal('${msg.id}')" class="bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors border border-amber-400/20">
                            Découvrir les indices (300 FCFA)
                        </button>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

function openRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function openCheckoutModal(messageId) {
    currentPaymentContext = { messageId };
    const modal = document.getElementById('checkoutModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// --- GESTION AVANCÉE DES PAIEMENTS & OFFRES ---
let selectedPaymentMethod = 'momo';
let selectedAmount = 300;

function setPaymentMethod(method) {
    selectedPaymentMethod = method;
    const btnMoMo = document.getElementById('btnMethodMoMo');
    const btnCard = document.getElementById('btnMethodCard');
    const momoFields = document.getElementById('momoFields');
    const cardFields = document.getElementById('cardFields');
    const phoneInput = document.getElementById('payerPhone');

    if (method === 'momo') {
        btnMoMo.className = "py-2.5 px-3 rounded-xl border border-amber-500 bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition-all";
        btnCard.className = "py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-950 text-gray-400 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:text-white";
        momoFields.classList.remove('hidden');
        cardFields.classList.add('hidden');
        if(phoneInput) phoneInput.required = true;
    } else {
        btnCard.className = "py-2.5 px-3 rounded-xl border border-amber-500 bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition-all";
        btnMoMo.className = "py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-950 text-gray-400 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:text-white";
        cardFields.classList.remove('hidden');
        momoFields.classList.add('hidden');
        if(phoneInput) phoneInput.required = false;
    }
}

function updatePaymentPlan(amount, label) {
    selectedAmount = amount;
    const totalElem = document.getElementById('displayTotalAmount');
    if (totalElem) totalElem.textContent = label;
}

function processAdvancedPayment(e) {
    e.preventDefault();
    const name = document.getElementById('payerName').value.trim();
    if (!name) return;

    closeCheckoutModal();

    if (typeof FedaPay !== 'undefined') {
        let handler = FedaPay.init({
            public_key: 'pk_sandbox_...', // Remplace par ta clé publique FedaPay active
            transaction: {
                amount: selectedAmount,
                description: `Whisper Pass (${selectedAmount} FCFA) - Msg #${currentPaymentContext.messageId || 'global'}`
            },
            customer: {
                name: name,
                phone_number: selectedPaymentMethod === 'momo' ? document.getElementById('payerPhone').value : '00000000'
            },
            metadata: {
                message_id: currentPaymentContext.messageId,
                plan: selectedAmount === 1800 ? 'weekly' : 'daily',
                payment_type: selectedPaymentMethod
            }
        });
        handler.open();
    } else {
        alert("Passerelle FedaPay en cours de chargement...");
    }
}

function copyMyLink() {
    if (!currentUser) return;
    const link = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
    navigator.clipboard.writeText(link);
    alert("📋 Lien copié ! Partage-le en story.");
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

window.openRegisterModal = openRegisterModal;
window.closeRegisterModal = closeRegisterModal;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.handleCreateUser = handleCreateUser;
window.handleSendConfession = handleSendConfession;
window.setPaymentMethod = setPaymentMethod;
window.updatePaymentPlan = updatePaymentPlan;
window.processAdvancedPayment = processAdvancedPayment;
window.copyMyLink = copyMyLink;
window.switchView = switchView;
window.updateCounter = updateCounter;
