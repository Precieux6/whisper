// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://yhwgcexmwyuoezezastb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aYnG3MV_pacbBlHeMXBmKw_jqRjdG8F";

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Gestion utilisateur local
let currentUser = JSON.parse(localStorage.getItem('whisper_current_user')) || null;
let targetUser = null;
let messages = [];
let currentPaymentContext = { type: 'single', messageId: null };

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
} else {
setupHeaderForGuest();
}
});

async function loadTargetUser(username) {
if (!supabase) return;
const cleanUsername = username.startsWith('@') ? username : '@' + username;

const { data, error } = await supabase
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
} else if (view === 'success') {
if (successView) successView.classList.remove('hidden');
} else {
publicView.classList.remove('hidden');
if (btnDashboard) btnDashboard.classList.remove('hidden');
if (btnPublic) btnPublic.classList.add('hidden');
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

if (!supabase) {
alert("Erreur de connexion à Supabase.");
return;
}

const { data, error } = await supabase
.from('users')
.insert([{ username: username, secret_token: secretToken }])
.select()
.single();

if (error) {
alert("Ce pseudo est déjà pris ou une erreur est survenue.");
return;
}

currentUser = data;
localStorage.setItem('whisper_current_user', JSON.stringify(currentUser));
closeRegisterModal();

window.location.href = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
}

async function handleSendConfession(e) {
e.preventDefault();
const input = document.getElementById('messageInput');
if (!input || !targetUser) {
alert("Destinataire introuvable.");
return;
}

const text = input.value.trim();
if(!text) return;

const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString();

const { error } = await supabase
.from('messages')
.insert([
{
user_id: targetUser.id,
content: text,
device_info: navigator.userAgent.includes("Mobile") ? "Smartphone (Mobile)" : "Ordinateur (Desktop)",
ip_address: "197.159.x.x",
is_paid: false,
expires_at: expiresAt
}
]);

if (error) {
console.error("Erreur d'insertion :", error);
alert("Erreur lors de l'envoi.");
return;
}

input.value = '';
updateCounter(input);
switchView('success');
}

async function fetchMessages() {
if (!supabase || !currentUser) return;

const { data, error } = await supabase
.from('messages')
.select('*')
.eq('user_id', currentUser.id)
.order('created_at', { ascending: false });

if (error) return;

messages = data || [];
renderDashboard();
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
<button onclick="openCheckoutModal('single', '${msg.id}')" class="bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors border border-amber-400/20">
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

function openCheckoutModal(type, messageId) {
currentPaymentContext = { type, messageId };
const modal = document.getElementById('checkoutModal');
if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeCheckoutModal() {
const modal = document.getElementById('checkoutModal');
if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function processFedaPayPayment(e) {
e.preventDefault();
const nameElem = document.getElementById('payerName');
const phoneElem = document.getElementById('payerPhone');
if (!nameElem || !phoneElem) return;

const name = nameElem.value;
const phone = phoneElem.value;
if(!name || !phone) return;

alert(`[Simulateur FedaPay]\n\nPaiement de 300 FCFA initié sur le ${phone}.`);

if (currentPaymentContext.type === 'single' && supabase) {
await supabase.from('messages').update({ is_paid: true }).eq('id', currentPaymentContext.messageId);
}

closeCheckoutModal();
fetchMessages();
alert("🎉 Paiement validé ! Indices débloqués.");
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
