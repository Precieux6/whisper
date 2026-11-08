import { createClient } from '@supabase/supabase-js';

// Initialiser Supabase avec la clé secrète (service_role) pour avoir les droits d'écriture
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    try {
        const event = req.body;

        // Vérifier si l'événement correspond à une transaction approuvée par FedaPay
        if (event.name === 'transaction.approved' || (event.data && event.data.status === 'approved')) {
            const transaction = event.data;
            
            // Récupérer les métadonnées ou custom_data envoyés lors de l'initialisation du paiement
            // (Par exemple l'ID du message ou le type de pass)
            const messageId = transaction.custom_metadata?.message_id;

            if (messageId) {
                // Mettre à jour le message dans Supabase pour le passer en is_paid = true
                const { error } = await supabase
                    .from('messages')
                    .update({ is_paid: true })
                    .eq('id', messageId);

                if (error) {
                    console.error('Erreur Supabase lors de la mise à jour :', error);
                    return res.status(500).json({ error: 'Erreur base de données' });
                }
            }
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Erreur Webhook :', err);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
}
