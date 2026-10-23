---
title: Accès IA
nav_order: 6
---

# Accès IA

Deux choses distinctes : laisser une **IA sur votre PC** (Claude Code…) piloter Kairn, et donner aux
**plugins** une IA locale.

## Laisser une IA piloter Kairn

Désactivé par défaut. Dans **Paramètres** › **Accès IA**, cochez **Autoriser des IA locales** : Kairn
écoute sur votre PC uniquement (port 47821 par défaut). Puis, page **Accès IA** :

1. **Clients** : ajoutez un client (un nom, un réglage), puis **Copier la commande** et collez-la dans
   votre terminal pour Claude Code. **Nouvelle clé** révoque l'ancienne.
2. Pour chaque outil, choisissez **Bloqué**, **Demander** ou **Autorisé**. Réglages tout prêts :
   **Lecture seule**, **Prudent** (par défaut : lire est libre, le reste vous est demandé),
   **Confiance**. Vous pouvez aussi limiter le client à certains serveurs.
3. **Demandes** : ce que l'IA attend de vous. Pour un plugin qu'elle veut créer ou remplacer, vous
   voyez son code avant d'**Autoriser** ou **Refuser**. Sans réponse, refus au bout de 5 minutes.
4. **Historique** : tout ce que chaque IA a fait ou tenté.

L'IA peut lister plugins, serveurs, comptes et lancements, lire un plugin ou un journal, créer ou
remplacer un plugin, lancer un plugin sur des comptes et arrêter un lancement — selon les
permissions que vous lui donnez. Elle ne peut pas modifier un plugin officiel.

**Couper l'accès IA** refuse ce qui attend, coupe l'accès et arrête ce qu'une IA a lancé. On le
rouvre dans Paramètres.

## IA locale pour les plugins

Certains plugins (étiquette **IA**) posent des questions à une IA qui tourne sur votre PC, avec
[Ollama](https://ollama.com). Dans **Paramètres** › **IA locale pour les plugins** : l'adresse
d'Ollama (`http://127.0.0.1:11434` par défaut), **Actualiser**, puis le **modèle** pour les questions
et le **modèle d'embeddings** pour les ressemblances. Rien ne quitte votre PC.
