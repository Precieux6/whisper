// --- CONFIGURATION SUPABASE SÉCURISÉE ---
// On vérifie d'abord si supabase n'est pas déjà instancié pour éviter les doublons
let supabaseClient = window.supabase ? window.supabase.createClient(
"https://yhwgcexmwyuoezezastb.supabase.co",
"sb_publishable_aYnG3MV_pacbBlHeMXBmKw_jqRjdG8F"
) : null;

// Utilisateur par défaut
let currentUser = {
id: "00000000-0000-0000-0000-000000000001",
username: "@precieux"
};

let messages = [];
let currentPaymentContext = {
type: 'single',
messageId: null
};

document.addEventListener('DOMContentLoaded', () => {
const messageInput = document.getElementById('messageInput');
if (messageInput) {
updateCounter(messageInput);
}
fetchMessages();

const linkDisplay = document.getElementById('myLinkDisplay');
const userDisplay = document.getElementById('myUsernameDisplay');
const targetDisplay = document.getElementById('targetUsername');

if (linkDisplay) linkDisplay.textContent = `${window.location.origin}${window.location.pathname}?u=${currentUser.username}`;
if (userDisplay) userDisplay.textContent = currentUser.username;
if (targetDisplay) targetDisplay.textContent = currentUser.username;
});

function updateCounter(textarea) {
const count = textarea.value.length;
const counterElem = document.getElementById('charCount');
if (counterElem) counterElem.textContent = count;
}

function switchView(view) {
const publicView = document.getElementById('publicView');
const dashboardView = document.getElementById('dashboardView');
const btnDashboard = document.getElementById('btnDashboard');
const btnPublic = document.getElementById('btnPublic');

if (!publicView || !dashboardView) return;

if (view === 'dashboard') {
publicView.classList.add('hidden');
dashboardView.classList.remove('hidden');
if (btnDashboard) btnDashboard.classList.add('hidden');
if (btnPublic) btnPublic.classList.remove('hidden');
fetchMessages();
} else {
publicView.classList.remove('hidden');
dashboardView.classList.add('hidden');
if (btnDashboard) btnDashboard.classList.remove('hidden');
if (btnPublic) btnPublic.classList.add('hidden');
}
}

async function handleSendConfession(e) {
e.preventDefault();
const input = document.getElementById('messageInput');
if (!input) return;
const text = input.value.trim();
if(!text) return;

if (!supabaseClient) {
alert("Erreur de connexion à la base de données.");
return;
}

const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString();

const { error } = await supabaseClient
.from('messages')
.insert([
{
user_id: currentUser.id,
content: text,
device_info: navigator.userAgent.includes("Mobile") ? "Smartphone (Mobile)" : "Ordinateur (Desktop)",
ip_address: "197.159.x.x",
is_paid: false,
expires_at: expiresAt
}
]);

if (error) {
console.error("Erreur d'insertion Supabase :", error);
alert("Une erreur est survenue lors de l'envoi.");
return;
}

input.value = '';
updateCounter(input);

alert("✨ Ton Whisper a été envoyé anonymement avec succès !");
switchView('dashboard');
}

async function fetchMessages() {
if (!supabaseClient) return;

const { data, error } = await supabaseClient
.from('messages')
.select('*')
.eq('user_id', currentUser.id)
.order('created_at', { ascending: false });

if (error) {
console.error("Erreur de récupération Supabase :", error);
return;
}

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

function openCheckoutModal(type, messageId) {
currentPaymentContext = { type, messageId };
const modal = document.getElementById('checkoutModal');
const title = document.getElementById('modalTitle');
const desc = document.getElementById('modalDesc');
const price = document.getElementById('modalPrice');

if (!modal) return;

if (type === 'single') {
if (title) title.textContent = "Révéler les indices du Whisper";
if (desc) desc.textContent = "Découvre l'appareil, la zone géographique, l'heure et l'IP de cet expéditeur.";
if (price) price.textContent = "300 FCFA";
} else {
if (title) title.textContent = "Pass Semaine Illimité";
if (desc) desc.textContent = "Débloque toutes les identités et indices de la semaine en illimité.";
if (price) price.textContent = "2 000 FCFA";
}

modal.classList.remove('hidden');
modal.classList.add('flex');
}

function closeCheckoutModal() {
const modal = document.getElementById('checkoutModal');
if (modal) {
modal.classList.add('hidden');
modal.classList.remove('flex');
}
}

async function processFedaPayPayment(e) {
e.preventDefault();
const nameElem = document.getElementById('payerName');
const phoneElem = document.getElementById('payerPhone');
if (!nameElem || !phoneElem) return;

const name = nameElem.value;
const phone = phoneElem.value;

if(!name || !phone) return;

alert(`[Simulateur FedaPay / USSD Push]\n\nUne demande de paiement de ${currentPaymentContext.type === 'single' ? '300' : '2000'} FCFA a été envoyée sur le ${phone}. Veuillez valider avec votre code PIN.`);

if (currentPaymentContext.type === 'single' && supabaseClient) {
const { error } = await supabaseClient
.from('messages')
.update({ is_paid: true })
.eq('id', currentPaymentContext.messageId);

if (error) {
console.error("Erreur de mise à jour du paiement :", error);
}
}

closeCheckoutModal();
fetchMessages();
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
