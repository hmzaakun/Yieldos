# 🚀 Yieldos dApp

Bienvenue sur Yieldos, une application décentralisée (dApp) construite avec Next.js et Solana, permettant la gestion de stratégies de rendement (yield strategies) et l’échange de tokens de rendement via un marketplace intégré.

---

## 📜 Présentation du Contrat Principal (Yieldos)

Le contrat Yieldos, développé avec Anchor (Rust), implémente un protocole de stratégies de rendement sur Solana. Il permet aux utilisateurs de déposer des tokens dans différentes stratégies, de recevoir des tokens de rendement, de réclamer des intérêts, de retirer leur capital, et d’échanger leurs tokens de rendement sur un marketplace décentralisé.

### ⚙️ Fonctionnalités principales

#### 1️⃣ Gestion des stratégies de rendement
- 🆕 **Création de stratégie** : Un administrateur peut créer une nouvelle stratégie de rendement, en définissant le token sous-jacent, le nom, l’APY (taux d’intérêt annuel), etc.
- 💸 **Dépôt** : Les utilisateurs peuvent déposer des tokens dans une stratégie active et reçoivent en échange des tokens de rendement (yTokens).
- 💼 **Retrait** : Les utilisateurs peuvent retirer leur capital de la stratégie.
- 🎁 **Réclamation du rendement** : Les utilisateurs peuvent réclamer les intérêts générés par leur dépôt.
- 🔄 **Rachat de yTokens** : Les utilisateurs peuvent échanger leurs yTokens contre le token sous-jacent (capital + rendement).

#### 2️⃣ Marketplace décentralisé
- 🏪 **Création de marketplace** : Un administrateur peut créer un marketplace pour une stratégie donnée, avec des frais de trading personnalisés.
- 📈 **Placement d’ordres** : Les utilisateurs peuvent placer des ordres d’achat ou de vente de yTokens.
- 🤝 **Exécution de trades** : Les ordres compatibles sont appariés et exécutés automatiquement, avec gestion des frais.
- ❌ **Annulation d’ordre** : Les utilisateurs peuvent annuler leurs ordres ouverts.

#### 3️⃣ Gestion des positions utilisateurs
- 👤 Chaque utilisateur possède une position par stratégie, qui enregistre le montant déposé, les yTokens reçus, le rendement déjà réclamé, etc.

### 🛠️ Schéma de fonctionnement

1. 💸 **Dépôt** → L’utilisateur dépose des tokens dans une stratégie → reçoit des yTokens.
2. ⏳ **Accumulation du rendement** → Les yTokens représentent la part de l’utilisateur dans la stratégie et accumulent du rendement.
3. 🔄 **Marketplace** → L’utilisateur peut vendre ses yTokens à d’autres utilisateurs ou en acheter.
4. 🏦 **Retrait/Rachat** → L’utilisateur peut retirer son capital ou racheter ses yTokens pour récupérer le token sous-jacent + rendement.

---

## ⚡ Installation et utilisation

### 📦 Installation

```bash
pnpm install
```

### 🖥️ Lancer l’application web

```bash
pnpm dev
```

### 🛠️ Commandes Anchor (Solana)

- 🏗️ **Build du programme** : `pnpm anchor-build`
- 🧪 **Tests** : `pnpm anchor-test`
- 🚀 **Déploiement Devnet** : `pnpm anchor deploy --provider.cluster devnet`
- 🏁 **Lancer un validator local** : `pnpm anchor-localnet`

---

## 🗂️ Structure du projet

- `anchor/` : Contrat Solana (Anchor, Rust)
- `src/` : Application Next.js (React, TypeScript)
- `idl/` : Interface du contrat (IDL)
- `public/` : Assets statiques

---

## 🔗 Ressources

- [Anchor Framework](https://project-serum.github.io/anchor/)
- [Solana Docs](https://docs.solana.com/)

---

**Résumé** : Yieldos est une plateforme DeFi sur Solana permettant de créer, gérer et échanger des stratégies de rendement de façon décentralisée, avec un marketplace intégré pour la liquidité des tokens de rendement.
