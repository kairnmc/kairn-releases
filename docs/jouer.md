---
title: Jouer avec un compte
nav_order: 5
---

# Jouer avec un compte

Jouez vous-même avec n'importe lequel de vos comptes, depuis votre propre Minecraft : votre client se
connecte à Kairn sur votre PC, et Kairn rejoint le serveur avec le compte choisi (connexion
Microsoft, proxy et `/login` compris). Le serveur ne voit que ce compte.

1. Page **Jouer avec un compte** : choisissez le **compte** et le **port local** (25566 par défaut),
   puis **Démarrer**.
2. Dans Minecraft, **même version que le serveur** : **Multijoueur** › **Connexion directe** ›
   `127.0.0.1:25566` (bouton **Copier**).
3. Kairn vous demande d'autoriser la connexion (« … veut jouer en tant que … ») : acceptez. Sans
   réponse, elle est refusée au bout de 25 secondes.

Le compte ne doit pas être déjà connecté en bot : déconnectez-le avant. **Arrêter** termine la partie.

## Plugins d'interception

Facultatif : des plugins qui voient et modifient ce qui passe entre votre client et le serveur
(10 au plus par partie). Ils se choisissent avant **Démarrer**.

## Enregistrer

Pendant la partie : **Enregistrer** (nom facultatif), **Pause** / **Reprendre**, **Terminer**.
L'enregistrement arrive dans **Enregistrements**, prêt à être rejoué par d'autres comptes.

Ou directement en jeu, dans le chat (ces commandes ne partent jamais au serveur) :

| Commande | Effet |
|---|---|
| `/mb rec [nom]` | commence à enregistrer |
| `/mb pause` | met en pause |
| `/mb reprise` | reprend |
| `/mb stop` | termine et enregistre |
