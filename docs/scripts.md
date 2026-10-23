---
title: Scripts et automatisation
nav_order: 4
---

# Scripts et automatisation

Le groupe **Scripts** du menu réunit tout ce qui fait agir vos comptes tout seuls.

## Plugins

Un **plugin** est un script : farmer, récupérer des récompenses, échanger… La page **Plugins** les liste.

1. **Lancer** sur le plugin voulu : une fenêtre demande pour quels comptes. Cherchez par nom, ou
   utilisez les raccourcis **Tous**, **En ligne** et un par tag ; les comptes déjà cochés dans la page
   Comptes sont pré-cochés.
2. **Suivant** : s'il a des réglages, le formulaire s'ouvre (prérempli avec vos derniers choix sur ce
   serveur), puis **Lancer**.

Les chaînes, les enregistrements et les kits se lancent de la même façon.

Un plugin peut être **réservé à certains serveurs** (comme les plugins faits pour un serveur précis) :
il n'apparaît alors que quand vous travaillez sur l'un d'eux.

- **Officiel** : un plugin fourni et mis à jour par l'auteur de Kairn. Il s'installe tout seul et
  ne se modifie pas (ses mises à jour le remplaceraient).
- **IA** : le plugin utilise l'IA locale (voir [Accès IA](ia.html#ia-locale-pour-les-plugins)).
- **Nouveau plugin** crée un dossier avec un exemple commenté ; **Dossier des plugins** l'ouvre.
  Voir [Écrire un plugin](plugins.html).

## Lancements

La page **Lancements** montre tout ce qui a été lancé depuis l'ouverture de Kairn : statut
(En cours, En pause, Terminé, Échec, Arrêté…), comptes connectés, avancement, journal.

- **Pause** / **Reprendre**, **Arrêter** ;
- certains scripts permettent de **passer** un compte en cours ;
- un script peut **poser une question** : elle s'affiche dans une fenêtre (choix ou réponse libre) ;
  **Plus tard** la laisse en attente dans Lancements et Activité.

Le compteur sur **Activité** indique ce qui attend votre réponse.

## Planifications

Une planification relance un plugin pour chaque compte dès que son délai est passé (par exemple
`kit:pvp`), tant que Kairn est ouvert. Créez-la avec **Planifier** sur un plugin : donnez le nom du
délai que le plugin note. La page **Planifications** montre, par compte, quand aura lieu le prochain
lancement ; un interrupteur la met en pause.

## Chaînes

Une **chaîne** enchaîne des étapes, compte par compte : rejoindre un mode de jeu, envoyer une
commande ou un message, récupérer un kit, donner des objets à un joueur, attendre, ou une action
d'un plugin. Chaque étape peut avoir une pause avant elle. Si une étape échoue pour un compte, la
chaîne passe au compte suivant. 50 étapes au plus.

## Enregistrements

Enregistrez ce que vous faites en jouant (voir [Jouer avec un compte](jouer.html#enregistrer)), puis
**rejouez-le** avec d'autres comptes : déplacements, chat, clics, blocs, menus…

- **Positions absolues** : rejoue aux mêmes coordonnées ;
- **Relatives** : décale tout de l'écart entre le bot et le point de départ de l'enregistrement.

**Modifier** permet d'ajuster le délai de chaque action ou d'en désactiver.

## Kits

La page **Kits** liste les kits du serveur. Sur les comptes choisis : **Relever les délais** (lit le
temps restant de chaque kit à menu) et **Récupérer les kits prêts**. Les kits se configurent dans le
[profil du serveur](serveurs.html#kits).
