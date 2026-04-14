Tes réponses me donnent déjà une direction nette.

Tu ne cherches pas un simple assistant. Tu cherches un runtime multi-agents persistant, local d’abord, qui découvre une opportunité, construit, mesure, apprend, puis relance. Dans ce cadre, je te conseille un orchestrateur maison, avec état durable et policy engine, puis des workers spécialisés derrière. Tu n’as pas besoin d’un leak pour le socle. Anthropic expose publiquement un Agent SDK qui reprend la même boucle agentique, les mêmes outils et la gestion de contexte de Claude Code. Claude Code expose aussi publiquement subagents, hooks, MCP et skills. OpenClaw charge des skills compatibles Agent Skills dans des dossiers SKILL.md. Vercel skills.sh et Kiro suivent eux aussi ce standard. ([Claude API Docs][1])

Ton intuition sur Opus 4.6 comme chef d’orchestre tient. Anthropic présente Opus 4.6 comme son modèle le plus intelligent pour les tâches agentiques complexes et longues. Pour les workers très outillés, la base la plus propre aujourd’hui reste la Responses API d’OpenAI, avec web search, file search, computer use, code interpreter, MCP distants et tool search sur GPT-5.4 et plus. Pour les synthèses longues, les gros dépôts, les PDF et la recherche outillée, Gemini 3.1 Pro a du sens. Pour le tri, l’extraction et le monitoring à bas coût, Gemini 3.1 Flash-Lite est logique. Et il faut bien noter que Gemini 3 Pro Preview est déjà arrêté depuis le 9 mars 2026. ([Claude][2])

Donc, mon routage par défaut serait simple. Opus 4.6 pour arbitrage, review finale et décisions ambigües. GPT-5.4 pour les boucles à outils, MCP et actions complexes. Gemini 3.1 Pro pour la synthèse longue, l’analyse de repo et les corpus volumineux. Gemini 3.1 Flash-Lite pour heartbeat, classification, extraction et surveillance. Et ton fichier “qui est meilleur à quoi” ne doit pas être écrit à la main. Il doit sortir d’un petit banc d’évaluation maison.

OpenClaw est utile, mais je le mettrais en périphérie. Pas au centre du cerveau. Sur Windows, OpenClaw supporte Windows natif et WSL2, avec WSL2 recommandé comme voie la plus stable. Il gère Telegram, les skills, les providers multiples, et peut démarrer automatiquement au reboot via tâche planifiée ou repli Startup. Je l’utiliserais pour les canaux et la couche skills. Je garderais l’orchestration, l’email critique et Stripe dans ton propre code. ([OpenClaw][3])

Pour les notifications, sur un PC local je partirais sur Telegram en long polling. Telegram impose de choisir entre getUpdates et webhooks. Les webhooks deviennent plus logiques quand tu auras une machine dédiée avec une URL publique. Pour Stripe, Payment Links plus webhooks suffisent au V0. Stripe documente aussi son CLI pour tester les webhooks en local. ([Telegram][4])

Je vois un vrai point bloquant dans ton V0 actuel. Avec tes garde-fous, le système peut découvrir, coder, rédiger, préparer une page, une offre et même un lien de paiement, mais il ne fermera presque pas la boucle revenu tant qu’aucun canal d’acquisition semi-actif n’est autorisé. Donc ton V0 doit être pensé comme “vente prête à approuver”. Niche, offre, landing page, analytics, support, lien de paiement, liste de leads, séquence d’emails en brouillon, rapport, puis feu vert humain.

Pour l’email, ton erreur 450 peut tout à fait venir d’un plafond d’envoi ou d’une politique de réputation. IONOS documente des limites horaires d’envoi, avec un message 450 quand le quota est dépassé, et d’autres erreurs 450 liées à des violations de politique. Si tu restes à 5 mails par jour au départ, tu réduis beaucoup de friction, mais je partirais quand même sur une boîte dédiée. Pas sur ta boîte principale. ([IONOS][5])

Pour la France, garde le juridique et l’outbound derrière validation humaine. La CNIL distingue clairement le B2C, consentement préalable, et le B2B, droit d’opposition. Pour vendre en ligne, les mentions obligatoires et les CGV dépendent du statut et du type de clients. L’agent peut préparer les brouillons. Il ne doit pas publier seul. ([CNIL][6])

