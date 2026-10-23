---
title: Écrire un plugin
nav_order: 8
---

# Écrire un plugin

Un plugin est un dossier dans le dossier des plugins de Kairn (page **Plugins** › **Dossier des
plugins**), avec un `plugin.json` et un fichier TypeScript ou JavaScript. **Nouveau plugin** crée un
exemple commenté qui fonctionne tel quel. Le fichier `kairn.d.ts`, réécrit à chaque démarrage, décrit
toute l'API : ouvrez le dossier dans un éditeur comme VS Code pour avoir l'autocomplétion.

Les bots sont de vrais bots [mineflayer](https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md).
Seule la syntaxe TypeScript « effaçable » est acceptée (pas d'`enum` ni de `namespace`).

## plugin.json

```json
{
  "name": "Dire bonjour",
  "version": "1.0.0",
  "description": "Chaque compte dit un message puis se déconnecte.",
  "main": "index.ts",
  "settings": [
    { "key": "message", "label": "Message", "type": "text", "required": true }
  ]
}
```

- `name` (obligatoire), `version`, `description` ;
- `main` : le fichier principal (`index.ts` par défaut) ;
- `type` : `script` (par défaut) ou `profile` (voir plus bas) ;
- `settings` : un formulaire montré avant chaque lancement, prérempli avec les derniers choix pour ce
  serveur. Types `text`, `number` (`min`, `max`, `integer`), `boolean`, `select` (`options`) ; `help`
  ajoute un texte d'aide. 30 réglages au plus ;
- `ai: true` : le plugin peut utiliser l'IA locale (`ctx.ai`).

Le nom du dossier sert d'identifiant : minuscules, chiffres et tirets.

## Un script

```ts
import type { ScriptContext } from '../kairn'

export default async function (ctx: ScriptContext): Promise<void> {
  const message = String(ctx.settings['message'])
  const result = await ctx.forEachBot(async (bot) => {
    bot.chat(message)
    await ctx.sleep(2_000)
  })
  ctx.log(`${result.done.length} compte(s) ont parlé, ${result.failed.length} en échec.`)
}
```

`ctx.forEachBot` connecte chaque compte choisi, lui fait faire le travail, puis le libère ; une erreur
sur un compte n'arrête pas les autres.

### Ce que propose `ctx`

- **Comptes** : `accounts`, `connect`, `release`, `forEachBot` (en parallèle, par tag…) ;
- **Journal et questions** : `log`, `warn`, `notify`, `ask` (choix ou réponse libre), `progress` ;
- **Temps** : `sleep`, `checkpoint` (respecte Pause et Arrêter), `signal` ;
- **Objets et menus** : `items` (trouver, déposer, retirer, donner, envoyer), `menus` (ouvrir,
  attendre, cliquer) ;
- **Déplacements et échanges** : `walkTo`, `trade` ;
- **Mémoire** : `storage` (gardé d'un lancement à l'autre, par serveur), `cooldowns` (délais comme
  `kit:pvp`, que les [planifications](scripts.html#planifications) attendent), `kits` ;
- **Réglages** : `settings` ;
- **IA locale** : `ai.ask`, `ai.extract`, `ai.similar` (avec `"ai": true`).

Le détail de chaque fonction est dans `kairn.d.ts`.

## Étape de chaîne

Exportez une `action`, faite pour un compte déjà connecté ; elle devient disponible dans les
[chaînes](scripts.html#chaînes) (« Action d'un plugin ») :

```ts
export async function action(ctx: ScriptContext, bot: Bot, account: Account): Promise<void> {
  bot.chat('/spawn')
}
```

Une erreur levée fait passer la chaîne au compte suivant.

## Interception (jouer avec un compte)

Exportez `intercept` pour voir, modifier ou bloquer les paquets entre votre client et le serveur
quand vous [jouez avec un compte](jouer.html#plugins-dinterception) :

```ts
export function intercept(proxy: ProxyContext) {
  proxy.onClient('chat', (packet) => {
    if (packet.data.message === '!ping') { packet.cancel(); proxy.tell('pong') }
  })
}
```

Les gestionnaires doivent être rapides (au-delà de 20 ms, le jeu rame et c'est signalé).

## Plugin de profil

Avec `"type": "profile"`, le plugin lit ce que le serveur affiche à chaque compte (scoreboard, tab) et
en tire des champs (grade, argent…), montrés dans l'aperçu des comptes. Il se choisit dans le
[profil du serveur](serveurs.html#profil-des-comptes) et tourne dans un bac à sable : pas de
fichiers, de réseau ni d'API Kairn, 50 ms au plus, 12 champs au plus.

```ts
export function profile(affichage: ServerDisplay) {
  const ligne = (debut: string) => affichage.sidebar?.lines.find((l) => l.startsWith(debut))?.slice(debut.length).trim() ?? ''
  return { Grade: ligne('GRADE') }
}
```

Pour l'argent ou les gemmes, les [valeurs suivies](serveurs.html#valeurs-suivies) font souvent la même
chose sans code.
