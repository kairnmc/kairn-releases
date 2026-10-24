---
title: Questions fréquentes
nav_order: 9
---

# Questions fréquentes

Un message qui bloque, un bot qui ne se connecte pas ? Cliquez sur une question pour voir la réponse.
Les questions sont rangées par thème.

## Comptes et bots

<details markdown="1">
<summary>Un bot reste en « Erreur »</summary>

Survolez son statut : la cause et le prochain essai sont indiqués (serveur injoignable, version qui
ne correspond pas au serveur, compte banni…). Vérifiez la version du serveur avec **Détecter** dans
son profil.
</details>

<details markdown="1">
<summary>Le code Microsoft a expiré</summary>

Relancez **Se connecter à Microsoft** : un nouveau code est donné.
Voir [Connecter un compte Microsoft](comptes.html#connecter-un-compte-microsoft).
</details>

<details markdown="1">
<summary>Le kit ne se récupère pas</summary>

Ouvrez le profil du serveur, section **Kits**, et utilisez **Essayer sur** un compte en ligne : le
journal montre à quelle étape ça bloque (menu qui ne s'ouvre pas, objet introuvable…).
Voir [Essayer un kit](serveurs.html#essayer-un-kit).
</details>

<details markdown="1">
<summary>Je ne peux pas jouer avec un compte</summary>

Il ne doit pas être connecté en bot ni utilisé par un script : déconnectez-le d'abord. Votre
Minecraft doit être dans la même version que le serveur.
</details>

## Accès et activation

<details markdown="1">
<summary>« Ce code est celui d’un autre PC »</summary>

Un code ne marche que sur le PC pour lequel il a été créé. Envoyez l'identifiant affiché à l'auteur
de Kairn pour en recevoir un pour ce PC.

{: .note }
Réinstaller Windows ou changer une pièce du PC ne change pas son identifiant ; changer plusieurs
pièces à la fois (carte mère, disque, processeur…), si.
</details>

<details markdown="1">
<summary>« Connexion nécessaire »</summary>

Kairn n'a pas pu vérifier votre accès. La raison est affichée dessous : pas de connexion, un
pare-feu, un proxy ou un VPN qui bloque GitHub… Corrigez-la puis **Réessayer**. Kairn marche jusqu'à
7 jours sans connexion.
</details>

<details markdown="1">
<summary>« Accès révoqué »</summary>

L'auteur de Kairn a retiré cet accès : contactez-le.
</details>

## Installation et mises à jour

<details markdown="1">
<summary>Windows bloque l’installateur</summary>

Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**. S'il n'y a que « Ne pas
exécuter » : clic droit sur l'installateur › **Propriétés** › cochez **Débloquer** › **OK**, puis
relancez-le (voir [Si Windows bloque l'installateur](index.html#si-windows-bloque-linstallateur)).
</details>

<details markdown="1">
<summary>La mise à jour ne s’installe pas</summary>

**Redémarrer** attend que les bots soient déconnectés, les scripts finis et la partie arrêtée. Sinon,
elle s'installe à la fermeture de Kairn. Voir [Garder Kairn à jour](parametres.html#garder-kairn-à-jour).
</details>

## Plugins

<details markdown="1">
<summary>Je ne peux pas modifier un plugin « Officiel »</summary>

C'est voulu : il est mis à jour par l'auteur de Kairn et vos modifications seraient remplacées.
Créez un **Nouveau plugin** pour écrire le vôtre.
</details>

<details markdown="1">
<summary>Mon plugin est en rouge</summary>

Le message dit pourquoi (`plugin.json` invalide, fichier principal introuvable…). Corrigez et rouvrez
la page Plugins.
</details>

## Et ensuite ?

Pas de réponse ici ? Contactez l'auteur de Kairn. Pour reprendre depuis le début : [Accueil](index.html).