Pour les skills tiers, je te recommande une règle dure. Tout skill externe est non fiable tant qu’il n’a pas passé ton audit. Côté OpenClaw, les installs pilotées par la Gateway passent par un scanner et les findings critiques bloquent par défaut, mais la commande openclaw skills install suit un autre chemin et télécharge simplement le dossier dans le workspace. Vercel a aussi ajouté des audits automatisés sur skills.sh. Et côté OpenAI, les appels MCP tiers demandent des approbations par défaut dans la Responses API quand le serveur le requiert. Donc ton pipeline d’audit à toi reste indispensable. Je le ferais en quatre étages, gel du commit, scan statique, lecture LLM x2, puis approbation humaine. ([OpenClaw][7])

La règle d’architecture la plus importante est celle-ci. Les agents ne doivent pas se parler librement en continu. Ils doivent s’échanger des tickets structurés, des artefacts versionnés, des logs d’outils et des verdicts. Chaque ticket porte un budget, une liste d’outils autorisés, un délai, une condition de réussite, et une politique de retry. C’est ce qui te donnera audit, reprise, fallback et contrôle.

Je partirais avec cinq rôles seulement au début. Orchestrateur. Scout marché. Builder. Growth-copie. Risk-audit. Au-delà, tu vas surtout augmenter le coût et le bruit.


[1]: https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-overview "https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-overview"
[2]: https://platform.claude.com/docs/en/release-notes/overview "https://platform.claude.com/docs/en/release-notes/overview"
[3]: https://docs.openclaw.ai/platforms/windows "https://docs.openclaw.ai/platforms/windows"
[4]: https://core.telegram.org/bots/api?utm_source=chatgpt.com "Telegram Bot API"
[5]: https://www.ionos.com/help/email/general-topics/what-are-the-mass-mailing-limits/ "https://www.ionos.com/help/email/general-topics/what-are-the-mass-mailing-limits/"
[6]: https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique "https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique"
[7]: https://openclaw.ai/blog/virustotal-partnership "https://openclaw.ai/blog/virustotal-partnership"


Je te donne la V1 que je construirais.

Architecture générale.

Je ferais un orchestrateur propriétaire, local, persistant, avec son propre état, ses propres politiques, son propre journal d’audit et ses propres files de jobs. Ensuite, je lui brancherais des runners spécialisés derrière, au lieu de laisser OpenAI, Anthropic, Google et OpenClaw boucler chacun de leur côté. La raison est simple. Si chaque runtime garde sa propre mémoire, ses propres permissions et ses propres retries, tu perds vite le contrôle. Aujourd’hui, OpenAI recommande la Responses API pour les nouveaux projets, avec web search, file search, remote MCP, tool search sur GPT-5.4+, computer use et background mode pour les tâches longues. Anthropic expose Claude Code comme bibliothèque, avec Agent SDK, subagents, skills et MCP. Codex supporte aussi MCP dans la CLI et l’IDE. ([OpenAI Développeurs][1])

Stack et runtime.

Sur ton PC Windows, je partirais sur WSL2 Ubuntu, Node 24, un daemon long vivant, puis une CLI de contrôle et Telegram comme canal principal d’alerte et d’approbation. OpenClaw supporte Windows natif et WSL2, mais recommande clairement WSL2 pour l’expérience complète. Les docs recommandent aussi Node pour la Gateway, Bun n’étant pas recommandé pour des raisons de fiabilité sur certains canaux comme Telegram. Pour du “background” propre, il vaut mieux un service utilisateur qui continue de tourner qu’un terminal laissé ouvert. ([OpenClaw][2])

Je ne mettrais pas OpenClaw au centre du cerveau. Je l’utiliserais pour les canaux, les skills, quelques automatisations et éventuellement des wake-ups. Le cœur resterait ton daemon. OpenClaw lit une config locale, gère canaux, sandboxing, outils et automation. Il expose skills, outils et plugins comme trois couches distinctes. C’est utile. Mais ses propres docs disent aussi que le modèle de confiance est celui d’un assistant personnel, pas une frontière de sécurité hostile multi-tenant. Donc, dès que tu imports des skills tiers ou des entrées vraiment non fiables, il faut séparer les domaines de confiance, idéalement jusqu’à l’utilisateur OS ou la machine. ([OpenClaw][3])

