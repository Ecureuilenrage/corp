---
batch_id: B10
title: Shared infra, auth, analytics & edge features
paths:
  - src/assistant/**
  - src/buddy/**
  - src/constants/**
  - src/query/**
  - src/services/**
  - src/tools/**
  - src/types/**
  - src/voice/**
  - src/utils/**
priority: moyenne
status: enriched
keywords:
  - services/api/client.ts
  - getAnthropicClient
  - services/api/withRetry.ts
  - oauth
  - growthbook
  - getAPIContextManagement
  - checkTokenBudget
  - voiceStreamSTT
---

# B10 - Shared infra, auth, analytics & edge features

## Resume
- Couverture: 535 fichiers / 150146 lignes.
- Ce batch se decoupe mieux en 5 sous-blocs extractibles: API transport + retry, OAuth + credentials, analytics + gates, compact/token budget, voice + edge helpers.
- Priorite 1: `src/services/api/client.ts`, `src/services/api/withRetry.ts`, `src/services/oauth/**`, `src/utils/auth.ts`, `src/services/analytics/{index,growthbook}.ts`, `src/services/compact/apiMicrocompact.ts`, `src/query/tokenBudget.ts`, `src/utils/tokenBudget.ts`.
- Priorite 2: `src/services/compact/microCompact.ts`, `src/services/voiceStreamSTT.ts`, `src/voice/voiceModeEnabled.ts`, `src/assistant/sessionHistory.ts`, `src/query/{config,deps,stopHooks}.ts`.
- Priorite 3: `src/services/voice.ts`, `src/services/voiceKeyterms.ts`, `src/buddy/**`, `src/services/api/{bootstrap,usage,filesApi,sessionIngress,referral,metricsOptOut,overageCreditGrant,ultrareviewQuota,grove}.ts`.
- Hubs les plus sensibles via le manifest: `src/utils/debug.ts` (106 dependants), `src/services/analytics/index.ts` (102), `src/utils/envUtils.ts` (82), `src/utils/log.ts` (71), `src/utils/config.ts` (48), `src/utils/messages.ts` (40), `src/utils/auth.ts` (33), `src/services/analytics/growthbook.ts` (26).
- Monolithes a traiter comme references plutot que comme premieres cibles de copie: `src/services/api/claude.ts` (69 deps internes), `src/utils/auth.ts`, `src/services/compact/compact.ts`.
- Contrats manquants dans la fuite a reconstruire avant extraction complete: `src/services/oauth/types.ts`, `src/utils/secureStorage/types.ts`, `src/types/message.ts`, `src/types/connectorText.ts`, `src/constants/querySource.ts`, `src/services/compact/cachedMicrocompact.ts`, `src/services/sessionTranscript/sessionTranscript.ts`.

## purpose
- Cartographier les briques runtime transverses les plus reutilisables sans trainer le shell complet.
- Distinguer les petits slices headless a forte valeur (`api/client.ts`, `analytics/index.ts`, `apiMicrocompact.ts`, `tokenBudget.ts`) des gros noeuds de couplage.
- Preparer des extractions futures avec fichiers exacts, symboles exacts, dependances bloquantes, feature flags et plans de copie minimaux.

## subdomains
- `API transport + retry`: `src/services/api/{client,withRetry,errors,errorUtils,logging}.ts`, `src/services/claudeAiLimits.ts`, puis `src/services/api/claude.ts` comme reference lourde.
- `OAuth + credentials`: `src/services/oauth/**`, `src/constants/oauth.ts`, `src/utils/{auth,authFileDescriptor,authPortable}.ts`, `src/utils/secureStorage/**`.
- `Analytics + feature gates`: `src/services/analytics/**`, `src/constants/keys.ts`.
- `Context compaction + token budget`: `src/services/compact/**`, `src/query/{config,deps,tokenBudget,stopHooks}.ts`, `src/utils/tokenBudget.ts`.
- `Voice + edge helpers`: `src/services/{voiceStreamSTT,voice,voiceKeyterms}.ts`, `src/voice/voiceModeEnabled.ts`, `src/assistant/sessionHistory.ts`, `src/buddy/**`.

## entrypoints
- `src/services/api/client.ts#getAnthropicClient`
- `src/services/api/withRetry.ts#withRetry`
- `src/services/api/claude.ts#queryModelWithStreaming`
- `src/services/oauth/index.ts#OAuthService`
- `src/services/oauth/client.ts#buildAuthUrl`
- `src/services/analytics/index.ts#attachAnalyticsSink`
- `src/services/analytics/growthbook.ts#initializeGrowthBook`
- `src/services/compact/apiMicrocompact.ts#getAPIContextManagement`
- `src/query/tokenBudget.ts#createBudgetTracker`
- `src/query/config.ts#buildQueryConfig`
- `src/query/deps.ts#productionDeps`
- `src/query/stopHooks.ts#handleStopHooks`
- `src/voice/voiceModeEnabled.ts#isVoiceModeEnabled`
- `src/services/voiceStreamSTT.ts#connectVoiceStream`
- `src/assistant/sessionHistory.ts#createHistoryAuthCtx`

## key files
- `src/services/api/client.ts` - provider-aware Anthropic client factory, headers, proxy and OAuth/API-key refresh seam.
- `src/services/api/withRetry.ts` - retry/backoff/fallback loop, OAuth/AWS/GCP cache invalidation, 529/429 handling.
- `src/services/api/claude.ts` - 3419 lignes; central API orchestration monolith, useful for behavior reference but expensive to extract.
- `src/constants/oauth.ts` - all OAuth URLs, scopes, `OAUTH_BETA_HEADER`, URL override allowlist, client config switch.
- `src/services/oauth/client.ts` - code->token exchange, refresh, account/profile bootstrap, org UUID lookup.
- `src/services/oauth/index.ts` - PKCE/browser/manual flow orchestrator.
- `src/utils/auth.ts` - 2002 lignes; auth hub for API key helpers, OAuth persistence, AWS/GCP refresh, subscriber/account checks.
- `src/utils/authFileDescriptor.ts` - CCR/remote token bridge via file descriptors and well-known files.
- `src/services/analytics/index.ts` - 173 lignes / 102 dependants; queue-first analytics bus with no internal deps.
- `src/services/analytics/growthbook.ts` - 1155 lignes / 26 dependants; cached GrowthBook runtime, auth-aware refresh, config overrides.
- `src/services/compact/apiMicrocompact.ts` - smallest native context-management slice.
- `src/query/tokenBudget.ts` + `src/utils/tokenBudget.ts` - lightweight token-budget guard with very low coupling.
- `src/services/compact/microCompact.ts` - medium-size tool-output trimming layer; dynamic dependency on missing `cachedMicrocompact.ts`.
- `src/services/voiceStreamSTT.ts` - OAuth-backed WebSocket speech-to-text client with GrowthBook gate.
- `src/assistant/sessionHistory.ts` - small session event pager built on top of BYOC/CCR auth headers.

## feature inventory
- `anthropic_client_factory`: core `src/services/api/client.ts`; reuse haute; coupling moyenne; best API slice if auth/session headers become adapters.
- `api_retry_policy`: core `src/services/api/withRetry.ts`; reuse haute; coupling moyenne; valuable retry/backoff/fallback logic without copying full `claude.ts`.
- `oauth_pkce_flow`: core `src/services/oauth/{index,auth-code-listener,crypto,client,getOauthProfile}.ts` + `src/constants/oauth.ts`; reuse haute; coupling moyenne; blocked by missing `src/services/oauth/types.ts`.
- `oauth_secure_storage`: core `src/utils/secureStorage/**`, `src/utils/authFileDescriptor.ts`, `src/utils/authPortable.ts`; reuse haute; coupling moyenne; good credentials bridge if local storage contract is rebuilt.
- `analytics_gate_runtime`: core `src/services/analytics/{index,growthbook,config,sink,sinkKillswitch}.ts` + `src/constants/keys.ts`; reuse haute; coupling moyenne.
- `api_context_management`: core `src/services/compact/apiMicrocompact.ts`; reuse haute; coupling faible; smallest extractible compaction slice.
- `token_budget_guard`: core `src/query/tokenBudget.ts`, `src/utils/tokenBudget.ts`; reuse haute; coupling faible; almost standalone.
- `context_microcompact`: core `src/services/compact/{microCompact,grouping,timeBasedMCConfig}.ts`; reuse moyenne a haute; coupling moyenne; blocked by `querySource.ts`, `types/message.ts`, optional cached MC module.
- `voice_stream_client`: core `src/services/voiceStreamSTT.ts`, `src/voice/voiceModeEnabled.ts`, `src/services/voiceKeyterms.ts`; reuse moyenne; coupling moyenne.
- `session_history_pager`: core `src/assistant/sessionHistory.ts`; reuse moyenne; coupling faible a moyenne; small remote session helper if `utils/teleport/api.ts` already exists.
- `buddy_companion`: core `src/buddy/{companion,prompt}.ts`; reuse faible a moyenne; coupling faible; purely secondary/cosmetic.
- `api_satellites`: `src/services/api/{bootstrap,usage,filesApi,sessionIngress,referral,metricsOptOut,overageCreditGrant,ultrareviewQuota,grove}.ts`; priority secondaire; wrappers around the same client/auth stack.

## symbol map

### API transport
- `src/services/api/client.ts`: `getAnthropicClient`, `CLIENT_REQUEST_ID_HEADER`, internal `buildFetch`.
- `src/services/api/withRetry.ts`: `BASE_DELAY_MS`, `CannotRetryError`, `FallbackTriggeredError`, `withRetry`, `getRetryDelay`, `parseMaxTokensContextOverflowError`, `is529Error`, `getDefaultMaxRetries`.
- `src/services/api/claude.ts`: `getExtraBodyParams`, `getPromptCachingEnabled`, `configureTaskBudgetParams`, `getAPIMetadata`, `verifyApiKey`, `queryModelWithoutStreaming`, `queryModelWithStreaming`, `executeNonStreamingRequest`, `stripExcessMediaItems`, `cleanupStream`, `updateUsage`, `accumulateUsage`, `addCacheBreakpoints`, `buildSystemPromptBlocks`, `queryHaiku`, `queryWithModel`, `MAX_NON_STREAMING_TOKENS`, `adjustParamsForNonStreaming`, `getMaxOutputTokensForModel`.
- `src/services/api/logging.ts`: `logAPIQuery`, `logAPIError`, `logAPISuccessAndDuration`.
- `src/services/api/errors.ts`: `API_ERROR_MESSAGE_PREFIX`, `PROMPT_TOO_LONG_ERROR_MESSAGE`, `parsePromptTooLongTokenCounts`, `getPromptTooLongTokenGap`, `isMediaSizeErrorMessage`, `getAssistantMessageFromError`, `classifyAPIError`.
- `src/services/api/errorUtils.ts`: `extractConnectionErrorDetails`, `getSSLErrorHint`, `sanitizeAPIError`, `formatAPIError`.
- `src/services/claudeAiLimits.ts`: `getRateLimitDisplayName`, `getRawUtilization`, `statusListeners`, `emitStatusChange`, `extractQuotaStatusFromHeaders`, `extractQuotaStatusFromError`.

### OAuth + credentials
- `src/constants/oauth.ts`: `fileSuffixForOauthConfig`, `CLAUDE_AI_INFERENCE_SCOPE`, `CLAUDE_AI_PROFILE_SCOPE`, `OAUTH_BETA_HEADER`, `CONSOLE_OAUTH_SCOPES`, `CLAUDE_AI_OAUTH_SCOPES`, `ALL_OAUTH_SCOPES`, `MCP_CLIENT_METADATA_URL`, `getOauthConfig`.
- `src/services/oauth/index.ts`: class `OAuthService`, methods `startOAuthFlow`, `handleManualAuthCodeInput`, `cleanup`.
- `src/services/oauth/auth-code-listener.ts`: class `AuthCodeListener`, methods `start`, `waitForAuthorization`, `handleSuccessRedirect`, `handleErrorRedirect`, `close`.
- `src/services/oauth/crypto.ts`: `generateCodeVerifier`, `generateCodeChallenge`, `generateState`.
- `src/services/oauth/client.ts`: `shouldUseClaudeAIAuth`, `parseScopes`, `buildAuthUrl`, `exchangeCodeForTokens`, `refreshOAuthToken`, `fetchAndStoreUserRoles`, `createAndStoreApiKey`, `isOAuthTokenExpired`, `fetchProfileInfo`, `getOrganizationUUID`, `populateOAuthAccountInfoIfNeeded`, `storeOAuthAccountInfo`.
- `src/services/oauth/getOauthProfile.ts`: `getOauthProfileFromApiKey`, `getOauthProfileFromOauthToken`.
- `src/utils/auth.ts`: `isAnthropicAuthEnabled`, `getAuthTokenSource`, `getAnthropicApiKey`, `getAnthropicApiKeyWithSource`, `getConfiguredApiKeyHelper`, `getApiKeyFromApiKeyHelper`, `clearApiKeyHelperCache`, `refreshAndGetAwsCredentials`, `clearAwsCredentialsCache`, `checkGcpCredentialsValid`, `refreshGcpCredentialsIfNeeded`, `clearGcpCredentialsCache`, `getApiKeyFromConfigOrMacOSKeychain`, `saveApiKey`, `removeApiKey`, `saveOAuthTokensIfNeeded`, `getClaudeAIOAuthTokens`, `clearOAuthTokenCache`, `handleOAuth401Error`, `getClaudeAIOAuthTokensAsync`, `checkAndRefreshOAuthTokenIfNeeded`, `isClaudeAISubscriber`, `hasProfileScope`, `getOauthAccountInfo`, `validateForceLoginOrg`.
- `src/utils/authFileDescriptor.ts`: `CCR_OAUTH_TOKEN_PATH`, `CCR_API_KEY_PATH`, `CCR_SESSION_INGRESS_TOKEN_PATH`, `maybePersistTokenForSubprocesses`, `readTokenFromWellKnownFile`, `getOAuthTokenFromFileDescriptor`, `getApiKeyFromFileDescriptor`.
- `src/utils/authPortable.ts`: `maybeRemoveApiKeyFromMacOSKeychainThrows`, `normalizeApiKeyForConfig`.
- `src/utils/secureStorage/index.ts`: `getSecureStorage`.
- `src/utils/secureStorage/fallbackStorage.ts`: `createFallbackStorage`.
- `src/utils/secureStorage/plainTextStorage.ts`: `plainTextStorage`.
- `src/utils/secureStorage/macOsKeychainHelpers.ts`: `CREDENTIALS_SERVICE_SUFFIX`, `getMacOsKeychainStorageServiceName`, `getUsername`, `KEYCHAIN_CACHE_TTL_MS`, `clearKeychainCache`, `primeKeychainCacheFromPrefetch`.
- `src/utils/secureStorage/macOsKeychainStorage.ts`: `macOsKeychainStorage`, `isMacOsKeychainLocked`.
- `src/utils/secureStorage/keychainPrefetch.ts`: `startKeychainPrefetch`, `ensureKeychainPrefetchCompleted`, `getLegacyApiKeyPrefetchResult`, `clearLegacyApiKeyPrefetch`.

### Analytics + gates
- `src/services/analytics/index.ts`: `stripProtoFields`, `attachAnalyticsSink`, `logEvent`, `logEventAsync`, `_resetForTesting`.
- `src/services/analytics/growthbook.ts`: `GrowthBookUserAttributes`, `onGrowthBookRefresh`, `hasGrowthBookEnvOverride`, `getAllGrowthBookFeatures`, `getGrowthBookConfigOverrides`, `setGrowthBookConfigOverride`, `clearGrowthBookConfigOverrides`, `getApiBaseUrlHost`, `initializeGrowthBook`, `getFeatureValue_DEPRECATED`, `getFeatureValue_CACHED_MAY_BE_STALE`, `getFeatureValue_CACHED_WITH_REFRESH`, `checkStatsigFeatureGate_CACHED_MAY_BE_STALE`, `checkSecurityRestrictionGate`, `checkGate_CACHED_OR_BLOCKING`, `refreshGrowthBookAfterAuthChange`, `resetGrowthBook`, `refreshGrowthBookFeatures`, `setupPeriodicGrowthBookRefresh`, `stopPeriodicGrowthBookRefresh`, `getDynamicConfig_BLOCKS_ON_INIT`, `getDynamicConfig_CACHED_MAY_BE_STALE`.
- `src/services/analytics/sink.ts`: `initializeAnalyticsGates`, `initializeAnalyticsSink`.
- `src/services/analytics/sinkKillswitch.ts`: type `SinkName`, `isSinkKilled`.
- `src/services/analytics/config.ts`: `isAnalyticsDisabled`, `isFeedbackSurveyDisabled`.
- `src/services/analytics/metadata.ts`: `sanitizeToolNameForAnalytics`, `isToolDetailsLoggingEnabled`, `isAnalyticsToolDetailsLoggingEnabled`, `mcpToolDetailsForAnalytics`, `extractMcpToolDetails`, `extractSkillName`, `getEventMetadata`, `to1PEventFormat`.
- `src/constants/keys.ts`: `getGrowthBookClientKey`.

### Compact + token budget
- `src/services/compact/apiMicrocompact.ts`: `ContextEditStrategy`, `ContextManagementConfig`, `getAPIContextManagement`.
- `src/services/compact/autoCompact.ts`: `getEffectiveContextWindowSize`, `AutoCompactTrackingState`, `AUTOCOMPACT_BUFFER_TOKENS`, `WARNING_THRESHOLD_BUFFER_TOKENS`, `ERROR_THRESHOLD_BUFFER_TOKENS`, `MANUAL_COMPACT_BUFFER_TOKENS`, `getAutoCompactThreshold`, `calculateTokenWarningState`, `isAutoCompactEnabled`, `shouldAutoCompact`, `autoCompactIfNeeded`.
- `src/services/compact/microCompact.ts`: `TIME_BASED_MC_CLEARED_MESSAGE`, `consumePendingCacheEdits`, `getPinnedCacheEdits`, `pinCacheEdits`, `markToolsSentToAPIState`, `resetMicrocompactState`, `estimateMessageTokens`, `PendingCacheEdits`, `MicrocompactResult`, `microcompactMessages`, `evaluateTimeBasedTrigger`.
- `src/services/compact/compact.ts`: `POST_COMPACT_MAX_FILES_TO_RESTORE`, `POST_COMPACT_TOKEN_BUDGET`, `POST_COMPACT_MAX_TOKENS_PER_FILE`, `POST_COMPACT_MAX_TOKENS_PER_SKILL`, `POST_COMPACT_SKILLS_TOKEN_BUDGET`, `stripImagesFromMessages`, `stripReinjectedAttachments`, `ERROR_MESSAGE_NOT_ENOUGH_MESSAGES`, `truncateHeadForPTLRetry`, `ERROR_MESSAGE_PROMPT_TOO_LONG`, `CompactionResult`, `RecompactionInfo`, `buildPostCompactMessages`, `annotateBoundaryWithPreservedSegment`, `mergeHookInstructions`, `compactConversation`, `partialCompactConversation`, `createCompactCanUseTool`, `createPostCompactFileAttachments`, `createPlanAttachmentIfNeeded`, `createSkillAttachmentIfNeeded`, `createPlanModeAttachmentIfNeeded`, `createAsyncAgentAttachmentsIfNeeded`.
- `src/services/compact/prompt.ts`: `getPartialCompactPrompt`, `getCompactPrompt`, `formatCompactSummary`, `getCompactUserSummaryMessage`.
- `src/services/compact/grouping.ts`: `groupMessagesByApiRound`.
- `src/services/compact/sessionMemoryCompact.ts`: `SessionMemoryCompactConfig`, `DEFAULT_SM_COMPACT_CONFIG`, `setSessionMemoryCompactConfig`, `getSessionMemoryCompactConfig`, `resetSessionMemoryCompactConfig`, `hasTextBlocks`, `adjustIndexToPreserveAPIInvariants`.
- `src/services/compact/timeBasedMCConfig.ts`: `TimeBasedMCConfig`, `getTimeBasedMCConfig`.
- `src/query/tokenBudget.ts`: `BudgetTracker`, `createBudgetTracker`, `TokenBudgetDecision`, `checkTokenBudget`.
- `src/query/config.ts`: `QueryConfig`, `buildQueryConfig`.
- `src/query/deps.ts`: `QueryDeps`, `productionDeps`.
- `src/query/stopHooks.ts`: `handleStopHooks`.
- `src/utils/tokenBudget.ts`: `parseTokenBudget`, `findTokenBudgetPositions`, `getBudgetContinuationMessage`.

### Voice + secondary edge helpers
- `src/voice/voiceModeEnabled.ts`: `isVoiceGrowthBookEnabled`, `hasVoiceAuth`, `isVoiceModeEnabled`.
- `src/services/voiceStreamSTT.ts`: `FINALIZE_TIMEOUTS_MS`, `VoiceStreamCallbacks`, `FinalizeSource`, `VoiceStreamConnection`, `isVoiceStreamAvailable`, `connectVoiceStream`.
- `src/services/voice.ts`: `_resetArecordProbeForTesting`, `_resetAlsaCardsForTesting`, `checkVoiceDependencies`, `RecordingAvailability`, `requestMicrophonePermission`, `checkRecordingAvailability`, `startRecording`, `stopRecording`.
- `src/services/voiceKeyterms.ts`: `splitIdentifier`, `getVoiceKeyterms`.
- `src/assistant/sessionHistory.ts`: `HISTORY_PAGE_SIZE`, `HistoryPage`, `HistoryAuthCtx`, `createHistoryAuthCtx`, `fetchLatestEvents`, `fetchOlderEvents`.
- `src/buddy/companion.ts`: `Roll`, `roll`, `rollWithSeed`, `companionUserId`, `getCompanion`.
- `src/buddy/prompt.ts`: `companionIntroText`, `getCompanionIntroAttachment`.

## dependency map
- `Anthropic client factory`: internal deps `src/utils/{auth,http,proxy,debug,envUtils}.ts`, `src/utils/model/{model,providers}.ts`, `src/bootstrap/state.ts`, `src/constants/oauth.ts`; external deps `@anthropic-ai/sdk`, `google-auth-library`; provider branches direct API, Bedrock, Foundry, Vertex.
- `API retry policy`: internal deps `src/utils/{auth,debug,envUtils,errors,fastMode,log,proxy}.ts`, `src/utils/model/model.ts`, `src/services/analytics/{index,growthbook}.ts`, `src/services/api/{errors,errorUtils}.ts`, missing `src/constants/querySource.ts`; external deps Anthropic SDK error classes.
- `OAuth PKCE flow`: internal deps `src/constants/oauth.ts`, `src/services/oauth/{client,auth-code-listener,crypto,getOauthProfile}.ts`, `src/utils/{browser,auth,config,debug}.ts`; external deps `axios`, localhost callback server; blocker `src/services/oauth/types.ts` absent.
- `OAuth credentials storage`: internal deps `src/utils/secureStorage/**`, `src/utils/authFileDescriptor.ts`, `src/utils/authPortable.ts`, `src/bootstrap/state.ts`, `src/utils/{envUtils,errors,fsOperations}.ts`; external deps macOS keychain / `security`; blocker `src/utils/secureStorage/types.ts` absent.
- `Analytics gate runtime`: internal deps `src/services/analytics/index.ts`, `src/constants/keys.ts`, `src/bootstrap/state.ts`, `src/utils/{config,debug,errors,http,log,signal,slowOperations,user}.ts`; external deps `@growthbook/growthbook`; gates include disk cache, env override, periodic refresh, auth-aware reinit.
- `API context management`: internal deps `src/services/compact/apiMicrocompact.ts`, tool-name constants from `src/tools/*`, `src/utils/envUtils.ts`; no external deps beyond API schema.
- `Token budget guard`: internal deps `src/query/tokenBudget.ts`, `src/utils/tokenBudget.ts`; no external deps; best low-coupling slice in the batch.
- `Microcompact layer`: internal deps `src/services/analytics/index.ts`, `src/services/api/promptCacheBreakDetection.ts`, `src/services/tokenEstimation.ts`, `src/utils/shell/shellToolUtils.ts`, missing `src/constants/querySource.ts`, missing optional `src/services/compact/cachedMicrocompact.ts`, missing `src/types/message.ts`.
- `Full compact summarizer`: internal deps `src/utils/{attachments,messages,settings}.ts`, `src/services/api/claude.ts`, `src/services/compact/sessionMemoryCompact.ts`, missing `src/services/sessionTranscript/sessionTranscript.ts`; high-coupling and expensive.
- `Voice stream client`: internal deps `src/constants/oauth.ts`, `src/utils/{auth,debug,http,log,mtls,proxy,slowOperations}.ts`, `src/services/analytics/growthbook.ts`; external deps `ws`; gates `VOICE_MODE`, `tengu_amber_quartz_disabled`, `tengu_cobalt_frost`.
- `Session history pager`: internal deps `src/utils/teleport/api.ts`, `src/constants/oauth.ts`, `src/entrypoints/agentSdkTypes.ts`; external deps `axios`; small if BYOC auth helpers are already present.
- `Central hubs feeding many slices`: `src/utils/debug.ts`, `src/utils/envUtils.ts`, `src/utils/log.ts`, `src/utils/config.ts`, `src/utils/messages.ts`, `src/utils/auth.ts`.

## hubs to watch first
- `src/services/analytics/index.ts` - 102 dependants / 0 deps internes; safest reusable bus and a hidden fan-out hub.
- `src/utils/debug.ts` - 106 dependants; crosses API, OAuth, analytics, voice and tooling.
- `src/utils/envUtils.ts` - 82 dependants; central env/region/helper seam used by API client, auth and query config.
- `src/utils/log.ts` - 71 dependants; shared error/reporting surface used by runtime services.
- `src/utils/config.ts` - 48 dependants / 33 deps; global config hub pulled into OAuth, GrowthBook and many side services.
- `src/utils/messages.ts` - 40 dependants / 55 deps; very large message-contract sink that blocks clean API/compact extraction.
- `src/utils/auth.ts` - 33 dependants / 28 deps; auth monolith bridging API keys, OAuth, cloud creds and subscriber metadata.
- `src/services/analytics/growthbook.ts` - 26 dependants; gate cache used by query, voice, analytics and feature rollout logic.
- `src/services/api/claude.ts` - only 5 dependants, but 69 internal deps and wide symbol surface; extraction blast radius is high.
- `src/services/oauth/client.ts` - 5 dependants / 6 deps; good seam once missing types are reconstructed.

## data flow
- Query/runtime path: `src/query/deps.ts` -> `src/services/api/claude.ts` -> `src/services/api/client.ts` -> `src/utils/auth.ts` -> provider-specific fetch + `src/services/api/withRetry.ts` -> `src/services/api/{logging,errors}.ts` -> `src/services/claudeAiLimits.ts`.
- Login path: `src/services/oauth/index.ts` -> `src/services/oauth/auth-code-listener.ts` + `src/services/oauth/client.ts` + `src/constants/oauth.ts` -> tokens/profile -> `src/utils/auth.ts` + `src/utils/secureStorage/**` + `src/utils/authFileDescriptor.ts`.
- Analytics path: callers -> `src/services/analytics/index.ts` queue -> `src/services/analytics/sink.ts` -> Datadog / 1P logger, while gates resolve through `src/services/analytics/growthbook.ts`.
- Compact path: prompt text -> `src/utils/tokenBudget.ts` -> `src/query/tokenBudget.ts`; request context trimming -> `src/services/compact/apiMicrocompact.ts` and `src/services/compact/microCompact.ts`; full summarization fallback -> `src/services/compact/compact.ts`.
- Voice path: `src/voice/voiceModeEnabled.ts` checks auth + gate -> `src/services/voiceStreamSTT.ts` opens WS -> `src/services/voice.ts` records local audio -> `src/services/voiceKeyterms.ts` injects repo/git keyterms.
- Remote history path: `src/assistant/sessionHistory.ts` -> `src/utils/teleport/api.ts` -> OAuth headers -> `/v1/sessions/:id/events`.
- Buddy path: `src/buddy/companion.ts` + `src/buddy/prompt.ts` stay almost isolated and are low priority.

## external deps
- `@anthropic-ai/sdk` for API client and error classes.
- `google-auth-library` for Vertex/GCP auth.
- `axios` for OAuth/profile/session-history HTTP helpers.
- `@growthbook/growthbook` for cached feature gates.
- `ws` for voice stream STT.
- AWS Bedrock, Azure Foundry and Vertex AI branches inside `src/services/api/client.ts`.
- macOS keychain / `security` CLI in `src/utils/secureStorage/**`.

## flags/env
- Provider/auth envs in `src/services/api/client.ts`: `ANTHROPIC_API_KEY`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION`, `ANTHROPIC_FOUNDRY_RESOURCE`, `ANTHROPIC_FOUNDRY_BASE_URL`, `ANTHROPIC_FOUNDRY_API_KEY`, `CLOUD_ML_REGION`, `ANTHROPIC_VERTEX_PROJECT_ID`.
- OAuth config/envs in `src/constants/oauth.ts`: `CLAUDE_CODE_CUSTOM_OAUTH_URL`, `USE_LOCAL_OAUTH`, `USE_STAGING_OAUTH`, plus runtime client-id selection via `getOauthConfig()`.
- Remote credential bridge env in `src/utils/authFileDescriptor.ts`: `CLAUDE_CODE_REMOTE`.
- Retry/fast-mode envs in `src/services/api/withRetry.ts` and `src/query/config.ts`: `UNATTENDED_RETRY`, `CLAUDE_CODE_UNATTENDED_RETRY`, `CLAUDE_CODE_DISABLE_FAST_MODE`, `CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES`.
- Compaction gates: `TOKEN_BUDGET`, `CACHED_MICROCOMPACT`, `PROMPT_CACHE_BREAK_DETECTION`.
- Analytics/growthbook envs: `CLAUDE_INTERNAL_FC_OVERRIDES`, kill-switch config `tengu_frond_boric`, datadog gate `tengu_log_datadog_events`.
- Voice gates: `VOICE_MODE`, `tengu_amber_quartz_disabled`, `tengu_cobalt_frost`.
- Query/runtime contract to rebuild from missing file: `src/constants/querySource.ts`.

## reusable ideas
- Split B10 around adapter boundaries: auth token source, session headers, config store, analytics sink, message contract.
- Prefer extracting `src/services/api/client.ts` + `src/services/api/withRetry.ts` instead of copying `src/services/api/claude.ts`.
- Prefer extracting `src/services/analytics/index.ts` alone before taking `growthbook.ts` and sink wiring.
- Prefer `src/services/compact/apiMicrocompact.ts` + token-budget helpers before touching the full summarizer.
- Split OAuth into two slices: PKCE/browser flow and credentials storage/FD bridge.

## reusable features
- `anthropic_client_factory` - `src/services/api/client.ts`; provider-aware client factory with session/request-id headers. Reuse haute, coupling moyenne.
- `api_retry_policy` - `src/services/api/withRetry.ts`; backoff, retry, fallback-model and auth/cloud cache invalidation. Reuse haute, coupling moyenne.
- `oauth_pkce_flow` - `src/services/oauth/{index,auth-code-listener,crypto,client}.ts`; reusable OAuth browser/manual flow. Reuse haute, coupling moyenne.
- `oauth_secure_storage` - `src/utils/secureStorage/**` + `src/utils/authFileDescriptor.ts`; credentials storage bridge with CCR well-known files. Reuse haute, coupling moyenne.
- `analytics_gate_runtime` - `src/services/analytics/{index,growthbook,config,sinkKillswitch}.ts`; queue-first analytics plus cached gates. Reuse haute, coupling moyenne.
- `api_context_management` - `src/services/compact/apiMicrocompact.ts`; native `clear_tool_uses` / `clear_thinking` strategy generation. Reuse haute, coupling faible.
- `token_budget_guard` - `src/query/tokenBudget.ts` + `src/utils/tokenBudget.ts`; continue/stop heuristic for long turns. Reuse haute, coupling faible.
- `voice_stream_client` - `src/services/voiceStreamSTT.ts` + `src/voice/voiceModeEnabled.ts`; OAuth-backed WS STT client. Reuse moyenne, coupling moyenne.

## extraction recipes

### API client
- Copier d'abord `src/services/api/{client,withRetry,errorUtils,errors,logging}.ts` et `src/services/claudeAiLimits.ts`.
- Garder `src/constants/oauth.ts`, `src/utils/{http,proxy,debug,envUtils}.ts`, `src/utils/model/{model,providers}.ts` comme references directes ou en tirer des adapters.
- Remplacer par interfaces locales tout ce qui vient de `src/utils/auth.ts`, `src/bootstrap/state.ts`, `src/constants/querySource.ts`, `src/types/message.ts`.
- Ne pas commencer par `src/services/api/claude.ts`: il embarque messages, analytics, compact, quota tracking et prompt cache logic.

### OAuth stack
- Slice PKCE/browser: `src/services/oauth/{index,auth-code-listener,crypto,client,getOauthProfile}.ts` + `src/constants/oauth.ts`.
- Slice credentials: `src/utils/secureStorage/{index,fallbackStorage,keychainPrefetch,macOsKeychainHelpers,macOsKeychainStorage,plainTextStorage}.ts`, `src/utils/authFileDescriptor.ts`, `src/utils/authPortable.ts`.
- Reconstituer explicitement `src/services/oauth/types.ts` et `src/utils/secureStorage/types.ts` avant toute copie mecanique.
- Fixer des interfaces d'integration pour: ouverture navigateur, config store, secure storage, logging debug, auth headers.

### Context compaction
- Slice minimale: `src/services/compact/apiMicrocompact.ts`, `src/query/tokenBudget.ts`, `src/utils/tokenBudget.ts`.
- Slice intermediaire: ajouter `src/services/compact/{grouping,microCompact,timeBasedMCConfig}.ts`.
- Eviter au debut `src/services/compact/{compact,sessionMemoryCompact}.ts`, qui tirent `src/utils/messages.ts`, `src/utils/attachments.ts`, `src/types/message.ts` et le transcript manquant.
- Si vous voulez le cached microcompact, reconstituer aussi `src/services/compact/cachedMicrocompact.ts` et `src/constants/querySource.ts`.

### Analytics gates
- Bus seul: `src/services/analytics/index.ts`.
- Runtime de gates: ajouter `src/services/analytics/{growthbook,config,sinkKillswitch}.ts` et `src/constants/keys.ts`.
- Sinks optionnels: `src/services/analytics/{sink,datadog,firstPartyEventLogger,firstPartyEventLoggingExporter}.ts`.
- Adapter/extraire `src/utils/{config,http,user,debug,log}.ts` et `src/bootstrap/state.ts` seulement si vous avez besoin du refresh auth-aware ou des sinks distants.

### Voice STT optionnel
- Copier `src/services/voiceStreamSTT.ts`, `src/voice/voiceModeEnabled.ts`, `src/services/voiceKeyterms.ts` si vous avez deja OAuth + GrowthBook.
- N'ajouter `src/services/voice.ts` que si vous avez besoin de capture micro locale.

## minimal reusable slices
- `API client, smallest viable`: `src/services/api/client.ts`, `src/services/api/withRetry.ts`, `src/services/api/errorUtils.ts`, `src/services/api/errors.ts`, `src/constants/oauth.ts`; injecter localement auth/session headers a la place de `src/utils/auth.ts` et `src/bootstrap/state.ts`.
- `OAuth PKCE flow`: `src/services/oauth/index.ts`, `src/services/oauth/auth-code-listener.ts`, `src/services/oauth/crypto.ts`, `src/services/oauth/client.ts`, `src/constants/oauth.ts`; reconstruire `src/services/oauth/types.ts`.
- `OAuth secure storage`: `src/utils/secureStorage/**`, `src/utils/authFileDescriptor.ts`, `src/utils/authPortable.ts`; reconstruire `src/utils/secureStorage/types.ts`.
- `Context compaction minimale`: `src/services/compact/apiMicrocompact.ts`, `src/query/tokenBudget.ts`, `src/utils/tokenBudget.ts`.
- `Analytics bus only`: `src/services/analytics/index.ts`.
- `Analytics gates, medium slice`: `src/services/analytics/{index,growthbook,config,sinkKillswitch}.ts`, `src/constants/keys.ts`.
- `Voice stream, medium slice`: `src/services/voiceStreamSTT.ts`, `src/voice/voiceModeEnabled.ts`, `src/services/voiceKeyterms.ts`.

## do not copy blindly
- `src/utils/auth.ts` - melange API key helper, OAuth persistence, AWS, GCP, subscriber/account metadata et validations org.
- `src/services/api/claude.ts` - tire messages, analytics, compact, quotas, cache-break detection et `QuerySource`.
- `src/services/compact/compact.ts` - depend du transcript manquant, des attachments et des gros contrats de messages.
- `src/services/analytics/growthbook.ts` - melange cache disque, auth headers, env overrides, refresh periodique et logging 1P.
- `src/services/voiceStreamSTT.ts` - couple OAuth, proxy/TLS, GrowthBook et WebSocket; petit mais pas standalone.
- `src/services/oauth/client.ts` et `src/services/oauth/getOauthProfile.ts` - la fuite manque `./types.js`.
- `src/utils/secureStorage/**` - la fuite manque `./types.js`.
- Toute logique qui importe `src/types/message.ts`, `src/types/connectorText.ts` ou `src/constants/querySource.ts` - ces contrats doivent etre recrees avant copie.

## copy risk
- Faible: `src/services/analytics/index.ts`, `src/services/oauth/crypto.ts`, `src/query/tokenBudget.ts`, `src/utils/tokenBudget.ts`, `src/services/compact/grouping.ts`, `src/buddy/**`.
- Moyenne: `src/services/api/client.ts`, `src/services/api/withRetry.ts`, `src/services/oauth/{index,client,auth-code-listener}.ts`, `src/services/analytics/growthbook.ts`, `src/services/voiceStreamSTT.ts`, `src/assistant/sessionHistory.ts`.
- Haute: `src/utils/auth.ts`, `src/services/api/claude.ts`, `src/services/compact/{compact,sessionMemoryCompact}.ts`, `src/utils/messages.ts`.

## search hints
- `getAnthropicClient`, `withRetry`, `OAuthService`, `buildAuthUrl`, `getAPIContextManagement`, `checkTokenBudget`, `initializeGrowthBook`, `connectVoiceStream`.
- `src/services/api/client.ts`, `src/services/oauth/client.ts`, `src/services/analytics/growthbook.ts`, `src/services/compact/apiMicrocompact.ts`, `src/query/tokenBudget.ts`, `src/voice/voiceModeEnabled.ts`.

## exact search shortcuts
- `rg -n "getAnthropicClient|CLIENT_REQUEST_ID_HEADER|buildFetch" src/services/api/client.ts`
- `rg -n "withRetry|CannotRetryError|FallbackTriggeredError|getRetryDelay|is529Error" src/services/api/withRetry.ts`
- `rg -n "queryModelWithStreaming|queryModelWithoutStreaming|executeNonStreamingRequest|buildSystemPromptBlocks|addCacheBreakpoints" src/services/api/claude.ts`
- `rg -n "OAuthService|startOAuthFlow|handleManualAuthCodeInput|cleanup" src/services/oauth/index.ts`
- `rg -n "buildAuthUrl|exchangeCodeForTokens|refreshOAuthToken|populateOAuthAccountInfoIfNeeded" src/services/oauth/client.ts`
- `rg -n "AuthCodeListener|waitForAuthorization|handleSuccessRedirect|handleErrorRedirect" src/services/oauth/auth-code-listener.ts`
- `rg -n "getSecureStorage|macOsKeychainStorage|createFallbackStorage|plainTextStorage|startKeychainPrefetch" src/utils/secureStorage`
- `rg -n "getOAuthTokenFromFileDescriptor|getApiKeyFromFileDescriptor|maybePersistTokenForSubprocesses" src/utils/authFileDescriptor.ts`
- `rg -n "saveOAuthTokensIfNeeded|getClaudeAIOAuthTokens|checkAndRefreshOAuthTokenIfNeeded|validateForceLoginOrg" src/utils/auth.ts`
- `rg -n "attachAnalyticsSink|logEventAsync|stripProtoFields" src/services/analytics/index.ts`
- `rg -n "initializeGrowthBook|getFeatureValue_CACHED_MAY_BE_STALE|checkStatsigFeatureGate_CACHED_MAY_BE_STALE|checkGate_CACHED_OR_BLOCKING|refreshGrowthBookAfterAuthChange" src/services/analytics/growthbook.ts`
- `rg -n "initializeAnalyticsSink|initializeAnalyticsGates|shouldTrackDatadog" src/services/analytics/sink.ts`
- `rg -n "sanitizeToolNameForAnalytics|mcpToolDetailsForAnalytics|extractSkillName" src/services/analytics/metadata.ts`
- `rg -n "getAPIContextManagement|clear_tool_uses_20250919|clear_thinking_20251015" src/services/compact/apiMicrocompact.ts`
- `rg -n "microcompactMessages|estimateMessageTokens|evaluateTimeBasedTrigger|pinCacheEdits" src/services/compact/microCompact.ts`
- `rg -n "compactConversation|partialCompactConversation|createCompactCanUseTool|createPlanAttachmentIfNeeded" src/services/compact/compact.ts`
- `rg -n "createBudgetTracker|checkTokenBudget" src/query/tokenBudget.ts`
- `rg -n "parseTokenBudget|findTokenBudgetPositions|getBudgetContinuationMessage" src/utils/tokenBudget.ts`
- `rg -n "isVoiceModeEnabled|hasVoiceAuth|isVoiceGrowthBookEnabled" src/voice/voiceModeEnabled.ts`
- `rg -n "connectVoiceStream|isVoiceStreamAvailable|FINALIZE_TIMEOUTS_MS|tengu_cobalt_frost" src/services/voiceStreamSTT.ts`
- `rg -n "checkVoiceDependencies|checkRecordingAvailability|startRecording|stopRecording" src/services/voice.ts`
- `rg -n "getVoiceKeyterms|splitIdentifier" src/services/voiceKeyterms.ts`
- `rg -n "createHistoryAuthCtx|fetchLatestEvents|fetchOlderEvents" src/assistant/sessionHistory.ts`
- `rg -n "rollWithSeed|getCompanion|getCompanionIntroAttachment" src/buddy/companion.ts src/buddy/prompt.ts`
