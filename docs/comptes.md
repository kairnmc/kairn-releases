---
title: Comptes
nav_order: 2
---

# Comptes

La page **Comptes** liste les comptes du serveur choisi en haut à gauche. Chaque serveur a ses
propres comptes.

## Ajouter un compte

Bouton **Ajouter un compte**, puis :

- **Premium (Microsoft)** : l'adresse e-mail du compte Microsoft. Juste après, une fenêtre vous donne
  un code à saisir sur la page de Microsoft. Votre mot de passe Microsoft n'est jamais demandé.
- **Cracked** : un **pseudo** (3 à 16 caractères : lettres, chiffres, `_`), pour les serveurs en mode
  cracked (offline) uniquement.

Options :

- **Mot de passe du serveur** : envoyé avec `/login` une fois le bot arrivé. Il est chiffré par Windows.
- **Mode rejoint à la connexion** : un des [modes de jeu](serveurs.html#modes-de-jeu) du serveur, ou
  rester au point d'arrivée.
- **Proxy** : SOCKS5, SOCKS4 ou HTTP (CONNECT), avec utilisateur et mot de passe si besoin (pas de
  mot de passe en SOCKS4). La connexion Microsoft, elle, ne passe pas par le proxy.
- **Reconnexion automatique** : reconnecte le bot après une déconnexion, jamais après un bannissement.
- **Anti-AFK** : le bot regarde autour de lui et fait un aller-retour de 4 blocs toutes les 1 à
  4 minutes ; il se met en pause quand un script utilise le compte.

Le type d'un compte (premium ou cracked) ne change plus après sa création.

## Connexion Microsoft

Pour un compte premium : **Se connecter à Microsoft**, puis dans la fenêtre :

1. **Ouvrir la page Microsoft** (ou copiez son adresse) ;
2. saisissez le code affiché (bouton **Copier**) ;
3. connectez-vous avec le compte Microsoft voulu.

La fenêtre se ferme toute seule une fois connecté. Le code expire au bout de quelques minutes :
recommencez s'il a expiré. La session reste enregistrée ; **Modifier** › **Se déconnecter** l'oublie
(il faudra un nouveau code).

## Le tableau

- En haut, la **barre d'objets** montre un compte par case : sa tête, son statut (petit carré en
  bas à gauche) et un carré doré si un kit est prêt. Un clic ouvre sa fiche.
- **Filtres** : Tous, En ligne, Kit prêt, et un filtre par tag (plusieurs tags : les comptes qui
  les ont tous).
- **Colonnes** : Compte, Statut, vos [valeurs suivies](serveurs.html#valeurs-suivies) (avec le total
  pour les nombres), Kits, temps En ligne.
- **Statuts** : Déconnecté, En file d'attente, Authentification…, Connexion au serveur…, En ligne,
  Reconnexion prévue, Erreur. Survolez-le pour la cause et le prochain essai.
- Sur chaque ligne : **Connecter** / **Déconnecter**, et le menu **⋯** : Console, Jouer avec ce compte,
  Modifier, Supprimer.

Les connexions se font quelques-unes à la fois (réglable dans [Paramètres](parametres.html#bots)).

## Agir sur plusieurs comptes

Cochez des lignes : une barre apparaît avec **Connecter**, **Déconnecter**, **Lancer un script**,
**Récupérer les kits**, et **Plus** (ajouter ou retirer des tags, exporter, supprimer).

## La fiche d'un compte

Un clic sur un compte ouvre sa fiche, à droite :

- **Aperçu** : ce que le serveur affiche sur ce compte (grade, argent…), ses kits, ses derniers messages ;
- **Console** : le chat du bot en direct ; écrivez un message ou une `/commande` (le compte doit
  être en ligne) ;
- **Kits** : chaque kit, prêt ou dans combien de temps, et combien de fois il a été récupéré ;
- **Stats** : temps en ligne (total et 7 jours), kits, dons, échanges, objets reçus, expulsions,
  déconnexions, et les derniers incidents.

## Tags

Menu **⋯** › **Gérer les tags** : créez des tags (nom et couleur) pour ranger vos comptes, puis
ajoutez-les depuis la fiche ou la sélection. Supprimer un tag ne supprime pas les comptes.

## Importer et exporter

Menu **⋯** de la page :

- **Exporter des comptes** : tous les comptes du serveur ou la sélection, dans un fichier. Cochez
  **Inclure les mots de passe** pour y mettre les mots de passe de serveur et de proxy : le fichier
  n'est alors **pas chiffré**, gardez-le pour vous. Les sessions Microsoft ne sont jamais exportées.
- **Importer des comptes** : un fichier exporté par Kairn. Un rapport liste les comptes importés et
  ceux ignorés (déjà présents, par exemple).
