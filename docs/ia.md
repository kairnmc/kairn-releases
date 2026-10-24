---
title: Accès IA
nav_order: 6
---

# Accès IA

Ici, vous reliez Kairn à une intelligence artificielle. Deux usages distincts :

- laisser une **IA sur votre PC** (Claude Code…) piloter Kairn ;
- donner aux **plugins** une IA locale.

## Laisser une IA piloter Kairn

{: .note }
Désactivé par défaut. Dans **Paramètres** › **Accès IA**, cochez **Autoriser des IA locales** : Kairn
écoute sur votre PC uniquement (port 47821 par défaut).

Puis, page **Accès IA** :

<ol class="kairn-steps">
  <li><strong>Clients</strong> Ajoutez un client (un nom, un réglage), puis <strong>Copier la commande</strong> et collez-la dans votre terminal pour Claude Code. <strong>Nouvelle clé</strong> révoque l’ancienne.</li>
  <li><strong>Permissions</strong> Pour chaque outil, choisissez <strong>Bloqué</strong>, <strong>Demander</strong> ou <strong>Autorisé</strong>. Réglages tout prêts : <strong>Lecture seule</strong>, <strong>Prudent</strong> (par défaut : lire est libre, le reste vous est demandé), <strong>Confiance</strong>. Vous pouvez aussi limiter le client à certains serveurs.</li>
  <li><strong>Demandes</strong> Ce que l’IA attend de vous. Pour un plugin qu’elle veut créer ou remplacer, vous voyez son code avant d’<strong>Autoriser</strong> ou <strong>Refuser</strong>. Sans réponse, refus au bout de 5 minutes.</li>
  <li><strong>Historique</strong> Tout ce que chaque IA a fait ou tenté.</li>
</ol>

### Ce que l'IA peut faire

Selon les permissions que vous lui donnez, l'IA peut :

- lister plugins, serveurs, comptes et lancements ;
- lire un plugin ou un journal ;
- créer ou remplacer un plugin ;
- lancer un plugin sur des comptes et arrêter un lancement.

{: .note }
Elle ne peut pas modifier un plugin officiel.

### Couper l'accès

{: .important }
**Couper l'accès IA** refuse ce qui attend, coupe l'accès et arrête ce qu'une IA a lancé. On le
rouvre dans Paramètres.

## Donner une IA locale aux plugins

Certains plugins (étiquette **IA**) posent des questions à une IA qui tourne sur votre PC, avec
[Ollama](https://ollama.com). Dans **Paramètres** › **IA locale pour les plugins** :

1. l'adresse d'Ollama (`http://127.0.0.1:11434` par défaut), puis **Actualiser** ;
2. le **modèle** pour les questions ;
3. le **modèle d'embeddings** pour les ressemblances.

{: .astuce }
Rien ne quitte votre PC.

## Et ensuite ?

Réglez le reste de Kairn dans [Paramètres](parametres.html), ou écrivez un plugin qui utilise l'IA
locale : [Écrire un plugin](plugins.html#ia-locale).
