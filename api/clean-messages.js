import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    // Optionnel : Sécuriser avec une clé secrète dans les en-têtes pour éviter que n'importe qui appelle l'URL
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    try {
        const now = new Date().toISOString();

        // Supprimer tous les messages non payés dont la date d'expiration est dépassée
        const { data, error } = await supabase
            .from('messages')
            .delete()
            .eq('is_paid', false)
            .lt('expires_at', now);

        if (error) {
            console.error('Erreur lors du nettoyage :', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Nettoyage des messages expirés effectué avec succès.' 
        });
    } catch (err) {
        console.error('Erreur Cron :', err);
        return res.status(500).json({ error: 'Erreur interne' });
    }
}
