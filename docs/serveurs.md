---
title: Serveurs
nav_order: 3
---

# Serveurs

Ici, vous apprenez à Kairn comment marche chaque serveur : son adresse, sa version, et tout ce qui
varie d'un serveur à l'autre (modes de jeu, kits, argent affiché…).

Choisissez le serveur sur lequel vous travaillez avec le sélecteur en haut à gauche ;
**Modifier ce serveur…** ouvre son profil.

## Ajouter un serveur

1. **Ajouter un serveur…**
2. Donnez un **nom**, l'**adresse** (port 25565 par défaut) et la **version Minecraft**. Le bouton
   **Détecter** demande sa version au serveur.
3. **Créer**.

Les réglages de cette page (modes de jeu, kits, valeurs…) apparaissent quand vous modifiez le serveur.

{: .astuce }
**Partir d'un serveur connu** (en haut du formulaire) : pour les serveurs déjà préparés, par exemple
PikaNetwork KitPvP, l'adresse, la version, les modes de jeu et les valeurs du scoreboard sont remplis
pour vous. La liste s'enrichit toute seule, sans mise à jour de Kairn.

## Ajouter des modes de jeu

Les modes du serveur (Skyblock, Factions…) et comment les rejoindre, pour qu'un bot y aille tout seul :

- **Taper une commande** (par exemple `/skyblock`) ;
- ou **Choisir dans un menu** : clic droit sur un objet (boussole…) ou une commande qui ouvre le
  menu, puis l'objet à cliquer (une partie de son nom suffit).

**Arrivée confirmée par** : un changement de serveur, un message du chat, ou rien.

{: .astuce }
Un compte peut rejoindre un mode dès sa connexion : c'est un réglage du [compte](comptes.html#les-options-du-compte).

## Récupérer ses kits automatiquement

Chaque serveur donne ses kits à sa façon : décrivez ici comment récupérer chacun.

![Réglage des kits d’un serveur](assets/serveur-kits.png)

| Réglage | Ce qu'il faut y mettre |
|---|---|
| **Pour l'obtenir** | Les étapes, dans l'ordre (voir [Les étapes](#les-étapes)). |
| **Objet du kit dans le dernier menu** et **titre de ce menu** | L'objet à cliquer et le menu où il se trouve. |
| **Puis cliquer** | Les confirmations éventuelles (« Confirmer »…). |
| **Délai si le serveur n'en affiche pas** | Le temps à attendre entre deux récupérations. |

### Essayer un kit

**Essayer sur** un compte en ligne : **Relever sans récupérer** (lit le délai restant) ou
**Récupérer**, avec un journal de ce qui s'est passé.

{: .note }
L'essai utilise le kit tel que vous l'écrivez, sans l'enregistrer.

Les kits prêts se récupèrent ensuite depuis la page [Kits](scripts.html#récupérer-les-kits), la
sélection de comptes, ou la fiche d'un compte.

## Suivre l'argent, les gemmes et autres valeurs

L'argent, les gemmes, les tokens… ne s'appellent pas pareil ni ne s'affichent au même endroit selon
les serveurs. Ces **valeurs suivies** peuvent s'afficher en colonnes dans la page Comptes. Pour chaque valeur :

- un **nom** (« Gemmes ») ;
- la **source** : le scoreboard, l'action bar, la réponse à une commande (`/money`), ou un menu ;
- le **libellé** écrit à côté de la valeur sur le serveur ;
- **nombre** (pour additionner) et **colonne du tableau** (pour l'afficher dans Comptes) ;
- pour une commande ou un menu : la lire **toutes les N minutes**.

{: .astuce }
Le plus simple : **Écran de** un compte en ligne affiche ce que voit ce compte ; cliquez sur la ligne
qui contient la valeur, Kairn la reconnaît. Un aperçu montre la valeur lue.

{: .note }
Une commande ou un menu n'est lu que quand aucun script n'utilise le compte.

## Régler les échanges entre comptes

Les commandes et textes du `/trade` du serveur, pour les scripts qui échangent des objets entre
comptes :

- commande pour demander et pour accepter (`{player}` est remplacé par le pseudo) ;
- titre de la fenêtre d'échange ;
- bouton « accepter » ;
- message de réussite.

## Afficher le profil des comptes

Un **plugin de profil** lit ce que le serveur affiche pour chaque compte (grade, île…) ; ses champs
apparaissent dans l'aperçu des comptes. Voir [Écrire un plugin](plugins.html#plugin-de-profil).

## Les étapes

Kits, menus et valeurs utilisent des **étapes**, faites dans l'ordre :

- **Commande** (`/kit`) ;
- **Clic sur un PNJ** (clic droit ou frapper), reconnu par le texte au-dessus de lui ;
- **Objet en main** (clic droit sur un objet de la barre) ;
- **Clic dans le menu** (avec, si besoin, le titre du menu attendu).

{: .note }
8 étapes au plus. La première étape ne peut pas être un clic dans un menu.

## Supprimer un serveur

**Modifier ce serveur…** › en bas, **Supprimer ce serveur…**.

{: .attention }
Ses comptes partent avec lui (avec leurs tags et mots de passe enregistrés), ainsi que ses kits,
valeurs suivies, chaînes, enregistrements et planifications ; les bots connectés sont déconnectés.
Pour garder les comptes, exportez-les avant (voir [Importer et exporter des comptes](comptes.html#importer-et-exporter-des-comptes)).

{: .note }
Kairn refuse tant qu'un lancement ou une partie utilise un de ses comptes : arrêtez-le d'abord.

## Et ensuite ?

Le serveur est prêt : [ajoutez vos comptes](comptes.html#ajouter-un-compte), puis
[récupérez leurs kits](scripts.html#récupérer-les-kits) ou lancez des [scripts](scripts.html).
