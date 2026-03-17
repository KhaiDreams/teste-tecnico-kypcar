# Teste Técnico Kypcar - Backend

Projeto backend para o desafio técnico da Kypcar, implementando o fluxo completo de integração com a API:

1. autenticação
2. registro de webhook
3. recebimento de evento
4. consulta de veículo por placa
5. criação automática de reserva (em até 60s)

## Objetivo do sistema

Este serviço existe para consumir eventos enviados pela Kypcar e executar automaticamente o fluxo de negócio da prova.

Quando um webhook chega com a placa, a aplicação:

- valida o payload
- enfileira processamento assíncrono
- consulta o veículo na API Kypcar
- cria a reserva correspondente
- registra status e tempo do processamento

## Stack

- Node.js 22+
- TypeScript
- Fastify
- Zod
- Vitest + Supertest
- Docker / Docker Compose

## Arquitetura (resumo)

- `src/core`: tipos e contratos (ports)
- `src/application`: casos de uso (orquestração)
- `src/infra/providers/http`: integrações reais com a API Kypcar
- `src/interfaces/http`: rotas, validações e error handling

Diferenciais implementados:

- logs estruturados
- refresh automático de token
- retry com backoff para falhas temporárias
- testes automatizados
- Docker

## Endpoints da aplicação

- `GET /health`
- `POST /webhooks/kypcar`
- `GET /debug/events/:id` (debug local)

### Payload esperado no webhook

```json
{
  "plate": "ABC1234"
}
```

Observação: o `eventId` é gerado internamente e retornado no `202 Accepted`.

## Configuração (.env)

Use `.env.example` como referência.

Variáveis principais:

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `PROCESSING_TIMEOUT_MS` (default `60000`)
- `WEBHOOK_BASE_URL` (URL pública HTTPS para receber webhook real)
- `AUTO_REGISTER_WEBHOOK` (`true` registra webhook no startup)
- `KYPCAR_API_URL` (default `https://dev.api.kypcar.com`)
- `KYPCAR_HTTP_TIMEOUT_MS` (default `10000`)
- `KYPCAR_RETRY_MAX_ATTEMPTS` (default `3`)
- `KYPCAR_RETRY_BASE_DELAY_MS` (default `250`)
- `KYPCAR_EMAIL`
- `KYPCAR_PASSWORD`

## Como rodar localmente

```bash
npm install
npm run dev
```

Servidor padrão: `http://localhost:3000`

## Como rodar com Docker

```bash
docker compose up --build
```

Para rodar em background:

```bash
docker compose up --build -d
```

Para parar:

```bash
docker compose down
```

## Como validar que está funcionando

### 1) Validação de qualidade (local)

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Todos devem finalizar com sucesso.

### 2) Teste manual rápido do webhook (sem depender da Kypcar)

Com a aplicação rodando:

```bash
curl -X POST http://localhost:3000/webhooks/kypcar \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC1234"}'
```

Resposta esperada:

- status `202`
- body com `eventId`

Depois consulte o processamento:

```bash
curl http://localhost:3000/debug/events/<eventId>
```

Esperado: `status = completed` (em ambiente local, geralmente rápido).

### 3) Teste manual completo com API real da Kypcar (E2E)

1. Exponha sua aplicação local em URL pública HTTPS (ex.: Cloudflare Tunnel ou ngrok).
2. Configure no `.env`:
   - `WEBHOOK_BASE_URL=https://sua-url-publica`
   - `AUTO_REGISTER_WEBHOOK=true`
   - credenciais `KYPCAR_EMAIL/KYPCAR_PASSWORD`
3. Suba a aplicação novamente.
4. Verifique nos logs se o webhook foi registrado.
5. Aguarde um evento da Kypcar.
6. Quando o evento chegar:
   - confira logs do fluxo (webhook recebido, veículo consultado, reserva criada)
   - confirme no `/debug/events/:id` se terminou como `completed`
   - valide duração abaixo de 60 segundos

## Como testar Docker manualmente (passo a passo)

1. Build da imagem:

```bash
docker compose build
```

2. Subir container:

```bash
docker compose up -d
```

3. Ver logs:

```bash
docker compose logs -f app
```

4. Testar saúde:

```bash
curl http://localhost:3000/health
```

5. Testar webhook:

```bash
curl -X POST http://localhost:3000/webhooks/kypcar \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC1234"}'
```

6. Parar tudo:

```bash
docker compose down
```

## Scripts úteis

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## Observações práticas

- Se `AUTO_REGISTER_WEBHOOK=true`, a aplicação tenta registrar webhook no startup.
- Em `NODE_ENV=test` (ou rodando Vitest), os providers reais são desabilitados para os testes não dependerem da API externa.
- O endpoint `/debug/events/:id` é de suporte e observabilidade local.