Boucle permanente.

Je garderais exactement une venture active et deux en attente. C’est assez pour garder de l’exploration, sans partir en bruit ni en coûts. La boucle serait celle-ci. Le scout découvre et délimite des sujets. L’orchestrateur score les opportunités. Une venture passe active. Le builder produit une offre, une page, un service minimal et l’instrumentation. Le growth prépare acquisition, contenu, SEO, annuaires, marketplaces et emails en brouillon. Le risk bloque ce qui touche aux zones sensibles. Puis la venture entre en observation. Si elle devient publique, qu’au moins un canal d’acquisition autorisé est lancé, et qu’au bout de 72 heures il n’y a aucun signal utile, kill automatique avec post-mortem. Pour “signal utile”, je prendrais au minimum impressions organiques, clics CTA, formulaires, réponses mail, essais de paiement ou achats test. Ça correspond bien à ton critère, on ne kill pas avant exposition réelle, on kill après exposition nulle.

Agents.

Je partirais sur cinq agents fixes seulement. Orchestrateur, scout marché, builder produit, growth, risk-ops. SEO, branding, copy, support, analytics et visuels ne seraient pas des agents persistants. Ce seraient des skills chargés à la demande par le bon agent. C’est moins cher et plus stable. Anthropic supporte explicitement le préchargement de skills dans les subagents. OpenClaw traite les skills comme des dossiers avec SKILL.md injecté dans le contexte. Vercel pousse le même standard ouvert de skills pour beaucoup d’agents. ([Claude API Docs][4])

J’ajouterais une règle dure. Les agents ne se parlent jamais librement. Ils ne s’échangent que des tickets structurés. Chaque ticket a un objectif, des critères de réussite, un budget soft, une liste d’outils autorisés, une date limite, un niveau de risque, un plan de fallback et un parent_task_id. C’est ce qui te donne arbre de délégation, replay, audit et kill propre.

Routeur de modèles.

Je réserverais Claude Opus 4.6 à l’arbitrage, à la revue finale, aux décisions ambigües et aux revues risk. Anthropic documente Opus 4.6 et Sonnet 4.6 avec contexte 1 M et adaptive thinking sur les modèles 4.6. Pour les boucles outillées, le build, les gros changements multi-fichiers et les tâches avec MCP, GPT-5.4 serait mon défaut. OpenAI le présente comme son modèle phare pour le raisonnement complexe, le code et les workflows agentiques, avec web search, file search, computer use et tool search. Pour les sous-tâches moins chères, GPT-5.4 mini. Pour la classification, l’extraction, le heartbeat, le tri, les alertes et une partie du monitoring, GPT-5.4 nano ou Gemini 3.1 Flash-Lite. Google décrit Flash-Lite comme son modèle le plus économique pour les tâches agentiques à fort volume et l’extraction simple. Pour la recherche lourde, les gros corpus, l’analyse de repo, les synthèses longues et certains jobs de recherche web, Gemini 3.1 Pro a beaucoup de sens, Google le présentant comme optimisé pour le software engineering, les workflows agentiques et l’usage précis d’outils. Et comme Gemini 3 est encore en preview, ton routage doit être piloté par evals, pas par intuition. Google précise aussi que Gemini 3 Pro Preview a été arrêté le 9 mars 2026 et pointe désormais vers Gemini 3.1 Pro Preview. ([Claude API Docs][5])

Pour les visuels, j’ajouterais un worker image séparé. Nano Banana 2, donc Gemini 3.1 Flash Image Preview, pour la vitesse et le volume. Nano Banana Pro, donc Gemini 3 Pro Image Preview, pour les visuels plus exigeants et l’édition de meilleure fidélité. Comme tu veux créer des offres, des assets et parfois des produits plus visuels, ce worker vaut la peine dès la V1. ([Google AI for Developers][6])

Je brancherais aussi un banc d’évaluation maison. Trente tâches réelles, dix recherche, dix build, cinq growth, cinq risk. Score par succès final, exactitude des outils, coût, latence et taux de reprise après erreur. Le résultat nourrit models/capabilities.yaml. Ce fichier ne doit pas être “opinionnel”. Il doit être mesuré et mis à jour. Avec GPT-5.4, tu peux en plus exploiter tool_search pour éviter d’injecter toute ta surface d’outils à chaque tour, ce qui réduit coût et latence. ([OpenAI Développeurs][7])

