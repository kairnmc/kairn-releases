---
title: Scripts et automatisation
nav_order: 4
---

# Scripts et automatisation

Ici, vous faites agir vos comptes tout seuls : lancer des plugins, les relancer à heure fixe,
enchaîner des actions, rejouer ce que vous avez fait en jouant, récupérer les kits. Tout se trouve
dans le groupe **Scripts** du menu.

## Lancer un plugin

Un **plugin** est un script : farmer, récupérer des récompenses, échanger… La page **Plugins** les liste.

1. **Lancer** sur le plugin voulu : une fenêtre demande pour quels comptes. Cherchez par nom, ou
   utilisez les raccourcis **Tous**, **En ligne** et un par tag.
2. **Suivant** : s'il a des réglages, le formulaire s'ouvre (prérempli avec vos derniers choix sur ce
   serveur), puis **Lancer**.

{: .astuce }
Les comptes déjà cochés dans la page Comptes sont pré-cochés. Les chaînes, les enregistrements et les
kits se lancent de la même façon.

### Les étiquettes des plugins

- **Officiel** : un plugin fourni et mis à jour par l'auteur de Kairn. Il s'installe tout seul et
  ne se modifie pas (ses mises à jour le remplaceraient).
- **IA** : le plugin utilise l'IA locale (voir [Accès IA](ia.html#donner-une-ia-locale-aux-plugins)).

{: .note }
Un plugin peut être **réservé à certains serveurs** (comme les plugins faits pour un serveur précis) :
il n'apparaît alors que quand vous travaillez sur l'un d'eux.

### Créer ou supprimer un plugin

- **Nouveau plugin** crée un dossier avec un exemple commenté ; **Dossier des plugins** l'ouvre.
  Voir [Écrire un plugin](plugins.html).
- La **corbeille** d'un plugin le supprime, avec les planifications qui le lancent.

{: .note }
On ne supprime pas un plugin pendant qu'il tourne. Un plugin officiel ne se supprime pas.

## Suivre ses lancements

La page **Lancements** montre tout ce qui a été lancé depuis l'ouverture de Kairn : statut
(En cours, En pause, Terminé, Échec, Arrêté…), comptes connectés, avancement, journal.

- **Pause** / **Reprendre**, **Arrêter** ;
- certains scripts permettent de **passer** un compte en cours ;
- l'**œil** à côté d'un compte en cours montre ses menus et son inventaire en direct (voir
  [l'onglet Menus](comptes.html#longlet-menus)) ;
- un script peut **poser une question** : elle s'affiche dans une fenêtre (choix ou réponse libre) ;
  **Plus tard** la laisse en attente dans Lancements et Activité.

{: .astuce }
Le compteur sur **Activité** indique ce qui attend votre réponse.

## Plugins officiels

### Émeraudes au home

Pour **Sunaria** et **BloodSymphony** : l'argent de chaque compte devient des blocs d'émeraude, achetés
au `/shop` et rangés dans les coffres d'un home, dans le claim de la faction du compte.

À chaque **tour**, le bot achète ce que son inventaire peut porter (environ 2 300 blocs), puis le range
dans les coffres, une stack par shift-clic, toutes d'un coup. Un coffre en hauteur est atteint avec de
la terre achetée pour l'occasion, recassée ensuite.

| Réglage | Ce qu'il fait |
|---|---|
| **Home** | Le home où le bot va (`/home <nom>`). Obligatoire. |
| **Acheter avec l'argent du compte** | Décoché : range seulement les blocs que le compte porte déjà. |
| **Argent à dépenser au plus** | 0 : tout l'argent. Pour un premier essai, une petite somme. |
| **Tours achat + rangement au plus** | 0 (par défaut) : sans limite. Le compte s'arrête de lui-même sans argent, au plafond, sans coffre libre, ou après un tour sans achat ni dépôt. |
| **Distance des coffres au home** | Jusqu'où chercher les coffres (8 à 48 blocs). |
| **Terre au plus pour monter** | 0 : jamais de construction. |
| **Vérifier le claim de la faction** | Coché (par défaut) : seuls les coffres dans le claim de la faction sont remplis. |
| **Doubles coffres à cheval sur un chunk non lu** | Coché (par défaut) : un double coffre dont une moitié est dans le claim est utilisé même si le bot ne peut pas entrer dans le chunk de l'autre moitié (un mur de coffres sur la limite de deux claims). |
| **Journal détaillé** | Chaque chunk lu, chaque coffre écarté et pourquoi. À cocher si on vous demande le journal. |

{: .attention }
Décocher **Vérifier le claim** remplit aussi les coffres hors du claim (zone libre, allié) : d'autres
joueurs peuvent alors les ouvrir et prendre les émeraudes.

{: .note }
« Aucun coffre du claim de la faction autour du home » : cochez **Journal détaillé**, relancez, et
regardez les lignes « écarté » : elles disent pourquoi chaque coffre a été laissé.

## Relancer un plugin automatiquement

Une **planification** relance un plugin pour chaque compte dès que son délai est passé (par exemple
`kit:pvp`), tant que Kairn est ouvert.

1. **Planifier** sur un plugin ;
2. donnez le nom du délai que le plugin note (souvent déjà rempli par le plugin).

La page **Planifications** montre, par compte, quand aura lieu le prochain lancement ; un
interrupteur la met en pause.

{: .attention }
Un délai seul ne relance rien. Dans la fiche d'un compte (onglet **Kits**), chaque délai noté par un
plugin dit s'il est **planifié** ou **non planifié**.

## Enchaîner des actions

Une **chaîne** enchaîne des étapes, compte par compte :

- rejoindre un mode de jeu ;
- envoyer une commande ou un message ;
- récupérer un kit ;
- donner des objets à un joueur ;
- attendre ;
- ou une action d'un plugin.

Chaque étape peut avoir une pause avant elle.

{: .note }
Si une étape échoue pour un compte, la chaîne passe au compte suivant. 50 étapes au plus.

## Rejouer un enregistrement

Enregistrez ce que vous faites en jouant (voir [Jouer avec un compte](jouer.html#enregistrer-une-partie)),
puis **rejouez-le** avec d'autres comptes : déplacements, chat, clics, blocs, menus…

- **Positions absolues** : rejoue aux mêmes coordonnées ;
- **Relatives** : décale tout de l'écart entre le bot et le point de départ de l'enregistrement.

{: .astuce }
**Modifier** permet d'ajuster le délai de chaque action ou d'en désactiver.

## Récupérer les kits

La page **Kits** liste les kits du serveur. Sur les comptes choisis :

- **Relever les délais** lit le temps restant de chaque kit à menu ;
- **Récupérer les kits prêts**.

Les kits se configurent dans le [profil du serveur](serveurs.html#récupérer-ses-kits-automatiquement).

## Et ensuite ?

Pour jouer vous-même et enregistrer vos actions : [Jouer avec un compte](jouer.html). Pour écrire
votre propre plugin : [Écrire un plugin](plugins.html).
