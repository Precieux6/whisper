// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://yhwgcexmwyuoezezastb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aYnG3MV_pacbBlHeMXBmKw_jqRjdG8F";

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Gestion utilisateur local
let currentUser = JSON.parse(localStorage.getItem('whisper_current_user')) || null;
let targetUser = null; // Utilisateur dont on visite le profil
let messages = [];
let currentPaymentContext = { type: 'single', messageId: null };

document.addEventListener('DOMContentLoaded', async () => {
const messageInput = document.getElementById('messageInput');
if (messageInput) updateCounter(messageInput);

// Analyser l'URL pour voir si on visite un profil (ex: ?u=precieux)
const urlParams = new URLSearchParams(window.location.search);
const profileUsername = urlParams.get('u');

if (profileUsername) {
// Mode Visiteur : on cherche le propriétaire du lien dans Supabase
await loadTargetUser(profileUsername);
} else if (currentUser) {
// Mode Propriétaire connecté : redirection sur son dashboard
setupHeaderForOwner();
switchView('dashboard');
} else {
// Premier accès sans lien : inviter à créer un compte ou afficher un profil par défaut
setupHeaderForGuest();
}
});

// Charger l'utilisateur cible depuis Supabase via son username
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
document.getElementById('targetUsername').textContent = targetUser.username;

// S'assurer que l'expéditeur ne voit pas le bouton tableau de bord
document.getElementById('headerActions').innerHTML = `
<button onclick="openRegisterModal()" class="bg-amber-500/10 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl border border-amber-500/20">
Créer mon lien
</button>
`;
}

// Configuration de l'en-tête pour le propriétaire
function setupHeaderForOwner() {
if (!currentUser) return;
document.getElementById('headerActions').innerHTML = `
<button onclick="switchView('dashboard')" id="btnDashboard" class="bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700">
Mon Tableau de bord
</button>
<button onclick="switchView('public')" id="btnPublic" class="bg-amber-500/10 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl border border-amber-500/20 hidden">
Envoyer un message
</button>
`;
document.getElementById('myUsernameDisplay').textContent = currentUser.username;
document.getElementById('myLinkDisplay').textContent = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
}

function setupHeaderForGuest() {
document.getElementById('headerActions').innerHTML = `
<button onclick="openRegisterModal()" class="bg-amber-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-lg">
Créer mon lien Whisper
</button>
`;
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

// Inscription / Création automatique d'un utilisateur dans Supabase
async function handleCreateUser(e) {
e.preventDefault();
const input = document.getElementById('newUsernameInput');
let username = input.value.trim().toLowerCase();
if (!username) return;

if (!username.startsWith('@')) username = '@' + username;
const secretToken = "token_" + Math.random().toString(36.substring(2));

if (!supabase) {
alert("Erreur de connexion à Supabase.");
return;
}

// Insérer dans la table users
const { data, error } = await supabase
.from('users')
.insert([{ username: username, secret_token: secretToken }])
.select()
.single();

if (error) {
alert("Ce pseudo est déjà pris ou une erreur est survenue. Choisis-en un autre.");
return;
}

currentUser = data;
localStorage.setItem('whisper_current_user', JSON.stringify(currentUser));
closeRegisterModal();

// Rediriger vers son propre lien / tableau de bord
window.location.href = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
}

// Envoyer un message anonyme rattaché au bon user_id
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
switchView('success'); // Afficher la vue de succès avec option de création de lien
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
const name = document.getElementById('payerName').value;
const phone = document.getElementById('payerPhone').value;
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