Codex.

Je ne prendrais pas Codex comme chef d’orchestre. Je le prendrais comme runner build. Deux usages sont très bons ici. D’abord, builder dans un worktree dédié pour implémenter, tester, vérifier et proposer un diff. Ensuite, serveur MCP derrière l’orchestrateur si tu veux l’appeler comme outil spécialisé. Codex supporte MCP dans la CLI et l’IDE, peut lui-même tourner comme serveur MCP, et protège les configs projet locales tant que le projet n’est pas de confiance. ([OpenAI Développeurs][8])

Skills.

Je garderais un format canonique unique. Un dossier par skill. SKILL.md, manifest.yaml, allowed_tools.yaml, tests, audit.json. Ensuite tu compiles ce format vers les usages des différents runners. Le point important est de ne pas tout mettre dans les skills. Vercel explique que les skills sont faits pour des workflows complets, tandis que MCP expose les outils, et leurs propres evals montrent que AGENTS.md peut mieux marcher que des skills seuls. Donc je ferais trois couches. Une couche globale, AGENTS.md, OPERATIONS.md, SECURITY.md, BRAND.md. Une couche skills, pour les workflows spécialisés, SEO, support, branding, image, Stripe, Vercel, analytics. Et une couche MCP, pour les vraies actions. ([Vercel][9])

Mémoire et arborescence.

Je ferais deux espaces. Le repo versionné, et l’état runtime hors repo. Dans le repo, agents, skills, policies, models, templates, apps, docs, tests. Hors repo, runtime/state.db, events, transcripts, costs, approvals, browser, inbox-cache, quarantine, artifact-store, secrets. Pour la mémoire lisible, memory/global et memory/ventures/<id>, avec DECISIONS.md, ASSUMPTIONS.md, LEARNINGS.md, MARKET.md, PRODUCT.md, CHANNELS.md, EXPERIMENTS.md, SUPPORT.md. Je sais que tu aimes le markdown, et je garderais ce choix pour la mémoire humaine. Mais j’ajouterais SQLite pour l’état machine. Le markdown est très bon pour relire, transmettre et versionner. Il est mauvais pour les locks, les retries, les corrélations, les coûts et les files.

J’utiliserais aussi une stratégie stricte de préfixe stable. Les fichiers globaux, les politiques, les manifests d’outils et les skills stables doivent venir avant les fichiers qui changent tout le temps, comme HEARTBEAT.md. OpenAI indique que le prompt caching peut réduire fortement latence et coûts d’entrée. OpenClaw a déjà adopté ce pattern, avec les fichiers stables avant HEARTBEAT.md pour ne pas casser le préfixe. Anthropic a en plus isolé le prompt caching par workspace depuis février 2026. Donc, un workspace par venture active est une bonne idée. ([OpenAI Développeurs][10])

Schéma d’événements.

Tous les événements partagent le même enveloppe. event_id, ts, type, venture_id, task_id, parent_task_id, actor, provider, model, prompt_hash, tool_ids, input_ref, output_ref, artifact_refs, cost_usd, latency_ms, risk_level, approval_state, retry_count, dedupe_key, tags. Les types que je mettrais dès le début sont simples. system.heartbeat, venture.scouted, venture.selected, task.created, task.started, task.completed, task.failed, task.deadletter, artifact.created, review.requested, approval.granted, approval.denied, content.published, lead.detected, payment.link.created, checkout.completed, budget.threshold.crossed, skill.import.requested, skill.audit.passed, skill.audit.failed, fallback.triggered, venture.killed, venture.archived. Avec ça, tu as timeline, audit, arbre de délégation, coûts et replay.

Garde-fous.

Je séparerais trois domaines de confiance. Domaine 1, ton code, tes skills approuvés, tes secrets. Domaine 2, le web public, les pièces jointes, les emails entrants, les pages vues par le navigateur. Domaine 3, les skills tiers, le code arbitraire et les outils nouvellement importés. Rien du domaine 3 n’exécute en accès normal tant qu’il n’est pas audité. OpenClaw rappelle que sa Gateway n’est pas une frontière de sécurité hostile multi-tenant. OpenAI recommande aussi, pour computer use, d’isoler le navigateur ou la VM, de garder l’humain dans la boucle pour les actions à fort impact, et de traiter le contenu des pages comme non fiable. ([OpenClaw][11])

