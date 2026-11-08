// État initial de l'application
let currentUser = {
    username: "@precieux",
    token: "whisper_token_9726"
};

// Simulation d'une base de données locale (ou messages par défaut)
let messages = JSON.parse(localStorage.getItem('whisper_messages')) || [
    {
        id: "msg_1",
        content: "Je n'ose pas te le dire en face, mais ton sourire illumine chacune de mes journées depuis des mois...",
        created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 29).toISOString(),
        is_paid: false,
        hints: {
            device: "iPhone 14 Pro (Safari)",
            location: "Cotonou, Littoral",
            ip: "154.120.x.x",
            time: "Il y a 25 minutes"
        }
    },
    {
        id: "msg_2",
        content: "Félicitations pour tous tes projets web en cours, tu assures un max ! Continue comme ça.",
        created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
        is_paid: true,
        hints: {
            device: "Windows PC (Chrome)",
            location: "Abomey-Calavi, Atlantique",
            ip: "197.234.x.x",
            time: "Il y a 2 heures"
        }
    }
];

let currentPaymentContext = {
    type: 'single', // 'single' (300 FCFA) ou 'weekly' (1800 FCFA)
    messageId: null
};

document.addEventListener('DOMContentLoaded', () => {
    updateCounter(document.getElementById('messageInput'));
    renderDashboard();
    
    // Configurer le lien affiché
    document.getElementById('myLinkDisplay').textContent = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
    document.getElementById('myUsernameDisplay').textContent = currentUser.username;
    document.getElementById('targetUsername').textContent = currentUser.username;
});

function updateCounter(textarea) {
    const count = textarea.value.length;
    document.getElementById('charCount').textContent = count;
}

function switchView(view) {
    const publicView = document.getElementById('publicView');
    const dashboardView = document.getElementById('dashboardView');
    const btnDashboard = document.getElementById('btnDashboard');
    const btnPublic = document.getElementById('btnPublic');

    if (view === 'dashboard') {
        publicView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        btnDashboard.classList.add('hidden');
        btnPublic.classList.remove('hidden');
        renderDashboard();
    } else {
        publicView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        btnDashboard.classList.remove('hidden');
        btnPublic.classList.add('hidden');
    }
}

function handleSendConfession(e) {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if(!text) return;

    const newMsg = {
        id: "msg_" + Date.now(),
        content: text,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString(),
        is_paid: false,
        hints: {
            device: navigator.userAgent.includes("Mobile") ? "Smartphone (Mobile)" : "Ordinateur (Desktop)",
            location: "Bénin (Cotonou / Calavi)",
            ip: "197.159.x.x",
            time: "À l'instant"
        }
    };

    messages.unshift(newMsg);
    localStorage.setItem('whisper_messages', JSON.stringify(messages));

    input.value = '';
    updateCounter(input);

    alert("✨ Ton Whisper a été envoyé anonymement avec succès !");
    switchView('dashboard');
}

function renderDashboard() {
    const container = document.getElementById('messagesContainer');
    document.getElementById('messageCountBadge').textContent = `${messages.length} message${messages.length > 1 ? 's' : ''}`;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500 text-xs">
                Aucun message pour le moment. Partage ton lien en story pour recevoir des confessions !
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(msg => {
        return `
            <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 relative space-y-3">
                <p class="text-sm italic text-gray-200">"${escapeHtml(msg.content)}"</p>
                
                ${msg.is_paid ? `
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs space-y-1 text-amber-300">
                        <div class="font-bold flex items-center gap-1">✨ Indices débloqués :</div>
                        <div>📱 Appareil : ${msg.hints.device}</div>
                        <div>📍 Zone : ${msg.hints.location}</div>
                        <div>🌐 IP : ${msg.hints.ip}</div>
                        <div>⏱️ Envoyé : ${msg.hints.time}</div>
                    </div>
                ` : `
                    <div class="flex flex-wrap justify-between items-center pt-2 border-t border-slate-900 gap-2">
                        <span class="text-[11px] text-gray-500">${msg.hints.time} (Expire dans 30h)</span>
                        <button onclick="openCheckoutModal('single', '${msg.id}')" class="bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors border border-amber-400/20">
                            Découvrir les indices (300 FCFA)
                        </button>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

function openCheckoutModal(type, messageId) {
    currentPaymentContext = { type, messageId };
    const modal = document.getElementById('checkoutModal');
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDesc');
    const price = document.getElementById('modalPrice');

    if (type === 'single') {
        title.textContent = "Révéler les indices du Whisper";
        desc.textContent = "Découvre l'appareil, la zone géographique, l'heure et l'IP de cet expéditeur.";
        price.textContent = "300 FCFA";
    } else {
        title.textContent = "Pass Semaine Illimité";
        desc.textContent = "Débloque toutes les identités et indices de la semaine en illimité.";
        price.textContent = "2 000 FCFA";
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function processFedaPayPayment(e) {
    e.preventDefault();
    const name = document.getElementById('payerName').value;
    const phone = document.getElementById('payerPhone').value;

    if(!name || !phone) return;

    alert(`[Simulateur FedaPay / USSD Push]

Une demande de paiement de ${currentPaymentContext.type === 'single' ? '300' : '1800'} FCFA a été envoyée sur le ${phone}. Veuillez valider avec votre code PIN Mobile Money.`);

    if (currentPaymentContext.type === 'single') {
        const msg = messages.find(m => m.id === currentPaymentContext.messageId);
        if (msg) {
            msg.is_paid = true;
            localStorage.setItem('whisper_messages', JSON.stringify(messages));
        }
    }

    closeCheckoutModal();
    renderDashboard();
    alert("🎉 Paiement validé avec succès ! Les indices sont désormais débloqués.");
}

function copyMyLink() {
    const link = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
    navigator.clipboard.writeText(link);
    alert("📋 Lien copié dans le presse-papier ! Tu peux le coller dans ta Story Instagram ou WhatsApp.");
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
