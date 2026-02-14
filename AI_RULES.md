# AI Development Rules - LotoExpert

Este documento define a stack tecnológica e as diretrizes de IA para o projeto.

## Tech Stack
* **Framework**: Next.js (App Router)
* **Language**: TypeScript
* **IA Engine**: Google Gemini SDK (`@google/generative-ai`)
* **Modelo**: Exclusivamente `gemini-2.0-flash-exp` (ou superior quando disponível).

## Diretrizes de IA
1. **Modelo Único**: Não implementar fallbacks para modelos inferiores (como Pro 1.0 ou Flash 1.5) a menos que explicitamente solicitado.
2. **Segurança**: Chaves de API devem ser buscadas primeiro no perfil do usuário (Supabase) via Server Actions, com fallback para variáveis de ambiente.
3. **Comunicação**: O agente deve manter uma persona de "Estrategista de Elite", utilizando termos técnicos de estatística.
4. **Integração**: Respostas que exigem ação na UI devem conter gatilhos como `[GENERATE:X]`.

## Banco de Dados & Auth
* **Auth**: Supabase Auth com persistência de perfil em `public.profiles`.
* **Database**: PostgreSQL (Supabase) com RLS habilitado em todas as tabelas.