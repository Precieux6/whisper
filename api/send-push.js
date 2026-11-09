import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
    'mailto:contact@whisper.bj',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    try {
        const { userId, messageText } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .select('push_subscription')
            .eq('id', userId)
            .single();

        if (error || !user || !user.push_subscription) {
            return res.status(404).json({ error: 'Abonnement push introuvable pour cet utilisateur' });
        }

        const pushSubscription = user.push_subscription;
        const originUrl = req.headers.origin || 'https://whisper.bj';
        
        const payload = JSON.stringify({
            title: 'Nouveau Whisper reçu 🤫',
            body: `Message : "${messageText ? messageText.substring(0, 50) : ''}..."`,
            url: originUrl
        });

        await webpush.sendNotification(pushSubscription, payload);

        return res.status(200).json({ success: true, message: 'Notification push envoyée avec succès' });
    } catch (err) {
        console.error('Erreur d’envoi Push :', err);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}