En pratique, je mettrais ces règles. Profondeur de délégation maximale à 2. Six jobs actifs maximum au total. Une seule venture active. Preview deploy automatique autorisé. Promotion production soumise à approbation. Publication automatique autorisée seulement pour documentation, changelog, billets non commerciaux et contenu SEO factuel à faible risque. Tout ce qui touche aux claims commerciaux, prix, CGV, mentions légales, paiements, remboursements, achat de domaine, ads, outreach et emails sortants reste derrière approbation au début.

Skills tiers.

Ton pipeline d’import doit être dur. Version pinning, miroir local, scan statique, extraction des URLs, lecture sécurité par deux modèles, simulation en sandbox, puis approbation humaine. OpenClaw a ajouté un scan VirusTotal pour ClawHub, et Vercel a ajouté des audits automatisés pour skills.sh. C’est utile, mais pas suffisant pour ton cas, car tu veux un système autonome avec secrets réels. Je ne lancerais jamais directement un skill installé depuis le réseau dans le domaine de confiance principal. ([OpenClaw][12])

Canaux.

Pour Telegram, je démarrerais en long polling. L’API Bot officielle rappelle que getUpdates et setWebhook sont mutuellement exclusifs. Sur un PC local, le polling est plus simple. Tu passeras en webhook quand tu auras une machine dédiée avec une URL publique stable. OpenClaw sait aussi gérer Telegram, les allowlists, les groupes et les commandes natives. ([Telegram][13])

Pour l’email, je mettrais une boîte dédiée. Lecture IMAP, envoi SMTP, brouillons, réponses, outreach en brouillon uniquement au départ. Limite dure initiale, cinq mails par jour, pas plus d’un envoi toutes les quinze minutes. Si le SMTP renvoie 421 ou 450, backoff d’une heure, réduction du débit, et bascule temporaire en mode draft-only. IONOS documente des limites horaires et un 450 spécifique quand la limite d’envoi est dépassée, ainsi que d’autres 450 liés à des violations de politique. ([IONOS][14])

Pour Stripe, V1 doit rester simple. Payment Links, webhooks, pas de checkout custom au début. Stripe documente qu’un Payment Link est une URL partageable réutilisable, et que les paiements peuvent être suivis via checkout.session.completed. Stripe documente aussi la CLI pour faire arriver les événements sur un serveur local pendant le développement. Donc ton agent prépare le produit, le lien, la page, le support et le webhook, mais n’active pas sans feu vert. ([Stripe Docs][15])

Conformité France.

Je garderais le juridique et l’outbound derrière validation humaine. La CNIL rappelle qu’en B2C, la prospection par courriel exige en principe un consentement préalable, et qu’en B2B la personne doit pouvoir s’y opposer. Service-Public indique aussi qu’à compter du 19 juin 2026, les contrats conclus à distance via une interface en ligne devront proposer une fonctionnalité pour exercer la rétractation directement en ligne. Le ministère de l’Économie rappelle en plus l’obligation d’accès à un dispositif de médiation de la consommation. Donc, l’agent peut préparer CGV, mentions et emails. Il ne doit pas les publier ni les envoyer seul dans ta première version. ([CNIL][16])

Fallbacks.

Je classifierais les échecs avant toute reprise. 429, 5xx, timeouts, DNS, SMTP 450, tool timeout, policy block, mauvaise qualité, manque de sources, manque de signal. 429 et 5xx, retry avec jitter, puis autre région ou autre modèle de la même famille, puis autre fournisseur. Tool timeout, checkpoint puis reprise ciblée. Policy block, passage au risk agent, pas de retry aveugle. Mauvaise qualité, self-review puis second avis cross-provider. SMTP 450, baisse du débit puis draft-only. Toute erreur enrichit un failure card dans memory/ventures/<id>/LEARNINGS.md et déclenche une notif Telegram si elle touche email, paiement, publication ou skills.

Ordre de build.

Phase 0, deux jours. Daemon, SQLite, bus d’événements, journal de coûts, policies, CLI, Telegram, approvals. Critère de réussite, tu lances un job depuis la CLI, tu le vois dans la timeline, tu l’approuves depuis Telegram, et tout est rejouable.

