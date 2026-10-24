---
title: Écrire un plugin
nav_order: 8
---

# Écrire un plugin
{: .no_toc }

Un plugin est un petit programme TypeScript (ou JavaScript) que Kairn lance sur vos comptes. Chaque
compte y est un **vrai bot [mineflayer](https://github.com/PrismarineJS/mineflayer)** : tout ce que
mineflayer sait faire, votre plugin le peut. Kairn ajoute par-dessus ce qui est pénible à écrire soi-même
(connexions, menus des serveurs, kits, délais, échanges, questions à l'utilisateur…).

{: .note }
Cette page s'adresse à ceux qui veulent écrire leur propre plugin. Pour simplement utiliser les
plugins, voir [Lancer un plugin](scripts.html#lancer-un-plugin).

**Par où commencer ?**

- Premier plugin : [Démarrer](#démarrer), puis [plugin.json](#pluginjson) et [Le script](#le-script).
- Faire agir les bots : [Utiliser mineflayer](#utiliser-mineflayer) et [Les outils de Kairn](#les-outils-de-kairn-ctx).
- Autres sortes de plugins : [Étape de chaîne](#étape-de-chaîne), [Interception](#interception-jouer-avec-un-compte),
  [Plugin de profil](#plugin-de-profil).
- Quand ça ne marche pas : [Déboguer](#déboguer) et [Bonnes pratiques](#bonnes-pratiques).

**Sommaire complet**

1. TOC
{:toc}

---

## Démarrer

Page **Plugins** › **Nouveau plugin** : Kairn crée un dossier avec un exemple qui fonctionne, et l'ouvre.
Ouvrez ce dossier (ou tout le dossier des plugins) dans **[VS Code](https://code.visualstudio.com)** :
le fichier `kairn.d.ts`, réécrit à chaque démarrage de Kairn, décrit toute l'API, et VS Code vous
propose les fonctions et leurs paramètres pendant que vous tapez.

Un plugin, c'est un dossier (son nom = son identifiant : minuscules, chiffres, tirets) :

```
plugins/
  dire-bonjour/
    plugin.json
    index.ts
```

Modifiez le fichier, enregistrez, relancez le plugin depuis Kairn : pas besoin de redémarrer l'app.

### TypeScript accepté

Les types TypeScript sont simplement retirés à l'exécution : la syntaxe « effaçable » seulement.
`interface`, `type`, annotations, `as`, génériques : oui. `enum`, `namespace`, paramètres de
constructeur `private x` : non (une erreur claire vous le dit). Du JavaScript (`.js`, `.mjs`) marche aussi.

---

## plugin.json

```json
{
  "name": "Farm de blé",
  "version": "1.0.0",
  "description": "Récolte et replante le blé autour de chaque compte.",
  "main": "index.ts",
  "settings": [
    { "key": "rayon", "label": "Rayon de récolte", "type": "number", "default": 8, "min": 2, "max": 32, "integer": true },
    { "key": "vendre", "label": "Vendre ensuite", "type": "boolean", "help": "Lance /sell all à la fin." },
    { "key": "mode", "label": "Mode", "type": "select", "options": ["rapide", "prudent"] },
    { "key": "joueur", "label": "Pseudo du compte principal", "type": "text", "required": true }
  ]
}
```

| Champ | Rôle |
|---|---|
| `name` | Nom affiché (obligatoire, 64 caractères au plus). |
| `version` | Votre numéro de version (`1.0.0` par défaut). |
| `description` | Affichée sous le nom dans Kairn. |
| `main` | Le fichier principal (`index.ts` par défaut). |
| `type` | `script` (par défaut) ou `profile` (voir [Plugin de profil](#plugin-de-profil)). |
| `settings` | Le formulaire montré avant chaque lancement (30 réglages au plus). |
| `ai` | `true` pour utiliser l'IA locale (`ctx.ai`). |
| `servers` | Les serveurs pour lesquels il est fait, ex. `["play.exemple.fr"]` ou `["*.exemple.fr"]` (le domaine et ses sous-domaines). Ailleurs, il n'apparaît pas et ne se lance pas. Absent : tous les serveurs. |
| `scheduleKey` | Le nom de délai avec lequel le planifier, ex. `"monplugin:passage"` : « Planifier » le propose déjà rempli. Le plugin note ce délai (`ctx.cooldowns.set`) pour dire quand le relancer. |

**Réglages** : types `text` (`required`), `number` (`min`, `max`, `integer`), `boolean`, `select`
(`options`) ; `default` et `help` partout. Le formulaire est prérempli avec les derniers choix faits
sur ce serveur ; le plugin les lit dans `ctx.settings`.

---

## Le script

```ts
import type { ScriptContext } from '../kairn'

export default async function (ctx: ScriptContext): Promise<void> {
  const r = await ctx.forEachBot(async (bot, account) => {
    ctx.log(`${account.username} est en ${bot.entity.position.floored()}`)
    bot.chat('Bonjour !')
    await ctx.sleep(2_000)
  })
  ctx.log(`${r.done.length} faits, ${r.failed.length} en échec, ${r.skipped.length} passés`)
}
```

`export default` reçoit `ctx`, la boîte à outils de Kairn. Le plus simple est presque toujours
`ctx.forEachBot` : il connecte chaque compte choisi (file d'attente, proxy, connexion Microsoft,
`/login`, mode de jeu par défaut : tout est géré), appelle votre fonction avec son bot, puis le
déconnecte, **même en cas d'erreur**. Un compte qui échoue est noté dans le journal et les suivants
continuent ; l'utilisateur peut aussi **passer** le compte en cours.

---

## Utiliser mineflayer

Oui : `bot` est l'objet `Bot` de mineflayer, complet. Toute sa
[documentation](https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md) s'applique.
Quelques exemples de ce que vous pouvez faire directement :

```ts
// Parler, lancer une commande
bot.chat('/spawn')

// Écouter le chat (texte sans couleurs)
bot.on('messagestr', (message) => {
  if (message.includes('Vous avez gagné')) ctx.log(`${bot.username} : ${message}`)
})

// Où il est, qui est autour
const ici = bot.entity.position                       // Vec3 : .x .y .z, .distanceTo(), .offset(), .floored()
const joueurs = Object.keys(bot.players)
const proche = bot.nearestEntity((e) => e.type === 'player')

// Regarder, bouger
await bot.lookAt(ici.offset(1, 0, 0))
bot.setControlState('forward', true)
await ctx.sleep(1_000)
bot.setControlState('forward', false)

// Blocs : trouver, casser, poser
const ble = bot.findBlock({ matching: bot.registry.blocksByName.wheat.id, maxDistance: 8 })
if (ble) await bot.dig(ble)

// Inventaire : lister, équiper, utiliser
const epee = bot.inventory.items().find((i) => i.name.includes('sword'))
if (epee) await bot.equip(epee, 'hand')
bot.activateItem()                                    // clic droit avec l'objet en main

// Vie, faim, expérience
ctx.log(`vie ${bot.health}, faim ${bot.food}, niveau ${bot.experience.level}`)
```

À savoir :

- **Ne déconnectez pas le bot vous-même** (`bot.quit()`, `bot.end()`) : laissez `forEachBot` (ou
  `ctx.release`) le faire, Kairn sait alors s'il doit le reconnecter.
- Les écouteurs (`bot.on(...)`) disparaissent avec le bot à la fin de son tour.
- `bot.registry` donne les blocs, objets et entités de la version du serveur
  (`bot.registry.itemsByName.diamond`…).
- **Se déplacer** : `ctx.walkTo` (plus bas) marche jusqu'à un point ou un joueur. Il charge
  [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) sur le bot
  (`bot.pathfinder`), réglé pour marcher seulement (ni creuser, ni poser, ni sauter).

---

## Les outils de Kairn (`ctx`)

Toutes les signatures complètes sont dans `kairn.d.ts`. Un « objet recherché » (`ItemQuery`) est une
partie de son nom affiché (`'Épée'`), ou `{ name, lore }` ; la comparaison ignore les couleurs, les
accents, les majuscules et les petites capitales des serveurs (`ᴍᴇɴᴜ`).

### Comptes

| | |
|---|---|
| `ctx.accounts` | Les comptes choisis pour ce lancement (`id`, `username`, `kind`, `tags`). |
| `ctx.forEachBot(fn, options?)` | Chaque compte tour à tour. `options.accounts` : une liste, ou `{ tag: 'farm' }` ; `options.parallel` : combien à la fois (1 par défaut). Renvoie `{ done, failed, skipped }`. |
| `ctx.connect(compte)` | Connecte un compte et renvoie son bot (pour piloter plusieurs bots ensemble). |
| `ctx.release(compte)` | Le déconnecte (et le reconnecte s'il était en ligne avant le script). |

```ts
// Deux bots en même temps : l'un donne tout à l'autre
const [alt, main] = await Promise.all([ctx.connect(ctx.accounts[0]), ctx.connect(ctx.accounts[1])])
await ctx.items.sendTo(alt, main, { keep: ['pioche', 'steak'] })
```

### Journal, questions, avancement

| | |
|---|---|
| `ctx.log(texte)` / `ctx.warn(texte)` | Une ligne dans le journal du lancement. |
| `ctx.notify(texte, { level })` | Une fenêtre dans Kairn (et une notification Windows si Kairn est en arrière-plan) ; au plus une toutes les 3 s. |
| `ctx.ask(question, options?)` | Pose une question et attend : `choices` (boutons), `input: true` (réponse libre), `timeoutMs` et `default`. |
| `ctx.progress(fait, total)` | La barre d'avancement (mise à jour toute seule avec `forEachBot`). |

```ts
if ((await ctx.ask('Vendre les diamants ?', { choices: ['Oui', 'Non'] })) === 'Oui') bot.chat('/sell diamond')
const main = await ctx.ask('Pseudo du compte principal ?', { input: true, timeoutMs: 60_000, default: 'Main' })
```

### Pause et arrêt

L'utilisateur peut mettre en pause ou arrêter votre script. Pour que ça marche :

- attendez avec **`ctx.sleep(ms)`** (pas `setTimeout`) : il respecte la pause et l'arrêt ;
- dans une longue boucle, appelez **`await ctx.checkpoint()`** à chaque tour ;
- `ctx.signal` (un `AbortSignal`) se déclenche à l'arrêt : passez-le à `fetch(url, { signal: ctx.signal })`.

### Machine à états

Pour les scripts qui enchaînent des phases (farmer, vendre, recommencer) :

```ts
await ctx.runMachine({
  initial: 'farm',
  data: { bot, ventes: 0 },
  states: {
    farm: async (d) => ((await inventairePlein(d.bot)) ? 'vendre' : 'farm'),
    vendre: async (d) => { d.bot.chat('/sell all'); d.ventes++; return d.ventes < 5 ? 'farm' : null },
  },
  trace: true, // note chaque passage dans le journal
})
```

Chaque état renvoie le suivant, ou `null` pour finir ; la pause et l'arrêt sont respectés entre deux
états ; `maxSteps` (10 000 par défaut) coupe une boucle sans fin.

### Objets

| | |
|---|---|
| `ctx.items.find(bot ou menu, objet, zone?)` | Le premier objet correspondant (`{ slot, item, name, lore }`), ou `null`. |
| `ctx.items.findAll(...)` | Tous, dans l'ordre des cases. |
| `ctx.items.name(item)` / `ctx.items.lore(item)` | Le nom affiché et la description, sans couleurs. |
| `ctx.items.deposit(bot, menu, objet, quantité?)` | Range dans le coffre ou menu ouvert ; renvoie le nombre déplacé. |
| `ctx.items.withdraw(bot, menu, objet, quantité?)` | Prend du coffre ou menu ouvert. |
| `ctx.items.give(bot, pseudo, options?)` | Marche jusqu'au joueur et jette les objets à ses pieds. |
| `ctx.items.sendTo(bot, autreBot ou pseudo, options?)` | Envoie à un autre compte (et vérifie qu'il les a ramassés si c'est un bot du script). |

Options de don : `items` (quoi), `count` (combien), `keep` (ce qu'il ne faut jamais donner).

### Menus des serveurs

```ts
const menu = await ctx.menus.open(bot, { command: '/kits' }, { title: 'Kits' })   // ou { item: 'Boussole' }
await ctx.menus.click(bot, menu, { name: 'Kit PvP', lore: 'Disponible' })
const suivant = await ctx.menus.waitFor(bot, { title: 'Confirmer' })
ctx.log(ctx.menus.title(suivant))
```

Les erreurs sont parlantes : un objet introuvable liste ceux qui étaient dans le menu, un menu qui ne
s'ouvre pas cite celui qui s'est ouvert à la place.

### Se déplacer et échanger

```ts
await ctx.walkTo(bot, { x: 100, y: 64, z: -20 })          // ou un pseudo visible : 'Steve'
await ctx.trade(alt, main, { give: { items: 'diamant', count: 32 } })
await ctx.trade(bot, 'Acheteur', {
  give: { items: 'diamant', count: 10 },
  receive: { items: 'émeraude', count: 20, type: 'emerald' }, // type obligatoire avec un joueur
})
```

`walkTo` : erreur claire si aucun chemin, au bout de 60 s par défaut (`timeoutMs`). `trade` utilise le
`/trade` réglé dans le [profil du serveur](serveurs.html#régler-les-échanges-entre-comptes) ; avec un joueur, le bot n'accepte
que si l'offre contient vraiment ce qui est demandé (un objet renommé « Diamant » ne passe pas).

### Mémoire et délais

```ts
// Gardé d'un lancement à l'autre, pour ce serveur (64 Ko par valeur, 1 Mo en tout)
const total = (ctx.storage.get('total') as number | undefined) ?? 0
ctx.storage.set('total', total + 1)

// Délais par compte, affichés dans Kairn et attendus par les planifications
if (ctx.cooldowns.ready(account, 'vote')) {
  bot.chat('/vote')
  ctx.cooldowns.set(account, 'vote', 24 * 3_600_000)
}
ctx.cooldowns.setFromText(account, 'kit:pvp', 'Disponible dans 2h 30m') // lit le délai dans un texte
```

`ctx.cooldowns` : `remaining`, `ready`, `set`, `setFromText`, `clear`, `parse` (« 1 heure 2 minutes »,
« Available in 5m 3s », « 01:59:30 »…). Une [planification](scripts.html#relancer-un-plugin-automatiquement) relance votre
plugin pour chaque compte dès que le délai qu'il a noté est passé.

### Kits

```ts
const r = await ctx.kits.claim(bot, {
  name: 'pvp',
  steps: [{ kind: 'npc', name: 'Kits' }, { kind: 'click', item: 'PvP' }],
  item: 'Kit PvP',
  confirm: ['Confirmer'],
})
if (r.status === 'claimed') ctx.log(`${r.items} objets, prochain dans ${r.nextInMs} ms`)
if (r.status === 'cooldown') ctx.log(`encore ${r.remainingMs} ms`)
```

Le délai est lu dans la description de l'objet ou dans le chat (français ou anglais) et noté sous
`kit:<nom>`. `ctx.kits.survey(bot, kits)` relève les délais de plusieurs kits sans rien récupérer.
Les kits réglés dans le profil du serveur se récupèrent aussi sans code.

### IA locale

Avec `"ai": true` et [Ollama](ia.html#donner-une-ia-locale-aux-plugins) installé :

```ts
const resume = await ctx.ai.ask('Résume ces messages : ' + lignes.join('\n'))
const vente = await ctx.ai.extract<{ prix: number; objet: string }>(message, { prix: 'number', objet: 'string' })
const meilleur = (await ctx.ai.similar('kit vote', nomsDesObjets))[0].text
```

Rien ne part sur Internet.

---

## Node.js et autres fichiers

Un plugin tourne dans Node.js, avec **tous ses modules** (`node:fs`, `node:path`, `fetch`…).

- **Vos propres fichiers** : importez-les avec leur extension : `import { calcul } from './lib/calcul.ts'`.
- **Paquets npm** : lancez `npm install <paquet>` dans le dossier du plugin ; ils s'importent alors
  normalement. Préférez les paquets en pur JavaScript.
- Les données à garder vont plutôt dans `ctx.storage` (gardé par serveur) que dans des fichiers.

---

## Étape de chaîne

Exportez une `action` en plus (ou à la place) : elle devient une étape **Action d'un plugin** dans les
[chaînes](scripts.html#enchaîner-des-actions), faite pour chaque compte, bot déjà connecté :

```ts
import type { Account, Bot, ScriptContext } from '../kairn'

export async function action(ctx: ScriptContext, bot: Bot, account: Account): Promise<void> {
  await ctx.walkTo(bot, { x: 0, y: 64, z: 0 })
  bot.chat('/is warp ferme')
}
```

Une erreur levée fait passer la chaîne au compte suivant. `ctx.settings` contient les réglages choisis
pour l'étape.

---

## Interception (jouer avec un compte)

Exportez `intercept` : quand vous [jouez avec un compte](jouer.html#ajouter-des-plugins-dinterception) et cochez
votre plugin, il voit passer les paquets entre votre Minecraft et le serveur, et peut les modifier,
les bloquer ou en envoyer.

```ts
import type { ProxyContext } from '../kairn'

export function intercept(proxy: ProxyContext) {
  // Une commande à vous, jamais envoyée au serveur
  proxy.onClient('chat', (packet) => {
    if (packet.data.message === '!pos') { packet.cancel(); proxy.tell(`Vous jouez ${proxy.account.username}`) }
  })
  // Cacher les messages de pub
  proxy.onServer('chat', (packet) => {
    if (String(packet.data.message).includes('boutique')) packet.cancel()
  })
  proxy.onEnd(() => proxy.log('partie terminée'))
}
```

- `onClient` / `onServer` : les paquets dans chaque sens (noms et champs de
  [minecraft-protocol](https://minecraft-data.prismarine.js.org/?d=protocol) pour la version du serveur) ;
  `packet.data` se modifie sur place, `packet.cancel()` le bloque.
- `sendToServer` / `sendToClient` : envoyer un paquet ; `tell(texte)` : une ligne dans votre chat.
- Les gestionnaires doivent être **synchrones et rapides** (au-delà de 20 ms le jeu rame, c'est
  signalé) ; enregistrez-les avant tout `await`.

---

## Plugin de profil

Avec `"type": "profile"`, le plugin lit ce que le serveur affiche à chaque compte et en tire des champs
(grade, île, argent…), montrés dans l'aperçu des comptes. Il se choisit dans le
[profil du serveur](serveurs.html#afficher-le-profil-des-comptes).

```ts
import type { ServerDisplay } from '../kairn'

export function profile(affichage: ServerDisplay) {
  const ligne = (debut: string) => affichage.sidebar?.lines.find((l) => l.startsWith(debut))?.slice(debut.length).trim() ?? ''
  return { Grade: ligne('GRADE'), Argent: Number(ligne('ARGENT').replace(/[^0-9]/g, '')) }
}
```

`affichage` contient le scoreboard (`sidebar.title`, `sidebar.lines`), le haut et le bas de la liste des
joueurs (`tab.header`, `tab.footer`), le nom du compte dans cette liste (`name`, souvent avec le grade)
et l'action bar (`actionBar`). Il tourne dans un bac à sable : pas de fichiers, de réseau, de minuteries
ni d'outils Kairn, 50 ms au plus, 12 champs au plus. Pour l'argent ou les gemmes, les
[valeurs suivies](serveurs.html#suivre-largent-les-gemmes-et-autres-valeurs) font souvent la même chose sans code.

---

## Déboguer

- Tout ce que vous passez à `ctx.log` / `ctx.warn`, et les erreurs avec leur message, s'affichent dans
  la carte du lancement (page **Lancements**).
- Un plugin en rouge dans la page Plugins dit pourquoi il ne peut pas se lancer (`plugin.json`
  invalide, fichier principal introuvable…).
- La **Console** d'un compte montre son chat en direct pendant que le script tourne.
- Testez d'abord sur un seul compte, puis élargissez.

## Bonnes pratiques

- Ne connectez pas trop de comptes à la fois (`parallel`) : les serveurs repèrent les rafales.
- Laissez un peu de temps entre les actions (`ctx.sleep`), comme un joueur.
- Notez les délais avec `ctx.cooldowns` : vos plugins deviennent planifiables.

{: .attention }
Un plugin a les mêmes droits que Kairn sur votre PC (fichiers, réseau). N'installez que des plugins
dont vous avez confiance en l'auteur. Les plugins **Officiel** sont signés par l'auteur de Kairn.
