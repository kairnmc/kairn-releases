---
title: Paramètres
nav_order: 7
---

# Paramètres

Page **Paramètres** : modifiez puis **Enregistrer** (l'apparence s'applique tout de suite).

![La page Paramètres](assets/parametres.png)

## Apparence

Quatre palettes : Redstone (par défaut), Améthyste, Lapis, Diamant.

## Bots

- **Connexions simultanées** (1 à 10, 3 par défaut) : combien de comptes se connectent en même temps ;
  les autres attendent leur tour (« En file d'attente »).
- **Bots par processus** (1 à 50, 10 par défaut) : vaut pour les connexions suivantes.

## Mises à jour

Kairn vérifie s'il existe une nouvelle version 15 secondes après son lancement, puis toutes les 6 heures.

- Par défaut, il vous la montre (dans **Activité** et ici) : **Télécharger**, puis **Redémarrer pour
  la vX**. Elle s'installe aussi quand vous fermez Kairn.
- **Télécharger les nouvelles versions dès qu'elles sortent** la télécharge en arrière-plan.
- Le redémarrage attend que les bots soient déconnectés, les scripts finis et la partie en cours
  arrêtée. **Vérifier maintenant** relance une vérification.

## Accès IA et IA locale

Voir [Accès IA](ia.html).

## Raccourcis

- **Ctrl K** : recherche rapide (comptes, pages, actions comme « Connecter tous les comptes »).
  ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.

## Où sont vos données

Dans `%APPDATA%\Kairn` :

- `data\` : comptes, réglages, kits, chaînes, enregistrements, statistiques… Les mots de passe
  (serveur, proxy) sont chiffrés par Windows et ne marchent que sur votre session.
- `auth-cache\` : les sessions Microsoft.
- `plugins\` : vos plugins et les plugins officiels.

Un fichier abîmé est mis de côté (`*.corrupt-<date>.json`) et Kairn vous le signale au lancement.
Pour changer de PC, exportez vos comptes (voir [Comptes](comptes.html#importer-et-exporter)) et
demandez un nouveau code d'accès.