Phase 1, deux jours. Routeur modèles et banc d’évaluation. Critère, trente tâches réelles, capabilities.yaml généré, choix du meilleur modèle par type de tâche.

Phase 2, trois jours. Boucle venture, scout, builder, growth, risk, une venture active, deux en attente. Critère, à partir d’un simple “trouve une opportunité”, le système produit trois ventures scorées, en sélectionne une, ouvre un backlog et génère un rapport.

Phase 3, deux jours. Runner build avec worktrees Git, tests, diff, preview deploy. Critère, le système crée une branche, modifie le code, exécute les tests, publie un preview et remonte un rapport.

Phase 4, deux jours. Recherche web, SEO, analytics, contenu non commercial auto-publiable. Critère, page publique ou preview instrumentée, événements suivis, sitemap et formulaires branchés.

Phase 5, deux jours. IMAP, SMTP, support inbox, brouillons outreach, rate limit, backoff. Critère, lecture d’un mail entrant, brouillon de réponse, envoi seulement après approbation, journal des décisions.

Phase 6, un à deux jours. Stripe Payment Links et webhooks. Critère, paiement de test complet, webhook reçu, lead ou commande créé, support branché.

Phase 7, deux jours. Registre de skills, quarantaine, audit, miroirs locaux, import approuvé. Critère, aucun skill tiers ne peut s’exécuter sans scan, double revue et approbation.

Phase 8, un jour. Règles continue, pause, kill, rapport quotidien, post-mortem automatique. Critère, une venture publique sans signal utile est tuée au bon moment et le rapport explique pourquoi.

Ce que je couperais du V1.

Pas d’accès banque. Pas d’ads automatiques. Pas d’achat de domaine. Pas d’outreach auto. Pas de publication juridique auto. Pas de vector DB. Pas de seconde machine. Pas de dix agents “experts” persistants. Les experts restent des skills. Et je ne mettrais pas Grok dans la première itération. Je le mettrais seulement dans le banc d’évaluation, après que le cœur tourne déjà.

Le point le plus important à retenir est celui-ci. Ne commence ni par Stripe, ni par les skills tiers, ni par le juridique. Commence par le daemon, l’état durable, le routeur de modèles, Telegram, les approvals, et une seule venture active. C’est ce qui transforme ton idée en machine contrôlable.

[1]: https://developers.openai.com/api/docs/guides/migrate-to-responses/ "https://developers.openai.com/api/docs/guides/migrate-to-responses/"
[2]: https://docs.openclaw.ai/platforms/windows "https://docs.openclaw.ai/platforms/windows"
[3]: https://docs.openclaw.ai/tools "https://docs.openclaw.ai/tools"
[4]: https://docs.anthropic.com/en/docs/claude-code/sub-agents "https://docs.anthropic.com/en/docs/claude-code/sub-agents"
[5]: https://docs.anthropic.com/en/release-notes/overview "https://docs.anthropic.com/en/release-notes/overview"
[6]: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview"
[7]: https://developers.openai.com/api/docs/guides/tools-tool-search/?utm_source=chatgpt.com "Tool search | OpenAI API"
[8]: https://developers.openai.com/codex/mcp "https://developers.openai.com/codex/mcp"
[9]: https://vercel.com/blog/agent-skills-explained-an-faq "https://vercel.com/blog/agent-skills-explained-an-faq"
[10]: https://developers.openai.com/api/docs/guides/prompt-caching/ "https://developers.openai.com/api/docs/guides/prompt-caching/"
[11]: https://docs.openclaw.ai/gateway/security "https://docs.openclaw.ai/gateway/security"
[12]: https://openclaw.ai/blog/virustotal-partnership "https://openclaw.ai/blog/virustotal-partnership"
[13]: https://core.telegram.org/bots/api "https://core.telegram.org/bots/api"
[14]: https://www.ionos.com/help/email/general-topics/what-are-the-mass-mailing-limits/ "https://www.ionos.com/help/email/general-topics/what-are-the-mass-mailing-limits/"
[15]: https://docs.stripe.com/api/payment-link "https://docs.stripe.com/api/payment-link"
[16]: https://www.cnil.fr/fr/la-prospection-commerciale "https://www.cnil.fr/fr/la-prospection-commerciale"
